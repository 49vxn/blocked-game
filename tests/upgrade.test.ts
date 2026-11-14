import { describe, expect, test } from 'bun:test'
import { AIR, BED, TEAMS, type TeamId } from '../src/games/bedwars/blocks'
import { MAX_HEALTH } from '../src/games/bedwars/constants'
import { addItem, countItem } from '../src/engine/inventory'
import { item } from '../src/games/bedwars/items'
import { createUpgradeMap } from '../src/games/bedwars/maps/upgrade'
import { MID, TOP } from '../src/games/bedwars/maps/plan'
import { upgradeRules } from '../src/games/bedwars/rules'
import { UpgradeBot } from '../src/games/bedwars/bots/upgrade'
import { Room } from '../src/games/bedwars/room'
import {
  UPGRADE_KILL_HEAL,
  UPGRADE_KILLS_TO_WIN,
  UPGRADE_MAX_PLAYERS,
  UPGRADE_MAX_TIER,
  UPGRADE_ROUND_TICKS,
  UPGRADE_SPAWN_PROTECTION_TICKS,
  UPGRADE_TEAM_SIZE,
  UPGRADE_TIERS,
  gearFor,
  nextUpgrade,
} from '../src/games/bedwars/upgrade'
import { bedwarsCodec } from '../src/games/bedwars/protocol'
import { FFA_DIFFICULTY_COOLDOWN, FFA_DIFFICULTY_INTERVAL, easierBotLevel, ffaBotLevel, harderBotLevel } from '../src/games/bedwars/sim/ffa'
import { fromWire, toWire } from '../src/engine/net/codec'
import { TestClient, ticks } from './room-helpers'

function upgrade(overrides: Parameters<typeof upgradeRules>[0] = {}) {
  const room = new Room({ rules: upgradeRules({ countdownTicks: 1, ...overrides }), seed: 4711 })
  const a = new TestClient(room, 'Ash')
  const b = new TestClient(room, 'Bea')
  ticks(room, 3)
  return { room, a, b }
}

function spawnBase(room: Room, team: TeamId) {
  return room.map.bases.find((b) => b.team === team)!
}

/** Places one block through the real message path, three cells in front of the base spawn. */
function placeBlock(room: Room, client: TestClient, block = 'wool') {
  const base = spawnBase(room, client.p.team!)
  const [sx, sy, sz, yaw] = base.spawn
  client.put(sx, sy, sz)
  client.p.protectedTicks = 0
  addItem(client.p.inventory, block, 8)
  const slot = client.p.inventory.findIndex((s) => s?.id === block)
  // Forward is (-sin yaw, -cos yaw). The spawn pads sit on the yaw right vector,
  // so stepping forward leaves their protected boxes on every island.
  const target = [Math.floor(sx - Math.sin(yaw) * 3), sy - 1, Math.floor(sz - Math.cos(yaw) * 3)] as const
  client.send({ t: 'place', x: target[0], y: target[1], z: target[2], face: [0, 1, 0], slot })
  const cell = [target[0], target[1] + 1, target[2]] as const
  expect(room.world.isPlaced(...cell)).toBe(true)
  return cell
}

describe('the tier ladder', () => {
  test('ten tiers, every gear id exists, and the healing tiers grant valid items', () => {
    expect(UPGRADE_TIERS.length).toBe(UPGRADE_MAX_TIER + 1)
    for (const [i, tier] of UPGRADE_TIERS.entries()) {
      expect(tier.tier).toBe(i)
      for (const id of [tier.sword, tier.pickaxe, tier.axe, tier.block]) expect(item(id)).toBeDefined()
      expect(tier.maxHealth).toBeGreaterThanOrEqual(MAX_HEALTH)
      if (i > 0) {
        expect(tier.maxHealth).toBeGreaterThanOrEqual(UPGRADE_TIERS[i - 1].maxHealth)
        expect(tier.speed).toBeGreaterThanOrEqual(UPGRADE_TIERS[i - 1].speed)
      }
    }
    expect(UPGRADE_TIERS.filter((t) => t.apples > 0).map((t) => t.tier)).toEqual([4, 8])
    expect(UPGRADE_TIERS.filter((t) => (t.heals?.length ?? 0) > 0).map((t) => t.tier)).toEqual([2, 5, 7, 8, 9])
    for (const tier of UPGRADE_TIERS) for (const heal of tier.heals ?? []) expect(item(heal.item)).toBeDefined()
    expect(gearFor(-4)).toBe(UPGRADE_TIERS[0])
    expect(gearFor(99)).toBe(UPGRADE_TIERS[UPGRADE_MAX_TIER])
    expect(nextUpgrade(UPGRADE_MAX_TIER)).toBeNull()
    expect(nextUpgrade(0)).toContain('Stone')
  })

  test('the rules describe an 8-seat free-for-all with no bots', () => {
    const rules = upgradeRules()
    expect(rules.mode).toBe('upgrade')
    expect(rules.bots).toBe(false)
    expect(rules.minPlayers).toBe(2)
    expect(rules.teams.length * rules.teamSize).toBe(UPGRADE_MAX_PLAYERS)
    expect(rules.teamSize).toBe(UPGRADE_TEAM_SIZE)
    expect(rules.timeline).toEqual([])
  })
})

