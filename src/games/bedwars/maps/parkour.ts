import { BRICK, CRACKED_STONE_BRICKS, CUT_SANDSTONE, DARK_PLANKS, GLASS, GOLD_BLOCK, GRAVEL, ICE, LANTERN, MOSSY_STONE_BRICKS, PACKED_ICE, PLANKS, QUARTZ, QUARTZ_PILLAR, ROOF_TILES, SAND, SANDSTONE, STONE, STONE_BRICKS, TERRACOTTA } from '../blocks'
import { box } from '../../../engine/terrain'
import { World } from '../../../engine/world'
import type { ParkourCourse, MapDef } from './types'

/** A pad centre on a helix, in feet coordinates. */
function padPoint(center: [number, number], radius: number, baseY: number, angleStep: number, step: number): [number, number, number] {
  const angle = -Math.PI / 2 + step * angleStep
  const x = Math.round(center[0] + Math.cos(angle) * radius)
  const z = Math.round(center[1] + Math.sin(angle) * radius)
  const y = baseY + Math.floor(step / 2)
  return [x, y, z]
}

const CHECKPOINT_STEPS = [0, 6, 12, 18, 24]
const FINISH_STEP = 29

/**
 * The original tutorial spiral course over the void. The pads climb around a
 * quartz core, with five checkpoint pads and a finish pad at the top. It is
 * built from the existing block palette so it carries no external map assets.
 */
export function createParkour(): MapDef {
  return spiralCourse({ name: 'Parkour' })
}

interface SpiralSpec {
  name: string
}

/**
 * Which parkour course to build. The parkour world opens on the classic
 * Hielke-style spiral tower; `'classic'` keeps the little quartz-spiral
 * tutorial reachable.
 */
export function parkourCourse(id: string | undefined): MapDef {
  return id === 'classic' ? spiralCourse({ name: 'Parkour' }) : spiralTower()
}

/** Tower spec, exported so tests and scripts can audit tread, gap and hop geometry. */
export const TOWER = {
  center: [40, 40] as [number, number],
  /** Centre radius of the walkway ribbon; the tread band is 11.2–15.0 out.
   *  The extra half block over the 13.3-centre lane tiles the one-wide
   *  diagonal corner gutter where adjacent tread lenses meet — at 14.6 the
   *  outer corner cell (d ≈ 14.86) fell outside the band and sprint-jump
   *  descents dropped through it. */
  radius: 13.3,
  ribbonInner: 11.2,
  // A wider outer shelf catches a slightly-off sprint landing; the audit
  // showed the old 15.0 edge dropping runners that were still inside the
  // visible walkway line.
  ribbonOuter: 16.2,
  baseY: 14,
  /** Angle per segment: 41 segments wrap one full lap of the tower. */
  angle: (2 * Math.PI) / 41,
  finishStep: 371,
  /** y climbed per themed level; a checkpoint tread marks each level board. */
  rise: 19,
  /** Continuous gaps in the walkway, the course's obstacles: two single-tread
   *  jumps per lap. `from` is the last solid tread before the gap (it rises +1
   *  to the landing either way). The old double gaps were not clearable by a
   *  plain sprint jump; the audit caught them. */
  gaps: (() => {
    const even = (k: number) => k - (k % 2)
    const list: Array<{ from: number; double: boolean }> = []
    for (let lap = 0; lap < 9; lap++) {
      list.push({ from: even(lap * 41 + 4), double: false }, { from: even(lap * 41 + 18), double: false })
    }
    return list
  })(),
}
/** One themed level of the climb: the face it shows, its accent stripe, trim and window style. */
interface TowerLevel {
  main: number
  accent: number
  trim: number
  label: string
}

