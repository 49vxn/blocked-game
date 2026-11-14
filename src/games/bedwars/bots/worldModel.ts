import type { TeamId } from '../blocks'
import type { GeneratorSpot, MapDef, Npc, TeamBase } from '../maps/types'
import { BASE_RADIUS } from '../rules'

/** The part of a room's team map the model needs; `Room.teams` satisfies this. */
export interface TeamStateLike {
  bed: boolean
  eliminated?: boolean
}

export interface WorldSource {
  map: MapDef
  teams?: ReadonlyMap<TeamId, TeamStateLike>
}

export interface WorldPoint {
  x: number
  y: number
  z: number
}

export type WorldNodeKind = 'base' | 'diamond' | 'emerald' | 'middle'

export interface WorldNode extends WorldPoint {
  id: string
  kind: WorldNodeKind
  team: TeamId | null
  /** Solid ground under the node, so it can be an escape target. */
  safe: boolean
}

export interface BedInfo extends WorldPoint {
  team: TeamId
  dx: number
  dz: number
  /** Middle of the two bed cells. */
  center: WorldPoint
  alive: boolean
  eliminated: boolean
  /** 0..1: how close the bed sits to open void. 1 is the rim. */
  exposure: number
  /** 0..1: the most dangerous lane into this base. */
  approachDanger: number
}

export interface LaneEstimate {
  distance: number
  /** Approximate blocks of wool needed to cross the void on this lane. */
  blockCost: number
  /** 0..1: contested space and enemy bases on the lane. */
  danger: number
  /** 0..1: how much of the lane is high over the void. */
  voidRisk: number
  /** 0..1: fraction of the lane with ground under it. */
  ground: number
}

export interface RoutePlan extends LaneEstimate {
  /** Sum of the lane block costs along the chosen route. */
  cost: number
  from: string | null
  to: string
  nodes: string[]
}

export interface HealPool extends WorldPoint {
  team: TeamId
  radius: number
}

export type GeneratorOwnership = 'home' | 'contested' | 'enemy'

const DIRECTIONS: readonly [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
]

const SAMPLE_STEP = 2
const MAX_BED_EDGE = 16

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function round(value: number, scale = 1000): number {
  return Math.round(value * scale) / scale + 0
}

/** Distance from a point to a segment on the x/z plane, so lane danger follows the actual line. */
function pointToSegment(p: WorldPoint, a: WorldPoint, b: WorldPoint): number {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const length2 = dx * dx + dz * dz
  if (length2 === 0) return Math.hypot(p.x - a.x, p.z - a.z)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / length2))
  return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t))
}

type RouteTarget = TeamId | string | WorldPoint

interface RouteTotals {
  cost: number
  blockCost: number
  distance: number
  danger: number
  voidRisk: number
  ground: number
}

function zeroTotals(): RouteTotals {
  return { cost: 0, blockCost: 0, distance: 0, danger: 0, voidRisk: 0, ground: 1 }
}

function mergeTotals(total: RouteTotals, lane: LaneEstimate): RouteTotals {
  return {
    cost: total.cost + lane.blockCost,
    blockCost: total.blockCost + lane.blockCost,
    distance: total.distance + lane.distance,
    danger: Math.max(total.danger, lane.danger),
    voidRisk: Math.max(total.voidRisk, lane.voidRisk),
    ground: Math.min(total.ground, lane.ground),
  }
}

/**
 * A deterministic read-only model of the room map for the bot planner. It is
 * built from `MapDef` and, optionally, the room's live team map; it never
 * inspects players. Lanes are sampled against the real voxel grid, so a map
 * change moves the costs and risks with it.
 */
export class WorldModel {
  readonly map: MapDef
  readonly nodes: WorldNode[]
  readonly beds: BedInfo[]

  private teamStates: ReadonlyMap<TeamId, TeamStateLike> | null
  private readonly nodeById = new Map<string, WorldNode>()
  private readonly nodeIndex = new Map<string, number>()
  private readonly baseNodes = new Map<TeamId, WorldNode>()
  private readonly laneCache = new Map<string, LaneEstimate>()

