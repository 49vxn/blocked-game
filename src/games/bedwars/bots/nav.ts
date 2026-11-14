import type { World } from '../../../engine/world'
import { blockDef } from '../blocks'

/** A path cell. `y` is the feet height after the cell is reached. */
export interface NavPoint {
  x: number
  y: number
  z: number
  /** True when a solid body cell must be dug before standing here. */
  dig: boolean
}

export interface NavOptions {
  /** Only these solid cells may be dug; map blocks and protected cover stay solid. */
  canDig?: (x: number, y: number, z: number) => boolean
  /** Soft occupied cells; they remain traversable at extra cost. */
  occupancy?: ReadonlySet<string>
  maxNodes?: number
}

interface NodeInfo {
  ok: boolean
  dig: boolean
  extraCost: number
}

interface Entry {
  key: string
  x: number
  y: number
  z: number
  g: number
  f: number
  h: number
  parent: string | null
}

const DEFAULT_MAX_NODES = 12_000
const DIG_COST = 7
const OCCUPANCY_COST = 6
const DIAGONAL_COST = Math.SQRT2
const STEP_COST = 0.25
const NEIGHBOURS: readonly [number, number, number][] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
  [1, 1, 0],
  [-1, 1, 0],
  [0, 1, 1],
  [0, 1, -1],
  [1, -1, 0],
  [-1, -1, 0],
  [0, -1, 1],
  [0, -1, -1],
  [1, 0, 1],
  [1, 0, -1],
  [-1, 0, 1],
  [-1, 0, -1],
]

