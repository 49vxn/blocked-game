import { IDLE_INPUT, lookDirection, type MoveInput } from '../../../../engine/physics'
import type { World } from '../../../../engine/world'
import { blockDef } from '../../blocks'
import type { Player } from '../../room'
import type { BotTierProfile } from '../types'

export interface Placement {
  /** The solid cell the block is placed against. */
  x: number
  y: number
  z: number
  face: [number, number, number]
  slot: number
}

export interface BridgeStep {
  input: MoveInput
  place?: Placement
  /** True while the bot is on the bridge's planned lane. */
  active: boolean
}

const BLOCK_SLOT = 0
const JUMP_COOLDOWN = 2

/**
 * Telly-style forward bridge for a bot: jump and lay the next floor cell ahead
 * while moving. The server remains authoritative; this only produces the same
 * place message a player would send.
 */
export class TellyBridge {
  private lastPlace = -999
  private lastJump = -999

  reset(): void {
    this.lastPlace = -999
    this.lastJump = -999
  }

  step(world: World, p: Player, profile: BotTierProfile, tick: number, blocks: number, slot = BLOCK_SLOT): BridgeStep {
    const input: MoveInput = { ...IDLE_INPUT, yaw: p.yaw, pitch: -0.35, forward: 1, sprint: true }
    if (profile.bridge !== 'telly') return { input, active: false }

    // A telly bridge starts with a jump from the edge. Do not start one when
    // there is no reserve for the landing block.
    if (!p.onGround) {
      const place = this.stepAir(world, p, tick, slot)
      return { input, place: place ?? undefined, active: true }
    }
    if (blocks < 4 || tick - this.lastJump < JUMP_COOLDOWN) return { input, active: true }
    this.lastJump = tick
    return { input: { ...input, jump: true }, active: true }
  }

  /** Lay the next floor cell while airborne. Returns no placement when blocked. */
  stepAir(world: World, p: Player, tick: number, slot = BLOCK_SLOT): Placement | null {
    if (p.onGround || tick - this.lastPlace < 1) return null
    const [fx, , fz] = lookDirection(p.yaw, 0)
    const alongX = Math.abs(fx) >= Math.abs(fz)
    const stepX = alongX ? (fx > 0 ? 1 : -1) : 0
    const stepZ = alongX ? 0 : (fz > 0 ? 1 : -1)
    const y = Math.floor(p.y) - 1
    const x = Math.floor(p.x) + stepX
    const z = Math.floor(p.z) + stepZ
    if (world.get(x, y, z) !== 0) return null
    const support = supportFor(world, x, y, z)
    if (!support) return null
    this.lastPlace = tick
    return { x: support[0], y: support[1], z: support[2], face: [x - support[0], y - support[1], z - support[2]], slot }
  }
}

/** A solid neighbour to place a block at (x,y,z) against: below, sides, above. */
export function supportFor(world: World, x: number, y: number, z: number): [number, number, number] | null {
  const options: [number, number, number][] = [
    [x, y - 1, z],
    [x + 1, y, z],
    [x - 1, y, z],
    [x, y, z + 1],
    [x, y, z - 1],
    [x, y + 1, z],
  ]
  return options.find(([ax, ay, az]) => blockDef(world.get(ax, ay, az)).solid) ?? null
}
