import { connectLocal, connectOnline } from '../../../engine/net/client'
import { connectSites } from '../../../sites/client'
import { BRAND } from '../constants'
import { bedwarsCodec, type ClientMessage, type ServerMessage } from '../protocol'
import { createBedwarsRoom, type RoomParams } from '../server'
import { Game } from './game'
import { installBrowserGuards } from './browser-guards'
import { loadSettings } from './settings'
import { openSettings } from './settings-ui'
import { openWardrobe } from './wardrobe'
import { bestRoom, cleanRoomName, fetchRooms, modeLabel, openSeats, randomRoomName, statusLabel, type RoomInfo, type RoomList } from './rooms'
import '@fontsource/pixelify-sans/400.css'
import '@fontsource/pixelify-sans/700.css'
import { drawTile } from '../../../engine/render/textures'
import './styles.css'

type JoinOptions = RoomParams & { name: string; hosting?: boolean }

const params = new URLSearchParams(location.search)
const app = document.getElementById('app')!
document.title = BRAND
// Before anything can render: no browser right-click menu, no autoscroll from a
// middle click, and no save/print/find panels over the game.
installBrowserGuards()

function webglAvailable(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
}

/** The menu's tiled background: the game's own dirt texture, drawn in code. */
function dirtTile(): string {
  const c = document.createElement('canvas')
  c.width = c.height = 16
  c.getContext('2d')!.putImageData(drawTile({ color: '#7a5a3a', pattern: 'noise', face: 'side' }, 7), 0, 0)
  return c.toDataURL()
}

function savedName(): string {
  try {
    return localStorage.getItem('name') ?? ''
  } catch {
    return ''
  }
}

