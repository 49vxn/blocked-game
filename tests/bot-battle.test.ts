import { describe, expect, test } from 'bun:test'
import { createBedwarsRoom } from '../src/games/bedwars/server'
import { BOT_LEVELS } from '../src/games/bedwars/rules'
import { TestClient, ticks } from './room-helpers'

describe('4v4v4v4 bot battle', () => {
  test('starts 16 bots, one of each tier on every team, with a spectator human', () => {
    const room = createBedwarsRoom({ world: 'arena', room: 'bot-battle', teamSize: 4, fast: false, battle: true })
    expect(room.phase).toBe('playing')
    expect(room.players.size).toBe(16)
    for (const team of room.teams.values()) {
      const members = [...room.players.values()].filter((p) => p.team === team.team)
      expect(members).toHaveLength(4)
      expect(new Set(members.map((p) => (p.brain as unknown as { level: string }).level))).toEqual(new Set(BOT_LEVELS))
      expect(team.bed).toBe(true)
    }

    const watcher = new TestClient(room, 'Watcher')
    expect(watcher.p.alive).toBe(false)
    expect(watcher.p.eliminated).toBe(true)
    expect(watcher.p.team).toBeNull()
    ticks(room, 40)
    expect(watcher.p.alive).toBe(false)
    expect(room.phase).toBe('playing')
  })
})
