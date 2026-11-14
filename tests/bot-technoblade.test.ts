import { describe, expect, test } from 'bun:test'
import { Bot, installBots } from '../src/games/bedwars/bots'
import { addItem } from '../src/engine/inventory'
import { rng } from '../src/engine/random'
import { Room } from '../src/games/bedwars/room'
import { sandboxRules } from '../src/games/bedwars/rules'
import { sandbox } from './room-helpers'
import { TestClient, ticks } from './room-helpers'

describe('sandbox technoblade tier', () => {
  test('/bot technoblade selects the telly profile without changing the lobby levels', () => {
    const room = new Room({ rules: sandboxRules() })
    installBots(room)
    const a = new TestClient(room, 'Ash')
    ticks(room, 61)
    a.send({ t: 'chat', text: '/bot technoblade' })
    const bot = [...room.players.values()].find((p) => p.brain && !p.home)
    expect(bot).toBeDefined()
    const brain = bot!.brain as any
    expect(brain.level).toBe('technoblade')
    expect(brain.tierProfile.bridge).toBe('telly')
    expect(brain.tierProfile.label).toBe('Technoblade')
  })

  test('telly wiring jumps at a gap and places the next floor cell while airborne', () => {
    const room = sandbox()
    const brain = new Bot('blue', rng(2), false, 'technoblade')
    const p = room.connect('Bot', null, brain)
    p.team = 'blue'
    p.alive = true
    room.teleport(p, 40.5, 20, 20.5, 0, 0)
    p.onGround = true
    addItem(p.inventory, 'wool', 16)
    const places: unknown[] = []
    const receive = room.receive.bind(room)
    room.receive = (id, msg) => {
      if (msg.t === 'place') places.push(msg)
      receive(id, msg)
    }
    const ground = (brain as any).walkTo(room, p, 40.5, 10, true)
    expect(ground.input.jump).toBe(true)
    p.onGround = false
    p.y = 20.2
    ;(brain as any).walkTo(room, p, 40.5, 10, true)
    expect(places.length).toBeGreaterThan(0)
  })
})
