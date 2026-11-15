import { describe, expect, test } from 'bun:test'
import { createCampusMap } from '../src/games/bedwars/maps/campus'
import { survivalRules } from '../src/games/bedwars/rules'
import { roomParams, createBedwarsRoom } from '../src/games/bedwars/server'
import { TPS } from '../src/games/bedwars/constants'
import { AIR, BLACKBOARD, BOOKSHELF, DOOR, FLOOD_WATER, PLANKS, blockDef } from '../src/games/bedwars/blocks'
import { drawTile, PATTERNS } from '../src/engine/render/textures'
import { applyDisaster, survivalSchedule, meteorPosition, METEOR_FLIGHT_TICKS, SURVIVAL_SECONDS, SURVIVAL_SLOTS, WARN_SECONDS } from '../src/games/bedwars/sim/survival'
import { TestClient, ticks } from './room-helpers'
import { IDLE_INPUT, stepMovement } from '../src/engine/physics'
import { World } from '../src/engine/world'
import { mover, run, settle } from './helpers'
import { STONE } from '../src/games/bedwars/blocks'
import { atlasLayout } from '../src/engine/render/atlas-layout'
import { meshChunk } from '../src/engine/render/mesher'
import { SunLight } from '../src/engine/render/light'

function humanOnlyRoom(name: string) {
  const room = createBedwarsRoom({ world: 'survival', room: name, fast: false }, true)
  room.botsEnabled = false
  return room
}

