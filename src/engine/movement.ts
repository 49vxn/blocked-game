/**
 * Movement presets for the shared controller. Values are per tick at 20 TPS.
 *
 * All four presets use the proven Classic exponential blend: with input, each
 * tick replaces part of the old velocity with the wanted direction. That is
 * what makes direction changes and stops respond immediately. The presets
 * differ only in top speed, so they cannot drift through a turn the way the
 * retired accelerate/brake experiment did.
 *
 * The displayed values are blocks per second: 4.9 / 6.5 walk / sprint for
 * Classic, which is a little slower than the old 5.2 / 7.0.
 */
import { JUMP_VELOCITY, SNEAK_MULTIPLIER, SPRINT_JUMP_BOOST, WALK_SPEED } from './constants'

export type MovementPresetId = 'classic' | 'surefoot' | 'snapline' | 'flowline' | 'bloxd'
export type AirControl = 'classic' | 'bloxd'

export interface MovementPreset {
  id: MovementPresetId
  name: string
  blurb: string
  /** Blocks per tick. */
  walk: number
  sprint: number
  sneak: number
  /** Classic carries old velocity; Bloxd replaces it with the input direction. */
  airControl: AirControl
}

export const MOVEMENT_PRESETS: Record<MovementPresetId, MovementPreset> = {
  classic: {
    id: 'classic',
    name: 'Classic',
    blurb: 'The normal controller, tuned a little slower: quick to turn, no drift.',
    walk: 0.245,
    sprint: 0.325,
    sneak: WALK_SPEED * SNEAK_MULTIPLIER,
    airControl: 'classic',
  },
  surefoot: {
    id: 'surefoot',
    name: 'Surefoot',
    blurb: 'Classic feel at a calmer pace. The easiest to keep on a one-block bridge.',
    walk: 0.225,
    sprint: 0.29,
    sneak: WALK_SPEED * SNEAK_MULTIPLIER,
    airControl: 'classic',
  },
  snapline: {
    id: 'snapline',
    name: 'Snapline',
    blurb: 'A small step below Classic in sprint, for careful fights around an edge.',
    walk: 0.24,
    sprint: 0.31,
    sneak: WALK_SPEED * SNEAK_MULTIPLIER,
    airControl: 'classic',
  },
  flowline: {
    id: 'flowline',
    name: 'Flowline',
    blurb: 'The old Classic sprint speed, with the same immediate steering.',
    walk: 0.255,
    sprint: 0.35,
    sneak: WALK_SPEED * SNEAK_MULTIPLIER,
    airControl: 'classic',
  },
  bloxd: {
    id: 'bloxd',
    name: 'Bloxd',
    blurb: 'Bloxd speeds (4 / 7 / 2) with input-driven air steering, not carried momentum.',
    walk: 0.2,
    sprint: 0.35,
    sneak: 0.1,
    airControl: 'bloxd',
  },
}

/** The three alternatives to Classic, in the order the sandbox cycles them. */
export const SANDBOX_MOVEMENTS: MovementPresetId[] = ['surefoot', 'snapline', 'flowline', 'bloxd']

/** Every preset in the order the sandbox switcher cycles through. */
export const MOVEMENT_CYCLE: MovementPresetId[] = ['classic', ...SANDBOX_MOVEMENTS]

/** Every normal match and every bot uses this until a setting says otherwise. */
export const DEFAULT_MOVEMENT: MovementPresetId = 'classic'

/** The jump values are shared by every preset, so a preset changes pace only. */
export const MOVEMENT_JUMP = { jump: JUMP_VELOCITY, sprintJump: SPRINT_JUMP_BOOST }

export function isMovementPreset(value: unknown): value is MovementPresetId {
  return typeof value === 'string' && value in MOVEMENT_PRESETS
}

/** The next preset in the sandbox cycle. */
export function nextMovement(current: MovementPresetId): MovementPresetId {
  const at = MOVEMENT_CYCLE.indexOf(current)
  return MOVEMENT_CYCLE[(at + 1) % MOVEMENT_CYCLE.length]
}

/** A short label for the HUD, e.g. "Classic · 4.9 walk / 6.5 sprint". */
export function movementLabel(id: MovementPresetId, tps = 20): string {
  const p = MOVEMENT_PRESETS[id]
  return `${p.name} · ${(p.walk * tps).toFixed(1)} walk / ${(p.sprint * tps).toFixed(1)} sprint`
}
