import { parkourCourse } from '../src/games/bedwars/maps/parkour'

/**
 * Headless audit for the classic tutorial course: the spawn, every pad's
 * headroom, every jump arc and the finish. Run with `bun scripts/inspect-tower.ts`.
 *
 * Spiral Tower is no longer audited here: since the walkway redesign it is a
 * continuous tread ribbon with real gaps, not discrete 3x3 pads, and
 * `tests/parkour-spiral.test.ts` asserts its walkway solidity, headroom,
 * continuity and a headless sprint-jump fleet that clears every riser and
 * gap. Auditing the tower with the old pad model raised hundreds of false
 * problems, so that half was retired.
 */
const CLASSIC = {
  center: [32, 32] as [number, number],
  radius: 7,
  baseY: 16,
  angle: 0.55,
  finishStep: 29,
}

function audit(name: string, spec: typeof CLASSIC): string[] {
  const map = parkourCourse('classic')
  const course = map.parkour!
  const w = map.world
  const { radius, baseY, angle, finishStep } = spec
  const pad = (step: number): [number, number, number] => {
    const a = -Math.PI / 2 + step * angle
    const x = Math.round(spec.center[0] + Math.cos(a) * radius)
    const z = Math.round(spec.center[1] + Math.sin(a) * radius)
    const y = baseY + Math.floor(step / 2)
    return [x, y, z]
  }
  const solid = (x: number, y: number, z: number) => w.isSolid(x, y, z)
  const air = (x: number, y: number, z: number) => !solid(x, y, z)
  const problems: string[] = []

  // The spawn: open at feet and head, solid below.
  const [sx, sy, sz] = course.checkpoints[0]
  if (!air(Math.floor(sx), Math.floor(sy), Math.floor(sz)) || !air(Math.floor(sx), Math.floor(sy) + 1, Math.floor(sz)))
    problems.push(`SPAWN BLOCKED at ${sx},${sy},${sz}`)
  if (!solid(Math.floor(sx), Math.floor(sy) - 1, Math.floor(sz))) problems.push('SPAWN floats: nothing below')

  // Every pad: solid underfoot, open at feet and head.
  for (let step = 0; step <= finishStep; step++) {
    const [x, y, z] = pad(step)
    if (!solid(x, y, z)) problems.push(`pad ${step} (${x},${y},${z}) is not solid`)
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) {
        if (!air(x + dx, y + 1, z + dz)) problems.push(`pad ${step}: feet cell blocked at ${x + dx},${y + 1},${z + dz}`)
        if (!air(x + dx, y + 2, z + dz)) problems.push(`pad ${step}: head cell blocked at ${x + dx},${y + 2},${z + dz}`)
      }
  }

  // Every jump arc: feet rise along a +1.2-apex arc, so only cells at or
  // above the arc's feet height count as blockers.
  const feet = (step: number) => pad(step)[1] + 1
  for (let step = 0; step < finishStep; step++) {
    const [x0, , z0] = pad(step)
    const [x1, , z1] = pad(step + 1)
    for (const t of [0.25, 0.5, 0.75]) {
      const px = Math.floor(x0 + (x1 - x0) * t)
      const pz = Math.floor(z0 + (z1 - z0) * t)
      const fy = feet(step) + (feet(step + 1) - feet(step)) * t + Math.sin(Math.PI * t) * 1.2
      for (const yy of [Math.round(fy), Math.round(fy) + 1]) if (solid(px, yy, pz)) problems.push(`arc ${step}->${step + 1} t=${t}: solid at ${px},${yy},${pz}`)
    }
  }

  // The finish stands and is clear at feet height.
  const [fx, ffy, fz] = course.finish
  if (!solid(Math.floor(fx), Math.floor(ffy) - 1, Math.floor(fz))) problems.push('finish floats')
  if (!air(Math.floor(fx), Math.floor(ffy), Math.floor(fz))) problems.push('FINISH BLOCKED')

  console.log(`${name}: encode bytes ${w.encode().length}, checks ${finishStep + 1} pads + ${finishStep} arcs`)
  return problems
}

const problems = audit('Classic', CLASSIC)

console.log(problems.length === 0 ? 'AUDIT CLEAN' : `AUDIT: ${problems.length} problems`)
for (const p of problems.slice(0, 24)) console.log(' -', p)
