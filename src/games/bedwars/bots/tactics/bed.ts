import { IDLE_INPUT, type MoveInput } from '../../../../engine/physics'
import type { World } from '../../../../engine/world'
import { BLOCK_REACH } from '../../constants'
import type { TeamId } from '../../blocks'
import type { ClientMessage } from '../../protocol'
import type { Player } from '../../room'
import type { BotTierProfile } from '../types'
import { cellFree, clutchCell, overVoid, placeable, roofCells } from './build'
import type { Placement } from './bridge'

export type BedPhase = 'approach' | 'break' | 'escape' | 'regroup'

/** One half of an enemy bed is enough; the server knows the partner. */
export interface BedTarget {
  x: number
  y: number
  z: number
  team: TeamId
}

export interface BedActor {
  id: number
  x: number
  y: number
  z: number
}

export interface BedView {
  world: World
  self: Player
  /** Null once the bed is gone; the bot must disengage, not trade. */
  bed: BedTarget | null
  defenders: BedActor[]
  allies?: BedActor[]
  profile: BotTierProfile
  tick: number
  blocks: number
  ownTeam: TeamId
}

export interface BedStep {
  phase: BedPhase
  input: MoveInput
  /** Dig, place and (never) attack messages for `room.receive`. */
  commands: ClientMessage[]
  place: Placement | null
  reason: 'approach' | 'break' | 'cover' | 'own-bed' | 'escape' | 'regroup'
}

const COVER_COOLDOWN = 10
const DIG_DONE = 0.8
const COVER_RADIUS = 6

/**
 * A bed sortie as a small state machine. It only reads the world and the
 * server's own dig progress; every block and dig goes back through the normal
 * command path, so protection, reach and break timers stay server-side.
 */
export class BedAssault {
  private lastBed: { x: number; z: number } | null = null
  private nextBuild = 0

  reset(): void {
    this.lastBed = null
    this.nextBuild = 0
  }

  step(view: BedView): BedStep {
    const { self, bed, tick, blocks } = view
    if (bed) this.lastBed = { x: bed.x, z: bed.z }

    if (!bed) {
      const phase: BedPhase = blocks > 0 ? 'escape' : 'regroup'
      return this.leave(view, phase, phase)
    }

    if (bed.team === view.ownTeam) return this.leave(view, 'regroup', 'own-bed')

    const yaw = yawToward(self, bed.x + 0.5, bed.z + 0.5)
    const distance = Math.hypot(bed.x + 0.5 - self.x, bed.z + 0.5 - self.z)

    if (distance > BLOCK_REACH) {
      const save = this.voidSave(view)
      return {
        phase: 'approach',
        input: { ...IDLE_INPUT, yaw, forward: 1, sprint: true },
        commands: save ? [placeCommand(save)] : [],
        place: save,
        reason: 'approach',
      }
    }

    const commands: ClientMessage[] = []
    const dig = self.dig
    const done = !!dig && dig.x === bed.x && dig.y === bed.y && dig.z === bed.z && dig.progress >= DIG_DONE
    commands.push({ t: 'dig', target: [bed.x, bed.y, bed.z], done })

    // One placement per tick: staying out of the void outranks cover.
    const save = this.voidSave(view)
    const cover = save ? null : this.cover(view, bed)
    const placed = save ?? cover
    if (placed) commands.push(placeCommand(placed))
    if (cover) this.nextBuild = tick + COVER_COOLDOWN

    return {
      phase: 'break',
      input: { ...IDLE_INPUT, yaw, pitch: 0.35, forward: distance > 2.4 ? 1 : 0, sprint: false },
      commands,
      place: placed,
      reason: cover ? 'cover' : 'break',
    }
  }

  /** A wall or roof between the bed and the nearest defender, if affordable. */
  private cover(view: BedView, bed: BedTarget): Placement | null {
    const { world, self, defenders, profile, tick, blocks } = view
    if (blocks <= profile.blockReserve + 1 || tick < this.nextBuild) return null
    const near = defenders.filter((d) => Math.hypot(d.x - self.x, d.z - self.z) <= COVER_RADIUS)
    if (!near.length) return null
    const threat = near.reduce((a, b) =>
      Math.hypot(a.x - self.x, a.z - self.z) <= Math.hypot(b.x - self.x, b.z - self.z) ? a : b,
    )

    if (threat.y > self.y + 1.5) {
      for (const cell of roofCells(world, bed.x, bed.y + 1, bed.z)) if (this.free(view, cell)) return cell
    }

    const cells: [number, number][] = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]
    cells.sort((a, b) => Math.hypot(bed.x + a[0] - threat.x, bed.z + a[1] - threat.z) - Math.hypot(bed.x + b[0] - threat.x, bed.z + b[1] - threat.z))

    for (const [dx, dz] of cells) {
      // Never box the bot out of its own break cell.
      if (Math.hypot(bed.x + dx + 0.5 - self.x, bed.z + dz + 0.5 - self.z) < 1.5) continue
      const cell = placeable(world, bed.x + dx, bed.y, bed.z + dz)
      if (cell && this.free(view, cell)) return cell
    }
    return null
  }

  /** The block cell must not be inside the bot, an ally or a defender. */
  private free(view: BedView, cell: Placement): boolean {
    return cellFree(cell, [view.self, ...(view.allies ?? []), ...view.defenders])
  }

  /**
   * The one void save every phase shares: a block under the feet while
   * airborne over nothing. An own-bed or a lost-bed retreat is as fatal as an
   * approach, so the check does not depend on why the bot is leaving.
   */
  private voidSave(view: BedView): Placement | null {
    const { world, self, blocks } = view
    if (blocks <= 0 || self.onGround || !overVoid(world, self)) return null
    return clutchCell(world, self)
  }

  /** Disengage from the last known bed; buy time instead of taking a fair fight. */
  private leave(view: BedView, phase: BedPhase, reason: BedStep['reason']): BedStep {
    const { self } = view
    const from = this.lastBed
    const awayX = from ? self.x - (from.x + 0.5) : -Math.sin(self.yaw)
    const awayZ = from ? self.z - (from.z + 0.5) : -Math.cos(self.yaw)
    const yaw = awayX === 0 && awayZ === 0 ? self.yaw + Math.PI : Math.atan2(-awayX, -awayZ)
    const save = this.voidSave(view)
    const commands: ClientMessage[] = save ? [placeCommand(save)] : []
    return {
      phase,
      input: { ...IDLE_INPUT, yaw, forward: 1, sprint: true },
      commands,
      place: save,
      reason,
    }
  }
}

function yawToward(self: Player, x: number, z: number): number {
  const dx = x - self.x
  const dz = z - self.z
  return dx === 0 && dz === 0 ? self.yaw : Math.atan2(-dx, -dz)
}

function placeCommand(cell: Placement): ClientMessage {
  return { t: 'place', x: cell.x, y: cell.y, z: cell.z, face: cell.face, slot: cell.slot }
}
