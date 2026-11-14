/**
 * Headless bot observer. Runs a 4v4v4v4 battle and records goals, targets,
 * paths, attacks, opening timings, base residency and close-range passes.
 *
 * Usage: bun scripts/bot-observer.ts [ticks]
 */
import { writeFileSync } from 'node:fs'
import { createBedwarsRoom } from '../src/games/bedwars/server'
import { TPS } from '../src/games/bedwars/constants'
import type { ClientMessage } from '../src/games/bedwars/protocol'

const ticks = Math.max(200, Number(process.argv[2] ?? 60 * TPS))
const room = createBedwarsRoom({ world: 'arena', room: 'observe', teamSize: 4, fast: false, battle: true })
const passes: any[] = []
const samples: any[] = []

interface Metric {
  attacks: number
  contacts: number
  passes: number
  contact: { active: boolean; since: number; attacked: boolean; counted: boolean }
  navReplans: number
  navFailures: number
  navStuckMax: number
  navPathLength: number
  navStraight: number
  firstShop: number | null
  firstSortie: number | null
  sortieBlocks: number | null
  firstField: number | null
  firstAttack: number | null
  lastAttack: number | null
  baseTicks: number
  aliveTicks: number
  goals: Record<string, number>
}

const metrics = new Map<number, Metric>()
const metricFor = (id: number): Metric => {
  const existing = metrics.get(id)
  if (existing) return existing
  const fresh: Metric = {
    attacks: 0,
    contacts: 0,
    passes: 0,
    contact: { active: false, since: 0, attacked: false, counted: false },
    navReplans: 0,
    navFailures: 0,
    navStuckMax: 0,
    navPathLength: 0,
    navStraight: 0,
    firstShop: null,
    firstSortie: null,
    sortieBlocks: null,
    firstField: null,
    firstAttack: null,
    lastAttack: null,
    baseTicks: 0,
    aliveTicks: 0,
    goals: {},
  }
  metrics.set(id, fresh)
  return fresh
}
for (const p of room.players.values()) if (p.brain) metricFor(p.id)

const receive = room.receive.bind(room)
room.receive = (id: number, msg: ClientMessage) => {
  if (msg.t === 'attack') {
    const metric = metricFor(id)
    metric.attacks++
    metric.lastAttack = room.tickCount
    if (metric.contact.active) metric.contact.attacked = true
    if (metric.firstAttack === null) metric.firstAttack = room.tickCount
  }
  return receive(id, msg)
}

for (let i = 0; i < ticks && room.phase === 'playing'; i++) {
  room.tick()
  for (const p of room.players.values()) {
    if (!p.brain || !p.alive || !p.team) continue
    const b = p.brain as any
    const metric = metricFor(p.id)
    metric.aliveTicks++
    metric.goals[b.goal] = (metric.goals[b.goal] ?? 0) + 1
    if (metric.firstShop === null && b.trips > 0) metric.firstShop = room.tickCount
    if (b.sortied && metric.firstSortie === null) {
      metric.firstSortie = room.tickCount
      metric.sortieBlocks = b.firstSortieBlocks
    }
    if (b.leftBase && metric.firstField === null) metric.firstField = room.tickCount
    const base = room.map.bases.find((x) => x.team === p.team)
    if (base && Math.hypot(p.x - base.center[0], p.z - base.center[2]) <= 12) metric.baseTicks++

    const nav = b.navigationTelemetry
    metric.navReplans = nav.replans
    metric.navFailures = nav.failures
    metric.navStuckMax = Math.max(metric.navStuckMax, nav.stuck)
    metric.navPathLength = nav.pathLength
    metric.navStraight = nav.straight

    const seen = b.perceptionState?.visible ?? []
    const near = seen
      .map((e: any) => ({ ...e, d: Math.hypot(e.x - p.x, e.z - p.z) }))
      .sort((a: any, c: any) => a.d - c.d)[0]
    // One episode per close contact that lasts 15 ticks without an attack.
    if (near && near.d < 3) {
      const contact = metric.contact
      if (!contact.active) {
        contact.active = true
        contact.since = room.tickCount
        contact.attacked = false
        contact.counted = false
        metric.contacts++
      }
      if (!contact.attacked && !contact.counted && room.tickCount - contact.since >= 15) {
        contact.counted = true
        metric.passes++
        passes.push({
          tick: room.tickCount,
          bot: p.name,
          team: p.team,
          level: b.level,
          goal: b.goal,
          target: b.target,
          distance: Number(near.d.toFixed(2)),
          episodeTicks: room.tickCount - contact.since,
          path: b.path,
          stall: b.stall,
        })
      }
    } else {
      metric.contact.active = false
    }
    if (i % 100 === 0) {
      samples.push({
        tick: room.tickCount,
        bot: p.name,
        team: p.team,
        level: b.level,
        goal: b.goal,
        target: b.target,
        pos: [Number(p.x.toFixed(1)), Number(p.z.toFixed(1))],
        visible: seen.length,
        path: b.path,
      })
    }
  }
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid]
}

