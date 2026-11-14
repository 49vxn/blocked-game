import type { BotTier, BotTierProfile } from './types'

/**
 * The five bot tiers. Values are design starting points from
 * `docs/BOT_AI_REWRITE.md`, not measured human percentiles. Reaction and
 * decision times are milliseconds; the motor quantizes them to 20 TPS.
 */
export const BOT_TIER_PROFILES: Record<BotTier, BotTierProfile> = {
  easy: {
    tier: 'easy',
    label: 'Easy',
    crown: false,
    reactionMs: [500, 1000],
    decisionMs: [300, 500],
    fovDegrees: 95,
    memorySeconds: 1.0,
    turnDegPerSecond: 240,
    turnAcceleration: 1200,
    aimError: 0.2,
    aimCorrections: [1, 2],
    overshoot: 0.2,
    bridge: 'slow',
    combatBuilds: 0,
    blockReserve: 16,
    targetSwitchMargin: 0.3,
    commitmentMs: 900,
    lapseChance: 0.03,
    personality: { aggression: 0.3, patience: 0.7, greed: 0.2, risk: 0.2, build: 0.1, commitment: 0.5, lapse: 0.03 },
  },
  normal: {
    tier: 'normal',
    label: 'Normal',
    crown: false,
    reactionMs: [380, 700],
    decisionMs: [220, 380],
    fovDegrees: 105,
    memorySeconds: 1.4,
    turnDegPerSecond: 360,
    turnAcceleration: 1800,
    aimError: 0.1,
    aimCorrections: [1, 2],
    overshoot: 0.15,
    bridge: 'speed',
    combatBuilds: 1,
    blockReserve: 24,
    targetSwitchMargin: 0.25,
    commitmentMs: 750,
    lapseChance: 0.02,
    personality: { aggression: 0.45, patience: 0.55, greed: 0.35, risk: 0.35, build: 0.25, commitment: 0.6, lapse: 0.02 },
  },
  hard: {
    tier: 'hard',
    label: 'Hard',
    crown: false,
    reactionMs: [280, 550],
    decisionMs: [160, 280],
    fovDegrees: 115,
    memorySeconds: 1.8,
    turnDegPerSecond: 520,
    turnAcceleration: 2600,
    aimError: 0.05,
    aimCorrections: [1, 2],
    overshoot: 0.12,
    bridge: 'speed',
    combatBuilds: 2,
    blockReserve: 32,
    targetSwitchMargin: 0.2,
    commitmentMs: 600,
    lapseChance: 0.012,
    personality: { aggression: 0.6, patience: 0.4, greed: 0.5, risk: 0.5, build: 0.55, commitment: 0.7, lapse: 0.012 },
  },
  expert: {
    tier: 'expert',
    label: 'Expert',
    crown: false,
    reactionMs: [220, 450],
    decisionMs: [120, 220],
    fovDegrees: 120,
    memorySeconds: 2.2,
    turnDegPerSecond: 650,
    turnAcceleration: 3200,
    aimError: 0.025,
    aimCorrections: [0, 1],
    overshoot: 0.06,
    bridge: 'speed',
    combatBuilds: 2,
    blockReserve: 48,
    targetSwitchMargin: 0.15,
    commitmentMs: 500,
    lapseChance: 0.008,
    personality: { aggression: 0.7, patience: 0.3, greed: 0.65, risk: 0.6, build: 0.75, commitment: 0.8, lapse: 0.008 },
  },
  technoblade: {
    tier: 'technoblade',
    label: 'Technoblade',
    crown: true,
    reactionMs: [190, 380],
    decisionMs: [100, 180],
    fovDegrees: 120,
    memorySeconds: 2.5,
    turnDegPerSecond: 720,
    turnAcceleration: 3600,
    aimError: 0.02,
    aimCorrections: [0, 1],
    overshoot: 0.04,
    bridge: 'telly',
    combatBuilds: 3,
    blockReserve: 64,
    targetSwitchMargin: 0.12,
    commitmentMs: 450,
    lapseChance: 0.005,
    personality: { aggression: 0.85, patience: 0.35, greed: 0.8, risk: 0.7, build: 0.9, commitment: 0.85, lapse: 0.005 },
  },
}

export const BOT_TIER_ORDER: BotTier[] = ['easy', 'normal', 'hard', 'expert', 'technoblade']

export function isBotTier(value: string): value is BotTier {
  return (BOT_TIER_ORDER as string[]).includes(value)
}

export function profileForTier(tier: BotTier | string | null | undefined): BotTierProfile {
  return (tier && isBotTier(tier) ? BOT_TIER_PROFILES[tier] : BOT_TIER_PROFILES.normal)
}
