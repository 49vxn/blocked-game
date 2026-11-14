import type { ArmorTier, Resource } from '../items'
import { ARMOR_ORDER } from '../items'
import { OFFERS, TOOL_TIER_COST, UPGRADES, type Offer, type TeamUpgrades } from '../shop'
import type { BotGoal, BotTierProfile } from './types'

export interface EconomyInventory {
  iron: number
  gold: number
  diamond: number
  emerald: number
  /** Every block item the bot carries, added together. */
  blocks: number
}

export interface EconomyEmergency {
  kind: 'escape' | 'bridge'
  /** Why the reserve may be broken; carried into the purchase reason. */
  reason: string
  blocksNeeded: number
}

export interface EconomyInput {
  goal: BotGoal
  profile: BotTierProfile
  inventory: EconomyInventory
  /** True while our bed stands. */
  bedAlive: boolean
  /** Blocks the map route to the next objective needs, from the world model. */
  routeCost: number
  /** True until the first rush is done; diamond upgrades wait for it. */
  firstRush?: boolean
  teamUpgrades?: Partial<TeamUpgrades>
  armor?: ArmorTier
  /** 0..3 (stone/iron/diamond sword); -1 when the bot has only its wooden sword. */
  swordTier?: number
  pickaxeTier?: number
  emergency?: EconomyEmergency | null
}

export interface EconomyWant {
  kind: 'blocks' | 'item' | 'upgrade'
  id: string
  name: string
  resource: Resource
  /** Total resource cost of `quantity` offers. */
  cost: number
  quantity: number
  priority: number
  reason: string
  affordable: boolean
  /** True when this want deliberately dips below the block reserve. */
  breaksReserve: boolean
}

export interface EconomyDecision {
  /** Blocks the bot will not place on non-lethal builds. */
  reserve: number
  /** Blocks to carry for the next objective, including the reserve floor. */
  blockBudget: number
  /** More blocks needed to reach the budget. */
  blocksNeeded: number
  /** Highest-priority affordable want; null when the bot must keep saving. */
  next: EconomyWant | null
  /** Every want in priority order, including unaffordable strategic plans. */
  wants: EconomyWant[]
  /** Diamond plan for the team, after the first rush. */
  diamond: EconomyWant | null
  /** The emerald plan for this stage (obsidian alive, pearl bedless). */
  emerald: EconomyWant | null
  /** True only when an explicit emergency allowed the reserve to break. */
  reserveBroken: boolean
  reason: string
}

export interface TeamUpgradeChoice {
  id: 'protection' | 'sharpness'
  level: number
  cost: number
}

const WOOL_OFFER = OFFERS.find((offer) => offer.id === 'wool')!
const OBSIDIAN_OFFER = OFFERS.find((offer) => offer.id === 'obsidian')!
const PEARL_OFFER = OFFERS.find((offer) => offer.id === 'pearl')!
const PICKAXE_OFFER = OFFERS.find((offer) => offer.id === 'pickaxe')!

function offerById(id: string): Offer {
  return OFFERS.find((offer) => offer.id === id)!
}

function upgradeLevels(id: 'protection' | 'sharpness'): number[] {
  return UPGRADES.find((upgrade) => upgrade.id === id)?.levels ?? []
}

export function nextTeamUpgrade(upgrades: Partial<TeamUpgrades> | undefined): TeamUpgradeChoice | null {
  const protection = upgrades?.protection ?? 0
  const protectionLevels = upgradeLevels('protection')
  if (protection < protectionLevels.length) return { id: 'protection', level: protection + 1, cost: protectionLevels[protection] }
  const sharpness = upgrades?.sharpness ?? 0
  const sharpnessLevels = upgradeLevels('sharpness')
  if (sharpness < sharpnessLevels.length) return { id: 'sharpness', level: sharpness + 1, cost: sharpnessLevels[sharpness] }
  return null
}

