import { describe, expect, test } from 'bun:test'
import { BOT_PROFILES, installBots } from '../src/games/bedwars/bots'
import { TPS } from '../src/games/bedwars/constants'
import { Room } from '../src/games/bedwars/room'
import { arenaRules, BOT_LEVELS } from '../src/games/bedwars/rules'

describe('bot opening economy', () => {
  test('Expert does not wait 96 seconds for an 80-iron solo kit', () => {
    // A solo forge is one iron per 24 ticks, so 80 iron is 96 seconds. After
    // navigation made Easy's 24-iron opening functional, that wait lost the
    // existing Expert-vs-Easy round. Team modes already cap at 16.
    expect(BOT_PROFILES.expert.tripIron).toBeLessThanOrEqual(32)
  })

  for (const level of BOT_LEVELS) {
    test(`${level} bots leave base with blocks inside 45 seconds`, () => {
      const room = new Room({
        rules: arenaRules({
          teams: ['red', 'blue'],
          teamSize: 4,
          countdownTicks: 0,
          minPlayers: 0,
          endTicks: 1_000_000,
          botLevel: level,
        }),
        seed: 3,
      })
      installBots(room)
      room.startRound()
      for (let i = 0; i < 45 * TPS; i++) room.tick()

      // A real first contact can kill bots inside 45 seconds. Judge the bots
      // that are still on their original life; a respawn legitimately starts
      // the opening trip again. Pool both teams so the sample is not one death.
      const originalLife = [...room.players.values()].filter((p) => p.brain && p.alive && p.team && p.stats.deaths === 0)
      // Navigation gets bots into contact sooner, so fewer may survive 45 s.
      // Every survivor on its original life still has to have made the sortie.
      expect(originalLife.length).toBeGreaterThanOrEqual(2)
      for (const p of originalLife) {
        const opening = (p.brain as unknown as { openingTelemetry: { sortied: boolean; firstSortieBlocks: number; leftBase: boolean } }).openingTelemetry
        expect(opening.sortied).toBe(true)
        expect(opening.firstSortieBlocks).toBeGreaterThanOrEqual(16)
        // They may legitimately return to defend; reaching the field is the
        // opening behaviour this test protects.
        expect(opening.leftBase).toBe(true)
      }
    })
  }
})
