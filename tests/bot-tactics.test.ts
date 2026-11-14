import { describe, expect, test } from 'bun:test'
import { World } from '../src/engine/world'
import { BED, STONE } from '../src/games/bedwars/blocks'
import { BOT_TIER_PROFILES } from '../src/games/bedwars/bots/profiles'
import { TellyBridge } from '../src/games/bedwars/bots/tactics/bridge'
import { clutchCell, pillarCell, wallCells } from '../src/games/bedwars/bots/tactics/build'
import { BedAssault } from '../src/games/bedwars/bots/tactics/bed'
import { DuelController, duelStyle } from '../src/games/bedwars/bots/tactics/duel'
import type { Player } from '../src/games/bedwars/room'

function body(overrides: Partial<Player> = {}): Player {
  return {
    x: 0.5,
    y: 1.2,
    z: 0.5,
    yaw: 0,
    pitch: 0,
    onGround: false,
    ...overrides,
  } as Player
}

describe('telly bridge', () => {
  test('starts with a jump and lays the next floor cell against a support', () => {
    const world = new World(8, 8, 8)
    world.set(0, 0, 3, STONE)
    const bridge = new TellyBridge()
    const profile = BOT_TIER_PROFILES.technoblade
    const self = body({ z: 3.5, onGround: true })
    const ground = bridge.step(world, self, profile, 20, 32)
    expect(ground.input.jump).toBe(true)
    const airborne = bridge.step(world, body({ z: 3.5 }), profile, 21, 32)
    expect(airborne.place).not.toBeUndefined()
    expect(airborne.place!.face).toEqual([0, 0, -1])
  })

  test('does not lay a block without a support or block reserve', () => {
    const world = new World(8, 8, 8)
    const bridge = new TellyBridge()
    const profile = BOT_TIER_PROFILES.technoblade
    expect(bridge.step(world, body(), profile, 20, 32).place).toBeUndefined()
    world.set(0, 0, 0, STONE)
    expect(bridge.step(world, body(), profile, 20, 2).input.jump).toBe(false)
  })
})

describe('combat builds', () => {
  test('places a wall cell between the bot and the enemy', () => {
    const world = new World(8, 8, 8)
    world.set(0, 0, 4, STONE)
    const self = body({ y: 1, z: 3.5, onGround: true })
    const enemy = body({ y: 1, z: 7 })
    const cells = wallCells(world, self, enemy)
    expect(cells).toHaveLength(1)
    expect(cells[0].face).toEqual([0, 1, 0])
  })

  test('a clutch cell only exists while airborne over a support', () => {
    const world = new World(8, 8, 8)
    world.set(0, 0, 0, STONE)
    expect(clutchCell(world, body({ y: 2.2 }))!.face).toEqual([0, 1, 0])
    expect(clutchCell(world, body({ y: 2.2, onGround: true }))).toBeNull()
  })

  test('the pillar cell is the clutch cell, not a second copy of it', () => {
    expect(pillarCell).toBe(clutchCell)
  })
})

function floor(world: World, size: number): void {
  for (let x = 0; x < size; x++) for (let z = 0; z < size; z++) world.set(x, 0, z, STONE)
}

const target = (overrides: Partial<{ id: number; x: number; y: number; z: number; sprinting: boolean }> = {}) => ({
  id: 2,
  x: 6.5,
  y: 1,
  z: 3.5,
  sprinting: false,
  ...overrides,
})