  constructor(source: WorldSource) {
    this.map = source.map
    this.teamStates = source.teams ?? null
    this.nodes = []
    this.beds = []

    for (const base of source.map.bases) {
      const node: WorldNode = {
        id: `base:${base.team}`,
        kind: 'base',
        team: base.team,
        x: base.center[0],
        y: base.center[1],
        z: base.center[2],
        safe: true,
      }
      this.addNode(node)
      this.baseNodes.set(base.team, node)
    }

    for (const [i, spot] of source.map.generators.entries()) {
      if (spot.kind !== 'diamond' && spot.kind !== 'emerald') continue
      this.addNode({
        id: `${spot.kind}:${i}`,
        kind: spot.kind,
        team: null,
        x: spot.pos[0],
        y: spot.pos[1],
        z: spot.pos[2],
        safe: true,
      })
    }

    const middleY = this.map.bases[0]?.spawn[1] ?? 0
    const middleX = this.map.world.sx / 2
    const middleZ = this.map.world.sz / 2
    if (this.groundAt(Math.floor(middleX), middleY, Math.floor(middleZ))) {
      const tooClose = this.nodes.some((node) => Math.hypot(node.x - middleX, node.z - middleZ) < 2.5)
      if (!tooClose) {
        this.addNode({
          id: 'middle',
          kind: 'middle',
          team: null,
          x: middleX,
          y: middleY,
          z: middleZ,
          safe: true,
        })
      }
    }

    this.beds = source.map.bases.map((base) => this.makeBed(base))
    for (const bed of this.beds) bed.approachDanger = this.approachDanger(bed.team)
    if (this.teamStates) this.setTeams(this.teamStates)
  }

  /** Refresh the bed status after a room reset or a bed break, without rebuilding the map. */
  setTeams(teams: ReadonlyMap<TeamId, TeamStateLike>): void {
    this.teamStates = teams
    for (const bed of this.beds) {
      const state = teams.get(bed.team)
      if (!state) continue
      bed.alive = state.bed
      bed.eliminated = state.eliminated === true
    }
  }

  baseNode(team: TeamId): WorldNode | null {
    return this.baseNodes.get(team) ?? null
  }

  bed(team: TeamId): BedInfo | null {
    return this.beds.find((bed) => bed.team === team) ?? null
  }

  bedAlive(team: TeamId): boolean {
    const bed = this.bed(team)
    return !!bed?.alive && !bed.eliminated
  }

  bedDistance(x: number, z: number, team: TeamId): number {
    const bed = this.bed(team)
    return bed ? Math.hypot(x - bed.center.x, z - bed.center.z) : Number.POSITIVE_INFINITY
  }

  /** Enemy beds with a bed still standing, most attractive raid target first. */
  exposedBeds(ownTeam: TeamId): BedInfo[] {
    return this.beds
      .filter((bed) => bed.team !== ownTeam && bed.alive && !bed.eliminated)
      .sort((a, b) => this.raidPriority(ownTeam, b.team) - this.raidPriority(ownTeam, a.team) || a.team.localeCompare(b.team))
  }

  /** Exposed beds first, then how costly and risky the approach from our base is. */
  raidPriority(fromTeam: TeamId, targetTeam: TeamId): number {
    const from = this.baseNodes.get(fromTeam)
    const bed = this.bed(targetTeam)
    if (!from || !bed || !bed.alive || bed.eliminated) return 0
    const lane = this.estimateLane(from, bed.center, [fromTeam, targetTeam])
    return round(
      clamp01(bed.exposure * 0.55 + bed.approachDanger * 0.2 + lane.danger * 0.1 + (1 / (1 + lane.distance / 60)) * 0.15),
      4,
    )
  }

  generatorOwnership(spot: GeneratorSpot, team: TeamId): GeneratorOwnership {
    if (!spot.team) return 'contested'
    return spot.team === team ? 'home' : 'enemy'
  }

  shop(team: TeamId): Npc | null {
    return this.map.npcs.find((npc) => npc.team === team && npc.kind === 'shop') ?? null
  }

  upgrades(team: TeamId): Npc | null {
    return this.map.npcs.find((npc) => npc.team === team && npc.kind === 'upgrades') ?? null
  }

  healPool(team: TeamId): HealPool | null {
    const base = this.map.bases.find((b) => b.team === team)
    if (!base) return null
    return { team, x: base.center[0], y: base.center[1], z: base.center[2], radius: BASE_RADIUS }
  }

  nearestSafeNode(x: number, y: number, z: number): WorldNode | null {
    let best: WorldNode | null = null
    let bestDistance = Number.POSITIVE_INFINITY
    for (const node of this.nodes) {
      if (!node.safe || !this.groundAt(Math.floor(node.x), Math.floor(node.y), Math.floor(node.z))) continue
      const d = Math.hypot(node.x - x, node.y - y, node.z - z)
      if (d < bestDistance) {
        best = node
        bestDistance = d
      }
    }
    return best
  }

  nearestSafeRoute(from: WorldPoint): RoutePlan {
    const node = this.nearestSafeNode(from.x, from.y, from.z)
    return node ? this.route(from, node) : this.emptyRoute(null)
  }

