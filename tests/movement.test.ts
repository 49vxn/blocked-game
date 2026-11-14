import { describe, expect, test } from 'bun:test'
import { IDLE_INPUT, stepMovement } from '../src/engine/physics'
import { MOVEMENT_PRESETS, nextMovement, type MovementPresetId } from '../src/engine/movement'
import { flatWorld, mover } from './helpers'

const TESTED: MovementPresetId[] = ['surefoot', 'snapline', 'flowline', 'bloxd']
const ALL: MovementPresetId[] = ['classic', ...TESTED]
const CLASSIC_PRESETS = ALL.filter((id) => MOVEMENT_PRESETS[id].airControl === 'classic')

/** Blocks travelled in one second after the controller has reached its speed. */
function speedPerSecond(id: MovementPresetId, input: object): number {
  const w = flatWorld()
  const m = mover(2.5, 10, 30)
  for (let i = 0; i < 20; i++) stepMovement(w, m, { ...IDLE_INPUT, forward: 1, ...input }, id)
  const beforeX = m.x
  const beforeZ = m.z
  for (let i = 0; i < 20; i++) stepMovement(w, m, { ...IDLE_INPUT, forward: 1, ...input }, id)
  return Math.hypot(m.x - beforeX, m.z - beforeZ)
}

/** Blocks travelled after releasing every movement key. */
function stopDistance(id: MovementPresetId): number {
  const w = flatWorld()
  const m = mover(2.5, 10, 30)
  for (let i = 0; i < 40; i++) stepMovement(w, m, { ...IDLE_INPUT, forward: 1, sprint: true }, id)
  const before = m.z
  for (let i = 0; i < 40; i++) stepMovement(w, m, { ...IDLE_INPUT, yaw: m.yaw }, id)
  return before - m.z
}

/** Distance still travelled toward the old direction after a full reversal. */
function reversalDrift(id: MovementPresetId): number {
  const w = flatWorld()
  const m = mover(2.5, 10, 30)
  for (let i = 0; i < 40; i++) stepMovement(w, m, { ...IDLE_INPUT, forward: 1, sprint: true }, id)
  const before = m.z
  let drift = 0
  for (let i = 0; i < 12; i++) {
    stepMovement(w, m, { ...IDLE_INPUT, forward: -1, sprint: true }, id)
    drift = Math.max(drift, before - m.z)
    if (m.vz > 0) break
  }
  return drift
}

/** After a sprint jump, hold the opposite direction and return the old-way velocity. */
function airReversal(id: MovementPresetId): { vz: number; airborne: boolean } {
  const w = flatWorld()
  const m = mover(2.5, 10, 30)
  for (let i = 0; i < 40; i++) stepMovement(w, m, { ...IDLE_INPUT, forward: 1, sprint: true }, id)
  stepMovement(w, m, { ...IDLE_INPUT, forward: 1, sprint: true, jump: true }, id)
  for (let i = 0; i < 6; i++) stepMovement(w, m, { ...IDLE_INPUT, forward: -1 }, id)
  return { vz: m.vz, airborne: !m.onGround }
}

/** After a forward jump, strafe right and return the leftover forward speed. */
function airStrafe(id: MovementPresetId): { vz: number; vx: number; airborne: boolean } {
  const w = flatWorld()
  const m = mover(2.5, 10, 30)
  for (let i = 0; i < 40; i++) stepMovement(w, m, { ...IDLE_INPUT, forward: 1, sprint: true }, id)
  stepMovement(w, m, { ...IDLE_INPUT, forward: 1, sprint: true, jump: true }, id)
  for (let i = 0; i < 6; i++) stepMovement(w, m, { ...IDLE_INPUT, strafe: 1 }, id)
  return { vz: m.vz, vx: m.vx, airborne: !m.onGround }
}

/** A normal jump with no input should keep its arc instead of braking. */
function airIdleRetention(id: MovementPresetId): number {
  const w = flatWorld()
  const m = mover(2.5, 10, 30)
  for (let i = 0; i < 40; i++) stepMovement(w, m, { ...IDLE_INPUT, forward: 1, sprint: true }, id)
  stepMovement(w, m, { ...IDLE_INPUT, forward: 1, sprint: true, jump: true }, id)
  const before = Math.hypot(m.vx, m.vz)
  for (let i = 0; i < 4; i++) stepMovement(w, m, IDLE_INPUT, id)
  return Math.hypot(m.vx, m.vz) / before
}

