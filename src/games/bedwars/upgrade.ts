import { TPS } from './constants'
import type { ArmorTier } from './items'

/**
 * Upgrade Rush: one ladder, one package per tier.
 *
 * Numbers are server-authoritative. The client only uses the table to preview
 * the next tier; the room applies the package with `applyUpgradeKit`.
 */
export const UPGRADE_MAX_TIER = 9
export const UPGRADE_KILLS_TO_WIN = 25
export const UPGRADE_ROUND_TICKS = 10 * 60 * TPS
export const UPGRADE_KILL_HEAL = 6
export const UPGRADE_SPAWN_PROTECTION_TICKS = TPS
/** Each colour has two seats, and each seat gets its own island in Upgrade Rush. */
export const UPGRADE_TEAM_SIZE = 2
export const UPGRADE_MAX_PLAYERS = 8

export interface UpgradeGear {
  tier: number
  /** Short name for the HUD badge. */
  name: string
  sword: string
  armor: ArmorTier
  pickaxe: string
  axe: string
  block: string
  blocks: number
  /** Apples granted when this tier is reached; 0 on every tier but 4 and 8. */
  apples: number
  /** Extra healing consumables granted with this tier package. */
  heals?: { item: string; count: number }[]
  /** Arrows topped up to this count; 0 before the bow tier. */
  arrows: number
  bow: boolean
  maxHealth: number
  /** Walking and air-control multiplier, matching `MoveInput.speedBoost`. */
  speed: number
  /** One line for the "next tier" HUD preview. */
  next: string
}

export const UPGRADE_TIERS: readonly UpgradeGear[] = [
  {
    tier: 0,
    name: 'Wood',
    sword: 'wood_sword',
    armor: 'leather',
    pickaxe: 'wood_pickaxe',
    axe: 'wood_axe',
    block: 'wool',
    blocks: 32,
    apples: 0,
    arrows: 0,
    bow: false,
    maxHealth: 20,
    speed: 1,
    next: 'Stone sword, +16 blocks',
  },
  {
    tier: 1,
    name: 'Stone',
    sword: 'stone_sword',
    armor: 'leather',
    pickaxe: 'wood_pickaxe',
    axe: 'wood_axe',
    block: 'wool',
    blocks: 48,
    apples: 0,
    arrows: 0,
    bow: false,
    maxHealth: 20,
    speed: 1,
    next: 'Chain armour, +walk speed',
  },
  {
    tier: 2,
    name: 'Chain',
    heals: [{ item: 'healing_potion', count: 1 }],
    sword: 'stone_sword',
    armor: 'chain',
    pickaxe: 'wood_pickaxe',
    axe: 'wood_axe',
    block: 'wool',
    blocks: 48,
    apples: 0,
    arrows: 0,
    bow: false,
    maxHealth: 20,
    speed: 1.06,
    next: 'Iron sword, stone tools, clay, +2 max HP',
  },
  {
    tier: 3,
    name: 'Iron',
    sword: 'iron_sword',
    armor: 'chain',
    pickaxe: 'stone_pickaxe',
    axe: 'stone_axe',
    block: 'clay',
    blocks: 48,
    apples: 0,
    arrows: 0,
    bow: false,
    maxHealth: 22,
    speed: 1.06,
    next: 'Iron armour, +golden apple',
  },
  {
    tier: 4,
    name: 'Iron+',
    sword: 'iron_sword',
    armor: 'iron',
    pickaxe: 'stone_pickaxe',
    axe: 'stone_axe',
    block: 'clay',
    blocks: 48,
    apples: 1,
    arrows: 0,
    bow: false,
    maxHealth: 22,
    speed: 1.06,
    next: 'Iron tools, +sprint speed',
  },
  {
    tier: 5,
    name: 'Steel',
    heals: [{ item: 'regen_potion', count: 1 }],
    sword: 'iron_sword',
    armor: 'iron',
    pickaxe: 'iron_pickaxe',
    axe: 'iron_axe',
    block: 'clay',
    blocks: 48,
    apples: 0,
    arrows: 0,
    bow: false,
    maxHealth: 22,
    speed: 1.12,
    next: 'Diamond sword, glass, +2 max HP',
  },
  {
    tier: 6,
    name: 'Diamond',
    sword: 'diamond_sword',
    armor: 'iron',
    pickaxe: 'iron_pickaxe',
    axe: 'iron_axe',
    block: 'glass',
    blocks: 48,
    apples: 0,
    arrows: 0,
    bow: false,
    maxHealth: 24,
    speed: 1.12,
    next: 'Diamond armour, gold tools, bow',
  },
  {
    tier: 7,
    name: 'Diamond+',
    heals: [{ item: 'healing_potion', count: 1 }],
    sword: 'diamond_sword',
    armor: 'diamond',
    pickaxe: 'gold_pickaxe',
    axe: 'gold_axe',
    block: 'glass',
    blocks: 48,
    apples: 0,
    arrows: 16,
    bow: true,
    maxHealth: 24,
    speed: 1.12,
    next: 'Diamond tools, moonstone, +golden apple, +speed',
  },
  {
    tier: 8,
    name: 'Moonstone',
    heals: [{ item: 'enchanted_apple', count: 1 }],
    sword: 'diamond_sword',
    armor: 'diamond',
    pickaxe: 'diamond_pickaxe',
    axe: 'diamond_axe',
    block: 'moonstone',
    blocks: 48,
    apples: 1,
    arrows: 32,
    bow: true,
    maxHealth: 24,
    speed: 1.18,
    next: 'Apex: +2 max HP, more blocks and arrows',
  },
  {
    tier: 9,
    name: 'Apex',
    heals: [{ item: 'regen_potion', count: 1 }],
    sword: 'diamond_sword',
    armor: 'diamond',
    pickaxe: 'diamond_pickaxe',
    axe: 'diamond_axe',
    block: 'moonstone',
    blocks: 64,
    apples: 0,
    arrows: 48,
    bow: true,
    maxHealth: 26,
    speed: 1.18,
    next: '',
  },
]

/** The package for a tier, clamped to the ladder. */
export function gearFor(tier: number): UpgradeGear {
  return UPGRADE_TIERS[Math.max(0, Math.min(UPGRADE_MAX_TIER, Math.floor(tier)))]
}

/** What the next kill unlocks, or null at the top. */
export function nextUpgrade(tier: number): string | null {
  return tier >= UPGRADE_MAX_TIER ? null : gearFor(tier).next
}