describe('the arena', () => {
  const map = createUpgradeMap()
  const solid = (x: number, y: number, z: number) => map.world.isSolid(x, y, z)

  test('four colour islands, no beds, shops or generators', () => {
    expect(new Set(map.bases.map((b) => b.team))).toEqual(new Set(TEAMS))
    expect(map.generators).toEqual([])
    expect(map.npcs).toEqual([])
    for (const base of map.bases) expect(map.world.get(base.bed.x, base.bed.y, base.bed.z)).not.toBe(BED[base.team])
  })

  test('two standable, protected spawn pads per colour', () => {
    for (const team of TEAMS) {
      const pads = map.upgradeSpawns?.[team]
      expect(pads?.length).toBe(2)
      expect(new Set(pads!.map(([x, , z]) => `${x},${z}`)).size).toBe(2)
      for (const [x, y, z] of pads!) {
        const [cx, cz] = [Math.floor(x), Math.floor(z)]
        expect(solid(cx, y - 1, cz)).toBe(true)
        expect(map.world.get(cx, y, cz)).toBe(AIR)
        expect(map.world.get(cx, y + 1, cz)).toBe(AIR)
        expect(map.build.protectedZones.some((b) => x >= b[0] && x <= b[3] && y >= b[1] && y <= b[4] && z >= b[2] && z <= b[5])).toBe(true)
      }
    }
  })

  test('eight one-player islands: every pad is separate and every island reaches the middle', () => {
    const pads = TEAMS.flatMap((team) => map.upgradeSpawns?.[team] ?? [])
    expect(pads.length).toBe(8)
    for (let i = 0; i < pads.length; i++)
      for (let j = i + 1; j < pads.length; j++) expect(Math.hypot(pads[i][0] - pads[j][0], pads[i][2] - pads[j][2])).toBeGreaterThan(12)

    for (const [x, y, z] of pads) {
      const steps = Math.max(1, Math.ceil(Math.hypot(MID - x, MID - z)))
      for (let i = 0; i <= steps; i++) {
        const px = Math.round(x + ((MID - x) * i) / steps)
        const pz = Math.round(z + ((MID - z) * i) / steps)
        expect(solid(px, y - 1, pz)).toBe(true)
      }
    }
  })
})

describe('starting a round', () => {
  test('two humans start and receive the tier-0 kit and separate spawn pads', () => {
    const { room, a, b } = upgrade()
    expect(room.phase).toBe('playing')
    expect(a.p.alive && b.p.alive).toBe(true)
    expect(a.p.team).not.toBe(b.p.team)
    expect(a.p.tier).toBe(0)
    expect(a.p.maxHealth).toBe(MAX_HEALTH)
    expect(a.p.armor).toBe('leather')
    expect(countItem(a.p.inventory, 'wood_sword')).toBe(1)
    expect(countItem(a.p.inventory, 'wool')).toBe(UPGRADE_TIERS[0].blocks)
    expect(a.p.protectedTicks).toBeLessThanOrEqual(UPGRADE_SPAWN_PROTECTION_TICKS)
    expect(`${a.p.x},${a.p.z}`).not.toBe(`${b.p.x},${b.p.z}`)
  })
})

