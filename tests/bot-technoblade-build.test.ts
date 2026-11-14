import { describe, expect, test } from 'bun:test'
import { addItem } from '../src/engine/inventory'
import { rng } from '../src/engine/random'
import { STONE } from '../src/games/bedwars/blocks'
import { Bot } from '../src/games/bedwars/bots'
import type { ClientMessage } from '../src/games/bedwars/protocol'
import { sandbox, TestClient } from './room-helpers'

function setup(level: 'technoblade' | 'expert') {
  const room = sandbox()
  const brain = new Bot('blue', rng(21), false, level)
  const p = room.connect('Bot', null, brain)
  p.team = 'blue'
  p.alive = true
  p.health = 5
  room.teleport(p, 40.5, 20, 36.5, 0, 0)
  const enemy = new TestClient(room, 'Enemy')
  enemy.p.team = 'red'
  room.teleport(enemy.p, 42.5, 20, 36.5, 0, 0)
  addItem(p.inventory, 'wool', 64)
  room.tickCount = 10
  ;(brain as any).updatePerception(room, p)
  const places: ClientMessage[] = []
  const receive = room.receive.bind(room)
  room.receive = (id, msg) => {
    if (msg.t === 'place') places.push(msg)
    return receive(id, msg)
  }
  return { room, brain, p, enemy, places }
}

describe('Technoblade combat builds', () => {
  test('places a clutch block while falling onto a support', () => {
    const room = sandbox()
    const brain = new Bot('blue', rng(22), false, 'technoblade')
    const p = room.connect('Bot', null, brain)
    p.team = 'blue'
    p.alive = true
    p.health = 20
    room.teleport(p, 40.5, 22.5, 36.5, 0, 0)
    p.onGround = false
    p.vy = -1
    room.world.set(40, 20, 36, STONE)
    addItem(p.inventory, 'wool', 64)
    room.tickCount = 10
    ;(brain as any).updatePerception(room, p)
    const enemy = new TestClient(room, 'Enemy')
    enemy.p.team = 'red'
    room.teleport(enemy.p, 42.5, 20, 36.5, 0, 0)
    const places: ClientMessage[] = []
    const receive = room.receive.bind(room)
    room.receive = (id, msg) => {
      if (msg.t === 'place') places.push(msg)
      return receive(id, msg)
    }
    ;(brain as any).fight(room, p, enemy.p)
    expect(places.length).toBeGreaterThan(0)
    expect(room.world.get(40, 21, 36)).not.toBe(0)
  })

  test('walls off a close enemy at low health; Expert does not', () => {
    const techno = setup('technoblade')
    ;(techno.brain as any).fight(techno.room, techno.p, techno.enemy.p)
    expect(techno.places.length).toBeGreaterThan(0)
    expect(techno.room.world.get(41, 20, 36)).not.toBe(0)

    const expert = setup('expert')
    ;(expert.brain as any).fight(expert.room, expert.p, expert.enemy.p)
    expect(expert.places).toHaveLength(0)
  })
})
