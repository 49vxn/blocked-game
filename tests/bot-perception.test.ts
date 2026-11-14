import { describe, expect, test } from 'bun:test'
import { rng } from '../src/engine/random'
import { STONE } from '../src/games/bedwars/blocks'
import { BOT_TIER_PROFILES } from '../src/games/bedwars/bots/profiles'
import { TargetMemory } from '../src/games/bedwars/bots/memory'
import { PerceptionTracker } from '../src/games/bedwars/bots/perception'
import type { PerceivedEnemy } from '../src/games/bedwars/bots/types'
import { TestClient } from './room-helpers'
import { sandbox } from './room-helpers'

const easy = BOT_TIER_PROFILES.easy
const TPS = 20

/** Two humans in the open sandbox, on opposing teams, at known positions. */
function arena() {
  const room = sandbox()
  const self = new TestClient(room, 'Scout')
  const enemy = new TestClient(room, 'Raider')
  enemy.p.team = 'blue'
  room.teleport(self.p, 40.5, 20, 44.5, 0, 0)
  room.teleport(enemy.p, 40.5, 20, 38.5, 0, 0)
  return { room, self, enemy }
}

/** A solid two-high wall across the straight line from the scout to the raider. */
function wall(room: ReturnType<typeof sandbox>) {
  for (const y of [20, 21]) for (const x of [40, 41]) room.world.set(x, y, 41, STONE)
}

function enemyOf(perception: ReturnType<PerceptionTracker['update']>, id: number): PerceivedEnemy | undefined {
  return [...perception.visible, ...perception.remembered].find((e) => e.id === id)
}

function fakeEnemy(id: number, x: number, z: number): PerceivedEnemy {
  return {
    id,
    team: 'blue',
    x,
    y: 20,
    z,
    vx: 0.1,
    vz: 0,
    lastSeenTick: 0,
    visible: true,
    confidence: 1,
    distance: 5,
    angle: 0,
  }
}

describe('target memory', () => {
  test('stores the last-seen point and decays confidence until it expires', () => {
    const memory = new TargetMemory()
    memory.observe(fakeEnemy(1, 10, 4), 0)
    expect(memory.lastSeenTick(1)).toBe(0)

    const fresh = memory.recall(1, 0, easy)
    expect(fresh).not.toBeNull()
    expect(fresh!.visible).toBe(false)
    expect(fresh!.confidence).toBeCloseTo(1)
    expect(fresh!.x).toBe(10)
    expect(fresh!.z).toBe(4)

    const midway = memory.recall(1, 10, easy)!
    const late = memory.recall(1, 19, easy)!
    expect(midway.confidence).toBeLessThan(fresh!.confidence)
    expect(late.confidence).toBeLessThan(midway.confidence)
    expect(late.confidence).toBeGreaterThan(0)
    // Velocity decays with age but the position never extrapolates.
    expect(Math.abs(late.vx)).toBeLessThan(Math.abs(fresh!.vx))
    expect(late.x).toBe(10)
    expect(late.z).toBe(4)

    expect(memory.recall(1, easy.memorySeconds * TPS, easy)).toBeNull()
    expect(memory.lastSeenTick(1)).toBeNull()
    expect(memory.all(0, easy)).toHaveLength(0)
  })

  test('forget and clear drop entries, and a new observation refreshes the point', () => {
    const memory = new TargetMemory()
    memory.observe(fakeEnemy(1, 10, 4), 0)
    memory.observe(fakeEnemy(2, -6, 2), 0)
    memory.forget(1)
    expect(memory.recall(1, 1, easy)).toBeNull()
    expect(memory.recall(2, 1, easy)).not.toBeNull()
    memory.clear()
    expect(memory.all(1, easy)).toHaveLength(0)

    memory.observe(fakeEnemy(3, 1, 1), 40)
    memory.observe(fakeEnemy(3, 8, -2), 45)
    const refreshed = memory.recall(3, 45, easy)!
    expect(refreshed.x).toBe(8)
    expect(refreshed.z).toBe(-2)
    expect(refreshed.lastSeenTick).toBe(45)
  })
})

