import type { World } from '../../../../engine/world'
import { blockDef } from '../../blocks'
import type { Player } from '../../room'
import { supportFor, type Placement } from './bridge'

const BLOCK_SLOT = 0

/** A place message for an air cell, against the nearest solid neighbour. */
export function placeable(world: World, x: number, y: number, z: number, slot = BLOCK_SLOT): Placement | null {
  if (world.get(x, y, z) !== 0) return null
  const support = supportFor(world, x, y, z)
  if (!support) return null
  return { x: support[0], y: support[1], z: support[2], face: [x - support[0], y - support[1], z - support[2]], slot }
}

/** Two blocks between the bot and an enemy: a readable wall-off, not a maze. */
export function wallCells(world: World, self: Player, enemy: { x: number; z: number }, slot = BLOCK_SLOT): Placement[] {
  const dx = enemy.x - self.x
  const dz = enemy.z - self.z
  const alongX = Math.abs(dx) >= Math.abs(dz)
  const sx = alongX ? (dx >= 0 ? 1 : -1) : 0
  const sz = alongX ? 0 : (dz >= 0 ? 1 : -1)
  const x = Math.floor(self.x) + sx
  const z = Math.floor(self.z) + sz
  const y = Math.floor(self.y)
  const out: Placement[] = []
  for (const dy of [0, 1]) {
    const cell = placeable(world, x, y + dy, z, slot)
    if (cell) out.push(cell)
  }
  return out
}

/** A block under the bot while airborne: the telly/clutch save cell. */
export function clutchCell(world: World, self: Player, slot = BLOCK_SLOT): Placement | null {
  if (self.onGround) return null
  return placeable(world, Math.floor(self.x), Math.floor(self.y) - 1, Math.floor(self.z), slot)
}

/**
 * A pillar cell under the bot while airborne; the next jump raises the base.
 * The same cell as a clutch, so it is the same function, not a copy that can
 * drift away from the save cell.
 */
export const pillarCell = clutchCell

/** Anything whose body fills the two cells above its feet. */
export interface Occupant {
  x: number
  y: number
  z: number
}

/** True when a placement cell would not land inside any listed body. */
export function cellFree(cell: Placement, occupants: Occupant[]): boolean {
  const x = cell.x + cell.face[0]
  const y = cell.y + cell.face[1]
  const z = cell.z + cell.face[2]
  for (const actor of occupants) {
    if (Math.floor(actor.x) !== x || Math.floor(actor.z) !== z) continue
    const feet = Math.floor(actor.y)
    if (y === feet || y === feet + 1) return false
  }
  return true
}

/** No solid block in the next `depth` cells below the feet: a fall that ends the round. */
export function overVoid(world: World, self: Player, depth = 4): boolean {
  const x = Math.floor(self.x)
  const z = Math.floor(self.z)
  const feet = Math.floor(self.y)
  for (let y = feet - 1; y >= feet - depth; y--) if (blockDef(world.get(x, y, z)).solid) return false
  return true
}

/** Roof cells over an objective, two blocks wide, used while breaking a bed. */
export function roofCells(world: World, x: number, y: number, z: number, slot = BLOCK_SLOT): Placement[] {
  const out: Placement[] = []
  for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const cell = placeable(world, x + dx, y, z + dz, slot)
    if (cell) out.push(cell)
  }
  return out
}