describe('duel tactics', () => {
  const wallView = (world: World) => ({
    world,
    self: body({ x: 3.5, y: 1, z: 3.5, onGround: true }),
    target: target({ x: 5.5, y: 1, z: 3.5 }),
    profile: BOT_TIER_PROFILES.technoblade,
    tick: 0,
    blocks: 80,
    health: 0.2,
    canSwing: false,
    retreating: true,
  })

  test('a low-health retreat builds a wall, and the reserve blocks it when short', () => {
    const world = new World(8, 8, 8)
    floor(world, 8)
    const controller = new DuelController()
    const view = {
      world,
      self: body({ x: 3.5, y: 1, z: 3.5, onGround: true }),
      target: target({ x: 5.5 }),
      profile: BOT_TIER_PROFILES.technoblade,
      tick: 0,
      blocks: 80,
      health: 0.2,
      canSwing: false,
      retreating: true,
    }
    const wall = controller.step(view)
    expect(wall.build).toBe('wall')
    expect(wall.commands.some((c) => c.t === 'place')).toBe(true)

    const short = new DuelController().step({ ...view, blocks: BOT_TIER_PROFILES.technoblade.blockReserve + 1 })
    expect(short.build).toBeNull()
  })

  test('a height disadvantage jumps first and pillars under itself only while safe', () => {
    const world = new World(8, 8, 8)
    floor(world, 8)
    const controller = new DuelController()
    const view = {
      world,
      self: body({ x: 3.5, y: 1, z: 3.5, onGround: true }),
      target: target({ y: 5 }),
      profile: BOT_TIER_PROFILES.technoblade,
      tick: 0,
      blocks: 80,
      health: 1,
      canSwing: false,
    }
    const jump = controller.step(view)
    expect(jump.reason).toBe('pillar')
    expect(jump.input.jump).toBe(true)
    expect(jump.build).toBeNull()

    const air = controller.step({ ...view, tick: 1, self: body({ x: 3.5, y: 2.2, z: 3.5 }) })
    expect(air.build).toBe('pillar')
    expect(air.commands.some((c) => c.t === 'place')).toBe(true)

    const ground = new DuelController().step({ ...view, blocks: 2 })
    expect(ground.reason).not.toBe('pillar')
  })

  test('a knockback over the void spends one block on a clutch, never more', () => {
    const world = new World(8, 8, 8)
    world.set(2, 4, 3, STONE)
    const clutch = new DuelController().step({
      world,
      self: body({ x: 3.5, y: 5.2, z: 3.5 }),
      target: target(),
      profile: BOT_TIER_PROFILES.technoblade,
      tick: 0,
      blocks: 1,
      health: 0.5,
      canSwing: false,
    })
    expect(clutch.build).toBe('clutch')
    expect(clutch.commands.filter((c) => c.t === 'place')).toHaveLength(1)

    const safeWorld = new World(8, 8, 8)
    safeWorld.set(3, 0, 3, STONE)
    const safe = new DuelController().step({
      world: safeWorld,
      self: body({ x: 3.5, y: 1.2, z: 3.5 }),
      target: target(),
      profile: BOT_TIER_PROFILES.technoblade,
      tick: 0,
      blocks: 8,
      health: 1,
      canSwing: false,
    })
    expect(safe.build).toBeNull()
  })

  test('strafes both ways, keeps the caller aim, and w-taps after a swing', () => {
    const world = new World(8, 8, 8)
    floor(world, 8)
    const controller = new DuelController()
    const view = {
      world,
      self: body({ x: 3.5, y: 1.2, z: 3.5, yaw: 0.7, pitch: 0.2 }),
      target: target({ x: 5.5 }),
      profile: BOT_TIER_PROFILES.hard,
      tick: 0,
      blocks: 8,
      health: 1,
      canSwing: true,
    }
    const first = controller.step(view)
    expect(first.input.yaw).toBe(0.7)
    expect(first.input.pitch).toBe(0.2)
    expect(first.commands.some((c) => c.t === 'attack' && c.target === 2)).toBe(true)

    const tapped = controller.step({ ...view, tick: 1 })
    expect(tapped.input.forward).toBe(0)
    expect(tapped.input.sprint).toBe(false)

    const sides = new Set<number>()
    for (let tick = 10; tick < 50; tick++) sides.add(controller.step({ ...view, tick, canSwing: false }).input.strafe > 0 ? 1 : -1)
    expect(sides.has(1)).toBe(true)
    expect(sides.has(-1)).toBe(true)
  })

  test('jumps into a crit instead of swinging from the ground', () => {
    const world = new World(8, 8, 8)
    floor(world, 8)
    const controller = new DuelController()
    const view = {
      world,
      self: body({ x: 3.5, y: 1, z: 3.5, onGround: true }),
      target: target({ x: 5.5 }),
      profile: BOT_TIER_PROFILES.technoblade,
      tick: 0,
      blocks: 8,
      health: 1,
      canSwing: true,
    }
    const jump = controller.step(view)
    expect(jump.input.jump).toBe(true)
    expect(jump.commands.some((c) => c.t === 'attack')).toBe(false)
    const falling = controller.step({ ...view, tick: 1, self: body({ x: 3.5, y: 1.4, z: 3.5 }) })
    expect(falling.commands.some((c) => c.t === 'attack')).toBe(true)
  })

  test('technoblade builds more than expert in the same staged duel and is still fallible', () => {
    const world = new World(16, 8, 16)
    for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) world.set(x, 0, z, STONE)
    const run = (tier: 'expert' | 'technoblade'): number => {
      const controller = new DuelController()
      let places = 0
      for (let tick = 0; tick < 60; tick++) {
        const step = controller.step({
          world,
          self: body({ x: 3.5, y: 1, z: 3.5, onGround: true }),
          target: target({ x: 7.5, sprinting: true }),
          profile: BOT_TIER_PROFILES[tier],
          tick,
          blocks: 120,
          health: 0.9,
          canSwing: false,
        })
        places += step.commands.filter((c) => c.t === 'place').length
      }
      return places
    }
    const tech = run('technoblade')
    const expert = run('expert')
    expect(tech).toBeGreaterThan(expert)
    expect(duelStyle(BOT_TIER_PROFILES.technoblade).wTap).toBe(true)
    expect(BOT_TIER_PROFILES.technoblade.aimError).toBeGreaterThan(0)
    expect(BOT_TIER_PROFILES.expert.aimError).toBeGreaterThan(0)
  })

  test('a 0-block clutch never emits a dead place command', () => {
    const world = new World(8, 8, 8)
    world.set(2, 4, 3, STONE)
    const step = new DuelController().step({
      world,
      self: body({ x: 3.5, y: 5.2, z: 3.5 }),
      target: target(),
      profile: BOT_TIER_PROFILES.technoblade,
      tick: 0,
      blocks: 0,
      health: 0.5,
      canSwing: false,
    })
    expect(step.build).toBeNull()
    expect(step.commands.some((c) => c.t === 'place')).toBe(false)
  })

  test('walls stay out of the bot, the enemy and ally bodies', () => {
    const world = new World(8, 8, 8)
    floor(world, 8)
    expect(new DuelController().step(wallView(world)).build).toBe('wall')

    const inside = new DuelController().step({ ...wallView(world), target: target({ x: 4.5, y: 1, z: 3.5 }) })
    expect(inside.build).toBeNull()
    expect(inside.commands.some((c) => c.t === 'place')).toBe(false)

    const blockedByAlly = new DuelController().step({ ...wallView(world), allies: [{ x: 4.5, y: 1, z: 3.5 }] })
    expect(blockedByAlly.build).toBeNull()
    expect(blockedByAlly.commands.some((c) => c.t === 'place')).toBe(false)
  })

  test('the wall cooldown stops a rebuild every tick', () => {
    const world = new World(8, 8, 8)
    floor(world, 8)
    const controller = new DuelController()
    const view = wallView(world)
    expect(controller.step({ ...view, tick: 0 }).build).toBe('wall')
    expect(controller.step({ ...view, tick: 1 }).build).toBeNull()
    expect(controller.step({ ...view, tick: 19 }).build).toBeNull()
    expect(controller.step({ ...view, tick: 20 }).build).toBe('wall')
  })

  test('a block at head height cancels the pillar for that tick', () => {
    const world = new World(8, 8, 8)
    floor(world, 8)
    const view = {
      world,
      self: body({ x: 3.5, y: 1, z: 3.5, onGround: true }),
      target: target({ y: 5 }),
      profile: BOT_TIER_PROFILES.technoblade,
      tick: 0,
      blocks: 80,
      health: 1,
      canSwing: false,
    }
    const clear = new DuelController().step(view)
    expect(clear.reason).toBe('pillar')
    expect(clear.input.jump).toBe(true)

    const lowCeiling = world.clone()
    lowCeiling.set(3, 3, 3, STONE)
    const blocked = new DuelController().step({ ...view, world: lowCeiling })
    expect(blocked.reason).not.toBe('pillar')
    expect(blocked.input.jump).toBe(false)
    expect(blocked.commands.some((c) => c.t === 'place')).toBe(false)
  })
})

