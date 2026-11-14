import type { TeamId } from '../blocks'
import type { BuildRules } from '../../../engine/building'
import type { GeneratorKind } from '../rules'
import type { World } from '../../../engine/world'

export type Vec3 = [number, number, number]

export interface TeamBase {
  team: TeamId
  /** Feet position and facing. */
  spawn: [number, number, number, number]
  /** Bed foot cell and the direction to its head. */
  bed: { x: number; y: number; z: number; dx: number; dz: number }
  forge: Vec3
  center: Vec3
}

export interface GeneratorSpot {
  kind: GeneratorKind
  pos: Vec3
  team?: TeamId
}

export interface Npc {
  kind: 'shop' | 'upgrades' | 'dummy' | 'ender' | 'team'
  team?: TeamId
  x: number
  y: number
  z: number
  yaw: number
}

export interface ParkourCourse {
  /** Feet position and facing at the start. */
  spawn: [number, number, number, number]
  /** Checkpoint feet positions; the first is the start pad. */
  checkpoints: Vec3[]
  finish: Vec3
  /** Horizontal radius of a checkpoint or finish pad. */
  radius: number
  /** Highest walkable point, for the spectator camera. */
  top: number
}

export interface MapMeta {
  name: string
  bases: TeamBase[]
  generators: GeneratorSpot[]
  npcs: Npc[]
  /** Floating labels for test stations and generators. */
  labels: { text: string; x: number; y: number; z: number }[]
  lobby: { spawn: [number, number, number, number]; box: [number, number, number, number, number, number] } | null
  spectator: [number, number, number, number, number]
  killY: number
  build: BuildRules
  sky: string
  /** Present only in a parkour room. */
  parkour?: ParkourCourse
}

export interface MapDef extends MapMeta {
  world: World
  /** Two FFA spawn pads per colour, indexed by the player's seat on that colour. */
  upgradeSpawns?: Record<TeamId, [number, number, number, number][]>
}
