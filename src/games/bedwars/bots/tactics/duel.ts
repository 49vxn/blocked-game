import { IDLE_INPUT, type MoveInput } from '../../../../engine/physics'
import type { World } from '../../../../engine/world'
import { ATTACK_REACH } from '../../constants'
import { blockDef } from '../../blocks'
import type { ClientMessage } from '../../protocol'
import type { Player } from '../../room'
import type { BotTier, BotTierProfile } from '../types'
import { cellFree, clutchCell, overVoid, pillarCell, wallCells, type Occupant } from './build'
import type { Placement } from './bridge'

export type DuelBuild = 'wall' | 'pillar' | 'clutch'

/** The part of an enemy a duel decision needs; perception owns the rest. */
export interface DuelTarget {
  id: number
  x: number
  y: number
  z: number
  /** Used only for the proactive wall read, not for tracking. */
  sprinting?: boolean
}

export interface DuelView {
  world: World
  self: Player
  target: DuelTarget
  profile: BotTierProfile
  tick: number
  blocks: number
  /** 0..1, not raw health points. */
  health: number
  /** The caller's aim is on target and the enemy is within reach. */
  canSwing: boolean
  /** Backing off or eating; the only time a reactive wall is worth it. */
  retreating?: boolean
  /** Teammates, for build occupancy only: the duel itself is one target. */
  allies?: Occupant[]
}

export interface DuelStyle {
  strafe: number
  strafeTicks: number
  wTap: boolean
  jumpCrit: boolean
  /** Minimum and maximum ticks between swings. */
  swingTicks: [number, number]
}

export interface DuelStep {
  input: MoveInput
  /** Attack and placement messages for the existing `room.receive` path. */
  commands: ClientMessage[]
  build: DuelBuild | null
  reason: 'pressure' | 'strafe' | 'crit' | 'wall' | 'pillar' | 'clutch'
}

const STYLES: Record<BotTier, DuelStyle> = {
  easy: { strafe: 0, strafeTicks: 6, wTap: false, jumpCrit: false, swingTicks: [10, 15] },
  normal: { strafe: 0.4, strafeTicks: 6, wTap: false, jumpCrit: false, swingTicks: [7, 11] },
  hard: { strafe: 0.8, strafeTicks: 14, wTap: true, jumpCrit: true, swingTicks: [4, 6] },
  expert: { strafe: 1, strafeTicks: 12, wTap: true, jumpCrit: true, swingTicks: [3, 4] },
  technoblade: { strafe: 1, strafeTicks: 10, wTap: true, jumpCrit: true, swingTicks: [3, 4] },
}

export function duelStyle(profile: BotTierProfile): DuelStyle {
  return STYLES[profile.tier] ?? STYLES.normal
}

const WALL_COOLDOWN = 20
const PILLAR_WINDOW = 12

/**
 * Close-range decisions for one committed target. It does not aim, track
 * targets, roll damage or place blocks itself: it returns the same input and
 * messages a person would send, and the server stays authoritative.
 */
export class DuelController {
  private strafeSide = 1
  private strafeUntil = 0
  private nextSwing = 0
  private wTapUntil = 0
  private nextBuild = 0
  private pillarUntil = -PILLAR_WINDOW - 1

  reset(): void {
    this.strafeSide = 1
    this.strafeUntil = 0
    this.nextSwing = 0
    this.wTapUntil = 0
    this.nextBuild = 0
    this.pillarUntil = -PILLAR_WINDOW - 1
  }

