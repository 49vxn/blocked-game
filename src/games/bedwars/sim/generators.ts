import { PICKUP_RADIUS } from '../../../engine/constants'
import type { TeamId } from '../blocks'
import type { GeneratorKind } from '../rules'

/** A generator placed by the map. `team` marks a home forge; diamond/emerald have none. */
export interface Generator {
  kind: GeneratorKind
  team?: TeamId
  pos: [number, number, number]
  next: number
}

/** A generator pile or a thrown item lying in the world. */
export interface Drop {
  id: number
  item: string
  count: number
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  /** The generator that made it, so its cap counts only its own pile; -1 for a thrown item. */
  source: number
  /** Thrown items: nobody picks them up before this tick, and they vanish at `expires`. */
  pickupAt?: number
  expires?: number
}

export interface PickupBody {
  x: number
  y: number
  z: number
  onGround: boolean
}

/**
 * A home forge pays only someone standing on its pad. The old team-wide rule
 * handed iron and gold to every living teammate anywhere on the map, which
 * made the forge a passive income stream instead of a place to defend.
 */
export const HOME_GENERATOR_RADIUS = 2

export function isHomeGenerator(generator: Generator | undefined): generator is Generator & { team: TeamId } {
  return !!generator?.team
}

/**
 * Home forges use a two-block pad rule; diamond and emerald piles keep the
 * normal item pickup radius. The caller picks one taker per pile per tick, so
 * a pile is never copied or split between teammates.
 */
export function canPickupDrop(body: PickupBody, drop: Drop, generators: Generator[]): boolean {
  const generator = drop.source >= 0 ? generators[drop.source] : undefined
  if (isHomeGenerator(generator)) {
    if (!body.onGround) return false
    const horizontal = Math.hypot(body.x - generator.pos[0], body.z - generator.pos[2])
    const vertical = Math.abs(body.y + 0.9 - (generator.pos[1] + 0.3))
    return horizontal <= HOME_GENERATOR_RADIUS && vertical <= 2
  }
  return Math.hypot(body.x - drop.x, body.y + 0.9 - drop.y, body.z - drop.z) <= PICKUP_RADIUS
}
