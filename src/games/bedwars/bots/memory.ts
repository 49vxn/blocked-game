import { TPS } from '../constants'
import type { BotTierProfile, PerceivedEnemy } from './types'

/**
 * Last-seen enemy memory. The bot never reads a hidden player's live position:
 * it stores the snapshot from the last tick the enemy was actually in sight,
 * then hands back that same point with a decaying confidence until the tier's
 * memory window runs out.
 */
export class TargetMemory {
  private readonly entries = new Map<number, PerceivedEnemy>()

  /** Store the snapshot from a sighting. Only the caller decides what was seen. */
  observe(enemy: PerceivedEnemy, tick: number): void {
    this.entries.set(enemy.id, {
      ...enemy,
      visible: true,
      confidence: 1,
      lastSeenTick: tick,
    })
  }

  /** The remembered point at `tick`, or null once the tier's memory window has passed. */
  recall(id: number, tick: number, profile: BotTierProfile): PerceivedEnemy | null {
    const entry = this.entries.get(id)
    if (!entry) return null
    const life = profile.memorySeconds * TPS
    const age = Math.max(0, tick - entry.lastSeenTick)
    if (life <= 0 || age >= life) {
      this.entries.delete(id)
      return null
    }
    // Linear coast to zero: monotone, deterministic and never refreshed by the
    // live player. Velocity fades with the memory; position does not move.
    const fade = 1 - age / life
    return {
      ...entry,
      visible: false,
      confidence: Math.min(1, entry.confidence) * fade,
      vx: entry.vx * fade,
      vz: entry.vz * fade,
      lastSeenTick: entry.lastSeenTick,
    }
  }

  /** Every unexpired memory as a hidden enemy, strongest first. */
  all(tick: number, profile: BotTierProfile): PerceivedEnemy[] {
    const out: PerceivedEnemy[] = []
    for (const id of [...this.entries.keys()]) {
      const enemy = this.recall(id, tick, profile)
      if (enemy) out.push(enemy)
    }
    return out.sort((a, b) => b.confidence - a.confidence || a.id - b.id)
  }

  forget(id: number): void {
    this.entries.delete(id)
  }

  clear(): void {
    this.entries.clear()
  }

  /** Tick of the last sighting, or null when nothing is stored. */
  lastSeenTick(id: number): number | null {
    return this.entries.get(id)?.lastSeenTick ?? null
  }
}