  /** Direct estimate between two points (or team bases/nodes), without routing through the graph. */
  laneBlockCost(from: RouteTarget, to: RouteTarget): number {
    const a = this.resolve(from)
    const b = this.resolve(to)
    if (!a || !b) return 0
    return this.estimateLane(a.point, b.point, this.exclusions(a.node, b.node)).blockCost
  }

  /** Cheapest safe route, preferring less danger and void at a small distance premium. */
  route(from: RouteTarget, to: RouteTarget): RoutePlan {
    const start = this.resolve(from)
    const end = this.resolve(to)
    if (!start || !end) return this.emptyRoute(null)
    if (start.node && end.node && start.node.id === end.node.id) {
      return { ...zeroTotals(), from: start.node.id, to: end.node.id, nodes: [start.node.id] }
    }

    const count = this.nodes.length
    const dist = new Array<number>(count).fill(Number.POSITIVE_INFINITY)
    const visited = new Array<boolean>(count).fill(false)
    const previous = new Array<number>(count).fill(-1)
    const totals = this.nodes.map(() => zeroTotals())

    const startIndex = start.node ? this.nodeIndex.get(start.node.id) ?? -1 : -1
    if (startIndex >= 0) {
      dist[startIndex] = 0
    } else {
      for (let i = 0; i < count; i++) {
        const lane = this.estimateLane(start.point, this.nodes[i], this.exclusions(null, this.nodes[i]))
        const weight = this.laneWeight(lane)
        dist[i] = weight
        totals[i] = mergeTotals(zeroTotals(), lane)
      }
    }

    const endIndex = end.node ? this.nodeIndex.get(end.node.id) ?? -1 : -1
    for (let iteration = 0; iteration < count; iteration++) {
      let u = -1
      let best = Number.POSITIVE_INFINITY
      for (let i = 0; i < count; i++) {
        if (!visited[i] && dist[i] < best) {
          best = dist[i]
          u = i
        }
      }
      if (u < 0) break
      visited[u] = true
      if (u === endIndex) break
      for (let v = 0; v < count; v++) {
        if (visited[v] || v === u) continue
        const lane = this.laneBetween(this.nodes[u], this.nodes[v])
        const candidate = dist[u] + this.laneWeight(lane)
        if (candidate < dist[v] - 1e-9) {
          dist[v] = candidate
          previous[v] = u
          totals[v] = mergeTotals(totals[u], lane)
        }
      }
    }

    if (endIndex >= 0) {
      if (!Number.isFinite(dist[endIndex]) || endIndex >= count) return this.emptyRoute(start.node?.id ?? null)
      return {
        ...totals[endIndex],
        from: start.node?.id ?? null,
        to: end.node?.id ?? '',
        nodes: this.tracePath(endIndex, previous),
      }
    }

    let bestEnd = -1
    let bestWeight = Number.POSITIVE_INFINITY
    let bestTotals = zeroTotals()
    for (let i = 0; i < count; i++) {
      if (!Number.isFinite(dist[i])) continue
      const lane = this.estimateLane(this.nodes[i], end.point, this.exclusions(this.nodes[i], null))
      const weight = dist[i] + this.laneWeight(lane)
      if (weight < bestWeight) {
        bestWeight = weight
        bestEnd = i
        bestTotals = mergeTotals(totals[i], lane)
      }
    }
    if (bestEnd < 0) return this.emptyRoute(start.node?.id ?? null)
    return {
      ...bestTotals,
      from: start.node?.id ?? null,
      to: end.node?.id ?? '',
      nodes: this.tracePath(bestEnd, previous),
    }
  }

  routeCost(from: RouteTarget, to: RouteTarget): number {
    return this.route(from, to).cost
  }

  private addNode(node: WorldNode): void {
    this.nodeIndex.set(node.id, this.nodes.length)
    this.nodes.push(node)
    this.nodeById.set(node.id, node)
  }

  private makeBed(base: TeamBase): BedInfo {
    const center = {
      x: base.bed.x + 0.5 + base.bed.dx * 0.5,
      y: base.bed.y,
      z: base.bed.z + 0.5 + base.bed.dz * 0.5,
    }
    return {
      x: base.bed.x,
      y: base.bed.y,
      z: base.bed.z,
      team: base.team,
      dx: base.bed.dx,
      dz: base.bed.dz,
      center,
      alive: true,
      eliminated: false,
      exposure: this.bedExposure(base),
      approachDanger: 0,
    }
  }

