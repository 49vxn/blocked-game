import { rng } from '../../../engine/random'
import { TICK_MS, TPS } from '../constants'
import type { BotTierProfile } from './types'

const DEG = 180 / Math.PI
const RAD = Math.PI / 180
/** A sighting is scheduled on the first 20 TPS tick at/after its sampled deadline. */
const QUANTUM_MS = TICK_MS
/** A target seen again inside this window is a re-acquisition, not a brand-new sighting. */
const REACQUIRE_TICKS = 5 * TPS
/** Re-acquisition keeps part of the original reaction: the bot already knows the target. */
const REACQUIRE_SCALE = 0.55
/** A desired angle this far from the last one starts a new aim action. */
const NEW_ACTION_RAD = 25 * RAD
/** Close enough to the action's aim point to spend a corrective submovement. */
const CORRECTION_REACH_RAD = 1.2 * RAD
/** Each correction keeps 55% of the remaining error, so the aim is never perfect. */
const CORRECTION_KEEP = 0.55
/** Small angular velocities are treated as settled rather than jittered forever. */
const AIM_DEADZONE_RAD = 0.25 * RAD
/** Integrate the caps in 5 ms substeps so a 50 ms tick cannot overshoot a near aim point. */
const SUBSTEP_SECONDS = 0.005

export interface AimContext {
  /** Distance to the aim point in blocks. */
  distance?: number
  /** Apparent angular size of the target in radians. */
  angularSize?: number
  /** Target angular speed in radians per second. */
  angularSpeed?: number
}

export interface AimResult {
  yaw: number
  pitch: number
  /** Actual combined angular speed for this tick, in degrees per second. */
  turnRate: number
}

interface Sighting {
  deadline: number
  delayMs: number
}

interface AimAction {
  biasYaw: number
  biasPitch: number
  overshootYaw: number
  overshootPitch: number
  overshootPending: boolean
  correctionsLeft: number
  lastDesiredYaw: number
  lastDesiredPitch: number
}

