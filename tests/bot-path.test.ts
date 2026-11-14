import { describe, expect, test } from 'bun:test'
import { World } from '../src/engine/world'
import { STONE } from '../src/games/bedwars/blocks'
import { findDetour } from '../src/games/bedwars/bots/path'

describe('bot path detours', () => {
  test('finds a clear side cell around a blocking wall', () => {
    const world = new World(8, 8, 8)
    for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) world.set(x, 0, z, STONE)
    world.set(2, 1, 2, STONE)
    world.set(2, 2, 2, STONE)
    expect(findDetour(world, 2.5, 3.5, 1, 0, -1)).toEqual({ strafe: 1, forward: 0.35 })
    expect(findDetour(world, 2.5, 3.5, 1, 0, 1)).not.toBeNull()
  })

  test('does not sidestep into a gap', () => {
    const world = new World(8, 8, 8)
    world.set(2, 0, 2, STONE)
    expect(findDetour(world, 2.5, 3.5, 1, 0, -1)).toBeNull()
  })
})