const LEVELS: TowerLevel[] = [
  { main: PLANKS, accent: DARK_PLANKS, trim: STONE_BRICKS, label: 'Level 1' },
  { main: SAND, accent: SANDSTONE, trim: CUT_SANDSTONE, label: 'Level 2' },
  { main: SANDSTONE, accent: CUT_SANDSTONE, trim: STONE_BRICKS, label: 'Level 3' },
  { main: STONE, accent: GRAVEL, trim: STONE_BRICKS, label: 'Level 4' },
  { main: STONE_BRICKS, accent: CRACKED_STONE_BRICKS, trim: MOSSY_STONE_BRICKS, label: 'Level 5' },
  { main: ICE, accent: PACKED_ICE, trim: QUARTZ, label: 'Level 6' },
  { main: TERRACOTTA.red, accent: TERRACOTTA.orange, trim: BRICK, label: 'Level 7' },
  { main: DARK_PLANKS, accent: PLANKS, trim: ROOF_TILES, label: 'Level 8' },
  { main: BRICK, accent: STONE_BRICKS, trim: DARK_PLANKS, label: 'Level 9' },
  { main: QUARTZ, accent: QUARTZ_PILLAR, trim: GOLD_BLOCK, label: 'Level 10' },
]

function levelAt(y: number): TowerLevel {
  const index = Math.max(0, Math.min(LEVELS.length - 1, Math.floor((y - TOWER.baseY) / TOWER.rise)))
  return LEVELS[index]
}

/**
 * The big one, after the classic community spiral maps: a solid cylindrical
 * tower over the void with a continuous spiral walkway wrapped around it. You
 * start on a plaza at its foot, run the walkway up the outside — a 1-block
 * rise every couple of sections, real gaps to jump over, one themed wall band
 * per lap — and finish on the beacon deck at the top. Built block by block
 * from our own palette; no external map assets.
 */
