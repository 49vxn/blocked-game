import type { World } from '../../../engine/world'
import { blockDef } from '../blocks'

export interface Detour {
  strafe: number
  forward: number
}

/**
 * Probe one step left and right around a wall. The caller still owns path
 * commitment; this only answers "is there a clear adjacent cell to slide into?"
 */
export function findDetour(
  world: World,
  x: number,
  z: number,
  feet: number,
  ux: number,
  uz: number,
): Detour | null {
  for (const side of [1, -1]) {
    const px = x + ux * 0.9 - uz * side * 0.9
    const pz = z + uz * 0.9 + ux * side * 0.9
    const fx = Math.floor(px)
    const fz = Math.floor(pz)
    const solid = (y: number) => blockDef(world.get(fx, y, fz)).solid
    if (solid(feet) || solid(feet + 1)) continue
    // Do not sidestep into a gap; the bridge code handles that case.
    if (![1, 2, 3].some((d) => solid(feet - d))) continue
    return { strafe: side, forward: 0.35 }
  }
  return null
}
