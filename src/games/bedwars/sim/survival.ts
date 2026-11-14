import { AIR, FLOOD_WATER } from '../blocks'
import { TPS } from '../constants'
import type { World } from '../../../engine/world'

export type Disaster = 'meteor' | 'flood' | 'earthquake'
export const SURVIVAL_SECONDS = 150
export const SURVIVAL_SLOTS = [20, 55, 90] as const
export const WARN_SECONDS = 10
export const METEOR_FLIGHT_TICKS = 6 * TPS

/** A visual-only flight ending exactly on the authoritative impact tick. */
export function meteorPosition(x: number, y: number, z: number, until: number, tick: number): [number, number, number] {
  const progress = Math.max(0, Math.min(1, (tick - (until - METEOR_FLIGHT_TICKS)) / METEOR_FLIGHT_TICKS)) ** 1.3
  return [x + 0.5 + 14 * (1 - progress), y + 1.5 + 40 * (1 - progress), z + 0.5 + 40 * (1 - progress)]
}

/** Deal each disaster into one slot without duplicating or omitting a disaster. */
export function survivalSchedule(random: () => number): Disaster[] {
  const order: Disaster[] = ['meteor', 'flood', 'earthquake']
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(random() * (i + 1)))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

/** Apply the three distinctive map changes at their original campus coordinates. */
export function applyDisaster(world: World, kind: Disaster): void {
  if (kind === 'meteor') {
    // A crater through both library roof layers, centred on Spawn's library zone.
    for (let x = 30; x <= 40; x++) for (let z = 40; z <= 50; z++)
      if ((x - 35) ** 2 + (z - 45) ** 2 <= 25)
        for (let y = 20; y <= 22; y++) world.set(x, y, z, AIR)
  } else if (kind === 'earthquake') {
    for (const [z0, z1] of [[41, 42], [44, 46], [48, 49]])
      for (let x = 15; x <= 17; x++) for (let y = 2; y <= 9; y++) for (let z = z0; z <= z1; z++) world.set(x, y, z, AIR)
  } else {
    for (let y = 1; y <= 4; y++) fillFieldLayer(world, y)
  }
}

/** Fill one field layer without replacing stairs, goals or buildings. */
export function fillFieldLayer(world: World, y: number): void {
  for (let x = 6; x <= 50; x++) for (let z = 3; z <= 19; z++)
    if (world.get(x, y, z) === AIR) world.set(x, y, z, FLOOD_WATER)
}

export function disasterTick(slot: number): number { return SURVIVAL_SLOTS[slot] * TPS }
