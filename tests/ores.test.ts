import { describe, expect, test } from 'bun:test'
import { World } from '../src/engine/world'
import { breakTicks, checkBreakable, type BuildRules } from '../src/engine/building'
import { countItem } from '../src/engine/inventory'
import { blockDef, DIAMOND_ORE, GOLD_ORE, IRON_ORE, oreResource, STONE, TEAMS } from '../src/games/bedwars/blocks'
import { item } from '../src/games/bedwars/items'
import { ARENAS, createArena } from '../src/games/bedwars/maps/arena'
import { duel } from './room-helpers'

const rules: BuildRules = { minY: 0, maxY: 20, protectedZones: [] }

describe('ore blocks', () => {
  test('each ore names its resource, amount and pickaxe tier', () => {
    expect(oreResource(IRON_ORE)).toBe('iron')
    expect(oreResource(GOLD_ORE)).toBe('gold')
    expect(oreResource(DIAMOND_ORE)).toBe('diamond')
    expect(blockDef(IRON_ORE).meta.oreAmount).toBe(1)
    expect(blockDef(IRON_ORE).meta.oreTier).toBe(0)
    expect(blockDef(GOLD_ORE).meta.oreTier).toBe(1)
    expect(blockDef(DIAMOND_ORE).meta.oreTier).toBe(2)
    expect(oreResource(STONE)).toBeUndefined()
  })

  test('wood mines iron, iron mines gold, diamond mines diamond; wrong tools never do', () => {
    expect(breakTicks(IRON_ORE, item('wood_pickaxe'))).toBeLessThan(Infinity)
    expect(breakTicks(GOLD_ORE, item('wood_pickaxe'))).toBe(Infinity)
    expect(breakTicks(DIAMOND_ORE, item('iron_pickaxe'))).toBe(Infinity)
    expect(breakTicks(GOLD_ORE, item('iron_pickaxe'))).toBeLessThan(Infinity)
    expect(breakTicks(DIAMOND_ORE, item('diamond_pickaxe'))).toBeLessThan(Infinity)
    expect(breakTicks(IRON_ORE, item('wood_sword'))).toBe(Infinity)
    expect(breakTicks(IRON_ORE, undefined)).toBe(Infinity)
  })

  test('only ore map blocks are breakable; ordinary map blocks still refuse', () => {
    const w = new World(8, 8, 8)
    w.set(1, 1, 1, IRON_ORE)
    w.set(2, 1, 1, STONE)
    expect(checkBreakable(w, rules, 1, 1, 1)).toBeNull()
    expect(checkBreakable(w, rules, 2, 1, 1)).toBe('map')
  })

  test('every arena places at least one exposed ore', () => {
    for (const layout of ARENAS) {
      const map = createArena(TEAMS, layout)
      let count = 0
      for (let x = 0; x < map.world.sx; x++)
        for (let y = 0; y < map.world.sy; y++)
          for (let z = 0; z < map.world.sz; z++) if (oreResource(map.world.get(x, y, z))) count++
      expect(count).toBeGreaterThan(0)
    }
  })

  test('breaking an ore drops its resource into the breaker inventory', () => {
    const { room, a } = duel()
    const x = Math.floor(a.p.x)
    const y = Math.floor(a.p.y)
    const z = Math.floor(a.p.z)
    room.world.set(x, y, z, IRON_ORE)
    room.breakBlock(a.p, x, y, z)
    expect(countItem(a.p.inventory, 'iron')).toBeGreaterThanOrEqual(1)
    expect(room.world.get(x, y, z)).toBe(0)
  })
})
