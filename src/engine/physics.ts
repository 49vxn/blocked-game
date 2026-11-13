import { blockDef } from './blocks'
import {
  AIR_ACCEL,
  AIR_ACCEL_SPRINT,
  AIR_DRAG,
  AIR_FRICTION,
  BLOXD_AIR_CONTROL,
  BLOXD_AIR_IDLE_DRAG,
  BLOXD_AIR_SPEED,
  COYOTE_TICKS,
  GRAVITY,
  GROUND_FRICTION,
  JUMP_VELOCITY,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  SAFE_FALL,
  SHIELD_MULTIPLIER,
  SNEAK_EDGE_PROBE,
  SNEAK_HEIGHT,
  SNEAK_MULTIPLIER,
  SPRINT_JUMP_BOOST,
} from './constants'
import { DEFAULT_MOVEMENT, MOVEMENT_PRESETS, type MovementPresetId } from './movement'
import type { World } from './world'

/** [minX, minY, minZ, maxX, maxY, maxZ] */
export type Box = [number, number, number, number, number, number]

const EPS = 1e-7

export function playerBox(x: number, y: number, z: number, sneaking: boolean): Box {
  const h = PLAYER_WIDTH / 2
  return [x - h, y, z - h, x + h, y + (sneaking ? SNEAK_HEIGHT : PLAYER_HEIGHT), z + h]
}

export function boxesOverlap(a: Box, b: Box): boolean {
  return a[0] < b[3] && a[3] > b[0] && a[1] < b[4] && a[4] > b[1] && a[2] < b[5] && a[5] > b[2]
}

function offset(b: Box, dx: number, dy: number, dz: number): Box {
  return [b[0] + dx, b[1] + dy, b[2] + dz, b[3] + dx, b[4] + dy, b[5] + dz]
}

/** Solid block boxes overlapping a region. */
function solidsIn(world: World, region: Box, visit: (b: Box) => void): void {
  for (let y = Math.floor(region[1]); y <= Math.floor(region[4] - EPS); y++)
    for (let z = Math.floor(region[2]); z <= Math.floor(region[5] - EPS); z++)
      for (let x = Math.floor(region[0]); x <= Math.floor(region[3] - EPS); x++) {
        const def = blockDef(world.get(x, y, z))
        if (def.solid) visit([x, y, z, x + 1, y + def.height, z + 1])
      }
}

export function collides(world: World, box: Box): boolean {
  let hit = false
  solidsIn(world, box, (b) => {
    if (boxesOverlap(box, b)) hit = true
  })
  return hit
}

/** The largest part of `d` along `axis` (0, 1, 2) the box can move without entering a solid. */
function clip(world: World, box: Box, axis: 0 | 1 | 2, d: number): number {
  if (d === 0) return 0
  const region: Box = [...box]
  if (d > 0) region[axis + 3] += d
  else region[axis] += d
  solidsIn(world, region, (b) => {
    for (let a = 0; a < 3; a++) {
      if (a === axis) continue
      if (!(box[a] < b[a + 3] && box[a + 3] > b[a])) return
    }
    if (d > 0 && box[axis + 3] <= b[axis] + EPS) d = Math.min(d, b[axis] - box[axis + 3])
    else if (d < 0 && box[axis] >= b[axis + 3] - EPS) d = Math.max(d, b[axis + 3] - box[axis])
  })
  return d
}

export interface MoveInput {
  /** -1 back, 1 forward */
  forward: number
  /** -1 left, 1 right */
  strafe: number
  jump: boolean
  sneak: boolean
  sprint: boolean
  shield?: boolean
  /** Walking and air-control multiplier (speed effects). */
  speedBoost?: number
  /** Extra jump velocity (jump effects). */
  jumpBoost?: number
  yaw: number
  pitch: number
}

export const IDLE_INPUT: MoveInput = { forward: 0, strafe: 0, jump: false, sneak: false, sprint: false, yaw: 0, pitch: 0 }

export interface Mover {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  yaw: number
  pitch: number
  onGround: boolean
  sneaking: boolean
  sprinting: boolean
  fallDistance: number
  /** Coyote-time ticks left (set while grounded, counts down in the air). */
  coyote?: number
  /** A hit gave extra velocity; do not brake it away on the next tick. */
  knockbackTicks?: number
}

export interface StepResult {
  /** Fall damage to apply this tick (0 when none). */
  fallDamage: number
  landed: boolean
  collidedHorizontally: boolean
}

