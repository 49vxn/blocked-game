import { IDLE_INPUT, type MoveInput } from '../../../engine/physics'
import { ATTACK_REACH } from '../constants'
import { item } from '../items'
import { MID } from '../maps/plan'
import type { Brain, Player, Room } from '../room'
import { BOT_LEVELS, type BotLevel } from '../rules'
import { profileForTier } from './profiles'

/**
 * A deliberately small Upgrade Rush brain. FFA has no beds, shops, generators
 * or team upgrades, so the arena bot's economy/defence planner would spend the
 * whole round looking for things that do not exist. This brain does the one
 * thing the mode needs: pick the nearest living player (teams are seats, not
 * allies), hold a sword, close along solid ground, and swing in reach.
 *
 * The room's performance director can change `room.ffaBotLevel` during the
 * round. The bot reads it every tick: Easy reacts late and never sprints;
 * Expert reacts almost immediately, sprints from farther out and aims with
 * much less error. The map already bridges every island, so the brain never
 * builds.
 */
export class UpgradeBot implements Brain {
  private level: BotLevel = 'normal'
  private profile = profileForTier('normal')
  private targetId: number | null = null
  private engageAt = 0

  constructor(level: BotLevel = 'normal') {
    this.setLevel(level)
  }

  private setLevel(level: BotLevel): void {
    this.level = level
    this.profile = profileForTier(level)
  }

  /** 20 TPS: one tick is 50 ms. */
  private reactionTicks(room: Room): number {
    const [lo, hi] = this.profile.reactionMs
    return Math.max(1, Math.round((lo + room.random() * (hi - lo)) / 50))
  }

  think(room: Room, p: Player): MoveInput {
    if (room.ffaBotLevel !== this.level) this.setLevel(room.ffaBotLevel)
    if (!p.alive) return { ...IDLE_INPUT, yaw: p.yaw, pitch: p.pitch }

    const sword = p.inventory.findIndex((s) => s !== null && item(s.id)?.kind === 'sword')
    if (sword >= 0 && p.selected !== sword) room.receive(p.id, { t: 'select', slot: sword })

    let target: Player | null = null
    let best = Number.POSITIVE_INFINITY
    for (const q of room.players.values()) {
      if (!q.alive || q.id === p.id) continue
      const d = Math.hypot(q.x - p.x, q.z - p.z)
      if (d < best) {
        best = d
        target = q
      }
    }

    // Nobody alive: walk toward the middle so bots gather where the next fight
    // will be instead of standing on their spawn pad.
    if (!target) {
      this.targetId = null
      const yaw = Math.atan2(-(MID - p.x), -(MID - p.z))
      return { ...IDLE_INPUT, yaw, pitch: 0, forward: 1, sprint: false, jump: false }
    }

    if (target.id !== this.targetId) {
      this.targetId = target.id
      this.engageAt = room.tickCount + this.reactionTicks(room)
    }

    const dx = target.x - p.x
    const dz = target.z - p.z
    const dist = Math.hypot(dx, dz)
    const eye = room.eye(p)
    const aimError = (room.random() - 0.5) * this.profile.aimError
    const chaseYaw = Math.atan2(-dx, -dz) + aimError
    const pitch = Math.atan2(target.y + 1 - eye[1], Math.max(0.1, dist))

    if (room.tickCount >= this.engageAt && dist <= ATTACK_REACH && Math.abs(target.y - p.y) < 2)
      room.receive(p.id, { t: 'attack', target: target.id })

    // One player per island means the nearest target is usually across void.
    // Walk the built island-to-middle bridge first; only chase directly once
    // the bot is in the middle arena where the routes meet.
    const centerDist = Math.hypot(p.x - MID, p.z - MID)
    let moveYaw = centerDist > 7 ? Math.atan2(-(MID - p.x), -(MID - p.z)) : chaseYaw
    let movingToMiddle = centerDist > 7
    const step = (yaw: number) => {
      const fx = -Math.sin(yaw)
      const fz = -Math.cos(yaw)
      const feet = Math.floor(p.y)
      return {
        fx,
        fz,
        ground: room.world.isSolid(Math.floor(p.x + fx * 0.9), feet - 1, Math.floor(p.z + fz * 0.9)),
        obstacle: room.world.isSolid(Math.floor(p.x + fx * 0.9), feet, Math.floor(p.z + fz * 0.9)),
      }
    }
    let ahead = step(moveYaw)
    if (!ahead.ground && !movingToMiddle && centerDist > 2) {
      moveYaw = Math.atan2(-(MID - p.x), -(MID - p.z))
      movingToMiddle = true
      ahead = step(moveYaw)
    }
    const moving = (movingToMiddle || dist > 2.2) && ahead.ground
    const sprintAt = BOT_LEVELS.indexOf(this.level) <= 0 ? Number.POSITIVE_INFINITY : this.level === 'normal' ? 8 : 5
    const sprintDist = movingToMiddle ? centerDist : dist

    return {
      ...IDLE_INPUT,
      yaw: moveYaw,
      pitch,
      forward: moving ? 1 : 0,
      sprint: moving && sprintDist > sprintAt && ahead.ground,
      jump: p.onGround && ahead.ground && ahead.obstacle,
    }
  }
}
