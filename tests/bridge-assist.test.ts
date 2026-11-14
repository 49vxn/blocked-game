import { describe, expect, test } from 'bun:test'
import { World } from '../src/engine/world'
import { STONE } from '../src/games/bedwars/blocks'
import { bridgePlacement, type BridgeFoot } from '../src/games/bedwars/client/bridge'

const foot = (over: Partial<BridgeFoot> = {}): BridgeFoot => ({
  x: 3.5,
  y: 5,
  z: 2.5,
  yaw: -Math.PI / 2,
  onGround: true,
  sneaking: false,
  ...over,
})

function platform(x0: number, x1: number): World {
  const world = new World(8, 8, 8)
  for (let x = x0; x <= x1; x++) world.set(x, 4, 2, STONE)
  return world
}

describe('bridge assist target', () => {
  test('forward places the next floor cell at a one-block edge', () => {
    const world = platform(0, 3)
    expect(bridgePlacement('forward', foot(), { forward: true, back: false }, world, null, false)).toEqual({
      support: { x: 3, y: 4, z: 2 },
      target: { x: 4, y: 4, z: 2 },
      face: [1, 0, 0],
    })
  })

  test('forward places nothing on flat ground or into a wall', () => {
    const flat = platform(0, 4)
    expect(bridgePlacement('forward', foot(), { forward: true, back: false }, flat, null, false)).toBeNull()

    const wall = platform(0, 3)
    wall.set(4, 4, 2, STONE)
    expect(bridgePlacement('forward', foot(), { forward: true, back: false }, wall, null, false)).toBeNull()
  })

  test('forward only bridges over a gap, not onto a lower floor', () => {
    const world = platform(0, 3)
    world.set(4, 3, 2, STONE)
    expect(bridgePlacement('forward', foot(), { forward: true, back: false }, world, null, false)).toBeNull()
  })

  test('forward needs forward input, not backward, and does not require sneak', () => {
    const world = platform(0, 3)
    expect(bridgePlacement('forward', foot(), { forward: false, back: false }, world, null, false)).toBeNull()
    expect(bridgePlacement('forward', foot(), { forward: true, back: true }, world, null, false)).toBeNull()
    expect(bridgePlacement('forward', foot({ sneaking: true }), { forward: true, back: false }, world, null, false)).not.toBeNull()
  })

  test('bedrock places behind only while sneaking and backing', () => {
    const world = platform(2, 3)
    expect(bridgePlacement('bedrock', foot({ x: 2.5, sneaking: true }), { forward: false, back: true }, world, null, false)).toEqual({
      support: { x: 2, y: 4, z: 2 },
      target: { x: 1, y: 4, z: 2 },
      face: [-1, 0, 0],
    })
    expect(bridgePlacement('bedrock', foot({ x: 2.5, sneaking: false }), { forward: false, back: true }, world, null, false)).toBeNull()
    expect(bridgePlacement('bedrock', foot({ x: 2.5, sneaking: true }), { forward: true, back: true }, world, null, false)).toBeNull()
  })

  test('a two-tick coyote cell allows the last block after stepping off the edge', () => {
    const world = platform(2, 2)
    const airborne = foot({ x: 2.5, y: 5.4, onGround: false })
    expect(bridgePlacement('forward', airborne, { forward: true, back: false }, world, { x: 2, y: 4, z: 2 }, true)).toEqual({
      support: { x: 2, y: 4, z: 2 },
      target: { x: 3, y: 4, z: 2 },
      face: [1, 0, 0],
    })
    expect(bridgePlacement('forward', airborne, { forward: true, back: false }, world, { x: 2, y: 4, z: 2 }, false)).toBeNull()
  })

  test('never places without a solid support', () => {
    const world = new World(8, 8, 8)
    expect(bridgePlacement('forward', foot(), { forward: true, back: false }, world, null, false)).toBeNull()
    expect(bridgePlacement('bedrock', foot({ sneaking: true }), { forward: false, back: true }, world, null, false)).toBeNull()
  })
})
