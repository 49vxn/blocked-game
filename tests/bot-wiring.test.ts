import { describe, expect, test } from 'bun:test'
import { rng } from '../src/engine/random'
import { STONE } from '../src/games/bedwars/blocks'
import { Bot } from '../src/games/bedwars/bots'
import { sandbox, TestClient } from './room-helpers'

describe('bot perception wiring', () => {
  test('the live enemy list follows line of sight, not the room player table', () => {
    const room = sandbox()
    const brain = new Bot('blue', rng(1))
    const self = room.connect('Bot', null, brain)
    self.team = 'blue'
    const human = new TestClient(room, 'Human')
    human.p.team = 'red'
    room.teleport(self, 40.5, 20, 44.5, 0, 0)
    room.teleport(human.p, 40.5, 20, 38.5, 0, 0)

    const wired = brain as any
    wired.updatePerception(room, self)
    expect(wired.enemies(room).map((q: { id: number }) => q.id)).toContain(human.p.id)

    // A solid wall between the bot's eyes and the human body.
    for (const y of [20, 21]) for (const x of [40, 41]) room.world.set(x, y, 41, STONE)
    wired.updatePerception(room, self)
    expect(wired.enemies(room)).toHaveLength(0)
  })
})
