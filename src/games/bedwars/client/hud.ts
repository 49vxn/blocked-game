import { TEAM_COLORS, TEAM_NAMES, TEAMS, type TeamId } from '../blocks'
import { BRAND, MAX_HEALTH, TPS } from '../constants'
import { OFFERS, TOOL_TIER_COST, UPGRADES, type Offer, type OfferCategory } from '../shop'
import { countItem, HOTBAR, INVENTORY_SIZE, STORAGE_SIZE, type Slot } from '../../../engine/inventory'
import { ARMOR_ORDER, AXES, item, PICKAXES } from '../items'
import type { ServerMessage } from '../protocol'
import { BOT_LEVELS, type BotLevel } from '../rules'
import type { Game } from './game'
import { keyLabel, type Action } from './settings'
import { MOVEMENT_JUMP, MOVEMENT_PRESETS } from '../../../engine/movement'
import { openSettings } from './settings-ui'
import { openWardrobe } from './wardrobe'
import { inviteLink } from './rooms'
import { formatParkourTime } from '../sim/parkour'
import { gearFor, UPGRADE_KILLS_TO_WIN, UPGRADE_MAX_TIER, UPGRADE_ROUND_TICKS } from '../upgrade'
import { playWindow } from './play-window'

const RESOURCE_COLORS: Record<string, string> = { iron: '#e8e8e8', gold: '#f2cf4a', diamond: '#5fe0d8', emerald: '#38d36b' }

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (className) e.className = className
  if (text) e.textContent = text
  return e
}