/** Horizontal distance from takeoff to landing on a flat floor. */
function sprintJumpDistance(id: MovementPresetId): number {
  const w = flatWorld()
  const m = mover(2.5, 10, 30)
  for (let i = 0; i < 40; i++) stepMovement(w, m, IDLE_INPUT, id)
  const x = m.x
  const z = m.z
  stepMovement(w, m, { ...IDLE_INPUT, forward: 1, sprint: true, jump: true }, id)
  let ticks = 0
  while (!m.onGround && ticks++ < 40) stepMovement(w, m, { ...IDLE_INPUT, forward: 1, sprint: true }, id)
  return Math.hypot(m.x - x, m.z - z)
}

function jumpPeak(id: MovementPresetId): number {
  const w = flatWorld()
  const m = mover(16.5, 10, 16.5)
  for (let i = 0; i < 40; i++) stepMovement(w, m, IDLE_INPUT, id)
  stepMovement(w, m, { ...IDLE_INPUT, jump: true }, id)
  let peak = m.y
  for (let i = 0; i < 30; i++) {
    stepMovement(w, m, IDLE_INPUT, id)
    peak = Math.max(peak, m.y)
  }
  return peak - 10
}

describe('movement presets', () => {
  test('each preset reaches its walk, sprint and sneak speeds', () => {
    for (const id of ALL) {
      const p = MOVEMENT_PRESETS[id]
      expect(speedPerSecond(id, {})).toBeCloseTo(p.walk * 20, 1)
      expect(speedPerSecond(id, { sprint: true })).toBeCloseTo(p.sprint * 20, 1)
      expect(speedPerSecond(id, { sneak: true })).toBeCloseTo(p.sneak * 20, 1)
    }
  })

  test('Classic keeps the normal game at 4.9 walk and 6.5 sprint blocks/s', () => {
    const p = MOVEMENT_PRESETS.classic
    expect(p.walk * 20).toBeCloseTo(4.9, 1)
    expect(p.sprint * 20).toBeCloseTo(6.5, 1)
  })

  test('releasing the keys stops every preset quickly', () => {
    for (const id of ALL) expect(stopDistance(id)).toBeLessThan(0.5)
  })

  test('turning around does not keep sliding in the old direction', () => {
    // Bloxd's higher 7 b/s sprint sits a hair over the old 0.1 line; 0.11 is
    // still a planted turn, not carried momentum.
    for (const id of ALL) expect(reversalDrift(id)).toBeLessThan(0.11)
  })

  test('the Bloxd preset changes direction within four ticks in the air', () => {
    const r = airReversal('bloxd')
    expect(r.airborne).toBe(true)
    expect(r.vz).toBeGreaterThan(0)
  })

  test('the Bloxd preset does not keep most of the old forward speed while strafing', () => {
    const r = airStrafe('bloxd')
    expect(r.airborne).toBe(true)
    expect(r.vx).toBeGreaterThan(0.1)
    expect(r.vz).toBeGreaterThan(-0.08)
  })

  test('the Bloxd preset keeps most of a no-input jump arc', () => {
    expect(airIdleRetention('bloxd')).toBeGreaterThan(0.95)
  })

  test('every preset clears a one-block step and never reaches two', () => {
    for (const id of ALL) {
      const peak = jumpPeak(id)
      expect(peak).toBeGreaterThan(1.5)
      expect(peak).toBeLessThan(1.75)
    }
  })

  test('Classic-family sprint jumps stay under 4.6 blocks, and faster presets go farther', () => {
    for (const id of CLASSIC_PRESETS) expect(sprintJumpDistance(id)).toBeLessThan(4.6)
    expect(sprintJumpDistance('flowline')).toBeGreaterThan(sprintJumpDistance('surefoot'))
  })

  test('diagonal input is normalised, not faster', () => {
    const straight = speedPerSecond('classic', {})
    const diagonal = speedPerSecond('classic', { strafe: 1 })
    expect(diagonal).toBeCloseTo(straight, 1)
  })

  test('M cycles Classic, Surefoot, Snapline, Flowline, Bloxd and back', () => {
    expect(nextMovement('classic')).toBe('surefoot')
    expect(nextMovement('surefoot')).toBe('snapline')
    expect(nextMovement('snapline')).toBe('flowline')
    expect(nextMovement('flowline')).toBe('bloxd')
    expect(nextMovement('bloxd')).toBe('classic')
  })
})
