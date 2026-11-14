import { describe, expect, test } from 'bun:test'
import { BOT_TIER_ORDER, BOT_TIER_PROFILES, isBotTier, profileForTier } from '../src/games/bedwars/bots/profiles'
import { BotTelemetry } from '../src/games/bedwars/bots/telemetry'

describe('bot tier profiles', () => {
  test('defines all five tiers with sane ordered limits', () => {
    expect(BOT_TIER_ORDER).toEqual(['easy', 'normal', 'hard', 'expert', 'technoblade'])
    for (const tier of BOT_TIER_ORDER) {
      const profile = BOT_TIER_PROFILES[tier]
      expect(profile.tier).toBe(tier)
      expect(profile.reactionMs[0]).toBeLessThanOrEqual(profile.reactionMs[1])
      expect(profile.decisionMs[0]).toBeLessThanOrEqual(profile.decisionMs[1])
      expect(profile.memorySeconds).toBeGreaterThan(0)
      expect(profile.turnDegPerSecond).toBeGreaterThan(0)
      expect(profile.aimError).toBeGreaterThanOrEqual(0)
      expect(profile.commitmentMs).toBeGreaterThan(0)
      expect(profile.lapseChance).toBeGreaterThanOrEqual(0)
      expect(profile.lapseChance).toBeLessThan(0.1)
      for (const trait of Object.values(profile.personality)) {
        expect(trait).toBeGreaterThanOrEqual(0)
        expect(trait).toBeLessThanOrEqual(1)
      }
    }
  })

  test('higher tiers are faster and more capable, but not perfect', () => {
    for (let i = 1; i < BOT_TIER_ORDER.length; i++) {
      const previous = BOT_TIER_PROFILES[BOT_TIER_ORDER[i - 1]]
      const current = BOT_TIER_PROFILES[BOT_TIER_ORDER[i]]
      expect(current.reactionMs[0]).toBeLessThan(previous.reactionMs[0])
      expect(current.turnDegPerSecond).toBeGreaterThan(previous.turnDegPerSecond)
      expect(current.memorySeconds).toBeGreaterThan(previous.memorySeconds)
      expect(current.blockReserve).toBeGreaterThanOrEqual(previous.blockReserve)
      expect(current.combatBuilds).toBeGreaterThanOrEqual(previous.combatBuilds)
      expect(current.aimError).toBeLessThanOrEqual(previous.aimError)
    }
    const techno = BOT_TIER_PROFILES.technoblade
    expect(techno.crown).toBe(true)
    expect(techno.bridge).toBe('telly')
    expect(techno.aimError).toBeGreaterThan(0)
    expect(techno.reactionMs[0]).toBeGreaterThanOrEqual(150)
    expect(techno.lapseChance).toBeGreaterThan(0)
  })

  test('unknown tiers fall back to normal and only known tiers pass the guard', () => {
    expect(isBotTier('expert')).toBe(true)
    expect(isBotTier('technoblade')).toBe(true)
    expect(isBotTier('godlike')).toBe(false)
    expect(profileForTier('technoblade').tier).toBe('technoblade')
    expect(profileForTier('godlike').tier).toBe('normal')
    expect(profileForTier(undefined).tier).toBe('normal')
  })
})

describe('bot telemetry', () => {
  test('keeps a bounded recent history and clears on demand', () => {
    const telemetry = new BotTelemetry()
    for (let i = 0; i < 25; i++) {
      telemetry.record({
        tick: i,
        tier: 'technoblade',
        goal: 'raid',
        targetId: 7,
        reason: 'test',
        score: 1,
        reactionMs: 200,
        aimError: 0.02,
        turnRate: 600,
        bridge: 'telly',
        blocks: 48,
        lapse: false,
      })
    }
    expect(telemetry.all()).toHaveLength(25)
    expect(telemetry.recent(3).map((entry) => entry.tick)).toEqual([22, 23, 24])
    telemetry.clear()
    expect(telemetry.all()).toHaveLength(0)
  })
})