function clock(ticks: number): string {
  const s = Math.max(0, Math.ceil(ticks / TPS))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function loadParkourBest(): number {
  try {
    const n = Number(localStorage.getItem('parkour-best'))
    return Number.isFinite(n) && n > 0 ? n : 0
  } catch {
    return 0
  }
}

const HEART = (fill: 'full' | 'half' | 'empty') =>
  `<svg viewBox="0 0 9 9" class="heart ${fill}"><path d="M1 1h2v1h1v1h1V2h1V1h2v1h1v3H8v1H7v1H6v1H5v1H4V8H3V7H2V6H1V5H0V2h1z"/>${fill === 'half' ? '<path class="half-cover" d="M5 2h1V1h2v1h1v3H8v1H7v1H6v1H5z"/>' : ''}</svg>`

/** All screen-space UI, as plain DOM over the canvas. */
export class Hud {
  private root = el('div', 'hud')
  private crosshair = el('div', 'crosshair')
  private charge = el('div', 'charge')
  private marker = el('div', 'hitmarker')
  private direction = el('div', 'damage-dir')
  private fps = el('div', 'fps')
  private hotbar = el('div', 'hotbar')
  private hearts = el('div', 'hearts')
  private armor = el('div', 'armor')
  private sidebar = el('div', 'sidebar panel')
  private feed = el('div', 'feed')
  private chatLog = el('div', 'chat-log')
  private chatInput = el('input', 'chat-input')
  private title = el('div', 'title')
  private center = el('div', 'center-note')
  private lobby = el('div', 'lobby panel')
  private scoreboard = el('div', 'scoreboard panel')
  private debug = el('pre', 'debug')
  private modal = el('div', 'modal')
  private help = el('div', 'help')
  private toasts = el('div', 'toasts')
  private vignette = el('div', 'vignette')
  private error = el('div', 'error-screen')
  private summary = el('div', 'summary panel')
  private loading = el('div', 'loading show')
  private backdrop = el('div', 'backdrop')
  private movementBadge = el('div', 'movement-badge hidden')
  private parkourBadge = el('div', 'parkour-badge hidden')
  private parkourBest = loadParkourBest()
  private slots: HTMLDivElement[] = []
  private titleUntil = 0
  private debugOn = false
  private modalKind: 'shop' | 'upgrades' | 'inventory' | 'storage' | null = null
  private storageKind: 'ender' | 'team' = 'ender'
  private storageSlots: (Slot | null)[] = []
  private shopTab: OfferCategory = 'blocks'
  private pickedSlot: number | null = null
  private lastRender = 0
  private lastFps = 0
  chatOpen = false

  constructor(
    container: HTMLElement,
    private readonly game: Game,
  ) {
    for (let i = 0; i < HOTBAR; i++) {
      const s = el('div', 'slot')
      this.slots.push(s)
      this.hotbar.append(s)
    }
    const bottom = el('div', 'bottom')
    const stats = el('div', 'stats')
    stats.append(this.hearts, this.armor)
    bottom.append(stats, this.hotbar)
    this.chatInput.maxLength = 200
    this.chatInput.placeholder = 'Team chat; start with ! for everyone, / for commands'
    const chat = el('div', 'chat')
    chat.append(this.chatLog, this.chatInput)
    this.renderPause()
    this.root.append(this.vignette, this.direction, this.crosshair, this.marker, this.charge, this.fps, this.sidebar, this.feed, chat, this.title, this.center, this.backdrop, this.lobby, this.scoreboard, this.debug, bottom, this.movementBadge, this.parkourBadge, this.toasts, this.summary, this.modal, this.help, this.loading, this.error)
    // Clicking outside the lobby card is the same as "Back to game".
    this.backdrop.addEventListener('click', () => this.game.lock(true))
    this.movementBadge.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).dataset.cycle !== undefined) this.game.cycleMovement()
    })
    container.append(this.root)

    this.chatInput.addEventListener('keydown', (e) => {
      e.stopPropagation()
      if (e.key === 'Enter') {
        const text = this.chatInput.value.trim()
        if (text) this.game.send({ t: 'chat', text })
        this.closeChat()
      } else if (e.key === 'Escape') this.closeChat()
    })
    this.modal.addEventListener('mousedown', (e) => {
      if (e.target === this.modal) this.closeModal()
    })
    // Clicking the dimmed backdrop also resumes; the card's own controls do not.
    this.help.addEventListener('click', (e) => {
      if (e.target === this.help) this.game.lock(true)
    })
    this.summary.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).dataset.close !== undefined) this.summary.classList.remove('show')
    })
    this.renderMovement()
  }

  /** The sandbox-only movement test card: current preset, its speeds, and the M hint. */
  private renderMovement() {
    const sandbox = this.game.mode.world === 'sandbox'
    this.movementBadge.classList.toggle('hidden', !sandbox)
    if (!sandbox) return
    const p = MOVEMENT_PRESETS[this.game.settings.sandboxMovement]
    this.movementBadge.innerHTML = `<div class="movement-head"><b>Movement: ${p.name}</b><button class="btn ghost small-btn" data-cycle>M · switch</button></div>
      <p class="movement-stats">${(p.walk * TPS).toFixed(1)} walk · ${(p.sprint * TPS).toFixed(1)} sprint · ${(p.sneak * TPS).toFixed(1)} sneak · ${MOVEMENT_JUMP.jump.toFixed(2)} jump</p>
      <p>${p.blurb}</p>`
  }

  /** Called when a preset changes in Settings or by cycling with M. */
  setMovementPreset() {
    this.renderMovement()
  }

  get modalOpen(): boolean {
    return this.modalKind !== null || this.chatOpen || this.settingsOpen
  }

  settingsOpen = false

  /** The pause card: resume, settings, leave, and the keys as they are bound now. */
  private renderPause() {
    const k = (a: Action) => (this.game.settings.keys[a] ?? []).map(keyLabel).join(' or ') || 'unbound'
    const parkour = this.game.mode.world === 'parkour'
    const sprint = this.game.settings.sprintMode === 'always' ? 'always on' : `${k('sprint')}${this.game.settings.doubleTapSprint ? ', or double-tap forward' : ''}`
    this.help.innerHTML = `<div class="help-card"><h1>${BRAND}</h1>
      <div class="pause-row"><button class="btn primary" data-pause="resume">Back to game</button><button class="btn" data-pause="bridge">Bridge: ${this.game.settings.bridgeAssist === 'auto' ? 'Auto' : this.game.settings.bridgeAssist === 'on' ? 'On' : 'Off'} · ${this.game.settings.bridgeStyle === 'forward' ? 'Forward' : 'Bedrock'}</button><button class="btn" data-pause="bridgeStyle">Style: ${this.game.settings.bridgeStyle === 'forward' ? 'Forward' : 'Bedrock'}</button><button class="btn" data-pause="wardrobe">Wardrobe</button><button class="btn" data-pause="settings">Settings</button><button class="btn" data-pause="fullscreen">${document.fullscreenElement ? 'Leave full screen' : 'Full screen'}</button><button class="btn" data-pause="leave">Leave</button></div>
      <p class="muted small">Click Back to game to capture the mouse. Full screen is optional: it keeps Ctrl+W and Ctrl+1 in the game, but you can play windowed and with the keyboard if your browser refuses either.</p>
      <p class="muted small">Laptop touchpad? Bridge assist Auto turns on when trackpad scrolling is detected. Bedrock style: hold use/right-click, sneak, and walk back. Forward style is opt-in: hold use/right-click and walk forward at an edge. Choose the style in Settings &gt; Game; this button only cycles Auto/On/Off.</p>
      <div class="keys">
        <span><kbd>${k('forward')}</kbd> <kbd>${k('left')}</kbd> <kbd>${k('back')}</kbd> <kbd>${k('right')}</kbd> move</span>
        <span><kbd>${k('jump')}</kbd> jump</span><span><kbd>${k('sneak')}</kbd> sneak</span><span><kbd>${sprint}</kbd> sprint</span>
        <span><kbd>Left click</kbd> hit, break</span><span><kbd>${k('use')}</kbd> or <kbd>Right click</kbd> place, use, shop</span><span><kbd>1-9</kbd> hotbar</span>
        <span><kbd>${k('drop')}</kbd> drop</span><span><kbd>${k('inventory')}</kbd> inventory</span><span><kbd>${k('shop')}</kbd> shop</span><span><kbd>${k('players')}</kbd> players</span>
        <span><kbd>${k('chat')}</kbd> chat</span><span><kbd>${k('debug')}</kbd> debug</span>
      </div>${parkour ? '<p class="muted small">Parkour: WASD move, Space jump, arrows look, R sprint. Falling returns you to the last checkpoint.</p>' : ''}${this.game.mode.world === 'survival' ? '<p class="muted small">School survival: F shoves nearby players; hold Space to swim up. Avoid red impact rings and follow gold supply beacons.</p>' : ''}<p class="muted small">Every control is explained, and can be changed, in Settings, Controls.</p></div>`
    this.help.querySelector('[data-pause="resume"]')!.addEventListener('click', () => this.game.lock(true))
    this.help.querySelector('[data-pause="bridge"]')!.addEventListener('click', () => {
      this.game.cycleBridgeAssist()
      this.renderPause()
    })
    this.help.querySelector('[data-pause="bridgeStyle"]')!.addEventListener('click', () => {
      this.game.cycleBridgeStyle()
      this.renderPause()
    })
    this.help.querySelector('[data-pause="settings"]')!.addEventListener('click', () => this.openSettingsWindow())
    this.help.querySelector('[data-pause="fullscreen"]')!.addEventListener('click', () => void this.game.toggleFullscreen())
    this.help.querySelector('[data-pause="wardrobe"]')!.addEventListener('click', () => {
      if (this.settingsOpen) return
      this.settingsOpen = true
      this.syncMenus()
      openWardrobe(
        this.root,
        this.game.self?.team ?? null,
        (look) => this.game.setLook(look),
        () => {
          this.settingsOpen = false
          this.syncMenus()
        },
      )
    })
    this.help.querySelector('[data-pause="leave"]')!.addEventListener('click', () => {
      this.game.destroy()
      location.href = location.pathname
    })
  }

  openSettingsWindow() {
    if (this.settingsOpen) return
    this.settingsOpen = true
    document.exitPointerLock?.()
    this.syncMenus()
    openSettings(
      this.root,
      this.game.settings,
      (s) => this.game.applySettings(s),
      () => {
        this.settingsOpen = false
        this.renderPause()
        this.syncMenus()
      },
    )
  }

  destroy() {
    this.root.remove()
  }

  setLocked(_locked: boolean) {
    this.syncMenus()
  }

  /** Show the pause card even when pointer lock never arrived. */
  openPause() {
    this.syncMenus()
  }

  /** Keep the full-screen button label current after the browser changes mode. */
  refreshPause() {
    const button = this.help.querySelector('[data-pause="fullscreen"]')
    if (button) button.textContent = document.fullscreenElement ? 'Leave full screen' : 'Full screen'
    const bridge = this.help.querySelector('[data-pause="bridge"]')
    if (bridge) bridge.textContent = `Bridge: ${this.game.settings.bridgeAssist === 'auto' ? 'Auto' : this.game.settings.bridgeAssist === 'on' ? 'On' : 'Off'} · ${this.game.settings.bridgeStyle === 'forward' ? 'Forward' : 'Bedrock'}`
    const style = this.help.querySelector('[data-pause="bridgeStyle"]')
    if (style) style.textContent = `Style: ${this.game.settings.bridgeStyle === 'forward' ? 'Forward' : 'Bedrock'}`
  }

  /** In the lobby, Esc opens the lobby screen; otherwise it opens the pause menu. */
  private inLobby(): boolean {
    const v = this.game.gameView
    return !!v && (v.mode === 'arena' || v.mode === 'upgrade') && (v.phase === 'waiting' || v.phase === 'countdown')
  }

  private syncMenus() {
    // A refused pointer lock or full screen is not a pause: the round stays
    // playable with the keyboard, so the card only appears when input is lost.
    const free = !this.game.acceptsInput && !this.modalOpen
    this.help.classList.toggle('hidden', !free || this.inLobby())
    this.backdrop.classList.toggle('show', free && this.inLobby())
    this.lobby.classList.toggle('open', free && this.inLobby())
  }

  showError(reason: string) {
    document.exitPointerLock?.()
    this.loading.classList.remove('show')
    this.error.innerHTML = `<div class="box"><h2>${escapeHtml(reason)}</h2><p class="muted">Your connection to the game ended. Trying again rejoins the same room.</p><div class="row"><button class="btn primary" data-retry>Try again</button><button class="btn" data-menu>Back to menu</button></div></div>`
    this.error.classList.add('show')
    this.error.querySelector('[data-retry]')!.addEventListener('click', () => location.reload())
    this.error.querySelector('[data-menu]')!.addEventListener('click', () => (location.href = location.pathname))
  }

  /** Hidden once we have a world and our own state. */
  setLoading(text: string | null) {
    this.loading.classList.toggle('show', text !== null)
    if (text) this.loading.innerHTML = `<div class="box"><h2>${text}</h2><div class="bar"><i></i></div></div>`
  }

  /** The end-of-round table; it stays up until the round resets or it is closed. */
  showSummary(m: Extract<ServerMessage, { t: 'summary' }>) {
    const upgrade = m.mode === 'upgrade'
    const survival = m.mode === 'survival'
    const survivors = m.survivors ?? m.players.filter((p) => p.deaths === 0).map((p) => p.name)
    const rows = m.players
      .map((p) =>
        survival
          ? `<tr${p.id === this.game.myId ? ' class="me"' : ''}><td>${escapeHtml(p.name)}</td><td>${(m.survivorIds ? m.survivorIds.includes(p.id) : p.deaths === 0) ? 'Survived' : 'Out'}</td></tr>`
          : upgrade
          ? `<tr${p.id === this.game.myId ? ' class="me"' : ''}><td><i style="background:${TEAM_COLORS[p.team]}"></i>${escapeHtml(p.name)}</td><td>${p.kills}</td><td>Tier ${p.tier} · ${gearFor(p.tier).name}</td><td>${p.deaths}</td></tr>`
          : `<tr${p.id === this.game.myId ? ' class="me"' : ''}><td><i style="background:${TEAM_COLORS[p.team]}"></i>${escapeHtml(p.name)}</td><td>${p.finals}</td><td>${p.kills}</td><td>${p.beds}</td><td>${p.deaths}</td></tr>`,
      )
      .join('')
    const title = survival
      ? survivors.length === 0 ? 'Nobody survived — the school wins' : survivors.length === 1 ? `${escapeHtml(survivors[0])} wins` : `${survivors.length} survived`
      : upgrade ? (m.winnerName ? `${escapeHtml(m.winnerName)} wins` : 'Draw') : m.winner === 'draw' ? 'Draw' : `${TEAM_NAMES[m.winner]} wins`
    const head = survival ? '<tr><th>Player</th><th>Result</th></tr>' : upgrade ? '<tr><th>Player</th><th>Kills</th><th>Tier</th><th>Deaths</th></tr>' : '<tr><th>Player</th><th>Finals</th><th>Kills</th><th>Beds</th><th>Deaths</th></tr>'
    this.summary.innerHTML = `<div class="window-head"><h2>${title}</h2><button class="btn ghost" data-close>Close</button></div>
      <table><thead>${head}</thead><tbody>${rows}</tbody></table>
      <p class="muted small">Back to the lobby in ${Math.round(m.lobbyIn / TPS)} seconds.</p>`
    this.summary.classList.add('show')
  }

  hurtFlash() {
    this.restart(this.vignette, 'hit')
    this.restart(this.hearts, 'shake')
  }

  /** The X around the crosshair when your hit lands; yellow for a critical hit. */
  hitMarker(crit: boolean) {
    this.marker.classList.toggle('crit', crit)
    this.restart(this.marker, 'show')
  }

  /** A red arc around the crosshair pointing toward where a hit came from (0 = straight ahead). */
  damageFrom(angle: number) {
    this.direction.style.setProperty('--angle', `${angle}rad`)
    this.restart(this.direction, 'show')
  }

  private restart(e: HTMLElement, cls: string) {
    e.classList.remove(cls)
    void e.offsetWidth
    e.classList.add(cls)
  }

  toast(text: string, ms = 2600) {
    const t = el('div', 'toast', text)
    this.toasts.append(t)
    setTimeout(() => t.remove(), ms)
  }

  event(m: Extract<ServerMessage, { t: 'event' }>) {
    switch (m.kind) {
      case 'title':
        this.title.innerHTML = `<div class="big">${escapeHtml(m.text)}</div>${m.sub ? `<div class="sub">${escapeHtml(m.sub)}</div>` : ''}`
        this.titleUntil = performance.now() + 3200
        break
      case 'kill':
      case 'bed': {
        const line = el('div', `feed-line ${m.kind}`, m.text)
        if (m.team) line.style.setProperty('--team', TEAM_COLORS[m.team])
        this.feed.prepend(line)
        while (this.feed.children.length > 6) this.feed.lastChild!.remove()
        setTimeout(() => line.classList.add('fade'), 7000)
        this.chatLine(m.text, m.kind)
        break
      }
      case 'error':
        this.toast(m.text)
        break
      default:
        this.chatLine(m.text, m.kind, m.team)
    }
  }

  private chatLine(text: string, kind: string, team?: TeamId) {
    const line = el('div', `chat-line ${kind}`)
    if (kind === 'chat' && team) {
      const [name, ...rest] = text.split(': ')
      const n = el('span', 'name', name)
      n.style.color = TEAM_COLORS[team]
      line.append(n, document.createTextNode(`: ${rest.join(': ')}`))
    } else line.textContent = text
    this.chatLog.append(line)
    while (this.chatLog.children.length > 60) this.chatLog.firstChild!.remove()
    this.chatLog.scrollTop = this.chatLog.scrollHeight
    setTimeout(() => line.classList.add('old'), 10_000)
  }

  openChat(prefix: string) {
    this.chatOpen = true
    document.exitPointerLock?.()
    this.root.classList.add('chatting')
    this.chatInput.value = prefix
    setTimeout(() => this.chatInput.focus(), 0)
  }

  closeChat() {
    this.chatOpen = false
    this.root.classList.remove('chatting')
    this.chatInput.blur()
    this.syncMenus()
    this.game.lock()
  }

  toggleDebug() {
    this.debugOn = !this.debugOn
  }

  setScoreboard(show: boolean) {
    this.scoreboard.classList.toggle('show', show)
    if (show) this.renderScoreboard()
  }

  /** G is a toggle, not a hold: a normal tap used to show the list for one frame. */
  toggleScoreboard() {
    this.setScoreboard(!this.scoreboard.classList.contains('show'))
  }

  /**
   * Close the shop or inventory. `resume` grabs the mouse again (clicking
   * Close, or Tab); Escape passes false, because Escape just released the
   * mouse and the browser refuses to re-lock it immediately. The pause card is
   * then the way back in.
   */
  closeModal(resume = true) {
    this.modalKind = null
    this.pickedSlot = null
    this.storageSlots = []
    this.modal.classList.remove('show')
    this.modal.innerHTML = ''
    // If pointer lock is refused, this is what surfaces the pause card instead
    // of leaving the player on a screen that accepts no mouse input.
    this.syncMenus()
    if (resume) this.game.lock()
  }

  /**
   * Death closes the windows that swallow input. Spectating is keyboard-first,
   * so a chat box or shop left open must not leave the camera frozen.
   */
  closeForDeath() {
    this.chatOpen = false
    this.root.classList.remove('chatting')
    this.chatInput.blur()
    this.modalKind = null
    this.pickedSlot = null
    this.storageSlots = []
    this.modal.classList.remove('show')
    this.modal.innerHTML = ''
    this.scoreboard.classList.remove('show')
  }

  private openModal(kind: 'shop' | 'upgrades' | 'inventory' | 'storage') {
    this.modalKind = kind
    document.exitPointerLock?.()
    // Closing a window emptied its DOM but kept this render key, so the next
    // open with the same state skipped the render and showed an empty window.
    this.modal.dataset.key = ''
    this.modal.classList.add('show')
    this.renderModal()
    this.syncMenus()
  }

  openShop(kind: 'shop' | 'upgrades') {
    this.openModal(kind)
  }

  openInventory() {
    this.openModal('inventory')
  }

  openStorage(kind: 'ender' | 'team') {
    this.storageKind = kind
    this.storageSlots = []
    this.openModal('storage')
  }

  showStorage(m: Extract<ServerMessage, { t: 'storage' }>) {
    this.storageKind = m.kind
    this.storageSlots = m.slots
    if (this.modalKind !== 'storage') this.openModal('storage')
    else {
      this.modal.dataset.key = ''
      this.renderModal()
    }
  }

  // Per-frame ---------------------------------------------------------------

  frame(now: number) {
    const g = this.game
    const self = g.self
    if (now > this.titleUntil) this.title.classList.remove('show')
    else this.title.classList.add('show')
    if (this.debugOn) {
      const d = g.debugInfo()
      const f = (v: number) => v.toFixed(3)
      this.debug.textContent = [
        `${BRAND}  ${d.fps} fps  tick ${d.tick}`,
        `xyz ${d.pos.map(f).join(' ')}`,
        `vel ${d.vel.map(f).join(' ')}`,
        `onGround ${d.onGround}  sneaking ${d.sneaking}  sprinting ${d.sprinting}`,
        `fall ${d.fall.toFixed(2)}  sunlight ${d.light}`,
        `yaw ${d.yaw.toFixed(2)}  pitch ${d.pitch.toFixed(2)}`,
        `target ${d.target}`,
        `dig ${(d.dig * 100).toFixed(0)}%`,
        `chunks ${d.chunks}  mesher ${d.mesher}`,
        `draws ${d.drawCalls}  triangles ${d.triangles}`,
        `render ${d.renderDistance}  quality ${d.quality}  fog ${d.fog ? d.fog.map((v: number) => v.toFixed(0)).join('-') : 'none'}`,
      ].join('\n')
    }
    this.root.classList.toggle('parkour', g.mode.world === 'parkour')
    this.debug.classList.toggle('show', this.debugOn)
    this.syncMenus()
    this.fps.classList.toggle('show', g.settings.showFps && !this.debugOn)
    if (g.settings.showFps && now - this.lastFps > 500) {
      this.lastFps = now
      this.fps.textContent = `${g.debugInfo().fps} fps`
    }
    const draw = g.drawCharge()
    this.charge.style.setProperty('--draw', String(draw))
    this.charge.classList.toggle('show', draw > 0)
    // DOM work a few times a second is plenty for everything else.
    if (now - this.lastRender < 100) return
    this.lastRender = now
    if (!self) return
    this.renderParkour()
    this.renderHotbar()
    this.renderStats()
    this.renderSidebar()
    this.renderLobby()
    this.renderCenter()
    if (this.scoreboard.classList.contains('show')) this.renderScoreboard()
    if (this.modalKind) this.renderModal()
    this.crosshair.classList.toggle('hidden', !self.alive)
  }

  /** Timer/checkpoint card for a parkour run. */
  private renderParkour(): void {
    const g = this.game
    const ps = g.self?.parkour
    const active = g.mode.world === 'parkour' && !!ps
    this.parkourBadge.classList.toggle('hidden', !active)
    if (!active || !ps) return
    const finished = ps.finishAt !== null
    const ticks = finished ? ps.finishAt! - ps.startedAt : Math.max(0, g.tickNow() - ps.startedAt)
    if (finished && (this.parkourBest === 0 || ticks < this.parkourBest)) {
      this.parkourBest = ticks
      try {
        localStorage.setItem('parkour-best', String(ticks))
      } catch {}
    }
    const best = this.parkourBest ? ` · best ${formatParkourTime(this.parkourBest)}` : ''
    const state = finished
      ? `<span class="parkour-finish">FINISHED · place ${ps.place ?? '-'} · ${formatParkourTime(ticks)}</span>`
      : `<span class="parkour-time">${formatParkourTime(ticks)}</span><span>checkpoint ${ps.checkpoint}/${ps.total}</span><span>round ${ps.round}/${ps.rounds}</span>`
    this.parkourBadge.innerHTML = `<div class="parkour-head"><b>PARKOUR</b><span class="muted small">${best}</span></div><div class="parkour-row">${state}</div>`
  }

  private renderHotbar() {
    const self = this.game.self!
    const team = self.team ?? 'red'
    for (let i = 0; i < HOTBAR; i++) {
      const s = self.inventory[i]
      const key = `${s?.id ?? ''}:${s?.count ?? 0}:${i === self.selected}:${team}`
      const slot = this.slots[i]
      if (slot.dataset.key === key) continue
      slot.dataset.key = key
      slot.classList.toggle('selected', i === self.selected)
      slot.innerHTML = s ? `<img src="${this.game.icons.url(s.id, team)}" alt=""><span class="count">${s.count > 1 ? s.count : ''}</span>` : ''
      slot.title = s ? (item(s.id)?.name ?? s.id) : ''
    }
    this.hotbar.classList.toggle('hidden', !self.alive)
  }

  private renderStats() {
    const self = this.game.self!
    const hp = Math.max(0, self.health)
    const max = Math.max(2, self.maxHealth || MAX_HEALTH)
    const left = (e: 'speed' | 'jump' | 'invisible' | 'regen') => Math.max(0, Math.ceil(((self.effects?.[e] ?? 0) - this.game.tickNow()) / TPS))
    const effects = [['speed', 'Speed'], ['jump', 'Jump'], ['invisible', 'Invisible'], ['regen', 'Regen']]
      .map(([e, label]) => [label, left(e as 'speed')] as const)
      .filter(([, s]) => s > 0)
      .map(([label, s]) => `${label} ${s}s`)
      .join(', ')
    const key = `${hp}:${max}:${self.armor}:${self.alive}:${self.protectedTicks > 0}:${effects}`
    if (this.hearts.dataset.key === key) return
    this.hearts.dataset.key = key
    let html = ''
    for (let i = 0; i < max / 2; i++) html += HEART(hp >= (i + 1) * 2 ? 'full' : hp === i * 2 + 1 ? 'half' : 'empty')
    this.hearts.innerHTML = html
    this.hearts.classList.toggle('hidden', !self.alive)
    this.armor.textContent = self.alive ? `${Math.ceil(hp)}/${max} HP · ${self.armor[0].toUpperCase()}${self.armor.slice(1)} armour${self.protectedTicks > 0 ? ', spawn shield' : ''}${effects ? `, ${effects}` : ''}` : ''
  }

  private renderSidebar() {
    const g = this.game
    const view = g.gameView
    const self = g.self!
    if (!view) return
    const upgrade = view.mode === 'upgrade'
    const survival = view.mode === 'survival'
    const window = playWindow()
    const rows: string[] = [`<div class="brand">${BRAND}</div>`, `<div class="line muted small">${window.clock} · ${window.label} · ${__SITES__ ? 'online' : 'LAN'}</div>`]
    if (g.bridgeAssistActive) rows.push(`<div class="line ok">Bridge assist: on · ${g.settings.bridgeStyle === 'forward' ? 'Forward' : 'Bedrock'}</div>`)
    if (view.mode === 'sandbox') rows.push('<div class="line muted">Sandbox: try every mechanic. /help for commands.</div>')
    else if (view.phase === 'waiting') rows.push(`<div class="line muted">Waiting for ${upgrade ? 'fighters (2–8)' : 'players'}</div>`)
    else if (view.phase === 'countdown') rows.push(`<div class="line">Starting in <b>${Math.ceil(g.clock() / TPS)}</b></div>`)
    else if (view.phase === 'playing') {
      if (upgrade) rows.push(`<div class="line muted">Time left <b>${clock(UPGRADE_ROUND_TICKS - g.clock())}</b></div>`)
      else if (survival) {
        rows.push(`<div class="line muted">Survive <b>${clock(150 * TPS - g.clock())}</b></div>`)
        rows.push(`<div class="line">Alive <b>${g.views.filter((p) => p.alive).length}</b></div>`)
        if (view.next) rows.push(`<div class="line">${view.next.label} in <b>${clock(view.next.in - (g.clock() - view.clock))}</b></div>`)
      } else {
        rows.push(`<div class="line muted">Time <b>${clock(g.clock())}</b></div>`)
        if (view.next) rows.push(`<div class="line">${view.next.label} in <b>${clock(view.next.in - (g.clock() - view.clock))}</b></div>`)
      }
    } else {
      const alive = g.views.filter((p) => p.alive).length
      const won = survival
        ? view.winnerName ? `${escapeHtml(view.winnerName)} wins` : alive > 0 ? `${alive} survived` : 'Nobody survived'
        : upgrade ? view.winnerName ? `${escapeHtml(view.winnerName)} wins` : 'Draw'
          : view.winner === 'draw' ? 'Draw' : view.winner ? `${TEAM_NAMES[view.winner]} wins` : 'Round over'
      rows.push(`<div class="line">${won}</div>`)
    }
    if (upgrade) {
      const up = self.upgrade
      const tier = up?.tier ?? 0
      rows.push(`<div class="line">Tier <b>${tier}</b> / ${UPGRADE_MAX_TIER} · ${gearFor(tier).name}</div>`)
      rows.push(`<div class="line">Kills <b>${self.stats.kills}</b> / ${UPGRADE_KILLS_TO_WIN} · deaths ${self.stats.deaths}</div>`)
      if (up?.next) rows.push(`<div class="line muted small">Next kill: ${escapeHtml(up.next)}</div>`)
      else rows.push('<div class="line muted small">Apex reached. Finish it.</div>')
    }
    if (view.mode === 'arena' && view.phase !== 'waiting' && view.phase !== 'countdown') {
      rows.push('<div class="teams">')
      for (const t of view.teams) {
        const state = t.eliminated ? '<span class="x">out</span>' : t.bed ? '<span class="ok">bed</span>' : `<span class="warn">${t.alive}</span>`
        rows.push(`<div class="team-row${t.team === self.team ? ' mine' : ''}"><i style="background:${TEAM_COLORS[t.team]}"></i>${TEAM_NAMES[t.team]}${t.team === self.team ? ' (you)' : ''}<span class="right">${state}</span></div>`)
      }
      rows.push('</div>')
    }
    if (!upgrade && !survival) {
      const res = ['iron', 'gold', 'diamond', 'emerald'].map((r) => `<span class="res"><i style="background:${RESOURCE_COLORS[r]}"></i>${countItem(self.inventory, r)}</span>`).join('')
      rows.push(`<div class="resources">${res}</div>`)
      if (view.mode === 'arena') rows.push(`<div class="line muted small">Kills ${self.stats.kills}, finals ${self.stats.finals}, beds ${self.stats.beds}</div>`)
    }
    const html = rows.join('')
    if (this.sidebar.dataset.html !== html) {
      this.sidebar.dataset.html = html
      this.sidebar.innerHTML = html
    }
  }

  /** The invite link was just copied (the button says so for a moment). */
  private copied = false

  private renderLobby() {
    const g = this.game
    if (g.gameView?.phase === 'waiting') this.summary.classList.remove('show')
    const view = g.gameView
    const self = g.self!
    const show = !!view && (view.mode === 'arena' || view.mode === 'upgrade') && (view.phase === 'waiting' || view.phase === 'countdown')
    this.lobby.classList.toggle('show', show)
    if (!show || !view) return
    const upgrade = view.mode === 'upgrade'
    const isHost = view.host === g.myId
    const people = g.views.filter((p) => !p.bot)
    const key = JSON.stringify([view.mode, view.teams, view.phase, view.teamSize, Math.ceil(g.clock() / TPS), self.team, isHost, view.bots, g.botLevel, people.map((p) => [p.id, p.name, p.team]), g.votes, g.myVote, g.locked, this.copied])
    if (this.lobby.dataset.key === key) return
    this.lobby.dataset.key = key
    const teamButtons = TEAMS.map((t) => {
      const n = g.views.filter((p) => p.team === t).length
      const full = n >= view.teamSize && self.team !== t
      return `<button class="btn team${self.team === t ? ' chosen' : ''}" data-team="${t}" style="--team:${TEAM_COLORS[t]}"${full ? ' disabled' : ''}><i></i>${TEAM_NAMES[t]}<span>${n}/${view.teamSize}</span></button>`
    }).join('')
    const humans = people.length
    if (g.locked) {
      // Playing on the lobby deck: a one-line banner; Esc opens the full lobby screen.
      this.lobby.innerHTML = `<div class="banner">${view.phase === 'countdown' ? `Starting in ${Math.ceil(g.clock() / TPS)}` : upgrade ? 'Waiting for fighters' : 'Waiting for players'}. Press Esc to pick ${upgrade ? 'a colour' : 'a team'}${isHost ? ' or start' : ''}.</div>`
      return
    }
    const q = new URLSearchParams(location.search)
    const roomName = q.get('room') ?? 'main'
    const invite = g.mode.offline ? null : inviteLink(roomName, { world: g.mode.world, private: q.get('private') === '1', fast: q.get('fast') === '1', teamSize: view.teamSize })
    const status =
      view.phase === 'countdown'
        ? `The round starts in ${Math.ceil(g.clock() / TPS)} seconds.`
        : humans < 2
          ? upgrade
            ? 'Upgrade Rush needs at least two fighters. Share the invite link.'
            : `Waiting for someone else to join.${isHost ? ' You can also start now and play the bots.' : ''}`
          : isHost
            ? `Everyone here can start. Press Start now when you are ready.${upgrade ? ' No bots: every seat is a person.' : ''}`
            : 'Waiting for the host to start.'
    const roster = people
      .map((p) => `<li><i style="background:${p.team ? TEAM_COLORS[p.team] : '#8b8b8b'}"></i>${escapeHtml(p.name)}${p.id === g.myId ? ' <span class="muted">(you)</span>' : ''}${p.id === view.host ? ' <span class="tag">host</span>' : ''}<span class="muted right">${p.team ? TEAM_NAMES[p.team] : 'no team yet'}</span></li>`)
      .join('')
    this.lobby.innerHTML = `
      <div class="lobby-head"><h2>${view.phase === 'countdown' ? `Starting in ${Math.ceil(g.clock() / TPS)}` : upgrade ? 'Waiting for fighters' : 'Waiting for players'}</h2>${g.mode.offline ? '<span class="tag">Solo</span>' : `<span class="tag">Room ${escapeHtml(roomName)}${q.get('private') === '1' ? ' · invite only' : ''}</span>`}${upgrade ? '<span class="tag">Upgrade Rush · FFA</span>' : ''}</div>
      <p class="status-line">${status}</p>
      ${invite ? `<div class="invite-row"><input readonly value="${escapeHtml(invite)}" aria-label="Invite link"><button class="btn" data-act="copy">${this.copied ? 'Copied' : 'Copy invite link'}</button></div>` : ''}
      <p class="label">In this room (${humans})</p>
      <ul class="roster">${roster}</ul>
      ${view.bots ? `<p class="muted small">${levelName(g.botLevel)} bots fill empty teams when the round starts; anyone who joins mid-round takes a bot's place.</p>` : ''}
      ${upgrade ? '<p class="muted small">Everyone fights alone. The colour is only your seat and spawn island; it does not protect anyone.</p>' : ''}
      <p class="label">${upgrade ? 'Seat colour' : 'Team'}</p>
      <div class="team-grid">${teamButtons}</div>
      ${g.votes ? `<p class="label">Arena</p><div class="map-grid">${g.votes.maps.map((m) => `<button class="btn map${g.myVote === m.id ? ' chosen' : ''}" data-map="${m.id}">${m.name}<span>${m.votes}</span></button>`).join('')}</div>` : ''}
      ${isHost && view.bots && !upgrade ? `<p class="label">Bot level</p><div class="team-grid">${BOT_LEVELS.map((l) => `<button class="btn${g.botLevel === l ? ' chosen' : ''}" data-level="${l}">${levelName(l)}</button>`).join('')}</div>` : ''}
      ${isHost ? `<div class="row"><button class="btn primary" data-act="start"${view.phase === 'countdown' ? ' disabled' : ''}>Start now</button>${upgrade ? '' : `<button class="btn" data-act="bots">${view.bots ? 'Bots: on' : 'Bots: off'}</button>`}<button class="btn" data-act="resume">Back to game</button></div>` : '<div class="row"><button class="btn" data-act="resume">Back to game</button></div>'}`
    this.lobby.querySelector('[data-act="resume"]')?.addEventListener('click', () => g.lock(true))
    this.lobby.querySelector('[data-act="copy"]')?.addEventListener('click', () => {
      const field = this.lobby.querySelector<HTMLInputElement>('.invite-row input')!
      field.select()
      const done = () => {
        this.copied = true
        setTimeout(() => (this.copied = false), 2000)
      }
      if (navigator.clipboard) navigator.clipboard.writeText(field.value).then(done, () => document.execCommand('copy') && done())
      else if (document.execCommand('copy')) done()
    })
    this.lobby.querySelectorAll<HTMLButtonElement>('[data-team]').forEach((b) => b.addEventListener('click', () => g.send({ t: 'team', team: b.dataset.team as TeamId })))
    this.lobby.querySelectorAll<HTMLButtonElement>('[data-map]').forEach((b) =>
      b.addEventListener('click', () => {
        g.myVote = b.dataset.map!
        g.send({ t: 'vote', map: b.dataset.map! })
      }),
    )
    this.lobby.querySelector('[data-act="start"]')?.addEventListener('click', () => g.send({ t: 'start' }))
    this.lobby.querySelector('[data-act="bots"]')?.addEventListener('click', () => g.send({ t: 'settings', bots: !view.bots }))
    this.lobby.querySelectorAll<HTMLButtonElement>('[data-level]').forEach((b) => b.addEventListener('click', () => g.send({ t: 'settings', bots: view.bots, botLevel: b.dataset.level as BotLevel })))
  }

  private renderCenter() {
    const self = this.game.self!
    let text = ''
    if (self.respawnIn !== null) text = `<div class="big">You died</div><div class="sub">Respawning in ${Math.ceil(self.respawnIn / TPS)}</div>`
    else if (self.eliminated && this.game.gameView?.phase === 'playing') text = '<div class="sub">Spectating. WASD fly, Space/Shift up and down, arrow keys look, G players.</div>'
    if (this.center.dataset.html !== text) {
      this.center.dataset.html = text
      this.center.innerHTML = text
    }
  }

  private renderScoreboard() {
    const g = this.game
    const upgrade = g.gameView?.mode === 'upgrade'
    const rows = [...g.views]
      .sort(
        upgrade
          ? (a, b) => b.kills - a.kills || b.tier - a.tier || a.deaths - b.deaths
          : (a, b) => (a.team ?? 'z').localeCompare(b.team ?? 'z'),
      )
      .map((p) => {
        const right = upgrade
          ? `Tier ${p.tier} · ${p.kills} kills${p.alive ? '' : ' · dead'}`
          : p.alive ? `${p.health} hp` : 'dead'
        return `<div class="score-row"><i style="background:${p.team ? TEAM_COLORS[p.team] : '#888'}"></i><span class="name">${escapeHtml(p.name)}${p.id === g.myId ? ' (you)' : ''}</span><span class="right">${right}</span></div>`
      })
      .join('')
    const html = `<h3>${upgrade ? 'Upgrade Rush · kills' : 'Players'}</h3>${rows}`
    if (this.scoreboard.dataset.html !== html) {
      this.scoreboard.dataset.html = html
      this.scoreboard.innerHTML = html
    }
  }

  // Modals -------------------------------------------------------------------

  private renderModal() {
    const self = this.game.self
    if (!self || !this.modalKind) return
    const key = JSON.stringify([this.modalKind, this.shopTab, self.inventory, self.armor, self.upgrades, self.pickaxeTier, self.axeTier, this.pickedSlot, this.storageKind, this.storageSlots])
    if (this.modal.dataset.key === key) return
    this.modal.dataset.key = key
    if (this.modalKind === 'shop') this.renderShop()
    else if (this.modalKind === 'upgrades') this.renderUpgrades()
    else if (this.modalKind === 'inventory') this.renderInventory()
    else this.renderStorage()
  }

  private renderShop() {
    const self = this.game.self!
    const team = self.team ?? 'red'
    const tabs: [OfferCategory, string][] = [['blocks', 'Blocks'], ['melee', 'Melee'], ['armor', 'Armour'], ['tools', 'Tools'], ['ranged', 'Ranged'], ['utility', 'Utility'], ['potions', 'Potions']]
    const offers = OFFERS.filter((o) => o.category === this.shopTab)
    const cards = offers.map((o) => this.offerCard(o)).join('')
    this.modal.innerHTML = `<div class="window panel">
      <div class="window-head"><h2>Item shop</h2><button class="btn ghost" data-close>Close</button></div>
      <div class="tabs">${tabs.map(([id, label]) => `<button class="tab${id === this.shopTab ? ' on' : ''}" data-tab="${id}">${label}</button>`).join('')}</div>
      <div class="offers">${cards}</div>
      <div class="wallet">${['iron', 'gold', 'diamond', 'emerald'].map((r) => `<span class="res"><i style="background:${RESOURCE_COLORS[r]}"></i>${countItem(self.inventory, r)} ${r}</span>`).join('')}</div>
    </div>`
    void team
    this.modal.querySelector('[data-close]')!.addEventListener('click', () => this.closeModal())
    this.modal.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) =>
      b.addEventListener('click', () => {
        this.shopTab = b.dataset.tab as OfferCategory
        this.renderModal()
      }),
    )
    this.modal.querySelectorAll<HTMLButtonElement>('[data-offer]').forEach((b) =>
      b.addEventListener('click', () => {
        if (!b.classList.contains('dim')) this.game.sound.play('buy')
        this.game.send({ t: 'buy', offer: b.dataset.offer! })
      }),
    )
  }

  private offerCard(o: Offer): string {
    const self = this.game.self!
    let icon = o.icon
    let cost = o.cost
    let owned = false
    let name = o.name
    if (o.give.kind === 'pickaxe' || o.give.kind === 'axe') {
      const tier = o.give.kind === 'pickaxe' ? self.pickaxeTier : self.axeTier
      const list = o.give.kind === 'pickaxe' ? PICKAXES : AXES
      owned = tier >= 3
      icon = list[Math.min(3, tier + 1)]
      name = item(icon)?.name ?? name
      cost = TOOL_TIER_COST[Math.min(3, tier + 1)]
    }
    if (o.give.kind === 'armor') owned = ARMOR_ORDER.indexOf(o.give.tier) <= ARMOR_ORDER.indexOf(self.armor)
    if (o.give.kind === 'shears') owned = countItem(self.inventory, 'shears') > 0
    const affordable = cost.every((c) => countItem(self.inventory, c.resource) >= c.amount)
    const price = cost.map((c) => `<span style="color:${RESOURCE_COLORS[c.resource]}">${c.amount} ${c.resource}</span>`).join(' ')
    return `<button class="offer${affordable && !owned ? '' : ' dim'}" data-offer="${o.id}"${owned ? ' disabled' : ''}>
      <img src="${this.game.icons.url(icon, self.team ?? 'red')}" alt=""><span class="offer-name">${name}</span><span class="price">${owned ? 'Owned' : price}</span></button>`
  }

  private renderUpgrades() {
    const self = this.game.self!
    const diamonds = countItem(self.inventory, 'diamond')
    const cards = UPGRADES.map((u) => {
      const level = self.upgrades[u.id]
      const maxed = level >= u.levels.length
      const cost = maxed ? 0 : u.levels[level]
      const pips = u.levels.map((_, i) => `<i class="${i < level ? 'on' : ''}"></i>`).join('')
      return `<button class="offer wide${maxed || diamonds < cost ? ' dim' : ''}" data-upgrade="${u.id}"${maxed ? ' disabled' : ''}>
        <span class="offer-name">${u.name}</span><span class="desc">${u.description}</span><span class="pips">${pips}</span>
        <span class="price">${maxed ? 'Maxed' : `<span style="color:${RESOURCE_COLORS.diamond}">${cost} diamond${cost === 1 ? '' : 's'}</span>`}</span></button>`
    }).join('')
    this.modal.innerHTML = `<div class="window panel">
      <div class="window-head"><h2>Team upgrades</h2><button class="btn ghost" data-close>Close</button></div>
      <div class="offers single">${cards}</div>
      <div class="wallet"><span class="res"><i style="background:${RESOURCE_COLORS.diamond}"></i>${diamonds} diamonds</span></div></div>`
    this.modal.querySelector('[data-close]')!.addEventListener('click', () => this.closeModal())
    this.modal.querySelectorAll<HTMLButtonElement>('[data-upgrade]').forEach((b) => b.addEventListener('click', () => this.game.send({ t: 'upgrade', id: b.dataset.upgrade as never })))
  }

  private renderStorage() {
    const self = this.game.self!
    const team = self.team ?? 'red'
    const cell = (s: Slot | null, i: number, attr: string) =>
      `<button class="slot inv" ${attr}="${i}">${s ? `<img src="${this.game.icons.url(s.id, team)}" alt=""><span class="count">${s.count > 1 ? s.count : ''}</span>` : ''}</button>`
    const chest = Array.from({ length: STORAGE_SIZE }, (_, i) => cell(this.storageSlots[i] ?? null, i, 'data-chest')).join('')
    const inv = Array.from({ length: INVENTORY_SIZE }, (_, i) => cell(self.inventory[i], i, 'data-inv')).join('')
    this.modal.innerHTML = `<div class="window panel narrow">
      <div class="window-head"><h2>${this.storageKind === 'team' ? 'Team chest' : 'Ender chest'}</h2><button class="btn ghost" data-close>Close</button></div>
      <p class="muted small">Click a chest slot to take the stack; click an inventory slot to store it. ${this.storageKind === 'team' ? 'Everyone on your team can use this chest.' : 'Only you can use this chest.'}</p>
      <div class="inv-grid">${chest}</div>
      <p class="label">Inventory</p><div class="inv-grid">${inv}</div></div>`
    this.modal.querySelector('[data-close]')!.addEventListener('click', () => this.closeModal())
    this.modal.querySelectorAll<HTMLButtonElement>('[data-chest]').forEach((b) => b.addEventListener('click', () => this.game.send({ t: 'storage', action: 'take', kind: this.storageKind, index: Number(b.dataset.chest) })))
    this.modal.querySelectorAll<HTMLButtonElement>('[data-inv]').forEach((b) => b.addEventListener('click', () => this.game.send({ t: 'storage', action: 'put', kind: this.storageKind, index: Number(b.dataset.inv) })))
  }

  private renderInventory() {
    const self = this.game.self!
    const team = self.team ?? 'red'
    const cell = (i: number) => {
      const s = self.inventory[i]
      return `<button class="slot inv${this.pickedSlot === i ? ' picked' : ''}${i < HOTBAR ? ' hot' : ''}" data-slot="${i}">${s ? `<img src="${this.game.icons.url(s.id, team)}" alt=""><span class="count">${s.count > 1 ? s.count : ''}</span>` : ''}</button>`
    }
    const storage = Array.from({ length: INVENTORY_SIZE - HOTBAR }, (_, k) => cell(k + HOTBAR)).join('')
    const hot = Array.from({ length: HOTBAR }, (_, k) => cell(k)).join('')
    this.modal.innerHTML = `<div class="window panel narrow">
      <div class="window-head"><h2>Inventory</h2><button class="btn ghost" data-close>Close</button></div>
      <p class="muted small">Click two slots to swap them.</p>
      <div class="inv-grid">${storage}</div><div class="inv-grid hotrow">${hot}</div></div>`
    this.modal.querySelector('[data-close]')!.addEventListener('click', () => this.closeModal())
    this.modal.querySelectorAll<HTMLButtonElement>('[data-slot]').forEach((b) =>
      b.addEventListener('click', () => {
        const i = Number(b.dataset.slot)
        if (this.pickedSlot === null) this.pickedSlot = i
        else {
          const a = this.pickedSlot
          this.pickedSlot = null
          if (a !== i) {
            ;[self.inventory[a], self.inventory[i]] = [self.inventory[i], self.inventory[a]]
            this.game.send({ t: 'swap', a, b: i })
          }
        }
        this.renderModal()
      }),
    )
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

function levelName(level: BotLevel): string {
  return level[0].toUpperCase() + level.slice(1)
}
