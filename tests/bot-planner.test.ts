import { describe, expect, test } from 'bun:test'
import { STONE, TEAMS, type TeamId } from '../src/games/bedwars/blocks'
import { createArena, SKYREACH } from '../src/games/bedwars/maps/arena'
import type { MapDef, Npc, TeamBase } from '../src/games/bedwars/maps/types'
import { BASE_RADIUS, arenaRules } from '../src/games/bedwars/rules'
import { Room } from '../src/games/bedwars/room'
import { BOT_TIER_PROFILES } from '../src/games/bedwars/bots/profiles'
import type { BotPerception, PerceivedEnemy } from '../src/games/bedwars/bots/types'
import { UtilityPlanner, type PlannerContext } from '../src/games/bedwars/bots/planner'
import { WorldModel, type WorldSource } from '../src/games/bedwars/bots/worldModel'
import { World } from '../src/engine/world'

/** A small four-base map with one deliberately exposed bed (Blue), so the planner cannot just pick the nearest. */
function stagedMap(): MapDef {
  const world = new World(64, 24, 64)
  const island = (x0: number, z0: number, x1: number, z1: number) => world.fill(x0, 0, z0, x1, 9, z1, STONE)
  island(4, 4, 20, 20)
  island(44, 4, 60, 20)
  island(44, 44, 60, 60)
  island(4, 44, 20, 60)
  island(28, 28, 36, 36)

  const base = (team: TeamId, cx: number, cz: number, bx: number, bz: number, dx: number, dz: number): TeamBase => ({
    team,
    spawn: [cx, 10, cz, 0],
    bed: { x: bx, y: 10, z: bz, dx, dz },
    forge: [cx - 3, 10, cz],
    center: [cx, 10, cz],
  })
  const bases = [
    base('red', 12.5, 12.5, 14, 12, 1, 0),
    base('blue', 52.5, 12.5, 58, 12, 1, 0),
    base('green', 52.5, 51.5, 52, 52, 1, 0),
    base('yellow', 12.5, 51.5, 14, 50, 0, 1),
  ]
  const npcs: Npc[] = []
  const generators: MapDef['generators'] = []
  for (const b of bases) {
    npcs.push({ kind: 'shop', team: b.team, x: b.center[0] - 2, y: 10, z: b.center[2], yaw: 0 })
    npcs.push({ kind: 'upgrades', team: b.team, x: b.center[0] + 2, y: 10, z: b.center[2], yaw: 0 })
    generators.push({ kind: 'iron', team: b.team, pos: [b.forge[0], 10, b.forge[2]] })
    generators.push({ kind: 'gold', team: b.team, pos: [b.forge[0], 10, b.forge[2]] })
  }
  generators.push({ kind: 'diamond', pos: [32.5, 10, 32.5] }, { kind: 'emerald', pos: [32.5, 10, 30.5] })

  return {
    name: 'Staged',
    world,
    bases,
    generators,
    npcs,
    labels: [],
    lobby: null,
    spectator: [32, 20, 32, 0, 0],
    killY: -8,
    build: { minY: 0, maxY: 24, protectedZones: [] },
    sky: '#ffffff',
  }
}

function stagedModel(teams?: WorldSource['teams']): WorldModel {
  return new WorldModel({ map: stagedMap(), teams })
}

function enemy(id: number, team: TeamId, x: number, z: number, overrides: Partial<PerceivedEnemy> = {}): PerceivedEnemy {
  return {
    id,
    team,
    x,
    y: 10,
    z,
    vx: 0,
    vz: 0,
    lastSeenTick: 199,
    visible: true,
    confidence: 1,
    distance: 0,
    angle: 0,
    ...overrides,
  }
}

interface PerceptionOptions {
  tick?: number
  self?: Partial<BotPerception['self']>
  visible?: PerceivedEnemy[]
  remembered?: PerceivedEnemy[]
  threat?: PerceivedEnemy | null
  danger?: Partial<BotPerception['danger']>
}

