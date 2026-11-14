import { describe, expect, test } from 'bun:test'
import { AIR, LANTERN } from '../src/games/bedwars/blocks'
import { IDLE_INPUT, stepMovement, type Mover } from '../src/engine/physics'
import type { World } from '../src/engine/world'
import { mover } from './helpers'
import { parkourCourse, TOWER } from '../src/games/bedwars/maps/parkour'
import { Room } from '../src/games/bedwars/room'
import { parkourRules } from '../src/games/bedwars/rules'
import type { SelfView } from '../src/games/bedwars/protocol'
import { TestClient, ticks } from './room-helpers'

function selfOf(client: TestClient): SelfView {
  const messages = client.msgs.filter((m): m is Extract<typeof m, { t: 'self' }> => m.t === 'self')
  return messages[messages.length - 1].self
}

// ---- geometry, mirrored from the builder in maps/parkour.ts so the audit is
// an independent re-derivation of the same spec rather than shared code. ----

interface Cell {
  x: number
  z: number
  t: number
  d: number
}

function pad(step: number): [number, number, number] {
  const a = -Math.PI / 2 + step * TOWER.angle
  const x = Math.round(TOWER.center[0] + Math.cos(a) * TOWER.radius)
  const z = Math.round(TOWER.center[1] + Math.sin(a) * TOWER.radius)
  const y = TOWER.baseY + Math.floor(step / 2)
  return [x, y, z]
}

function treadCells(step: number): Cell[] {
  const [px, , pz] = pad(step)
  const a = -Math.PI / 2 + step * TOWER.angle
  const tx = -Math.sin(a)
  const tz = Math.cos(a)
  const cells: Cell[] = []
  for (let dx = -2; dx <= 2; dx++)
    for (let dz = -2; dz <= 2; dz++) {
      const d = Math.hypot(px + dx - TOWER.center[0], pz + dz - TOWER.center[1])
      if (d <= TOWER.ribbonInner || d > TOWER.ribbonOuter) continue
      const t = dx * tx + dz * tz
      if (Math.abs(t) <= 1.35) cells.push({ x: px + dx, z: pz + dz, t, d })
    }
  return cells
}

function treadY(step: number): number {
  return TOWER.baseY + Math.floor(step / 2)
}

const SKIPPED: { [step: number]: boolean } = {}
for (const gap of TOWER.gaps) for (let i = 1; i <= (gap.double ? 2 : 1); i++) SKIPPED[gap.from + i] = true

// ---- the physics probe ----

interface SimResult {
  verdict: string | true
  landedFeet: number
  ticks: number
}

/**
 * A real flight over the joint from step `k`. The runner steers at a pursuit
 * waypoint a short arc ahead on the centre lane (aiming at the current tangent
 * lets a ground runner cut outward until the riser wall pins it), sprints a
 * runway so the tap launches at steady speed — delivered at the line a block
 * before the launch face — then coasts. The plain sprint jump window holds
 * feet height +1.0 for 1.24..4.69 blocks of travel with apex 1.6, which is
 * why every launch is delivered ~1.0 behind the face, whether the joint is a
 * riser, a flat step or a gap. On the tight phases the next tread's riser
 * wall can stand before the deliver line; that pin is a legal stair-walk, so
 * the tap fires from the pin instead.
 */
