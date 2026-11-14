import { describe, expect, test } from 'bun:test'
import { BOT_TIER_PROFILES } from '../src/games/bedwars/bots/profiles'
import { EconomyPlan, type EconomyInput } from '../src/games/bedwars/bots/economy'

function input(overrides: Partial<EconomyInput> = {}): EconomyInput {
  return {
    goal: 'shop',
    profile: BOT_TIER_PROFILES.normal,
    inventory: { iron: 40, gold: 12, diamond: 0, emerald: 0, blocks: 0 },
    bedAlive: true,
    routeCost: 0,
    firstRush: true,
    ...overrides,
  }
}

describe('bot economy', () => {
  test('keeps the block reserve and buys blocks before gear', () => {
    const plan = new EconomyPlan()
    const decision = plan.plan(input({ inventory: { iron: 40, gold: 12, diamond: 0, emerald: 0, blocks: 8 } }))

    expect(decision.reserve).toBe(BOT_TIER_PROFILES.normal.blockReserve)
    expect(decision.blockBudget).toBeGreaterThanOrEqual(decision.reserve)
    expect(decision.blocksNeeded).toBe(decision.reserve - 8)
    expect(decision.next?.kind).toBe('blocks')
    expect(decision.next?.id).toBe('wool')
    expect(decision.reserveBroken).toBe(false)
    expect(decision.wants.some((want) => want.kind !== 'blocks')).toBe(false)
  })

  test('only breaks the reserve for an explicit escape with a reason', () => {
    const plan = new EconomyPlan()
    const trapped = plan.plan(
      input({
        goal: 'escape',
        inventory: { iron: 40, gold: 12, diamond: 0, emerald: 0, blocks: 2 },
        emergency: { kind: 'escape', reason: 'knocked off the bridge', blocksNeeded: 4 },
      }),
    )

    expect(trapped.reserveBroken).toBe(true)
    expect(trapped.blocksNeeded).toBe(2)
    expect(trapped.next?.kind).toBe('blocks')
    expect(trapped.next?.reason).toContain('knocked off the bridge')
    expect(trapped.reason).toContain('escape')
  })

  test('does not break the reserve when escape blocks are already carried', () => {
    const plan = new EconomyPlan()
    const decision = plan.plan(
      input({
        goal: 'escape',
        inventory: { iron: 40, gold: 12, diamond: 0, emerald: 0, blocks: 24 },
        emergency: { kind: 'escape', reason: 'knocked off the bridge', blocksNeeded: 4 },
      }),
    )

    expect(decision.reserveBroken).toBe(false)
    expect(decision.blocksNeeded).toBe(0)
  })

  test('budgets the map route, not a fixed 64 wool', () => {
    const plan = new EconomyPlan()
    const short = plan.plan(
      input({
        profile: BOT_TIER_PROFILES.easy,
        firstRush: true,
        routeCost: 16,
        inventory: { iron: 40, gold: 0, diamond: 0, emerald: 0, blocks: 0 },
      }),
    )
    const long = plan.plan(
      input({
        profile: BOT_TIER_PROFILES.easy,
        firstRush: true,
        routeCost: 40,
        inventory: { iron: 40, gold: 0, diamond: 0, emerald: 0, blocks: 0 },
      }),
    )

    expect(short.blockBudget).toBe(16)
    expect(short.blocksNeeded).toBe(16)
    expect(long.blockBudget).toBe(40)
    expect(long.blocksNeeded).toBe(40)
    expect(short.blockBudget).not.toBe(64)
    expect(plan.firstRushBlocks(16, 0)).toBe(16)
    expect(plan.firstRushBlocks(40, 16)).toBe(24)
  })

  test('picks obsidian while the bed stands and a pearl once it is gone', () => {
    const plan = new EconomyPlan()
    const alive = plan.plan(
      input({
        goal: 'upgrade',
        bedAlive: true,
        inventory: { iron: 0, gold: 0, diamond: 0, emerald: 4, blocks: 32 },
      }),
    )
    const bedless = plan.plan(
      input({
        goal: 'upgrade',
        bedAlive: false,
        inventory: { iron: 0, gold: 0, diamond: 0, emerald: 4, blocks: 32 },
      }),
    )

    expect(alive.emerald?.id).toBe('obsidian')
    expect(alive.emerald?.cost).toBe(4)
    expect(alive.emerald?.affordable).toBe(true)
    expect(bedless.emerald?.id).toBe('pearl')
    expect(bedless.emerald?.cost).toBe(4)
  })

  test('spends diamonds on protection before sharpness, and only after the first rush', () => {
    const plan = new EconomyPlan()
    const early = plan.plan(
      input({
        firstRush: true,
        inventory: { iron: 0, gold: 0, diamond: 8, emerald: 0, blocks: 32 },
      }),
    )
    const protection = plan.plan(
      input({
        firstRush: false,
        inventory: { iron: 0, gold: 0, diamond: 8, emerald: 0, blocks: 32 },
      }),
    )
    const sharpness = plan.plan(
      input({
        firstRush: false,
        teamUpgrades: { protection: 4, sharpness: 0, forge: 0, healPool: 0 },
        inventory: { iron: 0, gold: 0, diamond: 8, emerald: 0, blocks: 32 },
      }),
    )

    expect(early.diamond).toBeNull()
    expect(protection.diamond?.id).toBe('protection')
    expect(protection.diamond?.cost).toBe(2)
    expect(sharpness.diamond?.id).toBe('sharpness')
    expect(sharpness.diamond?.cost).toBe(4)
  })

  test('is deterministic and does not mutate its input', () => {
    const plan = new EconomyPlan()
    const frozen = input({
      routeCost: 27,
      inventory: { iron: 21, gold: 3, diamond: 2, emerald: 4, blocks: 5 },
    })
    const before = structuredClone(frozen)
    const first = plan.plan(frozen)
    const second = new EconomyPlan().plan(frozen)

    expect(first).toEqual(second)
    expect(frozen).toEqual(before)
  })
})
