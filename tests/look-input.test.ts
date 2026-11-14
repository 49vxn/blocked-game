import { describe, expect, test } from 'bun:test'
import { clampLookDelta, MAX_LOOK_DELTA } from '../src/games/bedwars/client/look'

describe('mouse look input', () => {
  test('keeps a normal movement delta', () => {
    expect(clampLookDelta(12, -8)).toEqual({ x: 12, y: -8 })
  })

  test('clamps a huge driver/pointer-lock delta instead of dropping the event', () => {
    expect(clampLookDelta(900, -900)).toEqual({ x: MAX_LOOK_DELTA, y: -MAX_LOOK_DELTA })
  })

  test('only ignores non-finite movement', () => {
    expect(clampLookDelta(Number.NaN, 0)).toBeNull()
    expect(clampLookDelta(0, Number.POSITIVE_INFINITY)).toBeNull()
  })
})