  step(view: DuelView): DuelStep {
    const { world, self, target, profile, tick, blocks } = view
    const style = duelStyle(profile)
    const dx = target.x - self.x
    const dz = target.z - self.z
    const distance = Math.hypot(dx, dz)
    const reserve = profile.blockReserve
    const commands: ClientMessage[] = []
    let build: DuelBuild | null = null
    let reason: DuelStep['reason'] = 'pressure'

    // A clutch is an escape spend: the last block is allowed, but a bot with
    // no blocks must not emit a place the server can only reject.
    if (blocks > 0 && !self.onGround && overVoid(world, self)) {
      const cell = clutchCell(world, self)
      if (cell) {
        commands.push(placeCommand(cell))
        build = 'clutch'
        reason = 'clutch'
      }
    }

    if (!build && profile.combatBuilds >= 2 && this.canPillar(view)) {
      if (self.onGround && tick - this.pillarUntil > PILLAR_WINDOW) {
        this.pillarUntil = tick
        reason = 'pillar'
      } else if (!self.onGround) {
        const cell = pillarCell(world, self)
        if (cell) {
          commands.push(placeCommand(cell))
          build = 'pillar'
          reason = 'pillar'
        }
      }
    }

    if (!build && profile.combatBuilds >= 1 && view.retreating && view.health <= 0.45 && distance <= 6) {
      const cells = this.affordable(this.walls(view), blocks, reserve, 2)
      if (cells.length && tick >= this.nextBuild) {
        for (const cell of cells) commands.push(placeCommand(cell))
        this.nextBuild = tick + WALL_COOLDOWN
        build = 'wall'
        reason = 'wall'
      }
    }

    if (!build && profile.combatBuilds >= 3 && !view.canSwing && target.sprinting && distance >= 3 && distance <= 6 && view.health > 0.5) {
      const cells = this.affordable(this.walls(view), blocks, reserve, 4)
      if (cells.length && tick >= this.nextBuild) {
        for (const cell of cells) commands.push(placeCommand(cell))
        this.nextBuild = tick + WALL_COOLDOWN
        build = 'wall'
        reason = 'wall'
      }
    }

    let jump = reason === 'pillar' && self.onGround
    if (!build && !jump && view.canSwing && tick >= this.nextSwing) {
      if (style.jumpCrit && self.onGround) {
        jump = true
        reason = 'crit'
      } else {
        commands.push({ t: 'attack', target: target.id })
        this.nextSwing = tick + swingInterval(style, tick)
        if (style.wTap) this.wTapUntil = tick + 2
      }
    }

    if (reason === 'pressure' && style.strafe > 0 && distance <= 5) reason = 'strafe'

    let forward = distance > ATTACK_REACH - 1 ? 1 : 0
    if (view.retreating) forward = -1
    if (tick < this.wTapUntil) forward = 0

    if (style.strafe > 0 && distance <= 5) {
      if (tick >= this.strafeUntil) {
        this.strafeSide *= -1
        this.strafeUntil = tick + style.strafeTicks
      }
    }

    const input: MoveInput = {
      ...IDLE_INPUT,
      yaw: self.yaw,
      pitch: self.pitch,
      forward,
      strafe: style.strafe * this.strafeSide,
      jump,
      sprint: forward > 0 && !view.retreating && tick >= this.wTapUntil,
    }

    return { input, commands, build, reason }
  }

  /** Height help is only worth it with reserve blocks and a clear jump. */
  private canPillar(view: DuelView): boolean {
    const { world, self, target, blocks, profile } = view
    if (target.y - self.y < 1.6) return false
    if (blocks < profile.blockReserve + 2) return false
    if (self.onGround) {
      const head = Math.floor(self.y) + 2
      if (blockDef(world.get(Math.floor(self.x), head, Math.floor(self.z))).solid) return false
    }
    return true
  }

  /** Wall cells that would not land inside the bot, the enemy or an ally. */
  private walls(view: DuelView): Placement[] {
    const occupants: Occupant[] = [view.self, view.target, ...(view.allies ?? [])]
    return wallCells(view.world, view.self, view.target).filter((cell) => cellFree(cell, occupants))
  }

  /** Keep the reserve and refuse a build that cannot afford its purpose. */
  private affordable(cells: Placement[], blocks: number, reserve: number, minimum: number): Placement[] {
    const spendable = blocks - reserve
    return spendable < minimum ? [] : cells.slice(0, spendable)
  }
}

function swingInterval(style: DuelStyle, tick: number): number {
  const [min, max] = style.swingTicks
  return min + ((tick * 7 + 3) % (max - min + 1))
}

function placeCommand(cell: Placement): ClientMessage {
  return { t: 'place', x: cell.x, y: cell.y, z: cell.z, face: cell.face, slot: cell.slot }
}
