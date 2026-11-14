import { describe, expect, test } from 'bun:test'
import { rng } from '../src/engine/random'
import { STONE } from '../src/games/bedwars/blocks'
import { Bot } from '../src/games/bedwars/bots'
import { TPS } from '../src/games/bedwars/constants'
import type { MoveInput } from '../src/engine/physics'
import type { Player, Room } from '../src/games/bedwars/room'
import type { ClientMessage } from '../src/games/bedwars/protocol'
import type { BotTier } from '../src/games/bedwars/bots/types'
import { sandbox, TestClient } from './room-helpers'

interface TargetingAccess {
  noticed: { id: number; at: number } | null
  updatePerception(room: Room, self: Player): void
  engage(room: Room, self: Player): MoveInput | null
  respawned(room: Room, self: Player): void
  lapseRandom: (() => number) | null
  nextSwing: number
  lapseUntil: number
  lapsePending: boolean
}

function fixture(tier: BotTier = 'expert') {
  const room = sandbox()
  const brain = new Bot('blue', rng(22), false, tier)
  const access = brain as unknown as TargetingAccess
  const self = room.connect('Bot', null, brain)
  self.team = 'blue'
  room.teleport(self, 40.5, 20, 40.5, 0, 0)
  self.onGround = true
  const first = new TestClient(room, 'First').p
  first.team = 'red'
  room.teleport(first, 40.5, 20, 37.5, 0, 0)
  const second = new TestClient(room, 'Second').p
  second.team = 'green'
  room.teleport(second, 42.5, 20, 35.5, 0, 0)
  room.tickCount = 100
  const select = (at = room.tickCount) => {
    room.tickCount = at
    access.updatePerception(room, self)
    access.engage(room, self)
    return access.noticed?.id ?? null
  }
  return { room, brain, access, self, first, second, select }
}

describe('bot committed melee targets', () => {
  test('holds a visible target when a slightly nearer non-threat appears', () => {
    const f = fixture()
    expect(f.select()).toBe(f.first.id)
    f.room.teleport(f.second, 40.8, 20, 37.7, 0, 0)
    expect(f.select(101)).toBe(f.first.id)
    expect(f.access.noticed?.at).toBe(100)
  })

  test('waits until the commitment deadline before accepting a better ordinary target', () => {
    const f = fixture()
    expect(f.select()).toBe(f.first.id)
    f.room.teleport(f.second, 40.8, 20, 38.5, 0, 0)
    const deadline = 100 + Math.ceil(f.brain.tierProfile.commitmentMs * TPS / 1000)
    expect(f.select(deadline - 1)).toBe(f.first.id)
    expect(f.select(deadline)).toBe(f.second.id)
    expect(f.access.noticed?.at).toBe(deadline)
  })

  test('retains a near-equal target after the commitment expires', () => {
    const f = fixture()
    expect(f.select()).toBe(f.first.id)
    f.room.teleport(f.second, 40.8, 20, 37.7, 0, 0)
    expect(f.select(130)).toBe(f.first.id)
    f.room.teleport(f.second, 40.8, 20, 38.2, 0, 0)
    expect(f.select(131)).toBe(f.second.id)
  })

  test('a visible recent attacker overrides commitment even when farther away', () => {
    const f = fixture()
    expect(f.select()).toBe(f.first.id)
    f.self.lastAttacker = { id: f.second.id, tick: 101 }
    expect(f.select(101)).toBe(f.second.id)
  })

  test('a stale attacker does not override an unexpired commitment', () => {
    const f = fixture()
    expect(f.select()).toBe(f.first.id)
    f.self.lastAttacker = { id: f.second.id, tick: 101 - TPS }
    expect(f.select(101)).toBe(f.first.id)
  })

  test('a visible home-bed intruder overrides a closer ordinary target', () => {
    const f = fixture()
    // Blue sandbox bed is at (36, 20, 30). Stand outside its alarm radius.
    f.room.teleport(f.self, 36.5, 20, 36.5, 0, 0)
    f.room.teleport(f.first, 36.5, 20, 34.5, 0, 0)
    f.room.teleport(f.second, 39.5, 20, 27.5, 0, 0)
    expect(f.select()).toBe(f.first.id)
    f.room.teleport(f.second, 39.5, 20, 30.5, 0, 0)
    expect(f.select(101)).toBe(f.second.id)
  })

  test('does not defend a destroyed home bed', () => {
    const f = fixture()
    f.room.teleport(f.self, 36.5, 20, 36.5, 0, 0)
    f.room.teleport(f.first, 36.5, 20, 34.5, 0, 0)
    f.room.teleport(f.second, 39.5, 20, 30.5, 0, 0)
    f.room.teams.get('blue')!.bed = false
    expect(f.select()).toBe(f.first.id)
    expect(f.select(101)).toBe(f.first.id)
  })

  test('a dead committed target is immediately replaced', () => {
    const f = fixture()
    expect(f.select()).toBe(f.first.id)
    f.first.alive = false
    expect(f.select(101)).toBe(f.second.id)
  })

  test('a disconnected committed target is immediately replaced', () => {
    const f = fixture()
    expect(f.select()).toBe(f.first.id)
    f.room.disconnect(f.first.id)
    expect(f.select(101)).toBe(f.second.id)
  })

  test('losing line of sight clears commitment instead of tracking remembered coordinates', () => {
    const f = fixture()
    f.second.alive = false
    expect(f.select()).toBe(f.first.id)
    for (let x = 39; x <= 42; x++) for (let y = 20; y <= 22; y++) f.room.world.set(x, y, 38, STONE)
    expect(f.select(101)).toBeNull()
  })

  test('a hidden attacker cannot be selected through a wall', () => {
    const f = fixture()
    f.second.alive = false
    expect(f.select()).toBe(f.first.id)
    f.self.lastAttacker = { id: f.first.id, tick: 101 }
    for (let x = 39; x <= 42; x++) for (let y = 20; y <= 22; y++) f.room.world.set(x, y, 38, STONE)
    expect(f.select(101)).toBeNull()
  })

  test('an empty visible list clears a previous target', () => {
    const f = fixture()
    expect(f.select()).toBe(f.first.id)
    f.first.alive = false
    f.second.alive = false
    expect(f.select(101)).toBeNull()
  })
})