describe('bed tactics', () => {
  function bedWorld(): World {
    const world = new World(16, 8, 16)
    for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) world.set(x, 0, z, STONE)
    world.set(10, 1, 10, BED.red)
    world.set(11, 1, 10, BED.red)
    return world
  }

  const bed = { x: 10, y: 1, z: 10, team: 'red' as const }
  const base = { profile: BOT_TIER_PROFILES.technoblade, tick: 0, blocks: 80, defenders: [], allies: [], ownTeam: 'blue' as const }

  const placeCell = (place: { x: number; y: number; z: number; face: readonly number[] }): number[] => [
    place.x + place.face[0],
    place.y + place.face[1],
    place.z + place.face[2],
  ]

  test('approaches a distant bed, then breaks the near half in reach', () => {
    const world = bedWorld()
    const assault = new BedAssault()
    const approach = assault.step({ ...base, world, self: body({ x: 2.5, y: 1, z: 2.5, onGround: true }), bed })
    expect(approach.phase).toBe('approach')
    expect(approach.input.forward).toBe(1)
    expect(approach.commands.some((c) => c.t === 'dig')).toBe(false)

    const inReach = new BedAssault().step({ ...base, world, self: body({ x: 8.5, y: 1, z: 10.5, onGround: true }), bed })
    expect(inReach.phase).toBe('break')
    const dig = inReach.commands.find((c) => c.t === 'dig')
    expect(dig && dig.t === 'dig' ? dig.target : null).toEqual([10, 1, 10])
  })

  test('marks the dig done only when the server-side progress is nearly complete', () => {
    const world = bedWorld()
    const self = body({ x: 8.5, y: 1, z: 10.5, onGround: true, dig: { x: 10, y: 1, z: 10, progress: 0.9 } })
    const step = new BedAssault().step({ ...base, world, self, bed })
    const dig = step.commands.find((c) => c.t === 'dig')
    expect(dig && dig.t === 'dig' ? dig.done : false).toBe(true)
  })

  test('covers a break without placing inside itself or on the bed', () => {
    const world = bedWorld()
    const self = body({ x: 8.5, y: 1, z: 10.5, onGround: true })
    const step = new BedAssault().step({
      ...base,
      world,
      self,
      bed,
      defenders: [{ id: 3, x: 8.5, y: 1, z: 13.5 }],
    })
    expect(step.phase).toBe('break')
    expect(step.place).not.toBeNull()
    const cell = [step.place!.x + step.place!.face[0], step.place!.y + step.place!.face[1], step.place!.z + step.place!.face[2]]
    expect(cell).not.toEqual([Math.floor(self.x), Math.floor(self.y), Math.floor(self.z)])
    expect(cell).not.toEqual([10, 1, 10])
    expect(cell).not.toEqual([11, 1, 10])
  })

  test('refuses to dig its own bed', () => {
    const world = bedWorld()
    const step = new BedAssault().step({
      ...base,
      world,
      self: body({ x: 8.5, y: 1, z: 10.5, onGround: true }),
      bed: { ...bed, team: 'blue' },
    })
    expect(step.commands.some((c) => c.t === 'dig')).toBe(false)
  })

  test('disengages when the bed is gone, and regroups with no blocks', () => {
    const world = bedWorld()
    const escape = new BedAssault().step({
      ...base,
      world,
      self: body({ x: 8.5, y: 1, z: 10.5, onGround: true }),
      bed: null,
    })
    expect(escape.phase).toBe('escape')
    expect(escape.commands.some((c) => c.t === 'dig' || c.t === 'attack')).toBe(false)
    expect(escape.input.forward).toBe(1)

    const regroup = new BedAssault().step({
      ...base,
      world,
      self: body({ x: 8.5, y: 1, z: 10.5, onGround: true }),
      bed: null,
      blocks: 0,
    })
    expect(regroup.phase).toBe('regroup')
  })

  test('raises the roof over the bed when the defender has the height', () => {
    const world = bedWorld()
    const step = new BedAssault().step({
      ...base,
      world,
      self: body({ x: 8.5, y: 1, z: 10.5, onGround: true }),
      bed,
      defenders: [{ id: 3, x: 8.5, y: 4, z: 13.5 }],
    })
    expect(step.phase).toBe('break')
    expect(step.reason).toBe('cover')
    expect(placeCell(step.place!)).toEqual([bed.x, bed.y + 1, bed.z])
  })

  test('cover waits out its cooldown between placements', () => {
    const world = bedWorld()
    const controller = new BedAssault()
    const view = {
      ...base,
      world,
      self: body({ x: 8.5, y: 1, z: 10.5, onGround: true }),
      bed,
      defenders: [{ id: 3, x: 8.5, y: 1, z: 13.5 }],
    }
    expect(controller.step({ ...view, tick: 0 }).place).not.toBeNull()
    expect(controller.step({ ...view, tick: 5 }).place).toBeNull()
    expect(controller.step({ ...view, tick: 10 }).place).not.toBeNull()
  })

  test('clutches during the break phase when the floor is gone', () => {
    const world = bedWorld()
    world.set(7, 4, 10, STONE)
    const step = new BedAssault().step({
      ...base,
      world,
      self: body({ x: 8.5, y: 5.2, z: 10.5 }),
      bed,
    })
    expect(step.phase).toBe('break')
    expect(step.commands.some((c) => c.t === 'dig')).toBe(true)
    expect(step.commands.filter((c) => c.t === 'place')).toHaveLength(1)
    expect(placeCell(step.place!)).toEqual([8, 4, 10])
  })

  test('clutches while leaving its own bed, and not with no blocks', () => {
    const world = bedWorld()
    world.set(7, 4, 10, STONE)
    const view = {
      ...base,
      world,
      self: body({ x: 8.5, y: 5.2, z: 10.5 }),
      bed: { ...bed, team: 'blue' as const },
    }
    const step = new BedAssault().step(view)
    expect(step.phase).toBe('regroup')
    expect(step.reason).toBe('own-bed')
    const place = step.commands.find((c) => c.t === 'place')
    expect(place && place.t === 'place' ? placeCell(place) : null).toEqual([8, 4, 10])

    const broke = new BedAssault().step({ ...view, blocks: 0 })
    expect(broke.commands.some((c) => c.t === 'place')).toBe(false)
  })
})
