import type { RoomFactory } from '../../engine/net/room'
import { installBots } from './bots'
import { SurvivalBot } from './bots/survival'
import { bedwarsCodec } from './protocol'
import { Room } from './room'
import { arenaRules, scaleTimeline, survivalRules, TIMELINE } from './rules'
import { createCampusMap } from './maps/campus'

export interface RoomParams {
  world: 'arena' | 'sandbox' | 'parkour' | 'upgrade' | 'survival'
  room: string
  fast: boolean
  /** Players per team in an arena: 1 solo, 2 duos, 3 trios, 4 squads. */
  teamSize?: number
  /** Kept off the public room list; friends join with the invite link. */
  private?: boolean
  /** 4v4v4v4 all-bot arena; the human joins as a spectator. */
  battle?: boolean
  /** A named parkour course: anything but `classic` builds Spiral Tower. */
  map?: string
}

function supportedWorld(world: unknown): boolean {
  return world === 'arena' || world === 'survival'
}

export function roomParams(params: URLSearchParams): RoomParams {
  const worlds = params.getAll('world')
  const world = worlds.length === 0 ? 'arena' : worlds[0]
  if (worlds.length > 1 || !supportedWorld(world)) throw new Error('Unsupported game mode')
  return {
    world: world === 'survival' ? 'survival' : 'arena',
    room: (params.get('room') ?? 'main').replace(/[^a-z0-9-]/gi, '').slice(0, 32) || 'main',
    fast: params.get('fast') === '1',
    teamSize: Math.max(1, Math.min(4, Math.floor(Number(params.get('teamSize')) || 1))),
    private: params.get('private') === '1',
    battle: params.get('battle') === '1',
    map: (params.get('map') ?? '').replace(/[^a-z0-9-]/gi, '').toLowerCase().slice(0, 24) || undefined,
  }
}

/** A bed-wars room with bots installed; `offline` rooms start as soon as their one player arrives and allow cheats. */
export function createBedwarsRoom(p: RoomParams, offline = false): Room {
  if (!supportedWorld(p.world)) throw new Error('Unsupported game mode')
  const timeline = p.fast ? scaleTimeline(TIMELINE, 10) : TIMELINE
  const battle = !!p.battle && p.world === 'arena'
  // Solo is local to this page, so its command cheats (including /killaura) are safe to enable.
  const solo = battle ? { minPlayers: 1, countdownTicks: 0 } : offline ? { minPlayers: 1, countdownTicks: 5 * 20, cheats: true } : p.fast ? { countdownTicks: 60 } : {}
  const teamSize = battle ? 4 : p.teamSize ?? 1
  const rules = p.world === 'survival' ? survivalRules() : arenaRules({ timeline, teamSize, ...solo })
  const createMap = p.world === 'survival' ? createCampusMap : undefined
  const room = new Room({ rules, seed: Math.floor(Math.random() * 1e6), botBattle: battle, createMap })
  room.params = p
  installBots(room)
  if (rules.mode === 'survival') room.createBot = () => new SurvivalBot()
  if (battle) room.startBotBattle()
  return room
}

/** Rooms for the engine's host: one per world, name and speed. */
export const bedwarsRooms: RoomFactory = {
  validate(params) {
    const worlds = params.getAll('world')
    return worlds.length === 0 || (worlds.length === 1 && supportedWorld(worlds[0]))
  },
  key(params) {
    const p = roomParams(params)
    const mode = p.world === 'arena' ? `:t${p.teamSize ?? 1}` : ''
    return `${p.world}:${p.room}:${p.fast ? 'fast' : 'normal'}${mode}${p.map ? `:m${p.map}` : ''}${p.private ? ':private' : ''}${p.battle ? ':battle' : ''}`
  },
  create(params) {
    return createBedwarsRoom(roomParams(params))
  },
  codec: bedwarsCodec,
}
