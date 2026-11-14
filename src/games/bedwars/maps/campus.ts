import { fromBase64, World } from '../../../engine/world'
import { AIR, BED, BLACKBOARD, BOOKSHELF, BRICK, CRACKED_STONE_BRICKS, DARK_PLANKS, DIRT, DOOR, FLOOD_WATER, GLASS, GOLD_BLOCK, GRASS, GRAVEL, LANTERN, LEAVES, PLANKS, QUARTZ, ROOF_TILES, STONE, STONE_BRICKS, WOOL, type TeamId } from '../blocks'
import { CAMPUS_MATERIALS, CAMPUS_RLE } from './campus-data'
import type { MapDef } from './types'

/** The school grid, translated to the game's own block palette. */
const materials: Record<NonNullable<(typeof CAMPUS_MATERIALS)[number]>, number> = {
  grass: GRASS, brick: BRICK, wood: PLANKS, glass: GLASS, concrete: QUARTZ,
  bed_red: BED.red, iron: STONE, water: FLOOD_WATER, stone: STONE, stone_cracked: CRACKED_STONE_BRICKS,
  stone_mossy: STONE_BRICKS, plaster: QUARTZ, plaster_dirty: QUARTZ, roof_slate: STONE,
  roof_worn: STONE, door: DOOR, pavers: STONE_BRICKS, pavers_wet: STONE,
  hedge: LEAVES, steel: STONE, steel_rusted: STONE, glass_green: GLASS, glass_dark: GLASS,
  carpet: WOOL.red, shelf: BOOKSHELF, court: WOOL.blue, turf: GRASS, gravel: GRAVEL,
  blackboard: BLACKBOARD, roof_terracotta: ROOF_TILES, brick_aged: BRICK,
  brick_mossy: BRICK, brick_gold: GOLD_BLOCK, bed_blue: BED.blue, dirt: DIRT,
  bush: LEAVES, grass_mown: GRASS, road_line: QUARTZ, concrete_dark: STONE,
  timber_dark: DARK_PLANKS, trim_white: QUARTZ, lamp: LANTERN,
}

const positions = [[22, 1, 8], [20, 5, 24], [14, 5, 45], [35, 5, 45], [51, 5, 41], [13, 5, 57], [26, 5, 46], [52, 5, 57]] as const
const teams: TeamId[] = ['red', 'blue', 'green', 'yellow']

export function createCampusMap(): MapDef {
  const world = new World(64, 32, 64)
  const data = fromBase64(CAMPUS_RLE)
  let offset = 0
  for (let i = 0; i < data.length; i += 3) {
    const count = data[i] | (data[i + 1] << 8)
    const name = CAMPUS_MATERIALS[data[i + 2]]
    if (name === undefined || count === 0 || offset + count > world.cells.length) throw new Error('Invalid campus data')
    world.cells.fill(name === null ? AIR : materials[name], offset, offset + count)
    offset += count
  }
  if (offset !== world.cells.length) throw new Error('Incomplete campus data')
  const pads = positions.map(([x, y, z]) => [x + 0.5, y, z + 0.5, Math.atan2(-(32 - x), -(32 - z))] as [number, number, number, number])
  const upgradeSpawns = {} as Record<TeamId, [number, number, number, number][]>
  const bases = teams.map((team, i) => {
    const spawn = pads[i * 2]
    upgradeSpawns[team] = [spawn, pads[i * 2 + 1]]
    return { team, spawn, bed: { x: -1, y: -1, z: -1, dx: 1, dz: 0 }, forge: [0, 0, 0] as [number, number, number], center: [spawn[0], spawn[1], spawn[2]] as [number, number, number] }
  })
  return {
    name: 'Wellington College', world, bases, upgradeSpawns, generators: [], npcs: [], labels: [],
    lobby: { spawn: pads[0], box: [-1, -1, -1, -1, -1, -1] },
    spectator: [32.5, 30, 4.5, 0, -0.45], killY: -5,
    build: { minY: 1, maxY: 31, protectedZones: [], allowMapBreaking: true }, sky: '#9fd0ff',
  }
}