  private bedExposure(base: TeamBase): number {
    let closest = MAX_BED_EDGE
    const cells: [number, number][] = [
      [base.bed.x, base.bed.z],
      [base.bed.x + base.bed.dx, base.bed.z + base.bed.dz],
    ]
    for (const [x, z] of cells) {
      for (const [dx, dz] of DIRECTIONS) {
        let step = 1
        for (; step <= MAX_BED_EDGE; step++) {
          const gx = x + dx * step
          const gz = z + dz * step
          if (!this.map.world.isSolid(gx, base.bed.y - 1, gz)) break
        }
        closest = Math.min(closest, step)
      }
    }
    return round(clamp01(1 - (closest - 1) / 12), 4)
  }

  private approachDanger(team: TeamId): number {
    const own = this.baseNodes.get(team)
    if (!own) return 0
    let danger = 0
    for (const base of this.map.bases) {
      if (base.team === team) continue
      const other = this.baseNodes.get(base.team)
      if (!other) continue
      danger = Math.max(danger, this.laneBetween(other, own).danger)
    }
    return round(danger, 4)
  }

  private groundAt(x: number, y: number, z: number): boolean {
    for (let depth = 1; depth <= 4; depth++) {
      if (this.map.world.isSolid(x, y - depth, z)) return true
    }
    return false
  }

  private laneBetween(a: WorldNode, b: WorldNode): LaneEstimate {
    const first = a.id < b.id ? a : b
    const second = a.id < b.id ? b : a
    const key = `${first.id}|${second.id}`
    const cached = this.laneCache.get(key)
    if (cached) return cached
    const lane = this.estimateLane(a, b, this.exclusions(a, b))
    this.laneCache.set(key, lane)
    return lane
  }

  private estimateLane(from: WorldPoint, to: WorldPoint, exclude: TeamId[]): LaneEstimate {
    const dx = to.x - from.x
    const dz = to.z - from.z
    const distance = Math.hypot(dx, dz)
    if (distance < 0.5) return { distance, blockCost: 0, danger: 0, voidRisk: 0, ground: 1 }

    const y = Math.round((from.y + to.y) / 2)
    const steps = Math.max(2, Math.ceil(distance / SAMPLE_STEP))
    let ground = 0
    let samples = 0
    for (let i = 1; i < steps; i++) {
      const t = i / steps
      samples++
      if (this.groundAt(Math.floor(from.x + dx * t), y, Math.floor(from.z + dz * t))) ground++
    }
    const gaps = samples - ground
    const gapRatio = samples > 0 ? gaps / samples : 0
    const depth = clamp01((y - this.map.killY) / 30)
    const danger = this.laneDanger(from, to, exclude)
    return {
      distance: round(distance, 2),
      blockCost: round(gapRatio * distance, 1),
      danger,
      voidRisk: round(clamp01(gapRatio * (0.55 + depth * 0.45)), 3),
      ground: samples > 0 ? round(ground / samples, 3) : 1,
    }
  }

  private laneDanger(from: WorldPoint, to: WorldPoint, exclude: TeamId[]): number {
    let danger = 0
    for (const node of this.nodes) {
      if (node.kind === 'base' || !node.safe) continue
      const d = pointToSegment(node, from, to)
      danger = Math.max(danger, clamp01(1 - d / 14) * 0.6)
    }
    for (const base of this.map.bases) {
      if (exclude.includes(base.team)) continue
      const d = pointToSegment({ x: base.center[0], y: base.center[1], z: base.center[2] }, from, to)
      danger = Math.max(danger, clamp01(1 - d / 20) * 0.55)
    }
    return round(clamp01(danger), 3)
  }

  private laneWeight(lane: LaneEstimate): number {
    return lane.blockCost + lane.distance * 0.05 + lane.danger * 4 + lane.voidRisk * 3 + 1
  }

  private exclusions(a: WorldNode | null, b: WorldNode | null): TeamId[] {
    const teams: TeamId[] = []
    if (a?.team) teams.push(a.team)
    if (b?.team && b.team !== a?.team) teams.push(b.team)
    return teams
  }

  private tracePath(end: number, previous: number[]): string[] {
    const path: string[] = []
    let at = end
    while (at >= 0) {
      path.push(this.nodes[at].id)
      at = previous[at]
    }
    return path.reverse()
  }

  private resolve(target: RouteTarget): { node: WorldNode | null; point: WorldPoint } | null {
    if (typeof target === 'string') {
      const base = this.baseNodes.get(target as TeamId)
      if (base) return { node: base, point: base }
      const node = this.nodeById.get(target)
      return node ? { node, point: node } : null
    }
    if (typeof target === 'object') return { node: null, point: target }
    return null
  }

  private emptyRoute(from: string | null): RoutePlan {
    return { ...zeroTotals(), from, to: '', nodes: [] }
  }
}
