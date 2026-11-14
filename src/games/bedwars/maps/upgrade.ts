import type { Box } from '../../../engine/physics'
import { AIR, STONE_BRICKS, type TeamId } from '../blocks'
import { createArena, type ArenaLayout } from './arena'
import { MID, TOP } from './plan'
import type { MapDef } from './types'

/**
 * Upgrade Rush's eight-island arena. The four base islands remain, and the
 * four diamond islands become the second spawn island for each colour. Each
 * of the eight seats therefore has its own island and pad, while a colour
 * still names two seats (the FFA is not team-based). No beds, shops,
 * generators or team chests are kept.
 *
 * The base islands sit close to the middle (±30 instead of the old ±44) so a
 * solo FFA player reaches the fight in seconds. `bridgeToMiddle` covers the
 * four base lanes, and `bridgeFromPoint` connects each diamond island to the
 * middle, so all eight islands are reachable on foot.
 */
const UPGRADE_LAYOUT: ArenaLayout = {
  id: 'upgrade',
  name: 'Upgrade Rush',
  theme: 'ruins',
  bases: {
    red: { at: [0, -30], out: [0, -1] },
    blue: { at: [30, 0], out: [1, 0] },
    green: { at: [0, 30], out: [0, 1] },
    yellow: { at: [-30, 0], out: [-1, 0] },
  },
  // Decorative ring around the middle; no diamond generators are kept.
  diamonds: [
    [28, 28],
    [28, -28],
    [-28, 28],
    [-28, -28],
  ],
  middle: 12,
  seed: 9091,
  sky: '#8ec5ff',
}

/** How far out from a base centre the island edge sits, in cells. */
const ISLAND_EDGE = 8
/** The middle island's edge, leaving one cell to join the bridge. */
const MIDDLE_EDGE = UPGRADE_LAYOUT.middle + 1

/**
 * Paint a three-wide stone-brick bridge from each island to the middle at foot
 * height. Only air is filled: island and middle terrain, trims and decorations
 * are never removed. The base bridges and the diamond-island bridges make the
 * mode a Pit-style free-for-all instead of isolated islands that each need a
 * hand bridge.
 */
function bridgeToMiddle(map: MapDef): void {
  const y = TOP - 1
  const paint = (x: number, z: number) => {
    if (map.world.get(x, y, z) === AIR) map.world.set(x, y, z, STONE_BRICKS)
  }
  for (const base of map.bases) {
    const [cx, , cz] = base.center
    const dx = Math.sign(MID - Math.floor(cx))
    const dz = Math.sign(MID - Math.floor(cz))
    if (dx !== 0) {
      const from = Math.floor(cx + dx * ISLAND_EDGE)
      const to = Math.round(MID - dx * MIDDLE_EDGE)
      for (let x = Math.min(from, to); x <= Math.max(from, to); x++) for (let z = Math.floor(cz) - 1; z <= Math.floor(cz) + 1; z++) paint(x, z)
    } else if (dz !== 0) {
      const from = Math.floor(cz + dz * ISLAND_EDGE)
      const to = Math.round(MID - dz * MIDDLE_EDGE)
      for (let z = Math.min(from, to); z <= Math.max(from, to); z++) for (let x = Math.floor(cx) - 1; x <= Math.floor(cx) + 1; x++) paint(x, z)
    }
  }
}

/**
 * Paint a three-wide diagonal floor from a point to the middle. Only air is
 * filled, so the diamond island's own terrain and the middle are untouched.
 * The overlapping 3×3 stamps keep a diagonal bridge continuous.
 */
function bridgeFromPoint(map: MapDef, cx: number, cz: number): void {
  const y = TOP - 1
  const dx = MID - cx
  const dz = MID - cz
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz)))
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(cx + (dx * i) / steps)
    const z = Math.round(cz + (dz * i) / steps)
    for (let ox = -1; ox <= 1; ox++)
      for (let oz = -1; oz <= 1; oz++) if (map.world.get(x + ox, y, z + oz) === AIR) map.world.set(x + ox, y, z + oz, STONE_BRICKS)
  }
}

/** One diamond island becomes the second seat for each colour. */
const DIAMOND_FOR_TEAM: Record<TeamId, number> = { red: 1, blue: 0, green: 2, yellow: 3 }

export function createUpgradeMap(): MapDef {
  // No teams -> `createArena` places no beds. The base houses and walkways stay.
  const map = createArena([], UPGRADE_LAYOUT)
  bridgeToMiddle(map)
  map.generators = []
  map.npcs = []
  map.labels = []

  const spawns = {} as Record<TeamId, [number, number, number, number][]>
  const zones: Box[] = []
  for (const base of map.bases) {
    const [x, y, z, yaw] = base.spawn
    spawns[base.team] = [[x, y, z, yaw]]
    zones.push([x - 1.5, y, z - 1.5, x + 1.5, y + 3, z + 1.5])

    // The matching diamond island is this colour's second, solo spawn island.
    const [dx, dz] = UPGRADE_LAYOUT.diamonds[DIAMOND_FOR_TEAM[base.team]]
    const [ix, iz] = [MID + dx, MID + dz]
    const iyaw = Math.atan2(-(MID - ix), -(MID - iz))
    for (let ox = -1; ox <= 1; ox++)
      for (let oz = -1; oz <= 1; oz++) {
        map.world.set(ix + ox, TOP - 1, iz + oz, STONE_BRICKS)
        map.world.set(ix + ox, TOP, iz + oz, AIR)
        map.world.set(ix + ox, TOP + 1, iz + oz, AIR)
      }
    spawns[base.team].push([ix + 0.5, TOP, iz + 0.5, iyaw])
    zones.push([ix - 1.5, TOP, iz - 1.5, ix + 1.5, TOP + 3, iz + 1.5])
    bridgeFromPoint(map, ix, iz)
  }
  map.upgradeSpawns = spawns
  // The only protected build cells are the eight one-player spawn pads. Shop,
  // bed and chest reservations from the arena generator no longer apply.
  map.build = { ...map.build, protectedZones: zones }
  return map
}