function perception(options: PerceptionOptions = {}): BotPerception {
  return {
    tick: options.tick ?? 200,
    self: {
      x: 12.5,
      y: 10,
      z: 12.5,
      yaw: 0,
      pitch: 0,
      health: 20,
      onGround: true,
      team: 'red',
      ...options.self,
    },
    visible: options.visible ?? [],
    remembered: options.remembered ?? [],
    threat: options.threat ?? null,
    danger: { void: false, lowHealth: false, bedThreat: false, ...options.danger },
  }
}

const carry = (emeralds = 0, diamonds = 0): PlannerContext => ({
  blocks: 40,
  resources: { iron: 0, gold: 0, diamond: diamonds, emerald: emeralds },
})

describe('bot world model', () => {
  test('reads beds, generators, NPCs and the heal pool from the real arena map', () => {
    const map = createArena(TEAMS, SKYREACH)
    const model = new WorldModel({ map })

    expect(model.beds.map((bed) => bed.team).sort()).toEqual([...TEAMS].sort())
    for (const base of map.bases) {
      const bed = model.bed(base.team)
      expect(bed).not.toBeNull()
      expect([bed!.x, bed!.y, bed!.z]).toEqual([base.bed.x, base.bed.y, base.bed.z])
      expect(bed!.alive).toBe(true)
      expect(bed!.exposure).toBeGreaterThan(0)
      expect(bed!.exposure).toBeLessThanOrEqual(1)
      expect(model.healPool(base.team)).toMatchObject({ x: base.center[0], y: base.center[1], z: base.center[2], radius: BASE_RADIUS })
      expect(model.shop(base.team)?.kind).toBe('shop')
      expect(model.upgrades(base.team)?.kind).toBe('upgrades')
    }

    const diamond = map.generators.find((g) => g.kind === 'diamond')!
    expect(model.generatorOwnership(diamond, 'red')).toBe('contested')
    const redForge = map.generators.find((g) => g.kind === 'iron' && g.team === 'red')!
    expect(model.generatorOwnership(redForge, 'red')).toBe('home')
    expect(model.generatorOwnership(redForge, 'blue')).toBe('enemy')

    const cost = model.routeCost('red', 'blue')
    expect(cost).toBeGreaterThan(0)
    expect(cost).toBeLessThan(64)
    expect(model.routeCost('red', 'red')).toBe(0)
    expect(model.route('red', 'blue').nodes.length).toBeGreaterThan(0)
  })

  test('ranks the exposed bed above the nearest bed and finds a safe escape node', () => {
    const model = stagedModel()
    const red = model.bed('red')!

    expect(model.bedDistance(red.center.x, red.center.z, 'yellow')).toBeLessThan(model.bedDistance(red.center.x, red.center.z, 'blue'))
    expect(model.exposedBeds('red')[0].team).toBe('blue')
    expect(model.raidPriority('red', 'blue')).toBeGreaterThan(model.raidPriority('red', 'yellow'))

    expect(model.laneBlockCost('red', 'blue')).toBeGreaterThan(16)
    expect(model.laneBlockCost('red', 'blue')).toBeLessThan(64)
    expect(model.nearestSafeNode(24, 10, 12)?.team).toBe('red')
    expect(model.nearestSafeRoute({ x: 24, y: 10, z: 12 }).cost).toBeGreaterThan(0)
  })

  test('accepts a live Room map and its team state', () => {
    const room = new Room({ rules: arenaRules({ bots: false }) })
    const model = new WorldModel({ map: room.map, teams: room.teams })
    expect(model.bedAlive('red')).toBe(true)

    room.teams.get('red')!.bed = false
    model.setTeams(room.teams)
    expect(model.bedAlive('red')).toBe(false)
    expect(model.exposedBeds('red').map((bed) => bed.team)).not.toContain('red')
  })

  test('takes bed status from the room team map', () => {
    const model = stagedModel(
      new Map<TeamId, { bed: boolean; eliminated?: boolean }>([
        ['red', { bed: false, eliminated: false }],
        ['blue', { bed: true, eliminated: false }],
        ['green', { bed: true, eliminated: true }],
        ['yellow', { bed: true, eliminated: false }],
      ]),
    )
    expect(model.bedAlive('red')).toBe(false)
    expect(model.bedAlive('blue')).toBe(true)
    expect(model.bedAlive('green')).toBe(false)
    expect(model.exposedBeds('red').map((bed) => bed.team)).not.toContain('green')

    model.setTeams(
      new Map<TeamId, { bed: boolean; eliminated?: boolean }>([
        ['red', { bed: true }],
        ['blue', { bed: false }],
        ['green', { bed: true }],
        ['yellow', { bed: true }],
      ]),
    )
    expect(model.bedAlive('red')).toBe(true)
    expect(model.bedAlive('blue')).toBe(false)
  })
})

