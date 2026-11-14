import { describe, expect, test } from 'bun:test'
import { stepMovement } from '../src/engine/physics'
import { rng } from '../src/engine/random'
import { STONE } from '../src/games/bedwars/blocks'
import { Bot } from '../src/games/bedwars/bots'
import { sandbox } from './room-helpers'

describe('bot navigation integration', () => {
  test('walks around a map wall instead of digging it', () => {
    const room = sandbox()
    const brain = new Bot('blue', rng(4), false, 'normal')
    const p = room.connect('Walker', null, brain)
    p.team = 'blue'
    p.alive = true
    room.teleport(p, 30.5, 20, 36.5, 0, 0)
    // Two high and five wide: too tall to step over and not diggable map blocks.
    for (let z = 33; z <= 38; z++) {
      room.world.set(37, 20, z, STONE)
      room.world.set(37, 21, z, STONE)
    }

    for (let i = 0; i < 240; i++) {
      const step = (brain as any).walkTo(room, p, 44.5, 36.5, false, 0.45)
      stepMovement(room.world, p, step.input)
      if (step.arrived) break
    }
    expect(Math.hypot(p.x - 44.5, p.z - 36.5)).toBeLessThan(2)
    const nav = (brain as any).navigationTelemetry
    expect(nav.replans).toBeGreaterThan(0)
  })

  test('the higher-id bot yields when two bots meet head-on', () => {
    const room = sandbox()
    const a = new Bot('blue', rng(5), false, 'normal')
    const b = new Bot('blue', rng(6), false, 'normal')
    const pa = room.connect('A', null, a)
    const pb = room.connect('B', null, b)
    pa.team = 'blue'
    pb.team = 'blue'
    pa.alive = true
    pb.alive = true
    room.teleport(pa, 30.5, 20, 30.5, 0, 0)
    room.teleport(pb, 31.8, 20, 30.5, 0, 0)

    const forward = (brain: Bot, p: typeof pa, tx: number) => (brain as any).walkTo(room, p, tx, 30.5, false, 0.45).input.forward
    expect(forward(a, pa, 34.5)).toBeGreaterThan(0)
    expect(forward(b, pb, 27.5)).toBe(0)
  })

  test('a yielder backs out when its side-step cell is blocked', () => {
    const room = sandbox()
    const a = new Bot('blue', rng(13), false, 'normal')
    const b = new Bot('blue', rng(14), false, 'normal')
    const pa = room.connect('A', null, a)
    const pb = room.connect('B', null, b)
    pa.team = 'blue'
    pb.team = 'blue'
    pa.alive = true
    pb.alive = true
    // A lower-id bot is ahead and blocked by a map wall; B is behind and must
    // yield. The corridor's side cells are walls, so strafing cannot work.
    room.teleport(pb, 30.5, 20, 36.5, 0, 0)
    room.teleport(pa, 31.5, 20, 36.5, 0, 0)
    for (let x = 28; x <= 40; x++) for (const z of [35, 37]) {
      room.world.set(x, 20, z, STONE)
      room.world.set(x, 21, z, STONE)
    }
    // Close both ends so A cannot route around the blocking wall.
    for (const x of [29, 37]) for (const z of [35, 36, 37]) for (let y = 20; y <= 21; y++) room.world.set(x, y, z, STONE)
    for (let y = 20; y <= 21; y++) room.world.set(32, y, 36, STONE)

    let backedOut = false
    let furthestBack = pb.x
    for (let i = 0; i < 120; i++) {
      room.tickCount++
      const ia = (a as any).walkTo(room, pa, 40.5, 36.5, false, 0.45).input
      const ib = (b as any).walkTo(room, pb, 40.5, 36.5, false, 0.45).input
      if (ib.forward < 0) backedOut = true
      stepMovement(room.world, pa, ia)
      stepMovement(room.world, pb, ib)
      furthestBack = Math.min(furthestBack, pb.x)
    }
    expect(backedOut).toBe(true)
    expect(furthestBack).toBeLessThan(30.45)
    // Once the back-out hits the rear wall, the retry window must let it move
    // forward again rather than yielding forever.
    expect(pb.x).toBeGreaterThan(30.7)
  })

  test('a sealed bot drops an unreachable waypoint after 20 stuck ticks', () => {
    const room = sandbox()
    const brain = new Bot('blue', rng(15), false, 'normal')
    const p = room.connect('Trapped', null, brain)
    p.team = 'blue'
    p.alive = true
    room.teleport(p, 30.5, 20, 36.5, 0, 0)
    for (let x = 29; x <= 31; x++) for (let z = 35; z <= 37; z++) {
      if (x === 30 && z === 36) continue
      for (let y = 20; y <= 21; y++) room.world.set(x, y, z, STONE)
    }
    ;(brain as any).path = [[40.5, 36.5]]

    for (let i = 0; i < 25; i++) {
      room.tickCount++
      const step = (brain as any).followPath(room, p, () => {})
      stepMovement(room.world, p, step)
      if ((brain as any).path.length === 0) break
    }
    expect((brain as any).path.length).toBe(0)
    expect((brain as any).stuck).toBe(0)
  })

  test('two bots swap ends in a corridor without overlapping', () => {
    const room = sandbox()
    const a = new Bot('blue', rng(7), false, 'normal')
    const b = new Bot('blue', rng(8), false, 'normal')
    const pa = room.connect('A', null, a)
    const pb = room.connect('B', null, b)
    pa.team = 'blue'
    pb.team = 'blue'
    pa.alive = true
    pb.alive = true
    room.teleport(pa, 30.5, 20, 30.5, 0, 0)
    room.teleport(pb, 31.8, 20, 30.5, 0, 0)

    let closest = Number.POSITIVE_INFINITY
    for (let i = 0; i < 240; i++) {
      const ia = (a as any).walkTo(room, pa, 34.5, 30.5, false, 0.45).input
      const ib = (b as any).walkTo(room, pb, 27.5, 30.5, false, 0.45).input
      stepMovement(room.world, pa, ia)
      stepMovement(room.world, pb, ib)
      closest = Math.min(closest, Math.hypot(pa.x - pb.x, pa.z - pb.z))
      if (Math.hypot(pa.x - 34.5, pa.z - 30.5) < 0.8 && Math.hypot(pb.x - 27.5, pb.z - 30.5) < 0.8) break
    }
    expect(closest).toBeGreaterThan(0.6)
    expect(Math.hypot(pa.x - 34.5, pa.z - 30.5)).toBeLessThan(2)
    expect(Math.hypot(pb.x - 27.5, pb.z - 30.5)).toBeLessThan(2)
  })
})