const LANE_RADIUS = 13.8
const LANE_LEAD = 0.13
function jumpOver(world: World, k: number, landStep: number, label: string, backoff: number): SimResult {
  const cells = treadCells(k)
  if (cells.length < 3) return { verdict: `${label}: tread has only ${cells.length} cells`, landedFeet: 0, ticks: 0 }
  const front = Math.max(...cells.map((c) => c.t))
  const [px, , pz] = pad(k)
  const a = -Math.PI / 2 + k * TOWER.angle
  const tx = -Math.sin(a)
  const tz = Math.cos(a)
  const drive = (m: Mover, jump: boolean) => {
    // Hold the thread inside the band: aim at the point ahead of the mover on
    // the lane. The air needs a tighter target than the ground — an airborne
    // arc at 0.5 b/tick needs v²/r ≈ 0.018 of inward pull per tick, which a
    // waypoint on the mover's own circle (zero radial defect) cannot supply,
    // and the drift rode the arc out past the band edge right as the feet
    // descended to landing height.
    const rho = Math.atan2(m.z - TOWER.center[1], m.x - TOWER.center[0])
    const lane = m.onGround ? LANE_RADIUS : LANE_RADIUS - 0.5
    const xt = TOWER.center[0] + Math.cos(rho + LANE_LEAD) * lane
    const zt = TOWER.center[1] + Math.sin(rho + LANE_LEAD) * lane
    m.yaw = Math.atan2(m.x - xt, m.z - zt)
    return stepMovement(world, m, { ...IDLE_INPUT, yaw: m.yaw, forward: 1, sprint: true, jump })
  }
  const pos = (m: Mover) => (m.x - px) * tx + (m.z - pz) * tz
  // Runway start: the backmost cell of the outer lane — the innermost cells
  // lie close enough to the stepped wall face for its corners to pinch a
  // runner (the wall pokes out to d ≈ 11.85).
  const usable = cells.filter((c) => c.d >= 12.6)
  const pick = usable.length >= 2 ? usable : cells
  const spawnCell = pick.reduce((p, q) => (p.t <= q.t ? p : q))
  const m = mover(spawnCell.x + 0.5, treadY(k) + 1, spawnCell.z + 0.5)
  for (let i = 0; i < 3; i++) stepMovement(world, m, { ...IDLE_INPUT, yaw: m.yaw })
  if (!m.onGround) return { verdict: `${label}: spawn at ${spawnCell.x},${spawnCell.z} is not standing`, landedFeet: 0, ticks: 0 }
  // Launch line: `backoff` blocks early on ordinary joints — the next tread's
  // riser wall can stand right at the front face (tight staircase phases),
  // and a jump fired at the face presses it, slides along its side and slides
  // off the walkway (traced: launches that x-froze against the wall for 8+
  // ticks). Launched ~1.6 before the face the arc crosses wall-top height
  // (feet ≥ +1.0 held from 1.24 blocks of travel) just as it reaches it.
  // Gap-edge steps keep a near-edge line: the far edge is up to 3.4 blocks
  // out and the arc must cross it right at the +1.0 window, not short of it.
  const deliver = front - (0.55 + backoff) + 0.5 * (tx + tz)
  let last = pos(m)
  let stalled = 0
  for (let i = 0; i < 14; i++) {
    if (pos(m) >= deliver) break
    const touched = drive(m, false)
    // Jump on contact, the way a player does: the tick a grounded runner
    // first presses a riser wall, or the tick its feet leave an edge (a gap
    // lip or the band edge), launching later would fire after wall clips or
    // coyote expiry drained the runway velocity — probes showed launches
    // from v ≈ 0 pin-jumps flying straight up against the stack and dead
    // falls with no jump at all. Fire while the speed and coyote are alive.
    if (touched.collidedHorizontally && m.onGround) break
    if (!m.onGround) break
    if (pos(m) < last + 1e-6) stalled++
    else stalled = 0
    last = pos(m)
    if (stalled >= 2) break
  }
  drive(m, true)
  for (let i = 1; i < 30; i++) {
    drive(m, false)
    if (m.y < treadY(k) - 0.5)
      return { verdict: `${label}: plain sprint jump fell (tick ${i}: ${m.x.toFixed(2)},${m.y.toFixed(2)},${m.z.toFixed(2)})`, landedFeet: m.y, ticks: i }
    if (m.onGround) {
      // The arc proves a sprint jump holds feet height +1.0 for 1.24..4.69
      // blocks, and the walkway climbs only (+1 tread per two steps), so a
      // flight legally overflies flat steps and risers before touching down
      // on walkway floor further along. Accept any landing within three
      // tread-lens of the target, at that step's own feet level.
      for (let s = landStep; s <= landStep + 3; s++) {
        if (Math.abs(m.y - (treadY(s) + 1)) > 0.01) continue
        let n = Infinity
        for (const c of treadCells(s)) n = Math.min(n, Math.hypot(m.x - c.x - 0.5, m.z - c.z - 0.5))
        if (n <= 1.4) return { verdict: true, landedFeet: m.y, ticks: i }
      }
      return { verdict: `${label}: landed at feet ${m.y.toFixed(2)}, off the walkway at ${m.x.toFixed(2)},${m.z.toFixed(2)}`, landedFeet: m.y, ticks: i }
    }
  }
  return { verdict: `${label}: still in the air after 30 ticks at ${m.x.toFixed(2)},${m.y.toFixed(2)},${m.z.toFixed(2)}`, landedFeet: m.y, ticks: 30 }
}