/** Facing vectors for a yaw: yaw 0 looks toward -z, positive yaw turns left. */
export function forwardOf(yaw: number): [number, number] {
  return [-Math.sin(yaw), -Math.cos(yaw)]
}

export function lookDirection(yaw: number, pitch: number): [number, number, number] {
  const c = Math.cos(pitch)
  return [-Math.sin(yaw) * c, Math.sin(pitch), -Math.cos(yaw) * c]
}

/**
 * Moves a body by one tick: input, jump, collision (Y, then X, then Z), sneak
 * edge guard, gravity and fall damage. Shared by clients, the server and bots.
 */
export function stepMovement(world: World, m: Mover, input: MoveInput, presetId: MovementPresetId = DEFAULT_MOVEMENT): StepResult {
  const preset = MOVEMENT_PRESETS[presetId] ?? MOVEMENT_PRESETS[DEFAULT_MOVEMENT]
  const fluid = blockDef(world.get(Math.floor(m.x), Math.floor(m.y + 0.1), Math.floor(m.z))).meta.fluid === true
  m.yaw = input.yaw
  m.pitch = input.pitch

  // Standing up needs headroom; otherwise stay crouched.
  const wantsSneak = input.sneak || (m.sneaking && collides(world, playerBox(m.x, m.y, m.z, false)))
  m.sneaking = wantsSneak

  const forward = Math.max(-1, Math.min(1, input.forward))
  const strafe = Math.max(-1, Math.min(1, input.strafe))
  // The input carries the current sprint intent (hold, toggle or always). A
  // released hold key must stop the sprint on the next tick, not keep the old
  // state while the player walks forward.
  m.sprinting = !!input.sprint && forward > 0 && !m.sneaking && !input.shield

  const [fx, fz] = forwardOf(m.yaw)
  // Right is forward rotated a quarter turn clockwise.
  const rx = -fz
  const rz = fx
  let wx = fx * forward + rx * strafe
  let wz = fz * forward + rz * strafe
  const len = Math.hypot(wx, wz)
  if (len > 1) {
    wx /= len
    wz /= len
  }

  // Every preset shares the Classic blend. Replacing part of the old velocity
  // each tick is what makes a turn, a stop and a mid-air correction respond
  // immediately; an accelerate/brake controller with a low cap kept the old
  // direction alive and read as drifting without input.
  if (m.onGround) {
    let speed = m.sprinting ? preset.sprint : preset.walk
    if (m.sneaking) speed = Math.min(speed, preset.sneak)
    if (input.shield) speed *= SHIELD_MULTIPLIER
    speed *= (input.speedBoost ?? 1) * (fluid ? 0.45 : 1)
    m.vx = m.vx * GROUND_FRICTION + wx * speed * (1 - GROUND_FRICTION)
    m.vz = m.vz * GROUND_FRICTION + wz * speed * (1 - GROUND_FRICTION)
  } else if (preset.airControl === 'bloxd' && len > 0 && (m.knockbackTicks ?? 0) === 0) {
    // Bloxd preset: steer toward the input at the steady air speed instead of
    // carrying 91% of the old velocity. A reversal is planted in about three
    // ticks. Knockback keeps its momentum until the grace ends.
    const speed = (m.sneaking ? preset.sneak : BLOXD_AIR_SPEED) * (input.speedBoost ?? 1) * (fluid ? 0.45 : 1)
    m.vx = m.vx * (1 - BLOXD_AIR_CONTROL) + wx * speed * BLOXD_AIR_CONTROL
    m.vz = m.vz * (1 - BLOXD_AIR_CONTROL) + wz * speed * BLOXD_AIR_CONTROL
  } else if (preset.airControl === 'bloxd') {
    // Releasing every key mid-jump keeps the arc; it does not brake in air.
    m.vx *= BLOXD_AIR_IDLE_DRAG
    m.vz *= BLOXD_AIR_IDLE_DRAG
  } else {
    const accel = (m.sprinting ? AIR_ACCEL_SPRINT : AIR_ACCEL) * (m.sneaking ? SNEAK_MULTIPLIER : 1) * (input.speedBoost ?? 1) * (fluid ? 0.45 : 1)
    m.vx = m.vx * AIR_FRICTION + wx * accel
    m.vz = m.vz * AIR_FRICTION + wz * accel
  }
  // Jump from the ground, or within a few ticks of walking off an edge (coyote time).
  if (fluid && input.jump) {
    m.vy = Math.min(0.16, m.vy + 0.1)
    m.fallDistance = 0
  } else if (input.jump && (m.onGround || ((m.coyote ?? 0) > 0 && m.vy <= 0))) {
    m.vy = JUMP_VELOCITY + (input.jumpBoost ?? 0)
    m.coyote = 0
    if (m.sprinting) {
      m.vx += fx * SPRINT_JUMP_BOOST
      m.vz += fz * SPRINT_JUMP_BOOST
    }
  }

  let dx = m.vx
  let dy = m.vy
  let dz = m.vz
  let box = playerBox(m.x, m.y, m.z, m.sneaking)

  if (m.sneaking && m.onGround) [dx, dz] = guardEdge(world, box, dx, dz)

  const wantY = dy
  dy = clip(world, box, 1, dy)
  box = offset(box, 0, dy, 0)
  const wantX = dx
  dx = clip(world, box, 0, dx)
  box = offset(box, dx, 0, 0)
  const wantZ = dz
  dz = clip(world, box, 2, dz)
  box = offset(box, 0, 0, dz)

  m.x += dx
  m.y += dy
  m.z += dz

  const wasOnGround = m.onGround
  m.onGround = wantY < 0 && dy !== wantY
  if (dy !== wantY) m.vy = 0
  const hitX = dx !== wantX
  const hitZ = dz !== wantZ
  if (hitX) m.vx = 0
  if (hitZ) m.vz = 0
  if (hitX || hitZ) m.sprinting = false

  let fallDamage = 0
  let landed = false
  m.coyote = m.onGround ? COYOTE_TICKS : Math.max(0, (m.coyote ?? 0) - 1)
  if (m.onGround) {
    if (!wasOnGround) landed = true
    if (m.fallDistance > SAFE_FALL) fallDamage = Math.ceil(m.fallDistance - SAFE_FALL)
    m.fallDistance = 0
  } else if (dy < 0) {
    m.fallDistance -= dy
  }

  if (fluid) m.fallDistance = 0
  m.vy = fluid ? Math.max(-0.16, (m.vy - GRAVITY * 0.18) * 0.82) : (m.vy - GRAVITY) * AIR_DRAG
  if (Math.abs(m.vx) < 0.003) m.vx = 0
  if (Math.abs(m.vz) < 0.003) m.vz = 0
  if ((m.knockbackTicks ?? 0) > 0) m.knockbackTicks!--

  return { fallDamage, landed, collidedHorizontally: hitX || hitZ }
}