function start(options: JoinOptions, offline: boolean) {
  try {
    localStorage.setItem('name', options.name)
  } catch {}
  // Put the join in the address, so reloading (or "Try again") rejoins the same room.
  const query = new URLSearchParams({ play: '1', name: options.name, world: options.world, room: options.room })
  if ((options.teamSize ?? 1) > 1) query.set('teamSize', String(options.teamSize))
  if (options.fast) query.set('fast', '1')
  if (options.battle) query.set('battle', '1')
  if (!__SITES__ && options.private) query.set('private', '1')
  if (offline) query.set('offline', '1')
  if (__SITES__ && options.hosting && !offline) query.set('host', '1')
  history.replaceState(null, '', `?${query}`)
  app.innerHTML = ''
  if (!webglAvailable()) {
    app.innerHTML = `<div class="menu" style="background-image:url(${dirtTile()})"><div class="menu-wrap"><div class="menu-card"><h2>3D graphics are not available</h2><p class="lead">This browser or computer has WebGL 2 turned off. Turn on hardware acceleration in your browser settings, update your graphics drivers, or use the desktop app.</p><button class="btn" onclick="location.href=location.pathname">Back to menu</button></div></div></div>`
    return
  }
  const connection = offline
    ? connectLocal<ClientMessage, ServerMessage>(createBedwarsRoom(options, true), options.name, bedwarsCodec)
    : __SITES__ ? connectSites({ ...options, hosting: !!options.hosting })
    : connectOnline<ClientMessage, ServerMessage>(
        { name: options.name, world: options.world, room: options.room, ...(options.teamSize && options.teamSize > 1 ? { teamSize: String(options.teamSize) } : {}), ...(options.fast ? { fast: '1' } : {}), ...(options.private ? { private: '1' } : {}), ...(options.battle ? { battle: '1' } : {}) },
        bedwarsCodec,
      )
  const game = new Game(app, connection, loadSettings(), { offline, world: options.world })
  game.applySettings(game.settings)
  ;(window as unknown as { game: Game }).game = game
  // The click that started the match is a user gesture: enter the required
  // browser full screen now. A refusal leaves the pause card in charge.
  game.lock(true)
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** "5 playing online now", for the menu, or nothing when there is no server to ask. */
function onlineLine(list: RoomList | null): string {
  if (!list) return ''
  const n = list.online
  return `<span class="dot${n ? ' on' : ''}"></span>${n === 0 ? 'Nobody online yet: start a room and invite a friend' : `${n} ${n === 1 ? 'person' : 'people'} playing online now`}`
}

/** Refreshes `update` every few seconds for as long as `anchor` stays on the page. */
function poll(anchor: Element, update: (list: RoomList | null) => void) {
  if (__SITES__) return
  const run = async () => {
    if (!anchor.isConnected) return
    update(await fetchRooms())
    if (anchor.isConnected) setTimeout(run, 3000)
  }
  void run()
}

/** Start screen: name, modes and settings; Play online opens the room list. URL parameters skip it (?world=sandbox&offline=1&play=1). */
function menu() {
  app.innerHTML = `
    <div class="menu" style="background-image:url(${dirtTile()})">
      <div class="menu-wrap">
      <h1 class="menu-title">${BRAND}</h1>
      <p class="menu-tagline">The school falls down. Last one standing wins.</p>
      <div class="menu-card">
        <label class="field"><span>Name</span><input id="name" maxlength="16" placeholder="Your name" value="${esc(savedName())}"></label>
        <p class="online-line" id="online"></p>
        <div class="menu-buttons">
          <button class="btn primary" data-go="survival">School Survival</button>
          <button class="btn" data-go="bedwars">Bed Wars</button>
          <button class="btn" data-go="online">Play online</button>
          <div class="menu-pair"><button class="btn" data-go="wardrobe">Wardrobe</button><button class="btn" data-go="settings">Settings</button></div>
        </div>
        <p class="menu-foot">Two games, one school. Survival drops you into Wellington College while it tears itself apart. Bed Wars is the classic four-team fight. Both run offline against bots or online with friends on this network.</p>
      </div>
      </div>
    </div>`
  const card = app.querySelector('.menu-card')!
  poll(card, (list) => {
    const line = document.getElementById('online')
    if (line) line.innerHTML = onlineLine(list)
    // No server behind this page (a static build): do not offer a door that
    // only leads to "could not reach the server".
    if (!list) {
      card.querySelector('[data-go="online"]')?.remove()
      const foot = card.querySelector('.menu-foot')
      if (foot) foot.textContent = 'Two games, one school. Survival drops you into Wellington College while it tears itself apart. Bed Wars is the classic four-team fight. Both run here against bots.'
    }
  })
  app.querySelectorAll<HTMLButtonElement>('[data-go]').forEach((b) =>
    b.addEventListener('click', () => {
      const go = b.dataset.go
      if (go === 'settings') {
        openSettings(app, loadSettings(), () => {}, () => {})
        return
      }
      if (go === 'wardrobe') {
        openWardrobe(app, null, () => {}, () => {})
        return
      }
      const name = playerName()
      if (go === 'online') {
        saveName(name)
        online()
        return
      }
      if (go === 'survival') {
        saveName(name)
        start({ name, world: 'survival', room: 'survival', fast: false, teamSize: 1 }, true)
        return
      }
      // Bed Wars solo: four teams, bots fill the rest.
      saveName(name)
      start({ name, world: 'arena', room: 'bedwars', teamSize: 1, fast: false }, true)
    }),
  )
}

function playerName(): string {
  const input = document.getElementById('name') as HTMLInputElement | null
  return input?.value.trim() || savedName() || 'Player'
}

function saveName(name: string) {
  try {
    localStorage.setItem('name', name)
  } catch {}
}

/**
 * The online screen: who is on, Quick play, every public room with its arena,
 * state and open seats, and a form to make a room (public or invite-only).
 * Opened from the menu, or straight away from an invite link (?room=name).
 */
function online(invite?: { room: string; private: boolean; fast: boolean; teamSize?: number; world?: RoomInfo['world'] }) {
  if (__SITES__) return sitesOnline(invite)
  const card = app.querySelector('.menu-card')!
  const fresh = randomRoomName()
  card.innerHTML = `
    <div class="online-head"><h2>Play online</h2><button class="btn ghost" data-act="back">Back</button></div>
    ${invite ? `<div class="invite"><p>You were invited to room <b>${esc(invite.room)}</b>${invite.world === 'upgrade' ? ' (Upgrade Rush)' : ''}${invite.private ? ' (invite only)' : ''}.</p><button class="btn primary" data-act="invite">Join ${esc(invite.room)}</button></div>` : ''}
    <label class="field"><span>Your name</span><input id="name" maxlength="16" placeholder="Your name" value="${esc(savedName())}"></label>
    <p class="online-line" id="online"></p>
    <button class="btn${invite ? '' : ' primary'} wide" data-act="quick">Quick play</button>
    <p class="label">Rooms</p>
    <div class="room-list" id="rooms"><p class="muted small">Looking for rooms…</p></div>
    <p class="label">Make a room</p>
    <label class="field"><span>Mode</span><select id="world"><option value="survival"${!invite?.world || invite.world === 'survival' ? ' selected' : ''}>School Survival</option><option value="arena"${invite?.world === 'arena' ? ' selected' : ''}>Bed Wars</option></select></label>
    <label class="field"><span>Team size</span><select id="teamSize"><option value="1">Solo · 1 per team</option><option value="2">Duos · 2 per team</option><option value="3">Trios · 3 per team</option><option value="4">Squads · 4 per team</option></select></label>
    <div class="make-room">
      <input id="room" maxlength="32" value="${fresh}" aria-label="Room name">
      <button class="btn" data-act="make">Create</button>
    </div>
    <label class="field check"><input id="private" type="checkbox"> <span>Invite only: keep it off this list, and share the link instead</span></label>
    <label class="field check"><input id="fast" type="checkbox"> <span>Fast round: the timeline runs ten times quicker</span></label>
    <p class="muted small">Typing the name of a room that exists joins it. Rounds start when two people are in; the host can start sooner with bots.</p>`
  let rooms: RoomInfo[] = []
  const join = (room: string, options: { private?: boolean; fast?: boolean; world?: 'arena' | 'sandbox' | 'parkour' | 'upgrade' | 'survival'; teamSize?: number } = {}) => {
    const name = playerName()
    saveName(name)
    start({ name, world: options.world ?? 'arena', room, fast: !!options.fast, private: !!options.private, teamSize: options.teamSize }, false)
  }
  const list = card.querySelector('#rooms')!
  const render = (data: RoomList | null) => {
    const line = card.querySelector('#online')
    if (line) line.innerHTML = data ? onlineLine(data) : 'Could not reach the server. Solo and the sandbox still work.'
    rooms = data?.rooms ?? []
    list.innerHTML = rooms.length
      ? rooms
          .map((r, i) => {
            const seats = openSeats(r)
            return `<div class="room-row">
              <div class="room-name"><b>${esc(r.room)}</b><span class="muted small">${esc(modeLabel(r))}${r.world === 'arena' ? ` · ${esc(r.map)}` : ''}${r.fast ? ' · fast' : ''}</span></div>
              <div class="room-state"><span class="phase ${r.phase}">${statusLabel(r)}</span><span class="muted small">${r.players} ${r.players === 1 ? 'person' : 'people'}${r.bots ? `, ${r.bots} ${r.bots === 1 ? 'bot' : 'bots'}` : ''}</span></div>
              <button class="btn${seats ? '' : ' ghost'}" data-room="${i}">${seats ? 'Join' : 'Watch'}</button>
            </div>`
          })
          .join('')
      : '<p class="muted small">No public rooms right now. Make one below, or press Quick play to open the main room.</p>'
    list.querySelectorAll<HTMLButtonElement>('[data-room]').forEach((b) =>
      b.addEventListener('click', () => {
        const r = rooms[Number(b.dataset.room)]
        join(r.room, { fast: r.fast, world: r.world, teamSize: r.teamSize })
      }),
    )
  }
  poll(list, render)
  card.querySelector('[data-act="back"]')!.addEventListener('click', () => menu())
  card.querySelector('[data-act="invite"]')?.addEventListener('click', () => join(invite!.room, invite))
  card.querySelector('[data-act="quick"]')!.addEventListener('click', () => {
    const best = bestRoom(rooms)
    join(best?.room ?? 'main', { fast: best?.fast })
  })
  card.querySelector('[data-act="make"]')!.addEventListener('click', () => {
    const room = cleanRoomName((card.querySelector('#room') as HTMLInputElement).value) || fresh
    const world = (card.querySelector('#world') as HTMLSelectElement).value as 'arena' | 'survival'
    const teamSize = Number((card.querySelector('#teamSize') as HTMLSelectElement).value)
    join(room, { private: (card.querySelector('#private') as HTMLInputElement).checked, fast: (card.querySelector('#fast') as HTMLInputElement).checked, world, teamSize: world === 'arena' ? teamSize : 1 })
  })
}

/** Sites has no global room directory. Codes select casual, browser-hosted rooms. */
function sitesOnline(invite?: { room: string; fast: boolean; world?: RoomInfo['world'] }) {
  const card = app.querySelector('.menu-card')!
  card.innerHTML = `
    <div class="online-head"><h2>Play with friends</h2><button class="btn ghost" data-act="back">Back</button></div>
    <p class="lead">Up to four players. The host runs the match; keep the host's tab open and visible. Closing it ends the match.</p>
    <label class="field"><span>Your name</span><input id="name" maxlength="16" value="${esc(savedName())}" placeholder="Your name"></label>
    <label class="field"><span>Room code</span><input id="room" maxlength="32" value="${esc(invite?.room ?? randomRoomName())}"></label>
    <label class="field"><span>Mode</span><select id="world"><option value="survival"${invite?.world === 'survival' || !invite?.world ? ' selected' : ''}>School Survival</option><option value="arena"${invite?.world === 'arena' ? ' selected' : ''}>Bed Wars</option></select></label>
    <label class="field"><span>Team size</span><select id="teamSize"><option value="1">Solo</option><option value="2">Duos</option><option value="3">Trios</option><option value="4">Squads</option></select></label>
    <label class="field check"><input id="fast" type="checkbox" ${invite?.fast ? 'checked' : ''}><span>Fast round (everyone uses the same setting)</span></label>
    <div class="menu-pair"><button class="btn primary" data-act="host">Host a room</button><button class="btn" data-act="join">Join room</button></div>
    <p class="muted small">Share the invite link from the in-game lobby. Anyone with the code can join — no account needed. The host is trusted with the match state; there are no persistent rankings.</p>`
  card.querySelector('[data-act="back"]')!.addEventListener('click', menu)
  for (const action of ['host', 'join']) card.querySelector(`[data-act="${action}"]`)!.addEventListener('click', () => {
    const room = cleanRoomName((card.querySelector('#room') as HTMLInputElement).value)
    if (!room) return (card.querySelector('#room') as HTMLInputElement).focus()
    const name = playerName()
    saveName(name)
    const world = (card.querySelector('#world') as HTMLSelectElement).value as 'arena' | 'survival'
    const teamSize = Number((card.querySelector('#teamSize') as HTMLSelectElement).value)
    start({ name, room, world, teamSize: world === 'arena' ? teamSize : 1, fast: (card.querySelector('#fast') as HTMLInputElement).checked, hosting: action === 'host' }, false)
  })
}

if (params.get('play') === '1') {
  start(
    {
      name: params.get('name') ?? (savedName() || 'Player'),
      world: params.get('world') === 'arena' ? 'arena' : 'survival',
      room: params.get('room') ?? 'main',
      teamSize: Math.max(1, Math.min(4, Math.floor(Number(params.get('teamSize')) || 1))),
      fast: params.get('fast') === '1',
      private: params.get('private') === '1',
      battle: params.get('battle') === '1',
      hosting: params.get('host') === '1',
    },
    params.get('offline') === '1',
  )
} else {
  menu()
  // An invite link (?room=name) opens the room list with that room ready to join.
  const invited = params.get('room')
  if (invited) online({ room: cleanRoomName(invited) || 'main', private: params.get('private') === '1', fast: params.get('fast') === '1', world: params.get('world') === 'arena' ? 'arena' : 'survival', teamSize: Math.max(1, Math.min(4, Math.floor(Number(params.get('teamSize')) || 1))) })
}