function shortest(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Reaction and aim. It owns the per-sighting delay, the turn-rate/acceleration
 * caps and the coherent aim error. It has no `Room` access and sends nothing;
 * the integrator turns its angles into the next `MoveInput`.
 */
export class MotorController {
  private readonly sightings = new Map<number, Sighting>()
  /** Last tick each id was scheduled, used to make a re-acquisition faster. */
  private readonly known = new Map<number, number>()
  /** Fixed 0/1-tick phase so two bots sampling the same delay do not react together. */
  private readonly phaseTicks: number
  private action: AimAction | null = null
  /** Angular velocity in degrees per second, from the previous aim call. */
  private velocityYaw = 0
  private velocityPitch = 0

  constructor(private readonly random: () => number = rng(1)) {
    this.phaseTicks = this.random() < 0.5 ? 0 : 1
  }

  /** Forget every sighting, known target and aim state. */
  reset(): void {
    this.sightings.clear()
    this.known.clear()
    this.action = null
    this.velocityYaw = 0
    this.velocityPitch = 0
  }

  /**
   * Sample one reaction delay for a new sighting. Calling it again for a
   * tracked id keeps the original deadline; it never rerolls each tick.
   */
  scheduleSighting(id: number, tick: number, profile: BotTierProfile): void {
    for (const [knownId, at] of this.known) if (tick - at > REACQUIRE_TICKS) this.known.delete(knownId)
    const tracked = this.known.get(id)
    const recent = tracked !== undefined && tick - tracked <= REACQUIRE_TICKS
    this.known.set(id, tick)
    if (this.sightings.has(id)) return
    const ticks = this.sampleDelayTicks(profile, recent ? REACQUIRE_SCALE : 1)
    this.sightings.set(id, { deadline: tick + ticks, delayMs: ticks * QUANTUM_MS })
  }

  /** True on the first 20 TPS tick at/after this sighting's sampled deadline. */
  canReact(id: number, tick: number): boolean {
    const sighting = this.sightings.get(id)
    return !!sighting && tick >= sighting.deadline
  }

  /** Drop the pending sighting but remember the id, so a quick re-sighting is faster. */
  forget(id: number): void {
    this.sightings.delete(id)
  }

  /** The sampled delay for telemetry, or null when there is no pending sighting. */
  reactionDelayMs(id: number): number | null {
    return this.sightings.get(id)?.delayMs ?? null
  }

  /**
   * Move the aim toward the desired angles under the tier's caps. The motor
   * keeps its own velocity state, so call it every tick with the same
   * `dtSeconds` the simulation uses (0.05 at 20 TPS).
   */
  aim(
    currentYaw: number,
    currentPitch: number,
    desiredYaw: number,
    desiredPitch: number,
    profile: BotTierProfile,
    dtSeconds: number,
    context: AimContext = {},
  ): AimResult {
    const dt = clamp(dtSeconds, 1e-4, 0.25)
    const desired = clamp(desiredPitch, -Math.PI / 2, Math.PI / 2)

    let action = this.action
    if (!action || Math.abs(shortest(desiredYaw - action.lastDesiredYaw)) + Math.abs(desired - action.lastDesiredPitch) > NEW_ACTION_RAD) {
      action = this.beginAction(currentYaw, currentPitch, desiredYaw, desired, profile, context)
      this.action = action
      this.velocityYaw = 0
      this.velocityPitch = 0
    }
    action.lastDesiredYaw = desiredYaw
    action.lastDesiredPitch = desired

    // Integrate in short substeps. At 20 TPS a single 50 ms step with a high
    // turn acceleration would pass a near aim point before it could brake;
    // substeps keep the correction small without changing the reported tick.
    const steps = Math.max(1, Math.ceil(dt / SUBSTEP_SECONDS))
    const h = dt / steps
    const startYaw = Math.atan2(Math.sin(currentYaw), Math.cos(currentYaw))
    const startPitch = clamp(currentPitch, -Math.PI / 2, Math.PI / 2)
    let yaw = startYaw
    let pitch = startPitch

    for (let i = 0; i < steps; i++) {
      // Spend a corrective submovement once the current aim point is reached:
      // first undo the overshoot, then tighten the residual bias a little.
      let targetYaw = desiredYaw + action.biasYaw + (action.overshootPending ? action.overshootYaw : 0)
      let targetPitch = desired + action.biasPitch + (action.overshootPending ? action.overshootPitch : 0)
      targetPitch = clamp(targetPitch, -Math.PI / 2, Math.PI / 2)
      if (Math.abs(shortest(targetYaw - yaw)) <= CORRECTION_REACH_RAD && Math.abs(targetPitch - pitch) <= CORRECTION_REACH_RAD) {
        if (action.overshootPending) {
          action.overshootPending = false
          action.correctionsLeft = Math.max(0, action.correctionsLeft - 1)
        } else if (action.correctionsLeft > 0) {
          action.biasYaw *= CORRECTION_KEEP
          action.biasPitch *= CORRECTION_KEEP
          action.correctionsLeft--
        }
        targetYaw = desiredYaw + action.biasYaw
        targetPitch = clamp(desired + action.biasPitch, -Math.PI / 2, Math.PI / 2)
      }

      const deltaYaw = shortest(targetYaw - yaw)
      const deltaPitch = targetPitch - pitch
      const remaining = Math.hypot(deltaYaw, deltaPitch)

      // Kinematic stopping: build only the speed that can still be shed before
      // the aim point. Near it, the velocity falls under the acceleration cap.
      let wantYaw = 0
      let wantPitch = 0
      if (remaining > AIM_DEADZONE_RAD) {
        const speed = Math.min(profile.turnDegPerSecond, Math.sqrt(2 * profile.turnAcceleration * remaining * DEG))
        wantYaw = (deltaYaw / remaining) * speed
        wantPitch = (deltaPitch / remaining) * speed
      }

      let dvYaw = wantYaw - this.velocityYaw
      let dvPitch = wantPitch - this.velocityPitch
      const dvLength = Math.hypot(dvYaw, dvPitch)
      const maxDv = profile.turnAcceleration * h
      if (dvLength > maxDv && dvLength > 0) {
        dvYaw *= maxDv / dvLength
        dvPitch *= maxDv / dvLength
      }
      this.velocityYaw += dvYaw
      this.velocityPitch += dvPitch
      const speed = Math.hypot(this.velocityYaw, this.velocityPitch)
      if (speed > profile.turnDegPerSecond) {
        this.velocityYaw *= profile.turnDegPerSecond / speed
        this.velocityPitch *= profile.turnDegPerSecond / speed
      }

      const beforeYaw = yaw
      const beforePitch = pitch
      // No hard position clamp: the kinematic braking keeps a normal approach
      // short of the aim point, while a correction that moves the point behind
      // us brakes under the same acceleration cap instead of reversing in one
      // substep. That is the small, bounded overshoot a person produces.
      const stepYaw = this.velocityYaw * RAD * h
      const stepPitch = this.velocityPitch * RAD * h
      yaw = Math.atan2(Math.sin(yaw + stepYaw), Math.cos(yaw + stepYaw))
      pitch = clamp(pitch + stepPitch, -Math.PI / 2, Math.PI / 2)
      const actualYaw = shortest(yaw - beforeYaw)
      const actualPitch = pitch - beforePitch
      // Store what actually happened, so clipping at a limit cannot bank
      // angular velocity the bot never used.
      this.velocityYaw = (actualYaw * DEG) / h
      this.velocityPitch = (actualPitch * DEG) / h
    }

    const turnRate = (Math.hypot(shortest(yaw - startYaw), pitch - startPitch) * DEG) / dt
    return { yaw, pitch, turnRate }
  }

  /** One reaction delay, quantized to 50 ms and right-skewed with a slow tail. */
  private sampleDelayTicks(profile: BotTierProfile, scale: number): number {
    const [min, max] = profile.reactionMs
    const span = Math.max(0, max - min)
    const slow = this.random() < 0.18
    const skewed = slow ? 0.75 + this.random() * 0.25 : 1 - Math.sqrt(this.random()) * 0.85
    const sampled = (min + skewed * span) * scale
    const quantized = Math.max(1, Math.ceil(sampled / QUANTUM_MS))
    const maxTicks = Math.max(1, Math.ceil(max / QUANTUM_MS))
    return Math.min(maxTicks, quantized + this.phaseTicks)
  }

  /** A new aim action: sample a coherent error, a correction budget and an optional overshoot. */
  private beginAction(
    currentYaw: number,
    currentPitch: number,
    desiredYaw: number,
    desiredPitch: number,
    profile: BotTierProfile,
    context: AimContext,
  ): AimAction {
    const sigma = aimSigma(profile, context)
    const biasYaw = this.gaussian() * sigma
    const biasPitch = this.gaussian() * sigma * 0.6
    const [minCorrections, maxCorrections] = profile.aimCorrections
    const corrections = minCorrections + Math.floor(this.random() * (maxCorrections - minCorrections + 1))

    const deltaYaw = shortest(desiredYaw - currentYaw)
    const deltaPitch = desiredPitch - currentPitch
    let overshootYaw = 0
    let overshootPitch = 0
    if (corrections > 0 && this.random() < profile.overshoot) {
      const magnitude = (1 + this.random() * 3) * RAD
      overshootYaw = (deltaYaw >= 0 ? 1 : -1) * magnitude
      overshootPitch = deltaPitch === 0 ? 0 : (deltaPitch > 0 ? 1 : -1) * magnitude * 0.5
    }

    return {
      biasYaw,
      biasPitch,
      overshootYaw,
      overshootPitch,
      overshootPending: overshootYaw !== 0 || overshootPitch !== 0,
      correctionsLeft: corrections,
      lastDesiredYaw: desiredYaw,
      lastDesiredPitch: desiredPitch,
    }
  }

  /** Bounded Gaussian in [-2, 2]; never exactly zero, so the aim is never perfect. */
  private gaussian(): number {
    const u1 = Math.max(1e-6, this.random())
    const u2 = this.random()
    const z = clamp(Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2), -2, 2)
    if (Math.abs(z) >= 0.2) return z
    return (z < 0 ? -1 : 1) * 0.2
  }
}

/** Aim error grows with distance and target movement, and shrinks for a large apparent target. */
function aimSigma(profile: BotTierProfile, context: AimContext): number {
  const distance = Math.max(0.5, context.distance ?? 8)
  const angularSize = context.angularSize ?? Math.atan2(0.6, distance)
  const angularSpeed = Math.max(0, context.angularSpeed ?? 0)
  const distanceFactor = 0.6 + Math.min(1.6, distance / 20)
  const sizeFactor = Math.max(0.35, 1 - Math.min(1.2, angularSize * 2))
  const movementFactor = 1 + Math.min(2, angularSpeed * 4)
  return clamp(profile.aimError * distanceFactor * sizeFactor * movementFactor, 0.003, 0.3)
}
