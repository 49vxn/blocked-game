import type { MoveInput } from '../../../engine/physics'
import type { TeamId } from '../blocks'
import type { ClientMessage } from '../protocol'
import type { BotLevel } from '../rules'

/**
 * The public bot tiers. `technoblade` is intentionally separate from
 * `BotLevel` for now: the visible lobby tier is an integrator-owned plumbing
 * change, while the behavior can be developed and tested behind this type.
 */
export type BotTier = BotLevel | 'technoblade'

export type BotGoal =
  | 'gather'
  | 'shop'
  | 'upgrade'
  | 'defend'
  | 'guard'
  | 'raid'
  | 'thirdParty'
  | 'retreat'
  | 'regroup'
  | 'escape'
  | 'breakBed'

export type BridgeMode = 'slow' | 'speed' | 'telly'

/** 0 = no combat builds; 1 = wall/clutch; 2 = wall/pillar/clutch; 3 = full tactical set. */
export type CombatBuildLevel = 0 | 1 | 2 | 3

/** An enemy as the bot could plausibly know it at this tick. */
export interface PerceivedEnemy {
  id: number
  team: TeamId
  /** Last known position, not the live position when hidden. */
  x: number
  y: number
  z: number
  /** Last observed velocity; decays after the target is lost. */
  vx: number
  vz: number
  lastSeenTick: number
  visible: boolean
  /** 0..1; 1 only while currently in sight. */
  confidence: number
  /** Distance from the bot at the last observation. */
  distance: number
  /** Absolute angle from the bot's facing at the last observation. */
  angle: number
}

export interface BotPerception {
  tick: number
  self: {
    x: number
    y: number
    z: number
    yaw: number
    pitch: number
    health: number
    onGround: boolean
    team: TeamId
  }
  visible: PerceivedEnemy[]
  remembered: PerceivedEnemy[]
  /** Most urgent visible enemy, chosen by the perception/planner boundary. */
  threat: PerceivedEnemy | null
  /** Positional dangers that do not depend on an enemy being visible. */
  danger: {
    void: boolean
    lowHealth: boolean
    bedThreat: boolean
  }
}

export interface BotIntent {
  goal: BotGoal
  targetId: number | null
  /** Human-readable reason for telemetry and review. */
  reason: string
  /** Utility score that selected this intent. */
  score: number
}

export interface BotPersonality {
  /** 0 = avoids fights, 1 = seeks them. */
  aggression: number
  /** 0 = rush, 1 = wait for the right moment. */
  patience: number
  /** 0 = spends freely, 1 = hoards resources. */
  greed: number
  /** 0 = safe, 1 = takes risky flanks and clutches. */
  risk: number
  /** 0 = bed only, 1 = builds constantly in fights. */
  build: number
  /** 0 = switches targets quickly, 1 = stays committed. */
  commitment: number
  /** Per-engagement chance of a brief human lapse. */
  lapse: number
}

/**
 * One tier's tunable behavior. Times are milliseconds and are quantized to
 * 20 TPS (50 ms) by the motor; they are not per-tick values.
 */
export interface BotTierProfile {
  tier: BotTier
  label: string
  /** Crown tier label marker for the lobby UI once plumbing is approved. */
  crown: boolean
  reactionMs: [number, number]
  decisionMs: [number, number]
  fovDegrees: number
  memorySeconds: number
  turnDegPerSecond: number
  turnAcceleration: number
  aimError: number
  /** Minimum and maximum corrective submovements for an aim action. */
  aimCorrections: [number, number]
  /** 0..1 chance of a small overshoot before correction. */
  overshoot: number
  bridge: BridgeMode
  combatBuilds: CombatBuildLevel
  /** Blocks the bot tries to keep for escape and combat, not just bed defence. */
  blockReserve: number
  /** Another target must beat the current one by this fraction to switch. */
  targetSwitchMargin: number
  commitmentMs: number
  lapseChance: number
  personality: BotPersonality
}

export interface BotAction {
  input: MoveInput
  /** Actions the bot wants the integrator to send through `room.receive`. */
  commands: ClientMessage[]
}

export interface BotTelemetryEntry {
  tick: number
  tier: BotTier
  goal: BotGoal
  targetId: number | null
  reason: string
  score: number
  /** Sampled response/decision latency in milliseconds, if this tick had one. */
  reactionMs: number | null
  aimError: number | null
  turnRate: number | null
  bridge: BridgeMode | null
  blocks: number
  lapse: boolean
  outcome?: 'hit' | 'miss' | 'kill' | 'death' | 'bed'
}
