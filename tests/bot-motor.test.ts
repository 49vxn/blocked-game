import { describe, expect, test } from 'bun:test'
import { rng } from '../src/engine/random'
import { MotorController } from '../src/games/bedwars/bots/motor'
import { BOT_TIER_ORDER, BOT_TIER_PROFILES } from '../src/games/bedwars/bots/profiles'
import type { BotTierProfile } from '../src/games/bedwars/bots/types'

const DT = 1 / 20
const RAD = 180 / Math.PI

type Tier = (typeof BOT_TIER_ORDER)[number]

function percentile(values: number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))]
}

function median(values: number[]): number {
  return percentile(values, 0.5)
}

function shortest(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

/** Ticks between a fresh sighting at `startTick` and the first tick the bot may react. */
function delayTicks(motor: MotorController, id: number, startTick: number, profile: BotTierProfile): number {
  motor.scheduleSighting(id, startTick, profile)
  for (let tick = startTick + 1; tick <= startTick + 200; tick++) if (motor.canReact(id, tick)) return tick - startTick
  throw new Error('the bot never reacted')
}

function sampledDelays(tier: Tier, count = 400): number[] {
  const profile = BOT_TIER_PROFILES[tier]
  return Array.from({ length: count }, (_, i) => delayTicks(new MotorController(rng(i + 1)), 1, 0, profile) * 50)
}

/** How far the settled aim is from the perfect angle, in degrees. */
function settledError(profile: BotTierProfile, seed: number, distance: number, angularSpeed = 0): number {
  const motor = new MotorController(rng(seed))
  let yaw = 0
  let pitch = 0
  for (let i = 0; i < 300; i++) {
    const aim = motor.aim(yaw, pitch, 0, 0, profile, DT, { distance, angularSpeed })
    yaw = aim.yaw
    pitch = aim.pitch
  }
  return Math.abs(shortest(yaw)) * RAD
}

describe('bot motor reactions', () => {
  test('reaction delays are right-skewed, not constant, and stay in the tier range', () => {
    for (const tier of BOT_TIER_ORDER) {
      const profile = BOT_TIER_PROFILES[tier]
      const delays = sampledDelays(tier)
      const p50 = percentile(delays, 0.5)
      const p90 = percentile(delays, 0.9)
      expect(p50).toBeGreaterThanOrEqual(profile.reactionMs[0] - 50)
      expect(p50).toBeLessThanOrEqual(profile.reactionMs[1] + 50)
      expect(p90).toBeGreaterThanOrEqual(profile.reactionMs[0] - 50)
      expect(p90).toBeLessThanOrEqual(profile.reactionMs[1] + 50)
      expect(p90).toBeGreaterThan(p50 + 50)
      expect(new Set(delays).size).toBeGreaterThan(2)
    }
  })

  test('a new sighting pays the full sample and does not reset every tick', () => {
    const profile = BOT_TIER_PROFILES.hard
    const motor = new MotorController(rng(9))
    motor.scheduleSighting(1, 0, profile)
    const first = delayTicks(motor, 1, 0, profile)
    // Scheduling the same tracked sighting every tick keeps the original deadline.
    for (let tick = 1; tick <= first; tick++) motor.scheduleSighting(1, tick, profile)
    expect(delayTicks(motor, 1, first, profile)).toBe(1)
    expect(motor.canReact(1, first - 1)).toBe(false)
  })

  test('a recently tracked target is re-acquired faster than a brand-new one', () => {
    const profile = BOT_TIER_PROFILES.hard
    const fresh: number[] = []
    const again: number[] = []
    for (let seed = 1; seed <= 300; seed++) {
      const one = new MotorController(rng(seed))
      const first = delayTicks(one, 4, 0, profile)
      fresh.push(first * 50)
      one.forget(4)
      again.push(delayTicks(one, 4, first + 20, profile) * 50)
    }
    expect(median(again)).toBeLessThan(median(fresh))
  })

  test('same seed reproduces the same schedule and angles', () => {
    const profile = BOT_TIER_PROFILES.normal
    const run = (seed: number) => {
      const motor = new MotorController(rng(seed))
      const reactions: number[] = []
      motor.scheduleSighting(2, 0, profile)
      for (let tick = 0; tick <= 40; tick++) if (motor.canReact(2, tick)) reactions.push(tick)
      let yaw = -1.2
      let pitch = 0
      const angles: number[] = []
      for (let i = 0; i < 40; i++) {
        const aim = motor.aim(yaw, pitch, 1.1, -0.3, profile, DT, { distance: 8, angularSpeed: 0.2 })
        yaw = aim.yaw
        pitch = aim.pitch
        angles.push(Number(yaw.toFixed(6)), Number(pitch.toFixed(6)), Number(aim.turnRate.toFixed(6)))
      }
      return { reactions, angles }
    }
    expect(run(42)).toEqual(run(42))
    expect(run(42).angles).not.toEqual(run(43).angles)
  })
})

describe('bot motor aim', () => {
  test('per-tick yaw, pitch and turn rate never exceed the tier cap, and acceleration stays bounded', () => {
    for (const tier of BOT_TIER_ORDER) {
      const profile = BOT_TIER_PROFILES[tier]
      const motor = new MotorController(rng(5))
      let yaw = -2
      let pitch = 0
      let previousRate = 0
      let moved = 0
      for (let i = 0; i < 120; i++) {
        const aim = motor.aim(yaw, pitch, 2, 0.55, profile, DT, { distance: 4 })
        const yawStep = Math.abs(shortest(aim.yaw - yaw)) * RAD
        const pitchStep = Math.abs(aim.pitch - pitch) * RAD
        expect(yawStep).toBeLessThanOrEqual(profile.turnDegPerSecond * DT + 1e-6)
        expect(pitchStep).toBeLessThanOrEqual(profile.turnDegPerSecond * DT + 1e-6)
        expect(aim.turnRate).toBeLessThanOrEqual(profile.turnDegPerSecond + 1e-6)
        expect(Math.abs(aim.turnRate - previousRate) / DT).toBeLessThanOrEqual(profile.turnAcceleration + 1e-6)
        previousRate = aim.turnRate
        moved += yawStep + pitchStep
        yaw = aim.yaw
        pitch = aim.pitch
      }
      expect(moved).toBeGreaterThan(90)
      expect(Math.abs(shortest(yaw - 2)) * RAD).toBeLessThan(5)
      expect(Math.abs(pitch - 0.55) * RAD).toBeLessThan(5)
    }
  })

  test('never snaps to the perfect angle in one tick', () => {
    for (const tier of BOT_TIER_ORDER) {
      const profile = BOT_TIER_PROFILES[tier]
      const motor = new MotorController(rng(1))
      const aim = motor.aim(-Math.PI / 2, 0, Math.PI / 2, 0, profile, DT, { distance: 5 })
      const step = Math.abs(shortest(aim.yaw - -Math.PI / 2)) * RAD
      expect(step).toBeLessThan(profile.turnDegPerSecond * DT)
      expect(aim.yaw).not.toBe(Math.PI / 2)
    }
  })

  test('aim error is a coherent per-action error that scales with distance and target movement', () => {
    const expert = BOT_TIER_PROFILES.expert
    const near = Array.from({ length: 200 }, (_, i) => settledError(expert, i + 1, 4))
    const far = Array.from({ length: 200 }, (_, i) => settledError(expert, i + 1, 24))
    const still = Array.from({ length: 200 }, (_, i) => settledError(expert, i + 1, 8))
    const moving = Array.from({ length: 200 }, (_, i) => settledError(expert, i + 1, 8, 0.6))
    expect(median(far)).toBeGreaterThan(median(near))
    expect(median(moving)).toBeGreaterThan(median(still))
    expect(median(near)).toBeGreaterThan(0)
    expect(settledError(expert, 1, 4)).not.toBe(0)
  })

  test('lower tiers show overshoot and corrections; the top tiers stay bounded', () => {
    const easy = BOT_TIER_PROFILES.easy
    const expert = BOT_TIER_PROFILES.expert
    const techno = BOT_TIER_PROFILES.technoblade

    /** Largest angle past the perfect target (positive means it overshot). */
    const excursion = (profile: BotTierProfile, seed: number): number => {
      const motor = new MotorController(rng(seed))
      const desired = 0
      let yaw = -2
      let peak = -Infinity
      for (let i = 0; i < 160; i++) {
        const aim = motor.aim(yaw, 0, desired, 0, profile, DT, { distance: 6 })
        yaw = aim.yaw
        peak = Math.max(peak, shortest(yaw - desired))
      }
      return peak * RAD
    }

    const easyPeaks = Array.from({ length: 60 }, (_, i) => excursion(easy, i + 1))
    expect(Math.max(...easyPeaks)).toBeGreaterThan(0.5)

    for (const profile of [expert, techno]) {
      const peaks = Array.from({ length: 60 }, (_, i) => excursion(profile, i + 1))
      expect(Math.max(...peaks)).toBeLessThan(10)
      expect(median(sampledGoalError(profile))).toBeLessThan(4)
    }
  })
})

/** Settled error after a long turn, for the bounded-tier assertion above. */
function sampledGoalError(profile: BotTierProfile): number[] {
  return Array.from({ length: 60 }, (_, i) => settledError(profile, i + 1, 6))
}