export function spiralTower(): MapDef {
  const world = new World(80, 204, 80)
  const [cx, cz] = TOWER.center
  const { baseY, angle, finishStep, ribbonInner, ribbonOuter } = TOWER
  const pad = (step: number) => padPoint(TOWER.center, TOWER.radius, baseY, angle, step)
  const skipped = new Set<number>()
  for (const gap of TOWER.gaps) for (let i = 1; i <= (gap.double ? 2 : 1); i++) skipped.add(gap.from + i)
  const isCheckpoint = (step: number) => step % 38 === 0 && step <= 9 * 38
  const deckY = 199
  const deckTop = 200

  // The foot of the tower: a stone skirt rising out of the void to a flat
  // gravel plaza where the climb begins.
  for (let y = 8; y <= 12; y++)
    for (let dx = -16; dx <= 16; dx++)
      for (let dz = -16; dz <= 16; dz++) if (Math.hypot(dx, dz) <= 15.5) world.set(cx + dx, y, cz + dz, y === 8 ? STONE : GRAVEL)
  for (let dx = -16; dx <= 16; dx++)
    for (let dz = -16; dz <= 16; dz++) {
      const d = Math.hypot(dx, dz)
      if (d <= 10 || d > 15.5) continue
      world.set(cx + dx, 13, cz + dz, GRAVEL)
    }

  // The tower itself: one clean solid cylinder per level so runs stay long.
  // The walkway rests on this face (radius 11.2), and window slots, an accent
  // stripe and a trim belt show between the laps of the walkway.
  for (let y = 13; y < deckY; y++) {
    const level = levelAt(y)
    for (let dx = -12; dx <= 12; dx++)
      for (let dz = -12; dz <= 12; dz++) {
        const d = Math.hypot(dx, dz)
        if (d > 11.2) continue
        let material = level.main
        if (d > 9.2 && d <= 10.2) material = level.accent
        if (d > 10.2 && (y - baseY) % 18 === 5) material = level.trim
        if (y % 6 === 1 && d > 10.4) {
          const n = Math.abs(dx) <= 1 && dz >= 10
          const s = Math.abs(dx) <= 1 && dz <= -10
          const e = Math.abs(dz) <= 1 && dx >= 10
          const w = Math.abs(dz) <= 1 && dx <= -10
          if (n || s || e || w) material = GLASS
        }
        world.set(cx + dx, y, cz + dz, material)
      }
  }
  for (let y = 16; y < deckY; y += 18)
    for (const [ox, oz] of [[11, 0], [-11, 0], [0, 11], [0, -11]] as const) if (world.get(cx + ox, y, cz + oz) !== 0) world.set(cx + ox, y, cz + oz, LANTERN)

  // The beacon deck: the walkway fans out into a quartz apron at its final
  // height, and the raised deck with its glass crown sits one step above.
  for (let dx = -15; dx <= 15; dx++)
    for (let dz = -15; dz <= 15; dz++) {
      const d = Math.hypot(dx, dz)
      if (d > TOWER.ribbonInner) continue
      world.set(cx + dx, deckY, cz + dz, QUARTZ)
      if (d <= 7.2) world.set(cx + dx, deckTop, cz + dz, QUARTZ)
    }
  for (const [dx, dz] of [[2, 2], [-2, 2], [2, -2], [-2, -2]] as const) {
    box(world, cx + dx, deckTop + 1, cz + dz, cx + dx, deckTop + 2, cz + dz, GLASS)
    world.set(cx + dx, deckTop + 3, cz + dz, LANTERN)
  }

  // The walkway: overlapping 3-wide tread lenses wound around the wall. Each
  // tread shares a front cell with its successor, so where the path climbs
  // that shared cell is the riser you hop — a staircase, not an island hop.
  const tread = (step: number): Array<{ x: number; z: number; t: number; d: number }> => {
    const [px, , pz] = pad(step)
    const angle0 = -Math.PI / 2 + step * angle
    const tx = -Math.sin(angle0)
    const tz = Math.cos(angle0)
    const cells: Array<{ x: number; z: number; t: number; d: number }> = []
    for (let dx = -2; dx <= 2; dx++)
      for (let dz = -2; dz <= 2; dz++) {
        const d = Math.hypot(px + dx - cx, pz + dz - cz)
        if (d <= ribbonInner || d > ribbonOuter) continue
        const t = dx * tx + dz * tz
        if (Math.abs(t) <= 1.35) cells.push({ x: px + dx, z: pz + dz, t, d })
      }
    return cells
  }
  // Lamps sit on the outermost tread cell — a block to the side of the
  // walking line, never on it — so headroom along the centre cells holds.
  const lampCell = (step: number): [number, number] | undefined => {
    let best: { x: number; z: number; d: number } | undefined
    for (const cell of tread(step)) if (cell.d > (best?.d ?? 0)) best = cell
    return best && best.d > 14 ? [best.x, best.z] : undefined
  }
  const labels: MapDef['labels'] = []
  for (let step = 0; step < finishStep; step++) {
    if (skipped.has(step)) continue
    const y = baseY + Math.floor(step / 2)
    const checkpoint = isCheckpoint(step)
    const level = levelAt(y)
    const material = checkpoint ? level.trim : level.main
    for (const { x, z, d } of tread(step)) {
      world.set(x, y, z, material)
      // Every few treads: a stud under the outer edge, so the walkway reads
      // as built rather than floating.
      if (step % 4 === 2 && d > 13.4) world.set(x, y - 1, z, level.trim)
    }
    // A roadside lantern between the checkpoint lamps.
    if (step % 9 === 4 && !checkpoint) {
      const lamp = lampCell(step)
      if (lamp) world.set(lamp[0], y + 1, lamp[1], LANTERN)
    }
    if (checkpoint) {
      const lamp = lampCell(step)
      if (lamp) world.set(lamp[0], y + 1, lamp[1], LANTERN)
      const [x, , z] = pad(step)
      labels.push({ text: step === 0 ? 'Start' : LEVELS[Math.floor(step / 38)].label, x: x + 0.5, y: y + 3, z: z + 0.5 })
    }
  }

  labels.push({ text: 'Finish', x: cx + 0.5, y: deckTop + 5, z: cz + 0.5 })

  const [sx, , sz] = pad(0)
  const course: ParkourCourse = {
    spawn: [sx + 0.5, baseY + 1, sz + 0.5, -Math.PI / 2],
    checkpoints: Array.from({ length: 10 }, (_, i) => {
      const [x, y, z] = pad(i * 38)
      return [x + 0.5, y + 1, z + 0.5] as [number, number, number]
    }),
    finish: [cx + 0.5, deckTop + 1, cz + 0.5],
    radius: 2.4,
    top: deckTop + 1,
  }

  return {
    name: 'Spiral Tower',
    world,
    bases: [],
    generators: [],
    npcs: [],
    labels,
    lobby: null,
    spectator: [40.5, 218, 40.5, 0, -1.05],
    killY: 8,
    build: { minY: 1, maxY: deckTop + 3, protectedZones: [] },
    sky: '#9fc7e8',
    parkour: course,
  }
}

