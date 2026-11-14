import { IDLE_INPUT, type MoveInput } from '../../../engine/physics'
import { FLOOD_WATER } from '../blocks'
import { TPS } from '../constants'
import type { Brain, Player, Room } from '../room'
import { findNavPath, type NavPoint } from './nav'

/** A small survival-only brain: flee marked impacts, seek higher ground in water and wander otherwise. */
export class SurvivalBot implements Brain {
  private goal: [number, number, number] | null = null
  private nextGoal = 0
  private nextPath = 0
  private path: NavPoint[] = []
  private wasInWater = false

  think(room: Room, player: Player): MoveInput {
    const idle = { ...IDLE_INPUT, yaw: player.yaw, pitch: player.pitch }
    if (!player.alive) return idle
    const world = room.world
    const water = world.get(Math.floor(player.x), Math.floor(player.y + 0.1), Math.floor(player.z)) === FLOOD_WATER
    const danger = room.survivalRocks.find((r) => r.at > room.tickCount - room.phaseStart && Math.hypot(player.x - r.x - 0.5, player.z - r.z - 0.5) < 5 && player.y >= r.y - 1.5)
    if (danger) {
      const dx = player.x - danger.x - 0.5, dz = player.z - danger.z - 0.5
      const yaw = Math.hypot(dx, dz) < 0.1 ? player.id * 1.7 : Math.atan2(-dx, -dz)
      this.nextGoal = 0
      return { ...idle, yaw, forward: 1, sprint: true, jump: water }
    }
    const pads = Object.values(room.map.upgradeSpawns ?? {}).flat()
    if (!pads.length) return idle
    const enteredWater = water && !this.wasInWater
    this.wasInWater = water
    if (!this.goal || room.tickCount >= this.nextGoal || enteredWater) {
      const choices = water ? pads.filter((p) => p[1] >= 5) : pads
      const choice = choices[Math.floor(room.random() * choices.length)]
      this.goal = [choice[0], choice[1], choice[2]]
      this.nextGoal = room.tickCount + 5 * TPS
      this.nextPath = 0
    }
    if (room.tickCount >= this.nextPath) {
      const point = (x: number, y: number, z: number): NavPoint => ({ x: Math.floor(x), y: Math.floor(y), z: Math.floor(z), dig: false })
      this.path = findNavPath(world, point(player.x, player.y + 0.05, player.z), point(...this.goal), { maxNodes: 2500 }) ?? []
      this.nextPath = room.tickCount + TPS * 2
    }
    while (this.path.length && Math.hypot(player.x - this.path[0].x - 0.5, player.z - this.path[0].z - 0.5) < 0.55) this.path.shift()
    const waypoint = this.path[0]
    if (!waypoint) return { ...idle, jump: water }
    const dx = waypoint.x + 0.5 - player.x, dz = waypoint.z + 0.5 - player.z
    return { ...idle, yaw: Math.atan2(-dx, -dz), forward: 1, sprint: water, jump: water || (player.onGround && waypoint.y > player.y + 0.2) }
  }
}
