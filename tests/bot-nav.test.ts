import { describe, expect, test } from 'bun:test'
import { STONE } from '../src/games/bedwars/blocks'
import { findNavPath, navKey, simplifyNavPath, type NavPoint } from '../src/games/bedwars/bots/nav'
import { World } from '../src/engine/world'

function flat(sx = 14, sy = 7, sz = 14): World {
  const world = new World(sx, sy, sz)
  for (let x = 0; x < sx; x++) for (let z = 0; z < sz; z++) world.set(x, 0, z, STONE)
  return world
}

function start(x = 1, z = 1): NavPoint {
  return { x, y: 1, z, dig: false }
}

function goal(x: number, z: number): NavPoint {
  return { x, y: 1, z, dig: false }
}

function solidPath(world: World, path: NavPoint[]): boolean {
  return path.some((p) => {
    for (let y = p.y; y <= p.y + 1; y++) if (world.isSolid(p.x, y, p.z)) return true
    return false
  })
}

describe('bot navigation A*', () => {
  test('routes around a wall through the only gap', () => {
    const world = flat()
    for (let z = 0; z < 14; z++) for (let y = 1; y <= 2; y++) if (z !== 7) world.set(7, y, z, STONE)
    const path = findNavPath(world, start(), goal(12, 1))
    expect(path).not.toBeNull()
    expect(path!.length).toBeGreaterThan(12)
    expect(path!.some((p) => p.z === 7)).toBe(true)
    expect(solidPath(world, path!)).toBe(false)
  })

  test('returns null for a disconnected island', () => {
    const world = flat()
    for (let z = 0; z < 14; z++) for (let y = 0; y <= 1; y++) world.set(7, y, z, 0)
    expect(findNavPath(world, start(), goal(12, 1))).toBeNull()
  })

  test('steps up one block and drops down again', () => {
    const world = flat()
    for (let z = 0; z < 14; z++) world.set(6, 1, z, STONE)
    for (let z = 0; z < 14; z++) world.set(7, 1, z, STONE)
    const path = findNavPath(world, start(), goal(12, 1))
    expect(path).not.toBeNull()
    expect(path!.some((p) => p.y === 2)).toBe(true)
  })

  test('map blocks are not diggable, but a placed block is when allowed', () => {
    const world = flat()
    // Two blocks high: it cannot be stepped over, so the only route is through.
    for (let z = 0; z < 14; z++) for (let y = 1; y <= 2; y++) world.set(6, y, z, STONE)
    expect(findNavPath(world, start(), goal(12, 1), { canDig: () => false })).toBeNull()

    world.set(6, 1, 1, STONE, true)
    world.set(6, 2, 1, STONE, true)
    expect(findNavPath(world, start(), goal(12, 1), { canDig: () => false })).toBeNull()
    expect(findNavPath(world, start(), goal(12, 1), { canDig: (x, y, z) => x === 6 && y <= 2 && y >= 1 && z === 1 })).not.toBeNull()
  })

  test('soft occupancy makes the route take the other side of a pillar', () => {
    const world = flat()
    world.set(6, 1, 1, STONE)
    world.set(6, 2, 1, STONE)
    const clear = findNavPath(world, start(), goal(12, 1))
    expect(clear).not.toBeNull()
    // Occupy the side the deterministic clear route chose, then require the other side.
    const blocked = clear!.find((p) => p.x === 6 && p.z !== 1)!
    const occupied = new Set([navKey(blocked.x, blocked.y, blocked.z)])
    const avoided = findNavPath(world, start(), goal(12, 1), { occupancy: occupied })
    expect(avoided).not.toBeNull()
    expect(avoided!.some((p) => p.x === blocked.x && p.z === blocked.z)).toBe(false)
    expect(clear).not.toEqual(avoided)
  })

  test('same input produces the same path', () => {
    const world = flat()
    for (let z = 0; z < 14; z++) for (let y = 1; y <= 2; y++) if (z !== 8) world.set(8, y, z, STONE)
    expect(findNavPath(world, start(), goal(12, 1))).toEqual(findNavPath(world, start(), goal(12, 1)))
  })

  test('path simplification keeps corners and never cuts a wall', () => {
    const world = flat()
    for (let z = 0; z < 14; z++) for (let y = 1; y <= 2; y++) if (z !== 7) world.set(7, y, z, STONE)
    const path = findNavPath(world, start(), goal(12, 1))
    expect(path).not.toBeNull()
    const simplified = simplifyNavPath(world, path!)
    expect(simplified.length).toBeLessThanOrEqual(path!.length)
    expect(simplified[0]).toEqual(path![0])
    expect(simplified.at(-1)).toEqual(path!.at(-1))
    expect(solidPath(world, simplified)).toBe(false)
    for (let i = 1; i < simplified.length; i++) {
      const a = simplified[i - 1]
      const b = simplified[i]
      expect(Math.abs(a.x - b.x) + Math.abs(a.z - b.z)).toBeGreaterThan(0)
      expect(a.y).toBe(b.y)
    }
  })
})