describe('spiral tower course', () => {
  test('is a tall ten-level climb to a finish deck', () => {
    const map = parkourCourse('spiral')
    expect(map.name).toBe('Spiral Tower')
    expect(map.world.sx).toBe(80)
    expect(map.world.sy).toBe(204)
    expect(map.world.sz).toBe(80)
    const course = map.parkour
    expect(course).toBeDefined()
    // One checkpoint pad per themed level, start to top.
    expect(course!.checkpoints.length).toBe(10)
    expect(course!.finish[1]).toBeGreaterThan(course!.checkpoints[9][1])
    for (const [i, point] of course!.checkpoints.entries()) {
      expect(point[0]).toBeGreaterThan(0)
      expect(point[0]).toBeLessThan(map.world.sx)
      expect(point[2]).toBeGreaterThan(0)
      expect(point[2]).toBeLessThan(map.world.sz)
      expect(point[1]).toBeLessThan(map.world.sy)
      // Every checkpoint stands on the walkway, outside the tower shell.
      expect(map.world.get(Math.floor(point[0]), Math.floor(point[1]) - 1, Math.floor(point[2]))).not.toBe(AIR)
      expect(Math.hypot(point[0] - TOWER.center[0], point[2] - TOWER.center[1])).toBeGreaterThan(TOWER.ribbonInner)
      if (i > 0) expect(point[1] - course!.checkpoints[i - 1][1]).toBe(19)
    }
    expect(map.world.isSolid(Math.floor(course!.finish[0]), Math.floor(course!.finish[1]) - 1, Math.floor(course!.finish[2]))).toBe(true)
    expect(map.bases.length).toBe(0)
    expect(map.generators.length).toBe(0)
  })

  test('climbs for minutes, not seconds: a long helix with distinct levels', () => {
    const map = parkourCourse('spiral')
    const course = map.parkour!
    // Nine rises of 19 between start and the last level pad, then a finish above it.
    expect(course.checkpoints[9][1] - course.checkpoints[0][1]).toBe(9 * 19)
    expect(map.world.get(course.finish[0] | 0, course.finish[1], course.finish[2] | 0)).toBe(AIR)
    // And it still fits the join payload: a clean tower, not a speckled maze.
    expect(map.world.encode().length).toBeLessThan(200_000)
  })

  test('the walkway is solid underfoot with open headroom along the whole ribbon', () => {
    const map = parkourCourse('spiral')
    const w = map.world
    const problems: string[] = []
    for (let step = 0; step < TOWER.finishStep && problems.length < 24; step++) {
      if (SKIPPED[step]) continue
      const y = treadY(step)
      for (const { x, z, d } of treadCells(step)) {
        if (!w.isSolid(x, y, z)) {
          problems.push(`tread ${step} has no floor at ${x},${y},${z}`)
          continue
        }
        // Above a walk cell only three things are allowed: air, the next
        // tread's riser on the odd->even climb, or a corridor lantern on the
        // outer edge (a solid block standing just off the walking line).
        const above = w.get(x, y + 1, z)
        if (above !== AIR && above !== LANTERN) {
          const next = treadCells(step + 1).some((c) => c.x === x && c.z === z)
          if (!next || SKIPPED[step + 1]) problems.push(`tread ${step} blocked overhead at ${x},${y + 1},${z}`)
        }
        if (above === LANTERN && d <= 14) problems.push(`tread ${step} lantern on the walking line at ${x},${y + 1},${z}`)
        // Two above: the only solid allowed here is the corridor lamp standing
        // on the next riser's outer edge — so it stays a lane away from the
        // walking line as well.
        if (w.isSolid(x, y + 2, z) && !(w.get(x, y + 2, z) === LANTERN && d > 14))
          problems.push(`tread ${step} blocked at head height ${x},${y + 2},${z}`)
      }
    }
    expect(`walkway ${problems.length > 0 ? problems.join('; ') : 'clean'}`).toBe('walkway clean')
  })

  test('the ribbon is continuous: no floor hole between solid steps, and both gap edges are walkable', () => {
    const map = parkourCourse('spiral')
    const w = map.world
    const problems: string[] = []
    for (let step = 0; step + 1 < TOWER.finishStep && problems.length < 24; step++) {
      if (SKIPPED[step] || SKIPPED[step + 1]) continue
      const a = treadCells(step)
      const b = treadCells(step + 1)
      if (a.length === 0 || b.length === 0) {
        problems.push(`step ${step} or ${step + 1} has an empty lens`)
        continue
      }
      // Faces must touch or overlap; a gap between same-level treads is a
      // hole in the walkway, not an obstacle.
      const maxT = Math.max(...a.map((c) => c.t))
      const minNext = Math.min(...b.map((c) => c.t))
      if (minNext - 0.5 > maxT + 0.5) problems.push(`${step}->${step + 1}: floor hole of ${minNext - maxT - 1.0} between lens faces`)
    }
    // Rise joints: the riser cell must actually be built one level up.
    for (let step = 1; step + 1 < TOWER.finishStep && problems.length < 24; step += 2) {
      if (SKIPPED[step] || SKIPPED[step + 1]) continue
      for (const c of treadCells(step)) {
        if (!w.isSolid(c.x, treadY(step) + 1, c.z)) continue
        if (w.get(c.x, treadY(step) + 1, c.z) === LANTERN && c.d > 14) continue
        if (!treadCells(step + 1).some((p) => p.x === c.x && p.z === c.z))
          problems.push(`riser ${step}: solid above ${c.x},${treadY(step) + 1},${c.z} is not the next tread`)
      }
    }
    // Every gap: the launch and landing treads are solid floor.
    for (const gap of TOWER.gaps) {
      const landStep = gap.from + 1 + (gap.double ? 2 : 1)
      for (const step of [gap.from, landStep]) {
        const cells = treadCells(step)
        if (cells.length === 0) problems.push(`gap ${gap.from}: step ${step} has no cells`)
        for (const { x, z } of cells) if (!w.isSolid(x, treadY(step), z)) problems.push(`gap ${gap.from}: step ${step} missing floor at ${x},${treadY(step)},${z}`)
      }
    }
    expect(`joints ${problems.length > 0 ? problems.join('; ') : 'clean'}`).toBe('joints clean')
  })

  test('every hop, riser and gap in the course is provably clear to a plain sprint jump', () => {
    const map = parkourCourse('spiral')
    const w = map.world
    const problems: string[] = []
    // Every joint between consecutive solid steps — walk-on flats, hop-on
    // risers — then all gap flights.
    for (let k = 0; k + 1 < TOWER.finishStep && problems.length < 24; k++) {
      if (SKIPPED[k] || SKIPPED[k + 1]) continue
      if (TOWER.gaps.some((g) => k >= g.from - 1 && k < g.from + 1 + (g.double ? 2 : 1))) continue
      const r = jumpOver(w, k, k + 1, `joint ${k}->${k + 1}`, 1.05)
      if (r.verdict !== true) {
        if (process.env.TOWER_DEBUG) console.log('  ' + r.verdict)
        problems.push(r.verdict)
      }
    }
    for (const gap of TOWER.gaps) {
      const landStep = gap.from + 1 + (gap.double ? 2 : 1)
      const r = jumpOver(w, gap.from, landStep, `gap ${gap.from} (${gap.double ? 'double' : 'single'})`, 0)
      if (r.verdict !== true) {
        if (process.env.TOWER_DEBUG) console.log('  ' + r.verdict)
        problems.push(r.verdict)
      }
    }
    expect(`flights ${problems.length > 0 ? problems.join('; ') : 'clean'}`).toBe('flights clean')
  })

  test('the spawn keeps headroom on the start tread, and the finish owns the deck', () => {
    const map = parkourCourse('spiral')
    const course = map.parkour!
    const w = map.world
    const [sx, sy, sz] = course.checkpoints[0]
    expect(w.isSolid(Math.floor(sx), Math.floor(sy) - 1, Math.floor(sz))).toBe(true)
    expect(w.isSolid(Math.floor(sx), Math.floor(sy), Math.floor(sz))).toBe(false)
    expect(w.isSolid(Math.floor(sx), Math.floor(sy) + 1, Math.floor(sz))).toBe(false)
    // Finish feet on the deck top, clear headroom above, deck blocks below.
    const [fx, fy, fz] = course.finish
    expect(w.get(Math.floor(fx), Math.floor(fy) - 1, Math.floor(fz))).not.toBe(AIR)
    expect(w.get(Math.floor(fx), Math.floor(fy), Math.floor(fz))).toBe(AIR)
  })

  test('the tower reads as a solid keep: its heart is stone at the plaza level', () => {
    const map = parkourCourse('spiral')
    expect(map.world.isSolid(40, 60, 40)).toBe(true)
  })

  test('the parkour world opens on the tower; the classic course needs map=classic', () => {
    expect(parkourCourse(undefined).name).toBe('Spiral Tower')
    expect(parkourCourse('').name).toBe('Spiral Tower')
    expect(parkourCourse('spiral').name).toBe('Spiral Tower')
    expect(parkourCourse('parkour').name).toBe('Spiral Tower')
    expect(parkourCourse('not-a-course').name).toBe('Spiral Tower')
    expect(parkourCourse('classic').name).toBe('Parkour')
  })
})