/** While sneaking on ground, shorten a step that would leave the hitbox with nothing beneath it. */
function guardEdge(world: World, box: Box, dx: number, dz: number): [number, number] {
  const step = 0.05
  const free = (x: number, z: number) => !collides(world, offset(box, x, -SNEAK_EDGE_PROBE, z))
  const shrink = (v: number) => (Math.abs(v) < step ? 0 : v - Math.sign(v) * step)
  while (dx !== 0 && free(dx, 0)) dx = shrink(dx)
  while (dz !== 0 && free(0, dz)) dz = shrink(dz)
  while (dx !== 0 && dz !== 0 && free(dx, dz)) {
    dx = shrink(dx)
    dz = shrink(dz)
  }
  return [dx, dz]
}

/** The block under a body's feet, for server-side ground checks. */
export function groundBelow(world: World, x: number, y: number, z: number, sneaking: boolean): boolean {
  return collides(world, offset(playerBox(x, y, z, sneaking), 0, -0.05, 0))
}

/** Isotropic point-ish body for item drops: falls and rests on blocks. */
export function stepDrop(world: World, d: { x: number; y: number; z: number; vx: number; vy: number; vz: number }, gravity: number): void {
  const half = 0.125
  let box: Box = [d.x - half, d.y, d.z - half, d.x + half, d.y + 0.25, d.z + half]
  const dy = clip(world, box, 1, d.vy)
  box = offset(box, 0, dy, 0)
  const dx = clip(world, box, 0, d.vx)
  box = offset(box, dx, 0, 0)
  const dz = clip(world, box, 2, d.vz)
  d.x += dx
  d.y += dy
  d.z += dz
  const grounded = dy !== d.vy && d.vy < 0
  d.vy = grounded ? 0 : (d.vy - gravity) * AIR_DRAG
  const friction = grounded ? 0.6 : 0.98
  d.vx *= friction
  d.vz *= friction
}