function gearWant(offer: Offer, priority: number, reason: string, affordable: boolean): EconomyWant {
  const cost = offer.cost[0]
  return {
    kind: 'item',
    id: offer.id,
    name: offer.name,
    resource: cost.resource,
    cost: cost.amount,
    quantity: 1,
    priority,
    reason,
    affordable,
    breaksReserve: false,
  }
}

function blockingWant(units: number, iron: number, reason: string, breaksReserve: boolean, priority: number): EconomyWant {
  return {
    kind: 'blocks',
    id: 'wool',
    name: WOOL_OFFER.name,
    resource: 'iron',
    cost: WOOL_OFFER.cost[0].amount * units,
    quantity: units,
    priority,
    reason,
    affordable: iron >= WOOL_OFFER.cost[0].amount * units,
    breaksReserve,
  }
}

/**
 * Resource planning only: it returns wants and costs and never touches the
 * room, shop or inventory. The integrator decides when and where to buy.
 */
export class EconomyPlan {
  /** Blocks a first rush needs when the map route costs `routeCost` and `blocksCarried` are already held. */
  firstRushBlocks(routeCost: number, blocksCarried: number): number {
    return Math.max(0, Math.max(0, routeCost) - Math.max(0, blocksCarried))
  }

  plan(input: EconomyInput): EconomyDecision {
    const { profile, inventory: inv } = input
    const reserve = profile.blockReserve
    const route = Math.max(0, input.routeCost)
    const emergency = input.emergency ?? null

    let blockBudget = Math.max(reserve, route)
    let blocksNeeded = Math.max(0, blockBudget - inv.blocks)
    let reserveBroken = false
    let reason = blocksNeeded > 0 ? `keep ${reserve} blocks for escape and combat` : `route budget ${route} blocks`
    let breaksReserve = false

    if (emergency) {
      const needed = Math.max(0, emergency.blocksNeeded - inv.blocks)
      blockBudget = inv.blocks + needed
      blocksNeeded = needed
      reserveBroken = needed > 0 && blockBudget < reserve
      breaksReserve = reserveBroken
      reason = `emergency ${emergency.kind}: ${emergency.reason}`
    }

    const wants: EconomyWant[] = []
    if (blocksNeeded > 0) {
      const units = Math.ceil(blocksNeeded / 16)
      const reserveShort = Math.max(0, reserve - inv.blocks)
      const blockReason = emergency
        ? `emergency ${emergency.kind}: ${emergency.reason} (${blocksNeeded} blocks)`
        : reserveShort > 0
          ? `keep the ${reserve}-block reserve (${blocksNeeded} short)`
          : `bridge the ${route}-block route (${blocksNeeded} short)`
      wants.push(blockingWant(units, inv.iron, blockReason, breaksReserve, emergency ? 120 : 100))
    }

    // A short reserve may not be raided for swords or armour: only blocks are wanted until it is restored.
    const maySpend = inv.blocks >= reserve && !(emergency && reserveBroken)
    const diamond = input.firstRush ? null : this.diamondWant(input, maySpend)
    const emerald = this.emeraldWant(input, maySpend)
    if (maySpend) {
      if (diamond) wants.push(diamond)
      if (emerald) wants.push(emerald)
      wants.push(...this.gearWants(input))
    }

    wants.sort((a, b) => b.priority - a.priority || a.cost - b.cost || a.id.localeCompare(b.id))
    const next = wants.find((want) => want.affordable) ?? null

    return {
      reserve,
      blockBudget,
      blocksNeeded,
      next,
      wants,
      diamond,
      emerald,
      reserveBroken,
      reason,
    }
  }

  private diamondWant(input: EconomyInput, maySpend: boolean): EconomyWant | null {
    const choice = nextTeamUpgrade(input.teamUpgrades)
    if (!choice || !maySpend) return null
    const affordable = input.inventory.diamond >= choice.cost
    return {
      kind: 'upgrade',
      id: choice.id,
      name: choice.id === 'protection' ? `Team protection ${choice.level}` : `Sharpened swords ${choice.level}`,
      resource: 'diamond',
      cost: choice.cost,
      quantity: 1,
      priority: input.goal === 'upgrade' ? 85 : 75,
      reason: `diamonds: team ${choice.id} level ${choice.level}`,
      affordable,
      breaksReserve: false,
    }
  }