const byLevel = new Map<string, { bots: number; attacks: number; contacts: number; passes: number; shops: number[]; sorties: number[]; fields: number[]; firstAttacks: number[]; baseTicks: number; aliveTicks: number; navReplans: number; navFailures: number; navStuckMax: number; pathRatios: number[] }>()
const rows: any[] = []
for (const p of room.players.values()) {
  if (!p.brain) continue
  const b = p.brain as any
  const metric = metricFor(p.id)
  const row = byLevel.get(b.level) ?? { bots: 0, attacks: 0, contacts: 0, passes: 0, shops: [], sorties: [], fields: [], firstAttacks: [], baseTicks: 0, aliveTicks: 0, navReplans: 0, navFailures: 0, navStuckMax: 0, pathRatios: [] }
  row.bots++
  row.attacks += metric.attacks
  row.contacts += metric.contacts
  row.passes += metric.passes
  row.navReplans += metric.navReplans
  row.navFailures += metric.navFailures
  row.navStuckMax = Math.max(row.navStuckMax, metric.navStuckMax)
  if (metric.navPathLength > 0 && metric.navStraight > 0) row.pathRatios.push(metric.navPathLength / metric.navStraight)
  if (metric.firstShop !== null) row.shops.push(metric.firstShop)
  if (metric.firstSortie !== null) row.sorties.push(metric.firstSortie)
  if (metric.firstField !== null) row.fields.push(metric.firstField)
  if (metric.firstAttack !== null) row.firstAttacks.push(metric.firstAttack)
  row.baseTicks += metric.baseTicks
  row.aliveTicks += metric.aliveTicks
  byLevel.set(b.level, row)
  rows.push({
    bot: p.name,
    team: p.team,
    level: b.level,
    attacks: metric.attacks,
    contacts: metric.contacts,
    navReplans: metric.navReplans,
    navFailures: metric.navFailures,
    navStuckMax: metric.navStuckMax,
    navPathRatio: metric.navPathLength > 0 && metric.navStraight > 0 ? Number((metric.navPathLength / metric.navStraight).toFixed(2)) : null,
    firstShop: metric.firstShop,
    firstSortie: metric.firstSortie,
    sortieBlocks: metric.sortieBlocks,
    firstField: metric.firstField,
    firstAttack: metric.firstAttack,
    baseShare: metric.aliveTicks > 0 ? Number((metric.baseTicks / metric.aliveTicks).toFixed(3)) : null,
    goals: metric.goals,
  })
}

writeFileSync('.agents/bot-observer.jsonl', passes.map((e) => JSON.stringify(e)).join('\n') + '\n')
writeFileSync('.agents/bot-observer-samples.jsonl', samples.map((e) => JSON.stringify(e)).join('\n') + '\n')
writeFileSync('.agents/bot-observer-opening.jsonl', rows.map((e) => JSON.stringify(e)).join('\n') + '\n')
writeFileSync('.agents/bot-observer-navigation.jsonl', rows.map((e) => JSON.stringify(e)).join('\n') + '\n')

const summary = Object.fromEntries(
  [...byLevel.entries()].map(([level, row]) => [
    level,
    {
      bots: row.bots,
      attacks: row.attacks,
      contacts: row.contacts,
      passes: row.passes,
      nav: {
        replans: row.navReplans,
        failures: row.navFailures,
        stuckMax: row.navStuckMax,
        pathRatio: row.pathRatios.length ? Number((row.pathRatios.reduce((a, b) => a + b, 0) / row.pathRatios.length).toFixed(2)) : null,
      },
      firstShop: { min: row.shops.length ? Math.min(...row.shops) : null, median: median(row.shops) },
      firstSortie: { min: row.sorties.length ? Math.min(...row.sorties) : null, median: median(row.sorties) },
      firstField: { min: row.fields.length ? Math.min(...row.fields) : null, median: median(row.fields) },
      firstAttack: { min: row.firstAttacks.length ? Math.min(...row.firstAttacks) : null, median: median(row.firstAttacks) },
      baseShare: row.aliveTicks > 0 ? Number((row.baseTicks / row.aliveTicks).toFixed(3)) : null,
    },
  ]),
)

console.log(JSON.stringify({ phase: room.phase, ticks: room.tickCount, players: room.players.size, contacts: [...byLevel.values()].reduce((n, row) => n + row.contacts, 0), passes: passes.length, byLevel: summary }, null, 2))
