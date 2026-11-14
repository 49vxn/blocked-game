import { describe, expect, test } from 'bun:test'
import { clampLookDelta, MAX_LOOK_DELTA } from '../src/games/bedwars/client/look'

describe('mouse look delta', () => {
  test('keeps a normal movement delta unchanged', () => {
    expect(clampLookDelta(12, -8)).toEqual({ x: 12, y: -8 })
  })

  test('clamps a huge delta instead of dropping it, so the mouse never freezes', () => {
    expect(clampLookDelta(5000, -1200)).toEqual({ x: MAX_LOOK_DELTA, y: -MAX_LOOK_DELTA })
    expect(clampLookDelta(-900, 0)).toEqual({ x: -MAX_LOOK_DELTA, y: 0 })
  })

  test('ignores only a non-finite event', () => {
    expect(clampLookDelta(Number.NaN, 0)).toBeNull()
    expect(clampLookDelta(0, Number.POSITIVE_INFINITY)).toBeNull()
  })
})