  private emeraldWant(input: EconomyInput, maySpend: boolean): EconomyWant | null {
    if (!maySpend) return null
    const offer = input.bedAlive ? OBSIDIAN_OFFER : PEARL_OFFER
    const cost = offer.cost[0]
    return {
      kind: 'item',
      id: offer.id,
      name: offer.name,
      resource: cost.resource,
      cost: cost.amount,
      quantity: 1,
      priority: input.bedAlive ? 70 : 78,
      reason: input.bedAlive ? 'emeralds: obsidian layer while the bed stands' : 'emeralds: rift pearl after the bed is gone',
      affordable: input.inventory.emerald >= cost.amount,
      breaksReserve: false,
    }
  }

  private gearWants(input: EconomyInput): EconomyWant[] {
    const { inventory: inv, profile, goal } = input
    const wants: EconomyWant[] = []
    const swordTier = input.swordTier ?? -1
    const armor = input.armor ?? 'leather'
    const iron = inv.iron
    const gold = inv.gold
    const emerald = inv.emerald

    const sword = this.swordFor(profile, swordTier)
    if (sword) {
      const offer = offerById(sword)
      const cost = offer.cost[0]
      const stock = cost.resource === 'iron' ? iron : cost.resource === 'gold' ? gold : emerald
      wants.push(gearWant(offer, goal === 'defend' || goal === 'guard' ? 58 : 62, 'better sword', stock >= cost.amount))
    }

    const armorTier = this.armorFor(profile, armor)
    if (armorTier) {
      const offer = offerById(`${armorTier}_armor`)
      const cost = offer.cost[0]
      const stock = cost.resource === 'iron' ? iron : cost.resource === 'gold' ? gold : emerald
      wants.push(gearWant(offer, goal === 'defend' || goal === 'guard' ? 64 : 55, 'better armour', stock >= cost.amount))
    }

    if (goal === 'breakBed') {
      const tier = input.pickaxeTier ?? -1
      if (tier < 2) {
        const cost = tier < 0 ? PICKAXE_OFFER.cost[0] : TOOL_TIER_COST[tier + 1][0]
        wants.push({
          kind: 'item',
          id: PICKAXE_OFFER.id,
          name: PICKAXE_OFFER.name,
          resource: cost.resource,
          cost: cost.amount,
          quantity: 1,
          priority: 66,
          reason: 'a pickaxe for the bed defence',
          affordable: (cost.resource === 'iron' ? iron : cost.resource === 'gold' ? gold : emerald) >= cost.amount,
          breaksReserve: false,
        })
      }
    }

    return wants
  }

  private swordFor(profile: BotTierProfile, tier: number): string | null {
    switch (profile.tier) {
      case 'easy':
        return tier < 1 ? 'stone_sword' : null
      case 'normal':
        return tier < 2 ? 'iron_sword' : null
      case 'hard':
        return tier < 2 ? 'iron_sword' : null
      case 'expert':
      case 'technoblade':
        return tier < 3 ? 'diamond_sword' : null
      default:
        return null
    }
  }

  private armorFor(profile: BotTierProfile, armor: ArmorTier): ArmorTier | null {
    const rank = ARMOR_ORDER.indexOf(armor)
    switch (profile.tier) {
      case 'easy':
      case 'normal':
        return rank < ARMOR_ORDER.indexOf('chain') ? 'chain' : rank < ARMOR_ORDER.indexOf('iron') ? 'iron' : null
      case 'hard':
        return rank < ARMOR_ORDER.indexOf('iron') ? 'iron' : null
      case 'expert':
      case 'technoblade':
        return rank < ARMOR_ORDER.indexOf('diamond') ? 'diamond' : null
      default:
        return null
    }
  }
}