describe('utility planner', () => {
  test('chooses defend for a bed threat and targets the intruder', () => {
    const planner = new UtilityPlanner(stagedModel(), { seed: 7 })
    const intruder = enemy(42, 'blue', 16, 12)
    const intent = planner.choose(perception({ visible: [intruder], threat: intruder, danger: { bedThreat: true } }), BOT_TIER_PROFILES.hard, carry())

    expect(intent.goal).toBe('defend')
    expect(intent.targetId).toBe(42)
    expect(intent.reason).toContain('bed')
    expect(intent.score).toBeGreaterThan(0)
  })

  test('chooses retreat for low health while carrying resources', () => {
    const planner = new UtilityPlanner(stagedModel(), { seed: 11 })
    const intent = planner.choose(perception({ self: { health: 4 }, danger: { lowHealth: true } }), BOT_TIER_PROFILES.hard, carry(2, 3))

    expect(intent.goal).toBe('retreat')
    expect(intent.reason).toContain('health')
  })

  test('chooses escape when bedless, isolated and hunted', () => {
    const model = stagedModel(
      new Map<TeamId, { bed: boolean; eliminated?: boolean }>([
        ['red', { bed: false }],
        ['blue', { bed: true }],
        ['green', { bed: true }],
        ['yellow', { bed: true }],
      ]),
    )
    const planner = new UtilityPlanner(model, { seed: 3 })
    const hunter = enemy(7, 'blue', 16, 12)
    const intent = planner.choose(perception({ self: { health: 6 }, visible: [hunter], threat: hunter }), BOT_TIER_PROFILES.hard, {
      blocks: 0,
      resources: {},
      teammatesNearby: 0,
    })

    expect(intent.goal).toBe('escape')
    expect(intent.reason).toContain('bed')
  })

  test('raids the exposed bed even when another enemy bed is nearer', () => {
    const planner = new UtilityPlanner(stagedModel(), { seed: 9 })
    const intent = planner.choose(perception(), BOT_TIER_PROFILES.normal, carry())

    expect(intent.goal).toBe('raid')
    expect(planner.lastDecision()?.targetTeam).toBe('blue')
    expect(intent.reason).toContain('Blue')
    const model = stagedModel()
    expect(model.bedDistance(12.5, 12.5, 'yellow')).toBeLessThan(model.bedDistance(12.5, 12.5, 'blue'))
  })

  test('does not target a hidden enemy whose memory has expired', () => {
    const profile = BOT_TIER_PROFILES.normal
    const stale = enemy(42, 'blue', 16, 12, { visible: false, confidence: 0.4, lastSeenTick: 200 - profile.memorySeconds * 20 - 1 })
    const planner = new UtilityPlanner(stagedModel(), { seed: 13 })
    const intent = planner.choose(perception({ remembered: [stale] }), profile, carry())

    expect(intent.targetId).not.toBe(42)
    expect(planner.lastDecision()?.targetId).toBeNull()
  })

  test('still defends against a recently remembered enemy', () => {
    const profile = BOT_TIER_PROFILES.normal
    const recent = enemy(43, 'blue', 16, 12, { visible: false, confidence: 0.5, lastSeenTick: 198 })
    const planner = new UtilityPlanner(stagedModel(), { seed: 13 })
    const intent = planner.choose(perception({ remembered: [recent] }), profile, carry())

    expect(intent.goal).toBe('defend')
    expect(intent.targetId).toBe(43)
  })

  test('only offers third party when two teams are already fighting', () => {
    const profile = BOT_TIER_PROFILES.hard
    const planner = new UtilityPlanner(stagedModel(), { seed: 5 })
    const blue = enemy(1, 'blue', 30, 28)
    const green = enemy(2, 'green', 33, 29)
    const solo = planner.evaluateAll(perception({ visible: [blue] }), profile, carry()).find((s) => s.goal === 'thirdParty')
    const fight = planner.evaluateAll(perception({ visible: [blue, green] }), profile, carry()).find((s) => s.goal === 'thirdParty')

    expect(solo?.score).toBe(0)
    expect(fight?.score).toBeGreaterThan(0)
  })

  test('keeps its current goal through the commitment window, then switches', () => {
    const profile = BOT_TIER_PROFILES.normal
    const planner = new UtilityPlanner(stagedModel(), { seed: 21 })
    expect(planner.choose(perception({ tick: 200 }), profile, carry()).goal).toBe('raid')
    expect(planner.choose(perception({ tick: 201, self: { health: 4 }, danger: { lowHealth: true } }), profile, carry(2)).goal).toBe('raid')
    expect(planner.choose(perception({ tick: 216, self: { health: 4 }, danger: { lowHealth: true } }), profile, carry(2)).goal).toBe('retreat')
  })

  test('requires the switch margin before replacing the current goal', () => {
    const profile = BOT_TIER_PROFILES.normal
    const hurt = perception({ tick: 216, self: { health: 4 }, danger: { lowHealth: true } })
    const context = carry(2)
    const scores = new UtilityPlanner(stagedModel(), { seed: 21 }).evaluateAll(hurt, profile, context)
    const raid = scores.find((s) => s.goal === 'raid')!.score
    const retreat = scores.find((s) => s.goal === 'retreat')!.score
    expect(retreat).toBeGreaterThan(raid)
    const margin = retreat / raid - 1 + 0.05

    const stubborn = new UtilityPlanner(stagedModel(), { seed: 21 })
    stubborn.choose(perception({ tick: 200 }), profile, context)
    const stuck = stubborn.choose(hurt, { ...profile, targetSwitchMargin: margin }, context)
    expect(stuck.goal).toBe('raid')

    const open = new UtilityPlanner(stagedModel(), { seed: 21 })
    open.choose(perception({ tick: 200 }), profile, context)
    expect(open.choose(hurt, profile, context).goal).toBe('retreat')
  })

  test('same seed produces the same plans, and the world model is deterministic', () => {
    const run = (seed: number) => {
      const planner = new UtilityPlanner(stagedModel(), { seed })
      const fight = [enemy(1, 'blue', 15, 12), enemy(2, 'green', 17, 13)]
      return [
        planner.choose(perception({ tick: 200 }), BOT_TIER_PROFILES.expert, carry()),
        planner.choose(perception({ tick: 214, self: { health: 12 }, visible: fight, threat: fight[0] }), BOT_TIER_PROFILES.expert, carry(1, 2)),
        planner.choose(perception({ tick: 240, self: { health: 3 } }), BOT_TIER_PROFILES.expert, carry(3, 4)),
      ]
    }

    expect(run(4)).toEqual(run(4))
    expect(new WorldModel({ map: stagedMap() }).routeCost('red', 'blue')).toBe(new WorldModel({ map: stagedMap() }).routeCost('red', 'blue'))
  })
})