/** The little quartz-spiral tutorial, unchanged: five checkpoints in 29 steps. */
function spiralCourse(spec: SpiralSpec): MapDef {
  const world = new World(64, 48, 64)
  const checkpoints = CHECKPOINT_STEPS.map((step) => {
    const [x, y, z] = padPoint([32, 32], 7, 16, 0.55, step)
    return [x + 0.5, y + 1, z + 0.5] as [number, number, number]
  })
  const finishPoint = padPoint([32, 32], 7, 16, 0.55, FINISH_STEP)
  const finish: [number, number, number] = [finishPoint[0] + 0.5, finishPoint[1] + 1, finishPoint[2] + 0.5]

  // The central core gives the spiral a readable silhouette without blocking the ring.
  box(world, 32, 10, 32, 34, 28, 34, QUARTZ)
  box(world, 32, 29, 32, 34, 29, 34, QUARTZ)
  world.set(33, 30, 33, LANTERN)

  const labels: MapDef['labels'] = []
  for (let step = 0; step <= FINISH_STEP; step++) {
    const [x, y, z] = padPoint([32, 32], 7, 16, 0.55, step)
    const checkpoint = CHECKPOINT_STEPS.indexOf(step)
    const isFinish = step === FINISH_STEP
    const material = isFinish ? QUARTZ : checkpoint >= 0 ? MOSSY_STONE_BRICKS : step >= 10 && step <= 12 ? ICE : PLANKS
    // 3x3 pads; the gap between pad centres is a short jump, not a pixel jump.
    box(world, x - 1, y, z - 1, x + 1, y, z + 1, material)
    if (checkpoint >= 0) {
      // A lantern on a pole beside the pad marks the checkpoint without blocking the route.
      world.set(x + 2, y + 1, z, LANTERN)
      labels.push({ text: checkpoint === 0 ? 'Start' : `Checkpoint ${checkpoint}`, x: x + 0.5, y: y + 3, z: z + 0.5 })
    }
    if (isFinish) {
      // Extend the final pad at walking level; the runner stands on top of it.
      box(world, x - 2, y, z - 2, x + 2, y, z + 2, QUARTZ)
      world.set(x + 2, y + 1, z + 2, LANTERN)
      labels.push({ text: 'Finish', x: x + 0.5, y: y + 4, z: z + 0.5 })
    }
  }

  const course: ParkourCourse = {
    spawn: [checkpoints[0][0], checkpoints[0][1], checkpoints[0][2], 0],
    checkpoints,
    finish,
    radius: 2.4,
    top: finish[1],
  }

  return {
    name: spec.name,
    world,
    bases: [],
    generators: [],
    npcs: [],
    labels,
    lobby: null,
    spectator: [32.5, 42, 42, 0, -0.6],
    killY: 2,
    build: { minY: 1, maxY: 44, protectedZones: [] },
    sky: '#8ec5ff',
    parkour: course,
  }
}