describe('kills, deaths and tiers', () => {
  test('reaching tier 2 grants a healing potion for FFA', () => {
    const { room, a, b } = upgrade()
    a.p.tier = 1
    b.p.protectedTicks = 0
    room.hurt(b.p, 100, 'melee', a.p)
    expect(a.p.tier).toBe(2)
    expect(countItem(a.p.inventory, 'healing_potion')).toBe(1)
  })

  test('a kill adds one tier, one score and heals six', () => {
    const { room, a, b } = upgrade()
    a.p.health = 10
    b.p.protectedTicks = 0
    room.hurt(b.p, 100, 'melee', a.p)
    expect(b.p.alive).toBe(false)
    expect(a.p.tier).toBe(1)
    expect(a.p.stats.kills).toBe(1)
    expect(a.p.health).toBe(10 + UPGRADE_KILL_HEAL)
    expect(countItem(a.p.inventory, 'stone_sword')).toBe(1)
    expect(countItem(a.p.inventory, 'wood_sword')).toBe(0)
    expect(countItem(a.p.inventory, 'wool')).toBe(UPGRADE_TIERS[1].blocks)
  })

  test('a kill tops up the new max health and grants the tier apple', () => {
    const { room, a, b } = upgrade()
    a.p.tier = 3
    a.p.maxHealth = gearFor(3).maxHealth
    a.p.health = 18
    b.p.protectedTicks = 0
    room.hurt(b.p, 100, 'melee', a.p)
    expect(a.p.tier).toBe(4)
    expect(a.p.maxHealth).toBe(gearFor(4).maxHealth)
    expect(a.p.health).toBe(a.p.maxHealth)
    expect(countItem(a.p.inventory, 'golden_apple')).toBe(1)
  })

  test('death resets the tier and removes only the dead player\'s blocks', () => {
    const { room, a, b } = upgrade()
    const mine = placeBlock(room, a)
    const theirs = placeBlock(room, b)
    const base = spawnBase(room, a.p.team!)
    const floor = [Math.floor(base.spawn[0]), base.spawn[1] - 1, Math.floor(base.spawn[2]) + 3] as const
    a.p.tier = 6
    a.p.maxHealth = gearFor(6).maxHealth
    room.die(a.p, 'void')
    expect(a.p.tier).toBe(0)
    expect(a.p.maxHealth).toBe(MAX_HEALTH)
    expect(room.world.isPlaced(...mine)).toBe(false)
    expect(room.world.isPlaced(...theirs)).toBe(true)
    expect(room.world.isSolid(...floor)).toBe(true)
    ticks(room, upgradeRules().respawnTicks)
    expect(a.p.alive).toBe(true)
    expect(a.p.tier).toBe(0)
    expect(a.p.maxHealth).toBe(MAX_HEALTH)
    expect(a.p.health).toBe(MAX_HEALTH)
    expect(a.p.armor).toBe('leather')
    expect(countItem(a.p.inventory, 'wood_sword')).toBe(1)
    expect(countItem(a.p.inventory, 'wool')).toBe(UPGRADE_TIERS[0].blocks)
  })

  test('breaking a block forgets its owner', () => {
    const { room, a, b } = upgrade()
    const cell = placeBlock(room, a)
    const [sx, sy, sz] = spawnBase(room, a.p.team!).spawn
    a.put(sx, sy, sz)
    a.send({ t: 'dig', target: [...cell] })
    ticks(room, 80)
    expect(room.world.get(...cell)).toBe(AIR)
    // Bea now owns that cell; Ash's death must leave it alone.
    b.put(sx, sy, sz)
    b.p.protectedTicks = 0
    addItem(b.p.inventory, 'clay', 4)
    const slot = b.p.inventory.findIndex((s) => s?.id === 'clay')
    b.send({ t: 'place', x: cell[0], y: cell[1] - 1, z: cell[2], face: [0, 1, 0], slot })
    expect(room.world.isPlaced(...cell)).toBe(true)
    room.die(a.p, 'void')
    expect(room.world.isPlaced(...cell)).toBe(true)
  })

  test('same-colour players still damage each other in the free-for-all', () => {
    const { a, b } = upgrade()
    b.p.team = a.p.team
    const x = 60.5
    const z = 60.5
    const y = 90
    a.put(x, y, z, Math.PI, 0)
    b.put(x, y, z + 2.2, Math.PI, 0)
    a.p.protectedTicks = 0
    b.p.protectedTicks = 0
    a.send({ t: 'attack', target: b.p.id })
    expect(b.p.health).toBeLessThan(b.p.maxHealth)
  })
})