describe('campus survival', () => {
  test('shower craters never dig through the bottom layer of the world', () => {
    const room = humanOnlyRoom('crater-floor')
    const a = new TestClient(room, 'Ash')
    ticks(room, 13 * TPS)
    a.put(22.5, 1, 8.5)
    a.p.protectedTicks = 160 * TPS
    // Walk the whole round: every volley landed at or above the field floor.
    ticks(room, SURVIVAL_SECONDS * TPS)
    for (let x = 0; x < 64; x++) for (let z = 0; z < 64; z++) expect(room.world.get(x, 0, z)).not.toBe(AIR)
    expect(a.p.alive).toBe(true)
  })

  test('the campus fittings have their own tiles instead of bare planks', () => {
    expect([BOOKSHELF, DOOR, BLACKBOARD]).not.toContain(PLANKS)
    for (const block of [BOOKSHELF, DOOR, BLACKBOARD]) expect(PATTERNS.has(blockDef(block).texture.pattern)).toBe(true)
    // Paint them headless: a stand-in for the DOM's ImageData, as the block suite does.
    const g = globalThis as { ImageData?: unknown }
    const had = g.ImageData
    g.ImageData ??= class {
      data: Uint8ClampedArray
      constructor(
        readonly width: number,
        readonly height: number,
      ) {
        this.data = new Uint8ClampedArray(width * height * 4)
      }
    }
    try {
      const unique = (pattern: string) => {
        const tile = drawTile({ color: '#8a6034', pattern, face: 'side' }, 5)
        const pixels = new Set<string>()
        for (let i = 0; i < tile.data.length; i += 4) pixels.add(`${tile.data[i]},${tile.data[i + 1]},${tile.data[i + 2]}`)
        return pixels.size
      }
      // A real pattern, not a flat fallback: several distinct colours per tile.
      for (const pattern of ['bookshelf', 'door', 'chalkboard']) expect(unique(pattern)).toBeGreaterThan(3)
    } finally {
      if (had === undefined) delete g.ImageData
    }
    // The campus library shelves and classroom chalkboards use them.
    const map = createCampusMap()
    const used = new Set<number>()
    for (const cell of map.world.cells) used.add(cell & 0x7f)
    expect(used.has(BOOKSHELF)).toBe(true)
    expect(used.has(BLACKBOARD)).toBe(true)
  })

  test('the Spawn campus has eight walkable starting positions', () => {
    const map = createCampusMap()
    const spawns = Object.values(map.upgradeSpawns!).flat()
    expect(spawns).toHaveLength(8)
    for (const [x, y, z] of spawns) {
      expect(map.world.isSolid(Math.floor(x), y - 1, Math.floor(z))).toBe(true)
      expect(map.world.isSolid(Math.floor(x), y, Math.floor(z))).toBe(false)
      expect(map.world.isSolid(Math.floor(x), y + 1, Math.floor(z))).toBe(false)
    }
  })

  test('the main meteor travels toward the roof during the final six seconds', () => {
    const until = 500
    const start = meteorPosition(35, 21, 45, until, until - METEOR_FLIGHT_TICKS)
    const mid = meteorPosition(35, 21, 45, until, until - METEOR_FLIGHT_TICKS / 2)
    const end = meteorPosition(35, 21, 45, until, until)
    expect(start).toEqual([49.5, 62.5, 85.5])
    expect(end).toEqual([35.5, 22.5, 45.5])
    expect(mid[1]).toBeLessThan(start[1])
    expect(mid[1]).toBeGreaterThan(end[1])
    expect(meteorPosition(35, 21, 45, until, until + 10)).toEqual(end)
  })

  test('all three disasters have one slot and mutate their intended zones', () => {
    expect(new Set(survivalSchedule(() => 0.5))).toEqual(new Set(['meteor', 'flood', 'earthquake']))
    const map = createCampusMap()
    expect(map.world.get(35, 21, 45)).not.toBe(AIR)
    applyDisaster(map.world, 'meteor')
    expect(map.world.get(35, 21, 45)).toBe(AIR)
    expect(map.world.get(16, 4, 41)).not.toBe(AIR)
    applyDisaster(map.world, 'earthquake')
    expect(map.world.get(16, 4, 41)).toBe(AIR)
    expect(map.world.get(30, 2, 8)).toBe(AIR)
    applyDisaster(map.world, 'flood')
    expect(map.world.get(30, 2, 8)).toBe(FLOOD_WATER)
    expect(map.world.isSolid(30, 2, 8)).toBe(false)
  })

  test('the URL selects survival without changing existing modes', () => {
    expect(roomParams(new URLSearchParams('world=survival')).world).toBe('survival')
    expect(roomParams(new URLSearchParams('world=arena')).world).toBe('arena')
    expect(survivalRules().mode).toBe('survival')
  })

  test('a solo round warns, changes the school, ends and resets it', () => {
    const room = humanOnlyRoom('test')
    const a = new TestClient(room, 'Ash')
    ticks(room, 13 * TPS)
    expect(room.phase).toBe('playing')
    const initial = room.world.cells.slice()
    ticks(room, 22 * TPS)
    expect(a.events().some((e) => /meteor|flood|earthquake/i.test(e))).toBe(true)
    expect(room.world.cells.some((value, i) => value !== initial[i])).toBe(true)
    // Force a death and let the verdict finish; a solo player must not respawn mid-round.
    room.die(a.p, 'void')
    expect(a.p.eliminated).toBe(true)
    ticks(room, 12 * TPS)
    expect(room.phase).not.toBe('ended')
    expect(room.world.cells).toEqual(initial)
  })

  test('all three warnings and disasters occur during a complete solo round', () => {
    const room = humanOnlyRoom('clock')
    const a = new TestClient(room, 'Ash')
    ticks(room, 13 * TPS)
    a.put(2.5, 5, 30.5)
    // Keep the player alive to exercise the entire schedule; damage is covered separately.
    a.p.protectedTicks = 160 * TPS
    ticks(room, (SURVIVAL_SLOTS[2] + 1) * TPS)
    const events = a.events('title')
    // One banner per disaster: a ten-second warning, and then the disaster
    // announces itself (red marks, rising water, a split corridor).
    for (const kind of ['METEOR', 'FLOOD', 'EARTHQUAKE']) {
      expect(events.filter((e) => e === `${kind} IN ${WARN_SECONDS} SECONDS`)).toHaveLength(1)
      expect(events).not.toContain(kind)
    }
    expect(room.world.get(35, 21, 45)).toBe(AIR)
    expect(room.world.get(16, 4, 41)).toBe(AIR)
    // If flood is the final slot, the second layer takes four seconds to rise.
    ticks(room, 4 * TPS)
    expect(room.world.get(30, 2, 8)).toBe(FLOOD_WATER)
    // Run the clock out; stop the moment the verdict lands so the lobby reset
    // has not started yet.
    while (room.phase === 'playing') ticks(room, 1)
    expect(room.phase).toBe('ended')
    expect(a.last('summary')?.winnerName).toBe('Ash')
  })

  test('players can join a live round on a distinct open school spawn', () => {
    const room = humanOnlyRoom('late')
    const a = new TestClient(room, 'Ash')
    ticks(room, 13 * TPS)
    const b = new TestClient(room, 'Bea')
    expect(a.p.alive).toBe(true)
    expect(b.p.alive).toBe(true)
    expect(b.p.eliminated).toBe(false)
    expect([b.p.x, b.p.y, b.p.z]).not.toEqual([a.p.x, a.p.y, a.p.z])
  })

  test('a late joiner uses the free spawn when a same-colour player leaves', () => {
    const room = humanOnlyRoom('seats')
    const clients = Array.from({ length: 8 }, (_, i) => new TestClient(room, `Player${i}`))
    ticks(room, 13 * TPS)
    const occupied = clients.map((c) => [c.p.team, c.p.spawnSlot] as const)
    expect(new Set(occupied.map(([team, slot]) => `${team}:${slot}`)).size).toBe(8)
    room.disconnect(clients[0].p.id)
    const late = new TestClient(room, 'Late')
    expect(late.p.alive).toBe(true)
    expect([late.p.team, late.p.spawnSlot]).toEqual([...occupied[0]])
    expect(clients.slice(1).some((c) => c.p.team === late.p.team && c.p.spawnSlot === late.p.spawnSlot)).toBe(false)
  })

  test('meteor showers warn players before impact and water eventually reaches campus', () => {
    const room = humanOnlyRoom('pressure')
    const a = new TestClient(room, 'Ash')
    ticks(room, 13 * TPS)
    a.put(2.5, 5, 30.5)
    ticks(room, 31 * TPS)
    expect(a.events().some((text) => /meteor shower/i.test(text))).toBe(true)
    ticks(room, 3 * TPS)
    expect(a.p.health).toBeLessThan(20)
    // Avoid later shower damage while checking the late flood.
    a.p.protectedTicks = 120 * TPS
    // Out to 100s: past the last disaster slot and both late-flood stages.
    ticks(room, 66 * TPS)
    // The late flood gets one banner when the water starts rising, not a
    // warning plus a second stage banner ten seconds later.
    expect(a.events('title')).toContain('CAMPUS FLOODING')
    expect(a.events('title').filter((e) => e === 'CAMPUS FLOODING')).toHaveLength(1)
    expect(room.world.get(2, 5, 30)).toBe(FLOOD_WATER)
    expect(room.world.get(2, 6, 30)).toBe(FLOOD_WATER)
  })

  test('flood water hurts at ankle depth and hits harder once it is deeper', () => {
    const room = humanOnlyRoom('flood')
    const a = new TestClient(room, 'Ash')
    ticks(room, 13 * TPS)
    applyDisaster(room.world, 'flood')
    a.put(30.5, 1, 8.5)
    // One layer, head clear: wading. This used to cost nothing at all.
    room.world.set(30, 2, 8, AIR)
    room.world.set(30, 3, 8, AIR)
    ticks(room, TPS)
    expect(a.p.health).toBe(19)
    expect(a.p.alive).toBe(true)
    // Two layers: the water is over the waist and drowning speed applies.
    room.world.set(30, 2, 8, FLOOD_WATER)
    ticks(room, TPS)
    expect(a.p.health).toBe(17)
  })

  test('solo fills the round with bots, and a late human replaces one', () => {
    const room = createBedwarsRoom({ world: 'survival', room: 'bots', fast: false }, true)
    const a = new TestClient(room, 'Ash')
    ticks(room, 13 * TPS)
    const bots = [...room.players.values()].filter((p) => p.brain)
    expect(bots).toHaveLength(7)
    expect(bots.every((p) => p.alive)).toBe(true)
    expect(new Set([...room.players.values()].map((p) => `${p.team}:${p.spawnSlot}`)).size).toBe(8)
    const start = bots.map((p) => [p.x, p.y, p.z])
    ticks(room, 5 * TPS)
    expect(bots.some((p, i) => Math.hypot(p.x - start[i][0], p.y - start[i][1], p.z - start[i][2]) > 0.2)).toBe(true)
    const b = new TestClient(room, 'Bea')
    expect(b.p.alive).toBe(true)
    expect([...room.players.values()].filter((p) => p.brain)).toHaveLength(6)
    expect(room.players.size).toBe(8)
    expect(a.p.alive).toBe(true)
  })

  test('the main meteor marks the library roof ten seconds before impact', () => {
    const room = humanOnlyRoom('meteor-warning')
    const a = new TestClient(room, 'Ash')
    ticks(room, 13 * TPS)
    a.p.protectedTicks = 150 * TPS
    while (!a.events('title').includes(`METEOR IN ${WARN_SECONDS} SECONDS`) && room.phase === 'playing') ticks(room, 1)
    const mark = a.last('danger')
    expect(mark).toMatchObject({ x: 35, y: 21, z: 45, radius: 5, meteor: true })
    expect(mark!.until - room.tickCount).toBe(WARN_SECONDS * TPS)
    const late = new TestClient(room, 'Bea')
    expect(late.last('danger')).toEqual(mark)
    ticks(room, WARN_SECONDS * TPS)
    expect(a.last('explosion')).toMatchObject({ x: 35.5, z: 45.5 })
  })

  test('meteor shower identifies the impact cell before the impact', () => {
    const room = humanOnlyRoom('warning')
    const a = new TestClient(room, 'Ash')
    ticks(room, 13 * TPS)
    a.put(2.5, 5, 30.5)
    ticks(room, 31 * TPS)
    const warning = a.last('danger')
    expect(warning).toBeDefined()
    expect(warning?.x).toBe(2)
    expect(warning?.z).toBe(30)
    expect(warning!.until).toBeGreaterThan(room.tickCount)
    const late = new TestClient(room, 'Bea')
    expect(late.last('danger')).toEqual(warning)
    ticks(room, 3 * TPS)
    expect(a.last('explosion')).toBeDefined()
  })

  test('the field flood rises in layers instead of appearing at full height', () => {
    const room = humanOnlyRoom('rising')
    const a = new TestClient(room, 'Ash')
    ticks(room, 13 * TPS)
    a.p.protectedTicks = 150 * TPS
    const order = room.gameView().next?.label
    // Wait until the independently shuffled flood fires.
    while (!a.events('title').includes(`FLOOD IN ${WARN_SECONDS} SECONDS`) && room.phase === 'playing') ticks(room, 1)
    expect(order).toBeDefined()
    expect(room.world.get(30, 4, 8)).toBe(AIR)
    // Ten seconds to the flood, then four seconds per layer up to the fourth.
    ticks(room, 22 * TPS)
    expect(room.world.get(30, 4, 8)).toBe(FLOOD_WATER)
  })

  test('late high-water flood produces bounded ordered voxel updates', () => {
    const room = humanOnlyRoom('flood-traffic')
    const a = new TestClient(room, 'Ash')
    ticks(room, 13 * TPS)
    a.p.protectedTicks = 150 * TPS
    ticks(room, 95 * TPS)
    a.msgs.length = 0
    ticks(room, 4 * TPS)
    const packets = a.msgs.filter((m) => m.t === 'blocks')
    expect(packets.length).toBeGreaterThan(0)
    expect(Math.max(...packets.map((m) => m.changes.length))).toBeLessThanOrEqual(128)
    expect(packets.some((m) => m.changes.some((change) => change[3] === FLOOD_WATER))).toBe(true)
  })

  test('a supply drop offers a shared pickup that heals the first survivor', () => {
    const room = humanOnlyRoom('supplies')
    const a = new TestClient(room, 'Ash')
    ticks(room, 13 * TPS)
    // Stay away from every possible drop until explicitly testing collection.
    a.put(0.5, 5, 0.5)
    a.p.protectedTicks = 150 * TPS
    ticks(room, 38 * TPS)
    const drop = a.last('supply')
    expect(drop).toBeDefined()
    expect(drop?.landAt).toBeGreaterThan(room.tickCount)
    ticks(room, 6 * TPS)
    a.p.health = 5
    a.put(drop!.x, drop!.y, drop!.z)
    ticks(room, 1)
    expect(a.p.health).toBe(25)
    expect(a.last('supply')?.active).toBe(false)
  })

  test('flood water slows walking and swimming upward is possible', () => {
    const water = new World(32, 32, 32)
    water.fill(0, 0, 0, 31, 9, 31, STONE)
    water.fill(0, 10, 0, 31, 13, 31, FLOOD_WATER)
    const wet = mover(16.5, 10, 25), dry = mover(16.5, 10, 25)
    const land = new World(32, 32, 32)
    land.fill(0, 0, 0, 31, 9, 31, STONE)
    settle(water, wet); settle(land, dry)
    run(water, wet, 20, { forward: 1 }); run(land, dry, 20, { forward: 1 })
    expect(25 - wet.z).toBeLessThan((25 - dry.z) * 0.7)
    const before = wet.y
    for (let i = 0; i < 40; i++) stepMovement(water, wet, { ...IDLE_INPUT, jump: true })
    expect(wet.y).toBeGreaterThan(before + 1)
  })

  test('water faces carry liquid shading while adjacent water has no internal faces', () => {
    const w = new World(16, 16, 16)
    w.set(5, 5, 5, FLOOD_WATER); w.set(6, 5, 5, FLOOD_WATER)
    const mesh = meshChunk(w, new SunLight(w), atlasLayout(), 0, 0, 0)
    expect(mesh.indices.length).toBe(60)
    expect([...mesh.lights].every((light) => (light & (1 << 18)) !== 0)).toBe(true)
  })

  test('shoving pushes a nearby player without damaging them and observes a cooldown', () => {
    const room = humanOnlyRoom('shove')
    const a = new TestClient(room, 'Ash'), b = new TestClient(room, 'Bea')
    ticks(room, 13 * TPS)
    a.put(25.5, 5, 30.5, 0)
    b.put(25.5, 5, 28.5, 0)
    const hp = b.p.health
    a.send({ t: 'shove' })
    expect(b.p.health).toBe(hp)
    expect(b.p.vz).toBeLessThan(0)
    expect(b.last('velocity')).toBeDefined()
    const before = b.p.vz
    a.send({ t: 'shove' })
    expect(b.p.vz).toBe(before)
    ticks(room, Math.round(1.2 * TPS))
    b.p.vz = 0
    a.send({ t: 'shove' })
    expect(b.p.vz).toBeLessThan(0)
  })

  test('a full round raises at most two shower banners, not one per volley', () => {
    const room = humanOnlyRoom('banner-noise')
    const a = new TestClient(room, 'Ash')
    ticks(room, 13 * TPS)
    a.p.protectedTicks = 160 * TPS
    ticks(room, SURVIVAL_SECONDS * TPS)
    const showerBanners = a.events('title').filter((text) => /METEOR SHOWER/.test(text))
    expect(showerBanners.length).toBeGreaterThan(0)
    expect(showerBanners.length).toBeLessThanOrEqual(2)
    // The per-rock danger marks still fire for every volley.
    expect(a.msgs.filter((m) => m.t === 'danger' && !m.meteor).length).toBeGreaterThan(5)
    // ...and the campus floor survives them: rocks may not dig the last layer
    // or the school falls out of the world.
    expect(room.world.get(22, 0, 8)).not.toBe(AIR)
    // Untouched by the shower; a supply drop may have raised the ceiling to 25.
    expect(a.p.health).toBe(a.p.maxHealth)
  })

  test('everyone alive at the time limit shares the survival verdict', () => {
    const room = humanOnlyRoom('shared-verdict')
    const a = new TestClient(room, 'Ash'), b = new TestClient(room, 'Bea')
    ticks(room, 13 * TPS)
    a.put(2.5, 5, 30.5); b.put(4.5, 5, 30.5)
    a.p.protectedTicks = b.p.protectedTicks = 160 * TPS
    ticks(room, (SURVIVAL_SECONDS + 1) * TPS)
    expect(room.phase).toBe('ended')
    const summary = a.last('summary')
    expect(summary?.survivors).toEqual(['Ash', 'Bea'])
    expect(summary?.survivorIds).toEqual([a.p.id, b.p.id])
    expect(a.events('title').some((text) => text.includes('2 SURVIVED'))).toBe(true)
  })

  test('a round with no survivors says the school won', () => {
    const room = humanOnlyRoom('no-survivors')
    const a = new TestClient(room, 'Ash')
    ticks(room, 13 * TPS)
    room.die(a.p, 'void')
    ticks(room, 1)
    expect(a.last('summary')?.survivors).toEqual([])
    expect(a.last('summary')?.survivorIds).toEqual([])
    expect(a.events('title')).toContain('NOBODY SURVIVED')
  })

  test('survival kill feed reports the cause of disaster deaths', () => {
    const room = humanOnlyRoom('feed')
    const a = new TestClient(room, 'Ash'), b = new TestClient(room, 'Bea')
    ticks(room, 13 * TPS)
    room.hurt(b.p, 20, 'meteor')
    expect(a.events('kill')).toContain('Bea was hit by the meteor')
    expect(b.p.eliminated).toBe(true)
  })

  test('unclaimed supplies expire so the next scheduled drop can appear', () => {
    const room = humanOnlyRoom('supply-expiry')
    const a = new TestClient(room, 'Ash')
    ticks(room, 13 * TPS)
    a.put(0.5, 5, 0.5)
    a.p.protectedTicks = 160 * TPS
    // Advance beyond the 38-second drop boundary regardless of the initial countdown tick.
    ticks(room, 38 * TPS)
    const first = a.last('supply')
    expect(first?.active).toBe(true)
    ticks(room, 67 * TPS)
    const updates = a.msgs.filter((m) => m.t === 'supply')
    expect(updates.filter((m) => m.active)).toHaveLength(2)
    expect(updates.some((m) => !m.active)).toBe(true)
  })

  test('in multiplayer the last surviving player wins', () => {
    const room = humanOnlyRoom('test')
    const a = new TestClient(room, 'Ash')
    const b = new TestClient(room, 'Bea')
    ticks(room, 13 * TPS)
    room.die(b.p, 'void')
    ticks(room, 1)
    expect(room.phase).toBe('ended')
    expect(room.winnerName).toBe(a.p.name)
    expect(a.last('summary')?.winnerName).toBe(a.p.name)
  })
})
