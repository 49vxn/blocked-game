import { rng } from '../../../engine/random'
import { raycastBlock } from '../../../engine/raycast'
import { blockDef } from '../blocks'
import { EYE_HEIGHT, SNEAK_EYE_HEIGHT, TPS } from '../constants'
import type { Player, Room } from '../room'
import { TargetMemory } from './memory'
import type { BotPerception, BotTierProfile, PerceivedEnemy } from './types'

/** No one notices a player at the far side of the arena, cone or not. */
const SIGHT_RANGE = 64
/** Touching distance: a target just outside the cone is still noticed. */
const CLOSE_NOTICE_RADIUS = 2.5
/** Vertical slack for the close-range notice, so a target far above/below is not "touching". */
const CLOSE_NOTICE_HEIGHT = 3
/** How long a hit (by us or on us) counts as a plausible sighting. */
const HIT_EVENT_TICKS = 2 * TPS
/** The brief window where a remembered enemy near the bed raises the alarm. */
const BED_ALERT_RADIUS = 10
/** A wall must be closer than this to the target before it is treated as blocking. */
const LOS_SLACK = 0.35
/** Health at or below this counts as a positional danger for the planner. */
const LOW_HEALTH = 6

function shortest(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

/**
 * FOV and line-of-sight perception. The bot only ever receives live enemy
 * coordinates from this module, and only while the enemy is genuinely visible.
 * Everything else is a decaying memory snapshot.
 *
 * `notifyHit` is the integration hook for "I just hit someone": the integrator
 * calls it from the attack decision, and the target stays plausible-to-notice
 * for a couple of seconds even if it slips out of the cone. An enemy that just
 * hit the bot is picked up from `Player.lastAttacker` without any hook.
 */
export class PerceptionTracker {
  private readonly memory = new TargetMemory()
  private readonly hits = new Map<number, number>()
  /** Stable per-bot visual acuity (0.9–1.1), from the injected seeded stream. */
  private readonly acuity: number

  constructor(private readonly random: () => number = rng(1)) {
    this.acuity = 0.9 + this.random() * 0.2
  }

  update(room: Room, self: Player, profile: BotTierProfile, tick: number): BotPerception {
    for (const [id, at] of this.hits) if (tick - at > HIT_EVENT_TICKS) this.hits.delete(id)

    const team = self.team ?? 'red'
    const visible: PerceivedEnemy[] = []
    const seen = new Set<number>()
    const enemies = [...room.players.values()]
      .filter((q) => q.id !== self.id && q.alive && !q.eliminated && q.team && q.team !== team && !q.home)
      .sort((a, b) => a.id - b.id)

    for (const q of enemies) {
      if (!q.team) continue
      const dx = q.x - self.x
      const dy = q.y - self.y
      const dz = q.z - self.z
      const distance = Math.hypot(dx, dy, dz)
      if (distance > SIGHT_RANGE) continue
      const horizontal = Math.hypot(dx, dz)
      // Invisibility hides the body, not the evidence: a potion is only broken
      // by hitting the bot or being hit by it in the last couple of seconds.
      if (q.effects.invisible > tick && !this.alerted(q.id, self, tick)) continue

      const bearing = Math.atan2(-dx, -dz)
      const offset = shortest(bearing - self.yaw)
      const inCone = Math.abs(offset) <= (profile.fovDegrees * Math.PI) / 360
      const close = horizontal <= CLOSE_NOTICE_RADIUS * this.acuity && Math.abs(dy) <= CLOSE_NOTICE_HEIGHT
      const alerted = this.alerted(q.id, self, tick)
      if (!inCone && !close && !alerted) continue
      // Even a hit or a close stand-off does not see through a wall.
      if (!hasLineOfSight(room, self, q)) continue

      const perceived: PerceivedEnemy = {
        id: q.id,
        team: q.team,
        x: q.x,
        y: q.y,
        z: q.z,
        vx: q.vx,
        vz: q.vz,
        lastSeenTick: tick,
        visible: true,
        confidence: 1,
        distance,
        angle: Math.abs(offset),
      }
      visible.push(perceived)
      this.memory.observe(perceived, tick)
      seen.add(q.id)
    }

    const remembered = this.memory.all(tick, profile).filter((enemy) => !seen.has(enemy.id))
    const all = [...visible, ...remembered]
    const ownBase = self.team ? room.map.bases.find((base) => base.team === self.team) : undefined
    const ownBed = ownBase && self.team && room.teams.get(self.team)?.bed ? ownBase.bed : null

    return {
      tick,
      self: {
        x: self.x,
        y: self.y,
        z: self.z,
        yaw: self.yaw,
        pitch: self.pitch,
        health: self.health,
        onGround: self.onGround,
        team,
      },
      visible,
      remembered,
      threat: this.pickThreat(all, self, tick, ownBed),
      danger: {
        void: overVoid(room, self),
        lowHealth: self.health <= LOW_HEALTH,
        bedThreat: !!ownBed && all.some((enemy) => nearBed(enemy, ownBed)),
      },
    }
  }

  reset(): void {
    this.memory.clear()
    this.hits.clear()
  }

  /** The integrator reports a successful hit so the target can be noticed behind the cone. */
  notifyHit(id: number, tick: number): void {
    this.hits.set(id, tick)
  }

  private alerted(id: number, self: Player, tick: number): boolean {
    const hit = this.hits.get(id)
    if (hit !== undefined && tick - hit <= HIT_EVENT_TICKS) return true
    const attacker = self.lastAttacker
    return !!attacker && attacker.id === id && tick - attacker.tick <= HIT_EVENT_TICKS
  }

  /**
   * Most urgent enemy, not the globally nearest player: an attacker and an
   * enemy at our bed outrank a closer bystander, and a stale memory scores
   * lower than a live sighting.
   */
  private pickThreat(all: PerceivedEnemy[], self: Player, tick: number, ownBed: { x: number; z: number } | null): PerceivedEnemy | null {
    let best: PerceivedEnemy | null = null
    let bestScore = -Infinity
    for (const enemy of all) {
      const distance = Math.hypot(enemy.x - self.x, enemy.z - self.z)
      let score = 3 / (1 + distance / 4)
      score += enemy.visible ? 1 : enemy.confidence
      const attacker = self.lastAttacker
      if (attacker?.id === enemy.id && tick - attacker.tick <= HIT_EVENT_TICKS) score += 5
      if (this.hits.has(enemy.id)) score += 2
      if (ownBed) {
        const bedDistance = Math.hypot(enemy.x - (ownBed.x + 0.5), enemy.z - (ownBed.z + 0.5))
        if (bedDistance < BED_ALERT_RADIUS) score += 4 * (1 - bedDistance / BED_ALERT_RADIUS)
      }
      if (score > bestScore) {
        best = enemy
        bestScore = score
      }
    }
    return best
  }
}

/** A clear eye-to-body ray, using the same solid-block rule as the server's attack check. */
function hasLineOfSight(room: Room, self: Player, target: Player): boolean {
  const eye = [self.x, self.y + (self.sneaking ? SNEAK_EYE_HEIGHT : EYE_HEIGHT), self.z]
  const body = [target.x, target.y + 0.9, target.z]
  const dx = body[0] - eye[0]
  const dy = body[1] - eye[1]
  const dz = body[2] - eye[2]
  const length = Math.hypot(dx, dy, dz)
  if (length < 1e-6) return true
  const hit = raycastBlock(room.world, eye, [dx / length, dy / length, dz / length], length, true)
  return !hit || hit.distance >= length - LOS_SLACK
}

/** No solid ground within a few blocks below the feet: a fall or the void is a real danger. */
function overVoid(room: Room, self: Player): boolean {
  const x = Math.floor(self.x)
  const z = Math.floor(self.z)
  const feet = Math.floor(self.y + 0.01)
  for (let drop = 1; drop <= 4; drop++) if (blockDef(room.world.get(x, feet - drop, z)).solid) return false
  return true
}

function nearBed(enemy: PerceivedEnemy, bed: { x: number; z: number }): boolean {
  return Math.hypot(enemy.x - (bed.x + 0.5), enemy.z - (bed.z + 0.5)) < BED_ALERT_RADIUS
}