describe('late join', () => {
  test('a third player joins an active round on an open colour instead of spectating', () => {
    const { room } = upgrade()
    const c = new TestClient(room, 'Cal')
    ticks(room, 1)
    expect(c.p.team).not.toBeNull()
    expect(c.p.alive).toBe(true)
    expect(c.p.tier).toBe(0)
    expect(c.p.eliminated).toBe(false)
    expect(c.events('system').some((line) => line.includes('Joined Upgrade Rush'))).toBe(true)
  })
})

describe('the server room', () => {
  test('the retained Upgrade Rush room can use its map directly', () => {
    const room = new Room({ rules: upgradeRules(), createMap: createUpgradeMap })
    expect(room.rules.mode).toBe('upgrade')
    expect(room.map.name).toBe('Upgrade Rush')
  })
})

describe('the round clock', () => {
  test('25 kills ends the round and names the leader', () => {
    const { room, a, b } = upgrade()
    a.p.stats.kills = UPGRADE_KILLS_TO_WIN - 1
    a.p.tier = 8
    a.p.maxHealth = gearFor(8).maxHealth
    b.p.protectedTicks = 0
    room.hurt(b.p, 100, 'melee', a.p)
    expect(room.phase).toBe('ended')
    expect(room.gameView().winnerName).toBe('Ash')
    const summary = a.last('summary')!
    expect(summary).toMatchObject({ mode: 'upgrade', winnerName: 'Ash' })
    expect(summary.players[0]).toMatchObject({ name: 'Ash', kills: UPGRADE_KILLS_TO_WIN, tier: UPGRADE_MAX_TIER })
    ticks(room, 1)
    const tick = a.last('tick')!
    const wire = toWire(bedwarsCodec.encodeServer, tick)
    expect(fromWire(bedwarsCodec.decodeServer, wire)).toEqual(JSON.parse(JSON.stringify(tick)))
  })

  test('ten minutes ends the round even with no kills', () => {
    const { room, a } = upgrade()
    room.phaseStart = room.tickCount - UPGRADE_ROUND_TICKS
    ticks(room, 1)
    expect(room.phase).toBe('ended')
    expect(a.last('summary')).toMatchObject({ mode: 'upgrade' })
  })

  test('the rematch reset clears tiers, stats, teams and owned blocks', () => {
    const { room, a, b } = upgrade()
    const mine = placeBlock(room, a)
    a.p.stats.kills = UPGRADE_KILLS_TO_WIN - 1
    b.p.protectedTicks = 0
    room.hurt(b.p, 100, 'melee', a.p)
    expect(room.phase).toBe('ended')
    expect(a.p.tier).toBe(1)
    // Exactly endTicks lands on the reset tick; one more would start the countdown.
    ticks(room, upgradeRules().endTicks)
    expect(room.phase).toBe('waiting')
    expect(a.p.tier).toBe(0)
    expect(a.p.maxHealth).toBe(MAX_HEALTH)
    expect(a.p.team).toBeNull()
    expect(a.p.stats).toEqual({ kills: 0, finals: 0, beds: 0, deaths: 0 })
    expect(room.world.isPlaced(...mine)).toBe(false)
  })
})

