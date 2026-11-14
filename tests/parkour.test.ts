import { describe, expect, test } from 'bun:test'
import { AIR } from '../src/games/bedwars/blocks'
import { createParkour, parkourCourse } from '../src/games/bedwars/maps/parkour'
import { Room } from '../src/games/bedwars/room'
import { parkourRules } from '../src/games/bedwars/rules'
import { formatParkourTime } from '../src/games/bedwars/sim/parkour'
import type { SelfView } from '../src/games/bedwars/protocol'
import { TestClient, ticks } from './room-helpers'

function selfOf(client: TestClient): SelfView {
  const messages = client.msgs.filter((m): m is Extract<typeof m, { t: 'self' }> => m.t === 'self')
  return messages[messages.length - 1].self
}

describe('parkour course', () => {
  test('has a start, five ordered checkpoints and a finish over solid pads', () => {
    const map = createParkour()
    const course = map.parkour
    expect(course).toBeDefined()
    expect(course!.checkpoints.length).toBe(5)
    expect(course!.finish[1]).toBeGreaterThan(course!.checkpoints[4][1])
    for (const [i, point] of course!.checkpoints.entries()) {
      expect(map.world.get(Math.floor(point[0]), Math.floor(point[1]) - 1, Math.floor(point[2]))).not.toBe(AIR)
      if (i > 0) expect(point[1]).toBeGreaterThan(course!.checkpoints[i - 1][1])
    }
    expect(map.world.get(Math.floor(course!.finish[0]), Math.floor(course!.finish[1]) - 1, Math.floor(course!.finish[2]))).not.toBe(AIR)
    expect(map.bases.length).toBe(0)
    expect(map.generators.length).toBe(0)
  })
})

describe('parkour room', () => {
  test('spawns runners at the start and accepts checkpoints in order', () => {
    const room = new Room({ rules: parkourRules() })
    const a = new TestClient(room, 'Ash')
    const b = new TestClient(room, 'Bea')
    expect(room.phase).toBe('playing')
    expect(a.p.team).toBe('red')
    expect(b.p.team).toBe('red')
    expect(a.p.alive).toBe(true)
    ticks(room, 1)
    const course = room.map.parkour!
    expect(selfOf(a).parkour?.checkpoint).toBe(1)
    // The start counts as checkpoint 1; touching checkpoint 2 updates the view.
    a.put(...course.checkpoints[1])
    ticks(room, 1)
    expect(selfOf(a).parkour?.checkpoint).toBe(2)
    // A later checkpoint cannot be skipped.
    b.put(...course.checkpoints[3])
    ticks(room, 1)
    expect(selfOf(b).parkour?.checkpoint).toBe(1)
  })

  test('falling returns to the last checkpoint without resetting the timer', () => {
    const room = new Room({ rules: parkourRules() })
    const a = new TestClient(room, 'Ash')
    const course = room.map.parkour!
    a.put(...course.checkpoints[1])
    ticks(room, 1)
    const before = selfOf(a).parkour!
    expect(before.checkpoint).toBe(2)
    a.put(course.checkpoints[1][0], 0, course.checkpoints[1][2])
    ticks(room, 1)
    const after = selfOf(a).parkour!
    expect(a.p.alive).toBe(true)
    expect(after.checkpoint).toBe(2)
    expect(after.falls).toBe(1)
    expect(after.startedAt).toBe(before.startedAt)
  })

  test('finishing records a time and place', () => {
    const room = new Room({ rules: parkourRules() })
    const a = new TestClient(room, 'Ash')
    const course = room.map.parkour!
    for (const point of course.checkpoints.slice(1)) {
      a.put(...point)
      ticks(room, 1)
    }
    a.put(...course.finish)
    ticks(room, 1)
    const ps = selfOf(a).parkour!
    expect(ps.finishAt).not.toBeNull()
    expect(ps.place).toBe(1)
    expect(ps.checkpoint).toBe(5)
    expect(ps.finishAt! - ps.startedAt).toBeGreaterThanOrEqual(0)
  })

  test('a solo finish opens a short round break', () => {
    const room = new Room({ rules: parkourRules() })
    const a = new TestClient(room, 'Ash')
    const course = room.map.parkour!
    for (const point of course.checkpoints.slice(1)) {
      a.put(...point)
      ticks(room, 1)
    }
    a.put(...course.finish)
    ticks(room, 1)
    ticks(room, 3 * 20 + 2)
    expect(selfOf(a).parkour?.round).toBe(2)
    expect(a.p.alive).toBe(true)
  })

  test('the retained parkour room can run with the tower map directly', () => {
    const room = new Room({ rules: parkourRules(), createMap: () => parkourCourse(undefined) })
    expect(room.phase).toBe('playing')
    expect(room.map.name).toBe('Spiral Tower')
    expect(room.rules.mode).toBe('parkour')
  })

  test('formats times as m:ss.t', () => {
    expect(formatParkourTime(0)).toBe('0:00.0')
    expect(formatParkourTime(20 * 12.34)).toBe('0:12.3')
    expect(formatParkourTime(20 * 65)).toBe('1:05.0')
  })
})