describe('bot perception', () => {
  test('sees an unobstructed enemy in the front cone', () => {
    const { room, self, enemy } = arena()
    const tracker = new PerceptionTracker(rng(7))
    const perception = tracker.update(room, self.p, easy, 100)
    expect(perception.visible.map((e) => e.id)).toEqual([enemy.p.id])
    expect(perception.remembered).toHaveLength(0)
    const seen = perception.visible[0]
    expect(seen.visible).toBe(true)
    expect(seen.confidence).toBe(1)
    expect(seen.lastSeenTick).toBe(100)
    expect(seen.x).toBeCloseTo(enemy.p.x, 5)
    expect(seen.z).toBeCloseTo(enemy.p.z, 5)
    expect(seen.distance).toBeCloseTo(6, 1)
    expect(perception.threat?.id).toBe(enemy.p.id)
  })

  test('a wall blocks acquisition, the last-seen point is kept and then expires', () => {
    const { room, self, enemy } = arena()
    const tracker = new PerceptionTracker(rng(7))
    expect(tracker.update(room, self.p, easy, 100).visible).toHaveLength(1)

    wall(room)
    let perception = tracker.update(room, self.p, easy, 101)
    expect(perception.visible).toHaveLength(0)
    const remembered = enemyOf(perception, enemy.p.id)!
    expect(remembered.visible).toBe(false)
    expect(remembered.confidence).toBeLessThan(1)
    expect(remembered.lastSeenTick).toBe(100)

    // Move behind the wall: the remembered point must not follow the live player.
    room.teleport(enemy.p, 41.5, 20, 39.5, 0, 0)
    perception = tracker.update(room, self.p, easy, 110)
    expect(perception.visible).toHaveLength(0)
    const stale = enemyOf(perception, enemy.p.id)!
    expect(stale.x).toBeCloseTo(40.5, 5)
    expect(stale.z).toBeCloseTo(38.5, 5)

    // A full tier memory window after the last sighting, it is gone.
    const expiry = 100 + easy.memorySeconds * TPS
    expect(tracker.update(room, self.p, easy, expiry - 1).remembered).toHaveLength(1)
    expect(tracker.update(room, self.p, easy, expiry + 1).remembered).toHaveLength(0)
  })

  test('notices a target just outside the cone at touching distance, but not one far behind', () => {
    const close = arena()
    close.self.p.yaw = Math.PI
    close.room.teleport(close.enemy.p, 40.5, 20, 42.5, 0, 0)
    const closeTracker = new PerceptionTracker(rng(3))
    expect(closeTracker.update(close.room, close.self.p, easy, 50).visible.map((e) => e.id)).toEqual([close.enemy.p.id])

    const far = arena()
    far.self.p.yaw = Math.PI
    far.room.teleport(far.enemy.p, 40.5, 20, 32.5, 0, 0)
    const farTracker = new PerceptionTracker(rng(3))
    expect(farTracker.update(far.room, far.self.p, easy, 50).visible).toHaveLength(0)
  })

  test('invisibility hides a nearby enemy unless they just hit or were hit', () => {
    const { room, self, enemy } = arena()
    room.teleport(enemy.p, 40.5, 20, 42.5, 0, 0)
    enemy.p.effects.invisible = 100
    const tracker = new PerceptionTracker(rng(13))
    expect(tracker.update(room, self.p, easy, 50).visible).toHaveLength(0)

    tracker.notifyHit(enemy.p.id, 51)
    expect(tracker.update(room, self.p, easy, 52).visible.map((e) => e.id)).toEqual([enemy.p.id])

    self.p.effects.invisible = 0
    self.p.lastAttacker = { id: enemy.p.id, tick: 60 }
    const attacked = new PerceptionTracker(rng(13))
    expect(attacked.update(room, self.p, easy, 61).visible.map((e) => e.id)).toEqual([enemy.p.id])
  })

  test('a hit event or a recent attacker is noticed outside the cone, but never through a wall', () => {
    const { room, self, enemy } = arena()
    self.p.yaw = Math.PI // the enemy is behind the scout's facing
    const tracker = new PerceptionTracker(rng(11))
    expect(tracker.update(room, self.p, easy, 200).visible).toHaveLength(0)

    tracker.notifyHit(enemy.p.id, 200)
    expect(tracker.update(room, self.p, easy, 201).visible.map((e) => e.id)).toEqual([enemy.p.id])

    wall(room)
    tracker.notifyHit(enemy.p.id, 210)
    expect(tracker.update(room, self.p, easy, 211).visible).toHaveLength(0)

    // The attacker that just hit us is a plausible sighting too.
    const second = arena()
    second.self.p.yaw = Math.PI
    second.self.p.lastAttacker = { id: second.enemy.p.id, tick: 300 }
    const attackerTracker = new PerceptionTracker(rng(11))
    expect(attackerTracker.update(second.room, second.self.p, easy, 305).visible.map((e) => e.id)).toEqual([second.enemy.p.id])
    // ... and the event goes stale.
    expect(attackerTracker.update(second.room, second.self.p, easy, 400).visible).toHaveLength(0)
  })

  test('threat uses urgency, not a global nearest-player scan', () => {
    const room = sandbox()
    const self = new TestClient(room, 'Scout')
    const near = new TestClient(room, 'Near')
    const other = new TestClient(room, 'Other')
    near.p.team = 'blue'
    other.p.team = 'green'
    room.teleport(self.p, 40.5, 20, 44.5, 0, 0)
    room.teleport(near.p, 40.5, 20, 40.5, 0, 0)
    room.teleport(other.p, 43.5, 20, 41.5, 0, 0)
    const tracker = new PerceptionTracker(rng(5))

    let perception = tracker.update(room, self.p, easy, 100)
    expect(perception.visible).toHaveLength(2)
    expect(perception.threat?.id).toBe(near.p.id)

    // The farther enemy just hit us: urgency wins over raw distance.
    self.p.lastAttacker = { id: other.p.id, tick: 100 }
    perception = tracker.update(room, self.p, easy, 101)
    expect(perception.threat?.id).toBe(other.p.id)
  })

  test('reset clears memory and hit events', () => {
    const { room, self, enemy } = arena()
    const tracker = new PerceptionTracker(rng(7))
    tracker.update(room, self.p, easy, 100)
    wall(room)
    tracker.notifyHit(enemy.p.id, 100)
    expect(tracker.update(room, self.p, easy, 101).remembered).toHaveLength(1)
    tracker.reset()
    expect(tracker.update(room, self.p, easy, 102).visible).toHaveLength(0)
    expect(tracker.update(room, self.p, easy, 102).remembered).toHaveLength(0)
  })
})
