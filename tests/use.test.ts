import { describe, expect, test } from 'bun:test'
import { startsBowDraw } from '../src/games/bedwars/client/use'

describe('holding use', () => {
  test('a held bow starts drawing', () => {
    expect(startsBowDraw('bow', true)).toBe(true)
  })

  test('a bow released before the tick does not start drawing', () => {
    // The queued use reaches secondary() after mouseup already ran.
    expect(startsBowDraw('bow', false)).toBe(false)
  })

  test('a quick tap of any other item still runs its one-shot use', () => {
    expect(startsBowDraw('block', false)).toBe(true)
    expect(startsBowDraw('food', false)).toBe(true)
    expect(startsBowDraw(undefined, false)).toBe(true)
  })
})
