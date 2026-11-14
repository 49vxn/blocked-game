import { lookDirection } from '../../../engine/physics'
import type { World } from '../../../engine/world'
import { AIR } from '../blocks'

/** Bedrock: hold use + sneak + back. Forward: opt-in use + forward at an edge. */
export type BridgeStyle = 'bedrock' | 'forward'

export interface BridgeFoot {
  x: number
  y: number
  z: number
  yaw: number
  onGround: boolean
  sneaking: boolean
}

export interface GroundCell {
  x: number
  y: number
  z: number
}

export interface BridgePlacement {
  /** The solid cell the new block is placed against. */
  support: GroundCell
  /** The air cell that becomes floor. */
  target: GroundCell
  /** Face of `support` that `target` touches. */
  face: [number, number, number]
}

/**
 * The next floor cell for the bridge assist. It never places into a wall or
 * an occupied cell, never places both directions on one tick, and forward mode
 * only extends over a gap. The caller still runs normal place validation, so
 * protection, reach and bodies remain authoritative.
 */
export function bridgePlacement(
  style: BridgeStyle,
  foot: BridgeFoot,
  input: { forward: boolean; back: boolean },
  world: World,
  lastGround: GroundCell | null,
  coyote: boolean,
): BridgePlacement | null {
  if (style === 'forward') {
    if (!input.forward || input.back) return null
  } else if (!input.back || input.forward || !foot.sneaking) return null

  const support: GroundCell | null = foot.onGround
    ? { x: Math.floor(foot.x), y: Math.floor(foot.y) - 1, z: Math.floor(foot.z) }
    : coyote
      ? lastGround
      : null
  if (!support || !world.inBounds(support.x, support.y, support.z) || !world.isSolid(support.x, support.y, support.z)) return null

  const [fx, , fz] = lookDirection(foot.yaw, 0)
  const alongX = Math.abs(fx) >= Math.abs(fz)
  const ahead = alongX ? (fx > 0 ? 1 : -1) : fz > 0 ? 1 : -1
  const step = style === 'forward' ? ahead : -ahead
  const target = alongX ? { x: support.x + step, y: support.y, z: support.z } : { x: support.x, y: support.y, z: support.z + step }
  if (!world.inBounds(target.x, target.y, target.z) || world.get(target.x, target.y, target.z) !== AIR) return null
  // Forward is a gap bridge, not a staircase: the cell below the new floor must be void.
  if (style === 'forward' && world.isSolid(target.x, target.y - 1, target.z)) return null

  return {
    support,
    target,
    face: alongX ? [step, 0, 0] : [0, 0, step],
  }
}