describe('FFA difficulty director', () => {
  test('eases a human who is dying more than killing, then clamps at easy', () => {
    const death = { kills: 0, deaths: 4, tier: 0 }
    expect(ffaBotLevel({ current: 'normal', humans: [death], tick: FFA_DIFFICULTY_COOLDOWN, lastChangeTick: 0 })).toBe('easy')
    expect(ffaBotLevel({ current: 'easy', humans: [death], tick: FFA_DIFFICULTY_COOLDOWN, lastChangeTick: 0 })).toBe('easy')
    expect(easierBotLevel('easy')).toBe('easy')
  })

  test('hardens for a dominant human, then clamps at expert', () => {
    const dominant = { kills: 6, deaths: 0, tier: 6 }
    expect(ffaBotLevel({ current: 'normal', humans: [dominant], tick: FFA_DIFFICULTY_COOLDOWN, lastChangeTick: 0 })).toBe('hard')
    expect(ffaBotLevel({ current: 'expert', humans: [dominant], tick: FFA_DIFFICULTY_COOLDOWN, lastChangeTick: 0 })).toBe('expert')
    expect(harderBotLevel('expert')).toBe('expert')
  })

  test('does not flip on one death or inside the cooldown, and ignores bot-only rooms', () => {
    expect(ffaBotLevel({ current: 'normal', humans: [{ kills: 1, deaths: 2, tier: 1 }], tick: 500, lastChangeTick: 0 })).toBe('normal')
    expect(ffaBotLevel({ current: 'normal', humans: [{ kills: 0, deaths: 5, tier: 0 }], tick: FFA_DIFFICULTY_COOLDOWN - 1, lastChangeTick: 0 })).toBe('normal')
    expect(ffaBotLevel({ current: 'normal', humans: [], tick: 500, lastChangeTick: 0 })).toBe('normal')
  })

  test('the room samples at five seconds and changes after the cooldown', () => {
    const room = new Room({ rules: upgradeRules({ bots: false, minPlayers: 1, countdownTicks: 1 }), seed: 4711 })
    const a = new TestClient(room, 'Ash')
    ticks(room, 3)
    expect(room.phase).toBe('playing')
    a.p.stats.kills = 0
    a.p.stats.deaths = 4
    a.p.tier = 0
    ticks(room, FFA_DIFFICULTY_INTERVAL + 1)
    expect(room.ffaBotLevel).toBe('easy')
  })
})

describe('FFA map connections and bots', () => {
  test('every island is close to the middle and has a continuous bridge', () => {
    const map = createUpgradeMap()
    const solid = (x: number, y: number, z: number) => map.world.isSolid(x, y, z)
    for (const base of map.bases) {
      const [cx, , cz] = base.center
      expect(Math.hypot(cx - MID, cz - MID)).toBeLessThanOrEqual(31)
      const dx = Math.sign(MID - Math.floor(cx))
      const dz = Math.sign(MID - Math.floor(cz))
      const y = TOP - 1
      if (dx !== 0) {
        const from = Math.floor(cx + dx * 8)
        const to = Math.round(MID - dx * 13)
        for (let x = Math.min(from, to); x <= Math.max(from, to); x++) expect(solid(x, y, Math.floor(cz))).toBe(true)
      } else {
        const from = Math.floor(cz + dz * 8)
        const to = Math.round(MID - dz * 13)
        for (let z = Math.min(from, to); z <= Math.max(from, to); z++) expect(solid(Math.floor(cx), y, z)).toBe(true)
      }
    }
  })

  test('the retained FFA room fills all eight seats with bots and they move', () => {
    const room = new Room({ rules: upgradeRules({ bots: true, minPlayers: 1 }), createMap: createUpgradeMap })
    room.createBot = () => new UpgradeBot()
    const a = new TestClient(room, 'Ash')
    ticks(room, 10 * 20 + 2)
    expect(room.phase).toBe('playing')
    expect(room.players.size).toBe(8)
    expect(a.p.alive).toBe(true)
    const bots = [...room.players.values()].filter((p) => p.brain)
    expect(bots.length).toBe(7)
    for (const team of TEAMS) {
      const slots = bots.filter((b) => b.team === team).map((b) => b.spawnSlot)
      expect(new Set(slots).size).toBe(slots.length)
    }
    const before = new Map(bots.map((b) => [b.id, `${b.x.toFixed(2)},${b.z.toFixed(2)}`]))
    ticks(room, 40)
    expect(bots.some((b) => `${b.x.toFixed(2)},${b.z.toFixed(2)}` !== before.get(b.id))).toBe(true)
    // Eight separate islands must still meet at the middle: the old straight-
    // at-target brain stopped at the first void edge and produced 0 kills.
    ticks(room, 30 * 20)
    const kills = [...room.players.values()].reduce((n, p) => n + p.stats.kills, 0)
    expect(kills).toBeGreaterThan(0)
  })
})