export function navKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`
}

function solid(world: World, x: number, y: number, z: number): boolean {
  return blockDef(world.get(x, y, z)).solid
}

/**
 * A node is standable when the feet and head are clear and there is ground
 * below. A player-placed body block is allowed only when `canDig` approves it
 * and there is ground to stand on after the dig.
 */
function inspect(world: World, x: number, y: number, z: number, canDig: NavOptions['canDig']): NodeInfo {
  const feet = solid(world, x, y, z)
  const head = solid(world, x, y + 1, z)
  const ground = solid(world, x, y - 1, z)
  if (!feet && !head) return ground ? { ok: true, dig: false, extraCost: 0 } : { ok: false, dig: false, extraCost: 0 }
  if (!canDig || !ground) return { ok: false, dig: false, extraCost: 0 }
  // A dug cell must have clear headroom above the post-dig body.
  if (solid(world, x, y + 2, z)) return { ok: false, dig: false, extraCost: 0 }
  if (feet && !canDig(x, y, z)) return { ok: false, dig: false, extraCost: 0 }
  if (head && !canDig(x, y + 1, z)) return { ok: false, dig: false, extraCost: 0 }
  return { ok: true, dig: feet || head, extraCost: DIG_COST }
}

/** Nearest standable cell at or beside `target`, biased to the start height. */
function findGoal(world: World, target: NavPoint, startY: number, canDig: NavOptions['canDig']): NavPoint | null {
  let best: NavPoint | null = null
  let bestScore = Number.POSITIVE_INFINITY
  for (let r = 0; r <= 2; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (r > 0 && Math.abs(dx) !== r && Math.abs(dz) !== r) continue
        const x = target.x + dx
        const z = target.z + dz
        for (let y = startY + 2; y >= startY - 3; y--) {
          const info = inspect(world, x, y, z, canDig)
          if (!info.ok) continue
          const score = Math.hypot(x - target.x, z - target.z) + Math.abs(y - startY) * 0.5 + (info.dig ? 1 : 0)
          if (score < bestScore) {
            bestScore = score
            best = { x, y, z, dig: info.dig }
          }
        }
      }
    }
    // A walkable target cell is always preferred over a farther ring.
    if (best && bestScore < 1) break
  }
  return best
}

function findStart(world: World, start: NavPoint, canDig: NavOptions['canDig']): NavPoint | null {
  const direct = inspect(world, start.x, start.y, start.z, canDig)
  if (direct.ok) return { ...start, dig: direct.dig }
  for (let r = 1; r <= 2; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue
        for (let dy = 1; dy >= -1; dy--) {
          const info = inspect(world, start.x + dx, start.y + dy, start.z + dz, canDig)
          if (info.ok) return { x: start.x + dx, y: start.y + dy, z: start.z + dz, dig: info.dig }
        }
      }
    }
  }
  return null
}

class MinHeap {
  private items: Entry[] = []

  push(entry: Entry): void {
    const items = this.items
    items.push(entry)
    let i = items.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (!this.before(items[i], items[parent])) break
      ;[items[i], items[parent]] = [items[parent], items[i]]
      i = parent
    }
  }

  pop(): Entry | null {
    const items = this.items
    if (items.length === 0) return null
    const out = items[0]
    const last = items.pop()!
    if (items.length === 0) return out
    items[0] = last
    let i = 0
    while (true) {
      const left = i * 2 + 1
      const right = left + 1
      let smallest = i
      if (left < items.length && this.before(items[left], items[smallest])) smallest = left
      if (right < items.length && this.before(items[right], items[smallest])) smallest = right
      if (smallest === i) break
      ;[items[i], items[smallest]] = [items[smallest], items[i]]
      i = smallest
    }
    return out
  }

  get size(): number {
    return this.items.length
  }

  /** Lower f first, then lower heuristic, then a stable cell order. */
  private before(a: Entry, b: Entry): boolean {
    if (a.f !== b.f) return a.f < b.f
    if (a.h !== b.h) return a.h < b.h
    if (a.x !== b.x) return a.x < b.x
    if (a.z !== b.z) return a.z < b.z
    return a.y < b.y
  }
}

function heuristic(x: number, y: number, z: number, goal: NavPoint): number {
  return Math.hypot(x - goal.x, z - goal.z) + Math.abs(y - goal.y) * 0.4
}

/**
 * Find a ground route between two cells. The path includes the start and the
 * chosen goal cell. It returns null when the cells are on disconnected ground;
 * the caller then uses the existing bridge/dig fallback.
 */
export function findNavPath(world: World, start: NavPoint, target: NavPoint, options: NavOptions = {}): NavPoint[] | null {
  const canDig = options.canDig
  const occupancy = options.occupancy
  const maxNodes = Math.max(1, options.maxNodes ?? DEFAULT_MAX_NODES)
  const from = findStart(world, start, canDig)
  const to = findGoal(world, target, start.y, canDig)
  if (!from || !to) return null
  if (from.x === to.x && from.y === to.y && from.z === to.z) return [from]

  const cache = new Map<string, NodeInfo>()
  const infoAt = (x: number, y: number, z: number): NodeInfo => {
    const key = navKey(x, y, z)
    const cached = cache.get(key)
    if (cached) return cached
    const info = inspect(world, x, y, z, canDig)
    cache.set(key, info)
    return info
  }

  const startKey = navKey(from.x, from.y, from.z)
  const goalKey = navKey(to.x, to.y, to.z)
  const open = new MinHeap()
  const best = new Map<string, Entry>()
  const parent = new Map<string, string | null>()
  const startEntry: Entry = {
    key: startKey,
    x: from.x,
    y: from.y,
    z: from.z,
    g: 0,
    f: heuristic(from.x, from.y, from.z, to),
    h: heuristic(from.x, from.y, from.z, to),
    parent: null,
  }
  open.push(startEntry)
  best.set(startKey, startEntry)
  parent.set(startKey, null)

  let expanded = 0
  while (open.size > 0) {
    const current = open.pop()!
    if (current.g !== best.get(current.key)?.g) continue
    if (current.key === goalKey) return reconstruct(current.key, parent, infoAt)
    expanded++
    if (expanded > maxNodes) return null

    for (const [dx, dy, dz] of NEIGHBOURS) {
      const diagonal = dx !== 0 && dz !== 0
      if (diagonal && dy !== 0) continue
      // A diagonal must not cut a corner: both cardinal cells at the parent height are required.
      if (diagonal) {
        const a = infoAt(current.x + dx, current.y, current.z)
        const b = infoAt(current.x, current.y, current.z + dz)
        if (!a.ok || !b.ok) continue
      }
      const x = current.x + dx
      const y = current.y + dy
      const z = current.z + dz
      const info = infoAt(x, y, z)
      if (!info.ok) continue
      const key = navKey(x, y, z)
      if (parent.has(key) && key !== startKey) {
        // A cheaper route may still improve a node; the g check below handles it.
      }
      const occupied = occupancy?.has(key) ?? false
      const step = diagonal ? DIAGONAL_COST : 1
      const g = current.g + step + info.extraCost + (dy > 0 ? STEP_COST : 0) + (occupied ? OCCUPANCY_COST : 0)
      const previous = best.get(key)
      if (previous && previous.g <= g) continue
      const h = heuristic(x, y, z, to)
      const entry: Entry = { key, x, y, z, g, f: g + h, h, parent: current.key }
      best.set(key, entry)
      parent.set(key, current.key)
      open.push(entry)
    }
  }
  return null
}

function reconstruct(goalKey: string, parent: ReadonlyMap<string, string | null>, infoAt: (x: number, y: number, z: number) => NodeInfo): NavPoint[] {
  const keys: string[] = []
  let at: string | null = goalKey
  while (at) {
    keys.push(at)
    at = parent.get(at) ?? null
  }
  keys.reverse()
  return keys.map((key) => {
    const [x, y, z] = key.split(',').map(Number)
    return { x, y, z, dig: infoAt(x, y, z).dig }
  })
}

/**
 * Remove only collinear runs. Turns, height changes and dig cells stay as
 * waypoints, so simplification can never cut a corner or a wall.
 */
export function simplifyNavPath(_world: World, path: readonly NavPoint[]): NavPoint[] {
  if (path.length <= 2) return [...path]
  const out: NavPoint[] = [path[0]]
  for (let i = 1; i < path.length - 1; i++) {
    const a = path[i - 1]
    const b = path[i]
    const c = path[i + 1]
    const straight = b.x - a.x === c.x - b.x && b.z - a.z === c.z - b.z && b.y === a.y && c.y === b.y
    if (!straight || a.dig !== b.dig || b.dig !== c.dig) out.push(b)
  }
  out.push(path[path.length - 1])
  return out
}