/** Record actual server attack messages, not just desired swings. */
function trackAttacks(f: ReturnType<typeof fixture>) {
  const attacks: number[] = []
  const receive = f.room.receive.bind(f.room)
  f.room.receive = (id: number, message: ClientMessage) => {
    if (id === f.self.id && message.t === 'attack') attacks.push(f.room.tickCount)
    receive(id, message)
  }
  return attacks
}

describe('bot engagement lapses', () => {
  test('a forced lapse delays a swing once, remains bounded, and preserves the motor gate', () => {
    const f = fixture('expert')
    f.second.alive = false
    f.room.teleport(f.first, 40.5, 20, 38.5, 0, 0)
    f.access.lapseRandom = () => 0
    f.self.protectedTicks = 0
    f.first.protectedTicks = 0
    const attacks = trackAttacks(f)
    f.select(100)
    let trigger = 0
    for (let at = 101; at <= 150 && attacks.length === 0; at++) {
      f.self.yaw = 0
      f.self.pitch = 0
      f.select(at)
      if (!trigger && f.access.lapseUntil > 0) trigger = at
      if (trigger && at < f.access.lapseUntil) expect(attacks).toHaveLength(0)
    }
    expect(trigger).toBeGreaterThan(0)
    expect(f.access.lapseUntil).toBeGreaterThan(trigger)
    expect(f.access.lapseUntil).toBeLessThanOrEqual(trigger + 12)
    expect(attacks.length).toBeGreaterThan(0)
    expect(attacks[0]).toBeGreaterThanOrEqual(f.access.lapseUntil)
  })

  test('a non-lapsing engagement retains the original motor deadline', () => {
    const f = fixture('expert')
    f.second.alive = false
    f.room.teleport(f.first, 40.5, 20, 38.5, 0, 0)
    f.access.lapseRandom = () => 1
    f.self.protectedTicks = 0
    f.first.protectedTicks = 0
    const attacks = trackAttacks(f)
    for (let at = 100; at <= 125 && attacks.length === 0; at++) f.select(at)
    expect(attacks.length).toBeGreaterThan(0)
    expect(attacks[0]).toBeGreaterThan(100)
    expect(attacks[0]).toBeLessThanOrEqual(120)
  })

  test('rolls a lapse once per engagement rather than once per tick', () => {
    const f = fixture('expert')
    f.second.alive = false
    f.room.teleport(f.first, 40.5, 20, 38.5, 0, 0)
    let rolls = 0
    f.access.lapseRandom = () => { rolls++; return 0 }
    for (let at = 100; at <= 140; at++) f.select(at)
    expect(rolls).toBe(1)
    // Expert's motor reaction is shorter than Easy's, so assert the bounded
    // lapse window rather than a tier-specific literal tick.
    expect(f.access.lapseUntil).toBeGreaterThan(100)
    expect(f.access.lapseUntil).toBeLessThanOrEqual(130)
    expect(f.access.lapsePending).toBe(false)
  })

  test('respawning clears both commitment and an unconsumed lapse', () => {
    const f = fixture('expert')
    f.access.lapseRandom = () => 0
    expect(f.select()).toBe(f.first.id)
    expect(f.access.lapsePending).toBe(true)
    f.access.respawned(f.room, f.self)
    expect(f.access.noticed).toBeNull()
    expect(f.access.lapsePending).toBe(false)
    expect(f.access.lapseUntil).toBe(0)
    f.access.lapseRandom = () => 1
    f.room.teleport(f.second, 40.8, 20, 38.5, 0, 0)
    expect(f.select(101)).toBe(f.second.id)
    expect(f.access.lapsePending).toBe(false)
  })

  test('losing every target discards the old engagement lapse', () => {
    const f = fixture('expert')
    f.access.lapseRandom = () => 0
    expect(f.select()).toBe(f.first.id)
    expect(f.access.lapsePending).toBe(true)
    f.first.alive = false
    f.second.alive = false
    expect(f.select(101)).toBeNull()
    expect(f.access.lapsePending).toBe(false)
    expect(f.access.lapseUntil).toBe(0)
  })

  test('same lapse seed reproduces the swing schedule', () => {
    const run = () => {
      const f = fixture('expert')
      f.second.alive = false
      f.room.teleport(f.first, 40.5, 20, 38.5, 0, 0)
      const random = rng(124)
      f.access.lapseRandom = () => random() * 0.02
      f.self.protectedTicks = 0
      f.first.protectedTicks = 0
      const attacks = trackAttacks(f)
      for (let at = 100; at <= 160; at++) {
        f.self.yaw = 0
        f.self.pitch = 0
        f.select(at)
      }
      return attacks
    }
    const first = run()
    expect(first.length).toBeGreaterThan(0)
    expect(first).toEqual(run())
  })
})