describe('spiral tower room', () => {
  test('the retained parkour room runs on the default tower', () => {
    const room = new Room({ rules: parkourRules(), createMap: () => parkourCourse(undefined) })
    expect(room.phase).toBe('playing')
    expect(room.map.name).toBe('Spiral Tower')
    expect(room.rules.mode).toBe('parkour')
  })

  test('runs on it like the classic course: order, falls and a finish', () => {
    const room = new Room({ rules: parkourRules(), createMap: () => parkourCourse('spiral') })
    expect(room.phase).toBe('playing')
    const a = new TestClient(room, 'Ash')
    ticks(room, 1)
    const course = room.map.parkour!
    expect(selfOf(a).parkour?.checkpoint).toBe(1)
    // A later level cannot be reached without touching the ones between.
    a.put(...course.checkpoints[3])
    ticks(room, 1)
    expect(selfOf(a).parkour?.checkpoint).toBe(1)
    a.put(...course.checkpoints[1])
    ticks(room, 1)
    expect(selfOf(a).parkour?.checkpoint).toBe(2)
    // Falling drops the runner back to their last checkpoint without resetting the timer.
    a.put(course.checkpoints[1][0], 0, course.checkpoints[1][2])
    ticks(room, 1)
    const after = selfOf(a).parkour!
    expect(a.p.alive).toBe(true)
    expect(after.checkpoint).toBe(2)
    expect(after.falls).toBe(1)
    for (const point of course.checkpoints.slice(2)) {
      a.put(...point)
      ticks(room, 1)
    }
    a.put(...course.finish)
    ticks(room, 1)
    const ps = selfOf(a).parkour!
    expect(ps.finishAt).not.toBeNull()
    expect(ps.place).toBe(1)
    expect(ps.checkpoint).toBe(10)
  })
})
