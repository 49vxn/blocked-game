import {
  AmbientLight,
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  IcosahedronGeometry,
  DirectionalLight,
  DoubleSide,
  Fog,
  HemisphereLight,
  NoToneMapping,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
  type Object3D,
} from 'three'
import { AIR, blockDef } from '../blocks'
import { breakTicks, checkPlace } from '../../../engine/building'
import { checkBreak } from '../sim/beds'
import { ATTACK_REACH, BLOCK_REACH, EYE_HEIGHT, SNEAK_EYE_HEIGHT, TICK_MS, TPS } from '../constants'
import { countItem, HOTBAR } from '../../../engine/inventory'
import { item, JUMP_BOOST, placedBlock, SPEED_BOOST } from '../items'
import type { MapMeta } from '../maps/types'
import { IDLE_INPUT, lookDirection, playerBox, stepMovement, type MoveInput, type Mover } from '../../../engine/physics'
import { meteorPosition, METEOR_FLIGHT_TICKS } from '../sim/survival'
import type { ClientMessage, GameView, PlayerView, SelfView, ServerMessage } from '../protocol'
import type { BotLevel } from '../rules'
import { raycastBlock, rayBox, type BlockHit } from '../../../engine/raycast'
import { fromBase64, World } from '../../../engine/world'
import type { Connection } from '../../../engine/net/client'
import { atlasLayout } from '../../../engine/render/atlas-layout'
import { ChunkRenderer } from '../../../engine/render/chunks'
import { BlockCursor } from '../../../engine/render/entities'
import { ItemDrops } from './drops'
import { createMapDecor, PlayerModels } from './models'
import { IconPainter } from './icons'
import { createChunkMaterial, defaultEnvironment } from '../../../engine/render/shaders'
import { createSky } from '../../../engine/render/sky'
import { atmosphereFor, type Atmosphere } from './atmosphere'
import { crackTextures, createAtlasTexture } from '../../../engine/render/textures'
import { ViewModel } from './viewmodel'
import { Hud } from './hud'
import { actionFor, IS_DESKTOP, pixelRatio, saveSettings, type Action, type Settings } from './settings'
import { DEFAULT_MOVEMENT, MOVEMENT_PRESETS, nextMovement, type MovementPresetId } from '../../../engine/movement'
import { Particles } from './particles'
import { ProjectileModels } from './projectiles'
import { FloatingText } from './floating-text'
import { GeneratorDisplays } from './generators'
import { Avatar } from './avatar'
import { loadLook } from './wardrobe'
import { encodeLook, KILL_EFFECTS, TRAILS, type Look } from '../sim/look'
import { falloff, Sound } from './sound'
import { clampLookDelta } from './look'
import { startsBowDraw } from './use'
import { bridgePlacement, type GroundCell } from './bridge'

type Target = { kind: 'block'; hit: BlockHit } | { kind: 'player'; id: number; distance: number } | { kind: 'npc'; npc: MapMeta['npcs'][number]; distance: number } | null


/**
 * The client: predicts its own movement with the shared physics at the
 * server's tick rate, renders everything else from snapshots, and turns
 * input into the same messages a bot or test would send.
 */
export class Game {
  readonly renderer: WebGLRenderer
  readonly scene = new Scene()
  readonly camera = new PerspectiveCamera(75, 1, 0.05, 600)
  readonly hud: Hud
  private env = defaultEnvironment()
  private atmosphere: Atmosphere = atmosphereFor({ name: 'Skyreach', sky: '#8ec5ff' })
  private readonly sun = new DirectionalLight(0xfff4e0, 1.6)
  private layout = atlasLayout()
  private atlas = createAtlasTexture(this.layout)
  private material = createChunkMaterial(this.atlas.texture, this.layout.size, this.env)
  private glassMaterial = createChunkMaterial(this.atlas.texture, this.layout.size, this.env, true)
  private cracks = crackTextures()
  private viewModel = new ViewModel(this.atlas.texture, this.layout)
  private players = new PlayerModels(
    this.layout,
    this.atlas.texture,
    (x, y, z, trail) => this.trail(x, y, z, trail),
    (x, y, z) => this.groundBelow(x, y, z),
  )
  /** Your own figure, drawn in the third-person view. */
  private selfAvatar = new Avatar(this.layout, this.atlas.texture)
  thirdPerson = false
  private selfTrailClock = 0
  private dropModels = new ItemDrops()
  private cursor = new BlockCursor(this.cracks)
  private sky: ReturnType<typeof createSky> | null = null
  private decor: Object3D | null = null
  private chunks: ChunkRenderer | null = null

  world: World | null = null
  map: MapMeta | null = null
  myId = 0
  self: SelfView | null = null
  gameView: GameView | null = null
  views: PlayerView[] = []
  private viewMap = new Map<number, PlayerView>()
  /** Lobby map vote state, and this player's own vote. */
  votes: Extract<ServerMessage, { t: 'votes' }> | null = null
  myVote: string | null = null
  /** The level bots will play at, as the host last set it. */
  botLevel: BotLevel = 'normal'
  private tick = 0

  /** Our own body, predicted locally. */
  me: Mover = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, onGround: false, sneaking: false, sprinting: false, fallDistance: 0 }
  private prev = { x: 0, y: 0, z: 0 }
  private tp = 0
  private eye = EYE_HEIGHT
  private spectator = { x: 0, y: 0, z: 0, yaw: 0, pitch: -0.45 }

  private keys = new Set<string>()
  private leftDown = false
  private rightDown = false
  private clickQueue: ('attack' | 'use')[] = []
  private lastForwardTap = 0
  /** Sprint started by a double-tap or a toggle press; the physics drops it when you stop going forward. */
  private sprintLatched = false
  private placeCooldown = 0
  private digCooldown = 0
  private bridgeCooldown = 0
  /** Last solid cell under the feet, kept for two ticks after stepping off a lip. */
  private bridgeGround: GroundCell | null = null
  private bridgeCoyote = 0
  /** The first mousemove after a lock is often the browser centring the cursor. */
  private firstLookAfterLock = false
  /** Trackpad wheel gestures are small and frequent; mouse wheels are coarse. */
  private touchpadScore = 0
  private touchpadDetected = false
  private dig: { x: number; y: number; z: number; progress: number } | null = null
  private target: Target = null
  private remoteBoxes: ReturnType<PlayerModels['boxes']> = []
  private accumulator = 0
  private lastFrame = performance.now()
  private fps = 60
  private dangerMarkers: { mesh: Mesh; until: number; meteor?: Mesh; x: number; y: number; z: number }[] = []
  private supplyMarker: { beam: Mesh; crate: Mesh; landAt: number } | null = null
  private lastCountdown = 0
  readonly sound = new Sound()
  private particles = new Particles()
  private projectiles = new ProjectileModels(this.layout, this.atlas.texture)
  private damageText = new FloatingText()
  private gens = new GeneratorDisplays()
  private shake = 0
  private hurtRoll = 0
  private pendingHit: { id: number; at: number; crit: boolean } | null = null
  private lastKnock: { vx: number; vz: number; at: number } | null = null
  private running = true
  private fallbackNotified = false
  /** Last time a big invisibility mote was emitted for a remote player. */
  private invisParticleAt = new Map<number, number>()
  /** The browser-shortcut hint is shown once per session, not on every Ctrl press. */
  private shortcutHintShown = false
  /** Keyboard Lock is requested once per full-screen entry, not every frame. */
  private keyboardLocked = false
  /**
   * Set when the browser refuses pointer lock (embedded panels, some managed
   * laptops). The round must stay playable: keyboard intent still counts, and
   * only mouse look is lost.
   */
  private pointerLockFailed = false
  private wasFullscreen = false
  readonly icons: IconPainter
  settings: Settings

  /** Ask before closing the tab or window while a round is live. */
  private readonly guardLeave = (event: BeforeUnloadEvent) => {
    const phase = this.gameView?.phase
    if (!this.running || (phase !== 'countdown' && phase !== 'playing')) return
    event.preventDefault()
    event.returnValue = ''
  }

  /**
   * Keys the tab strip keeps for itself. Locking "KeyW" also captures Ctrl+W,
   * and "Digit1" captures Ctrl+1 (a locked key covers its modifier
   * combinations), which is the only way a page can keep them. Escape is left
   * out on purpose so the browser can still leave full screen.
   */
  private static readonly BROWSER_KEYS = ['KeyW', 'KeyR', 'KeyT', 'KeyN', 'KeyQ', 'KeyP', 'KeyS', 'KeyO', 'KeyL', 'KeyF', 'Tab', 'Digit0', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9']

  /**
   * In JavaScript full screen, Chromium can hand the tab strip's keys to the
   * game (the Keyboard Lock API). This is what Bloxd relies on as well. Outside
   * full screen the browser keeps Ctrl+W and Ctrl+1, so this also remembers
   * that the player chose a window and stops offering the same prompt.
   */
  private readonly syncKeyboardLock = () => {
    this.hud.refreshPause()
    if (document.fullscreenElement) this.wasFullscreen = true
    else if (this.wasFullscreen) {
      this.wasFullscreen = false
      this.leftDown = this.rightDown = false
      this.cancelBow()
      this.keys.clear()
      this.stopDig()
      this.sprintLatched = false
      this.hud.setLocked(false)
      this.hud.toast('Full screen is required to play. Click Back to game to return.', 5000)
    }
    const keyboard = (navigator as Navigator & { keyboard?: { lock?: (keys?: string[]) => Promise<void>; unlock?: () => void } }).keyboard
    if (!keyboard?.lock) return
    if (this.running && document.fullscreenElement) {
      if (this.keyboardLocked) return
      this.keyboardLocked = true
      const pending = keyboard.lock(Game.BROWSER_KEYS)
      if (pending) void pending.catch(() => (this.keyboardLocked = false))
    } else if (this.keyboardLocked) {
      this.keyboardLocked = false
      keyboard.unlock?.()
    }
  }

  constructor(
    private readonly container: HTMLElement,
    private readonly connection: Connection<ClientMessage, ServerMessage>,
    settings: Settings,
    readonly mode: { offline: boolean; world: 'arena' | 'sandbox' | 'parkour' | 'upgrade' | 'survival' },
  ) {
    this.settings = settings
    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
    this.renderer.outputColorSpace = SRGBColorSpace
    // The chunk shader applies Voxelize's light curve itself.
    this.renderer.toneMapping = NoToneMapping
    this.renderer.autoClear = false
    this.renderer.setClearColor(this.env.skyMiddle)
    container.appendChild(this.renderer.domElement)

    this.scene.add(new HemisphereLight(0xcfe6ff, 0x5a6a80, 1.6))
    this.scene.add(new AmbientLight(0xffffff, 0.35))
    this.sun.position.copy(this.env.sunDirection).multiplyScalar(100)
    this.scene.add(this.sun)
    this.scene.fog = new Fog(this.env.skyMiddle, this.env.fogNear, this.env.fogFar)
    this.scene.add(this.players.group, this.dropModels.group, this.cursor.group, this.particles.mesh, this.projectiles.group, this.damageText.group, this.selfAvatar.root, this.gens.group)
    this.selfAvatar.root.visible = false
    this.camera.rotation.order = 'YXZ'

    this.icons = new IconPainter(this.atlas.canvas, this.layout, (id, team) => {
      const def = item(id)
      return def?.kind === 'block' ? placedBlock(def, team) : def?.kind === 'tnt' ? def.block : undefined
    })
    this.hud = new Hud(container, this)

    this.hud.setLoading('Joining the game')
    connection.onMessage((m) => this.onMessage(m))
    connection.onClose((reason) => this.hud.showError(reason))
    this.bindInput()
    window.addEventListener('beforeunload', this.guardLeave)
    document.addEventListener('fullscreenchange', this.syncKeyboardLock)
    this.syncKeyboardLock()
    window.addEventListener('resize', this.resize)
    this.resize()
    requestAnimationFrame(this.frame)
  }

  send(msg: ClientMessage) {
    this.connection.send(msg)
  }

  destroy() {
    this.running = false
    this.syncKeyboardLock()
    this.connection.close()
    window.removeEventListener('beforeunload', this.guardLeave)
    document.removeEventListener('fullscreenchange', this.syncKeyboardLock)
    window.removeEventListener('wheel', this.detectTouchpad)
    window.removeEventListener('resize', this.resize)
    this.clearDangerMarkers()
    this.clearSupplyMarker()
    this.renderer.dispose()
    this.hud.destroy()
    this.renderer.domElement.remove()
  }

  // Server messages -----------------------------------------------------------

  private onMessage(m: ServerMessage) {
    switch (m.t) {
      case 'welcome':
        this.myId = m.id
        this.tp = m.tp
        this.loadWorld(m.world, m.map)
        this.send({ t: 'look', look: encodeLook(this.look) })
        break
      case 'world':
        this.loadWorld(m.world, m.map)
        break
      case 'tick': {
        this.tick = m.tick
        for (const d of m.players) {
          const prev = this.viewMap.get(d.id)
          const next = { ...prev, ...d } as PlayerView
          // Someone took a hit: a puff of red, a thump and the damage over their head.
          if (prev && d.hurtAt !== undefined && d.id !== this.myId && next.alive) {
            const mine = this.pendingHit && this.pendingHit.id === d.id && performance.now() - this.pendingHit.at < 600
            this.particles.burst(next.x, next.y + 1.1, next.z, '#c0302a', mine ? 14 : 8, 0.6, mine ? 3 : 2)
            this.sound.play('hit', mine ? 1 : falloff(Math.hypot(next.x - this.me.x, next.y - this.me.y, next.z - this.me.z)))
            const lost = (prev.health ?? next.health) - next.health
            if (lost > 0) this.damageText.show(next.x, next.y + 2.4, next.z, `-${lost}`, mine && this.pendingHit!.crit ? '#ffe14a' : '#ff5a4a')
            if (mine) {
              if (this.pendingHit!.crit) this.particles.burst(next.x, next.y + 1.5, next.z, '#fff3a0', 12, 0.8, 4)
              this.hud.hitMarker(this.pendingHit!.crit)
              this.pendingHit = null
            }
          }
          this.viewMap.set(d.id, next)
        }
        for (const id of m.gone ?? []) this.viewMap.delete(id)
        this.views = [...this.viewMap.values()]
        if (m.game) this.gameView = m.game
        this.players.update(this.views, this.myId, m.tick, performance.now(), this.self?.team ?? null)
        if (m.drops) this.dropModels.update(m.drops)
        break
      }
      case 'self': {
        const before = this.self
        this.self = m.self
        if (!before) this.hud.setLoading(null)
        if (before && m.self.health < before.health && m.self.alive) {
          this.hud.hurtFlash()
          this.sound.play('hurt')
          // Knockback points away from whoever hit us: show where it came from and tilt the view.
          const k = this.lastKnock
          if (k && performance.now() - k.at < 400 && Math.hypot(k.vx, k.vz) > 0.05) {
            const fx = -Math.sin(this.me.yaw)
            const fz = -Math.cos(this.me.yaw)
            const ahead = -(k.vx * fx + k.vz * fz)
            const right = -(k.vx * -fz + k.vz * fx)
            const angle = Math.atan2(right, ahead)
            this.hud.damageFrom(angle)
            this.hurtRoll = Math.sign(right || 1) * 0.12
          } else this.hurtRoll = 0.08
        }
        if (before && ['iron', 'gold', 'diamond', 'emerald'].some((r) => countItem(m.self.inventory, r) > countItem(before.inventory, r))) this.sound.play('pickup', 0.6)
        if (!m.self.alive && before?.alive !== false) this.enterSpectator()
        break
      }
      case 'blocks':
        for (const [x, y, z, raw] of m.changes) {
          const before = this.world?.get(x, y, z) ?? AIR
          this.world?.set(x, y, z, raw & 0x7f, (raw & 0x80) !== 0)
          const after = raw & 0x7f
          const d = Math.hypot(x + 0.5 - this.me.x, y + 0.5 - this.me.y, z + 0.5 - this.me.z)
          // A flood updates thousands of cells: it is not thousands of placed blocks.
          if (before !== AIR && after === AIR && blockDef(before).meta.fluid !== true) {
            this.particles.burst(x + 0.5, y + 0.5, z + 0.5, blockDef(before).texture.top, 14)
            this.sound.play('break', falloff(d))
          } else if (before === AIR && after !== AIR && blockDef(after).meta.fluid !== true) this.sound.play('place', falloff(d) * 0.7)
        }
        break
      case 'velocity':
        this.me.vx = m.vx
        this.me.vy = m.vy
        this.me.vz = m.vz
        this.me.onGround = false
        // Keep the hit's momentum for a moment instead of braking it away on the next tick.
        this.me.knockbackTicks = 10
        this.lastKnock = { vx: m.vx, vz: m.vz, at: performance.now() }
        break
      case 'teleport':
        this.me.x = this.prev.x = m.x
        this.me.y = this.prev.y = m.y
        this.me.z = this.prev.z = m.z
        this.me.yaw = m.yaw
        this.me.pitch = m.pitch
        this.me.vx = this.me.vy = this.me.vz = 0
        this.me.knockbackTicks = 0
    this.me.fallDistance = 0
    this.bridgeGround = null
    this.bridgeCoyote = 0
    this.tp = m.tp
        break
      case 'event':
        this.hud.event(m)
        if (m.kind === 'bed') this.sound.play('bed')
        else if (m.kind === 'kill' && this.self && m.text.includes(` by ${this.viewMap.get(this.myId)?.name}`)) this.sound.play('kill')
        else if (m.kind === 'error') this.sound.play('deny')
        else if (m.kind === 'title' && (m.text === 'Protect your bed' || m.text === 'Upgrade Rush')) this.sound.play('start')
        break
      case 'summary':
        this.hud.showSummary(m)
        break
      case 'danger': {
        const mark = new Mesh(new RingGeometry(m.radius * 0.75, m.radius, 48), new MeshBasicMaterial({ color: '#ff3434', transparent: true, opacity: 0.8, depthWrite: false, side: DoubleSide }))
        mark.rotation.x = -Math.PI / 2
        mark.position.set(m.x + 0.5, m.y + 1.03, m.z + 0.5)
        this.scene.add(mark)
        let meteor: Mesh | undefined
        if (m.meteor) {
          meteor = new Mesh(new IcosahedronGeometry(1.25, 1), new MeshBasicMaterial({ color: '#ff7428' }))
          meteor.visible = false
          this.scene.add(meteor)
        }
        this.dangerMarkers.push({ mesh: mark, until: m.until, meteor, x: m.x, y: m.y, z: m.z })
        this.sound.play('tick')
        break
      }
      case 'supply': {
        this.clearSupplyMarker()
        if (m.active) {
          const beam = new Mesh(new BoxGeometry(0.3, 18, 0.3), new MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0.65, depthWrite: false }))
          const crate = new Mesh(new BoxGeometry(0.9, 0.9, 0.9), new MeshBasicMaterial({ color: '#d8a844' }))
          beam.position.set(m.x, m.y + 9, m.z)
          crate.position.set(m.x, m.y + 0.45, m.z)
          crate.visible = this.tick >= m.landAt
          this.scene.add(beam, crate)
          this.supplyMarker = { beam, crate, landAt: m.landAt }
        }
        break
      }
      case 'projectiles':
        this.projectiles.update(m.list, performance.now())
        break
      case 'explosion': {
        const d = Math.hypot(m.x - this.me.x, m.y - this.me.y, m.z - this.me.z)
        this.particles.burst(m.x, m.y, m.z, '#ff9a2a', 30, m.power, 7)
        this.particles.burst(m.x, m.y, m.z, '#5a5a5a', 24, m.power * 1.2, 4)
        this.sound.play('explode', falloff(d, 48))
        this.shake = Math.max(this.shake, Math.max(0, 1 - d / (m.power * 6)))
        break
      }
      case 'gens':
        this.gens.update(m.list)
        break
      case 'effect':
        this.killEffect(m.effect, m.x, m.y, m.z)
        break
      case 'votes':
        this.votes = m
        // A fresh lobby clears every vote, including ours.
        if (m.maps.every((x) => x.votes === 0)) this.myVote = null
        break
      case 'lobby':
        this.botLevel = m.botLevel
        break
      case 'storage':
        this.hud.showStorage(m)
        break
    }
  }

  private clearDangerMarkers() {
    for (const marker of this.dangerMarkers) {
      for (const mesh of [marker.mesh, marker.meteor]) {
        if (!mesh) continue
        this.scene.remove(mesh)
        mesh.geometry.dispose()
        ;(mesh.material as MeshBasicMaterial).dispose()
      }
    }
    this.dangerMarkers = []
  }

  private clearSupplyMarker() {
    if (!this.supplyMarker) return
    for (const mesh of [this.supplyMarker.beam, this.supplyMarker.crate]) {
      this.scene.remove(mesh)
      mesh.geometry.dispose()
      ;(mesh.material as MeshBasicMaterial).dispose()
    }
    this.supplyMarker = null
  }

  private loadWorld(encoded: string, map: MapMeta) {
    this.clearDangerMarkers()
    this.clearSupplyMarker()
    this.bridgeGround = null
    this.bridgeCoyote = 0
    this.chunks?.dispose()
    if (this.chunks) this.scene.remove(this.chunks.group)
    if (this.decor) this.scene.remove(this.decor)
    if (this.sky) this.scene.remove(this.sky.root)
    this.players.clear()
    this.dropModels.clear()
    this.projectiles.clear()
    this.viewMap.clear()
    this.world = World.decode(fromBase64(encoded))
    this.map = map
    this.applyAtmosphere(atmosphereFor(map))
    this.fallbackNotified = false
    this.chunks = new ChunkRenderer(this.world, this.layout, this.material, this.glassMaterial)
    this.chunks.buildAll()
    this.scene.add(this.chunks.group)
    this.decor = createMapDecor(map.npcs, map.labels.filter((l) => l.text !== 'Diamond' && l.text !== 'Emerald'), this.layout, this.atlas.texture)
    this.gens.load(map.generators)
    this.scene.add(this.decor)
    const top = map.parkour?.top ?? map.bases[0]?.spawn[1] ?? 40
    this.sky = createSky(this.env, top + this.atmosphere.cloudHeight, [this.world.sx / 2, this.world.sz / 2])
    this.sky.cloudMaterial.uniforms.uCloudColor.value.set(this.atmosphere.cloudColor)
    this.scene.add(this.sky.root)
    // A new world must not reset a living player's view (or close their shop).
    if (!this.alive) this.enterSpectator()
  }

  // Input ---------------------------------------------------------------------

  get uiOpen(): boolean {
    return this.hud.modalOpen
  }

  get locked(): boolean {
    return document.pointerLockElement === this.renderer.domElement
  }

  /**
   * Full screen is offered, not imposed. It is the only browser state where
   * Ctrl+W and Ctrl+1 can be captured, but refusing it must never lock a player
   * out of their own round.
   */
  get needsFullscreen(): boolean {
    return !IS_DESKTOP && typeof document !== 'undefined' && typeof document.documentElement.requestFullscreen === 'function' && !document.fullscreenElement
  }

  /** The game accepts input when the mouse is captured, or when the browser refused to capture it. */
  get acceptsInput(): boolean {
    return this.locked || this.pointerLockFailed || this.automation || this.mode.world === 'parkour'
  }

  /**
   * Start or resume playing: grab the mouse and, unless the player opted out,
   * enter JavaScript full screen from the same click. Full screen is the only
   * browser state where Keyboard Lock can keep Ctrl+W and Ctrl+1 out of the tab
   * strip (see syncKeyboardLock). A refused request still starts the game.
   */
  lock(_fullscreen = false) {
    this.sound.unlock()
    if (this.uiOpen) return
    // Browser play is full-screen only, as on Bloxd: windowed play cannot keep
    // the pointer or the tab-strip keys, so it is not accepted. Start both
    // requests in this click: awaiting full screen before asking for the pointer
    // loses user activation and makes lock fail intermittently.
    if (this.needsFullscreen) this.playFullscreen()
    this.lockPointer()
  }

  /**
   * Enter full screen, then take the mouse. A refused or stalled full-screen
   * request must never leave the player looking at a game with no cursor: the
   * timer resumes anyway, and taking the pointer twice is harmless.
   */
  private playFullscreen(): void {
    let resumed = false
    let timer = 0
    const finish = () => {
      if (resumed) return
      resumed = true
      window.clearTimeout(timer)
      if (IS_DESKTOP || document.fullscreenElement || this.pointerLockFailed) {
        if (!this.locked) this.lockPointer()
      } else {
        // Windowed play is allowed: only the tab-strip shortcuts are lost.
        if (!this.locked) this.lockPointer()
        this.hud.toast('Playing windowed. Full screen keeps Ctrl+W and Ctrl+1 in the game.', 4000)
      }
    }
    timer = window.setTimeout(finish, 1200)
    try {
      void document.documentElement.requestFullscreen().then(finish, finish)
    } catch {
      finish()
    }
  }

  private lockPointer(): void {
    if (this.uiOpen) return
    this.renderer.domElement.requestPointerLock?.()?.catch?.(() => {})
  }

  /**
   * Full screen is the only browser state where Keyboard Lock may capture
   * reserved shortcuts such as Ctrl+W and Ctrl+1. It must be requested from a
   * click, so the pause menu calls this directly.
   */
  async toggleFullscreen(): Promise<void> {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else {
        await document.documentElement.requestFullscreen()
        this.lockPointer()
      }
    } catch {
      this.hud.toast('The browser blocked full screen. Click the game, then try again.')
    }
  }

  private bindInput() {
    const canvas = this.renderer.domElement
    canvas.addEventListener('click', () => {
      // With the chat box open the click used to do nothing at all: the open
      // chat counted as a reason not to grab the mouse, and the chat stayed
      // open behind it. Close it first, then play.
      if (this.hud.chatOpen) this.hud.closeChat()
      else if (!this.locked) this.lock(true)
    })
    document.addEventListener('pointerlockchange', () => {
      if (this.locked) this.firstLookAfterLock = true
      else {
        this.firstLookAfterLock = false
        this.leftDown = this.rightDown = false
        this.cancelBow()
        this.keys.clear()
        this.stopDig()
        this.sprintLatched = false
      }
      this.hud.setLocked(this.locked)
    })
    // A blocked pointer lock used to leave the page with neither mouse look nor
    // a pause menu. Always give the player a way back in.
    document.addEventListener('pointerlockerror', () => {
      // Embedded panels and some managed laptops never grant pointer lock.
      // Keep playing with the keyboard rather than freezing the round.
      this.pointerLockFailed = true
      this.hud.toast('Mouse look is unavailable here: click the game to try again. Keyboard controls stay live.')
      // The click-to-play card, not the pause menu: the pause menu would swallow
      // the very keyboard controls the toast just promised were still live.
      this.hud.setLocked(false)
    })
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return
      // Ignore exactly one event per lock: browsers can emit a jump right after
      // capturing the pointer. Never gate on time or drop large deltas after
      // that, or a high-DPI mouse freezes the camera.
      if (this.firstLookAfterLock) {
        this.firstLookAfterLock = false
        return
      }
      const step = clampLookDelta(e.movementX, e.movementY)
      if (!step) return
      const s = this.settings.sensitivity * 0.0022
      // The spectator's look is its own: a dead body's yaw is not the camera's.
      const view = this.alive ? this.me : this.spectator
      view.yaw -= step.x * s
      const dy = step.y * s * (this.settings.invertY ? -1 : 1)
      view.pitch = Math.max(-Math.PI / 2 + 0.001, Math.min(Math.PI / 2 - 0.001, view.pitch - dy))
    })
    document.addEventListener('mousedown', (e) => {
      if (!this.locked) return
      if (e.button === 0) {
        this.leftDown = true
        this.clickQueue.push('attack')
      } else if (e.button === 2) {
        // Keep the browser's context menu out of the way while playing.
        e.preventDefault()
        this.rightDown = true
        this.placeCooldown = 0
        this.clickQueue.push('use')
      }
    })
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.leftDown = false
        this.stopDig()
      } else if (e.button === 2) {
        this.rightDown = false
        this.releaseBow()
      }
    })
    document.addEventListener('wheel', (e) => {
      if (!this.locked || !this.self) return
      const next = (this.self.selected + (e.deltaY > 0 ? 1 : HOTBAR - 1)) % HOTBAR
      this.select(next)
    })
    window.addEventListener('wheel', this.detectTouchpad, { passive: true })
    window.addEventListener('keydown', (e) => {
      // The settings and wardrobe windows bind their own keys and close
      // themselves; nothing here should see those presses.
      if (this.hud.settingsOpen) return
      if (this.hud.chatOpen) {
        // The chat box handles Enter and Esc while it has focus. If focus moved
        // away (a click, alt-tab), Esc must still close it instead of leaving
        // the game with no working keyboard.
        if (e.code === 'Escape') {
          e.preventDefault()
          this.hud.closeChat()
        }
        return
      }
      // Ctrl+W / Cmd+W close the tab, and Ctrl+1..9 switch browser tabs. A page
      // cannot cancel those outside JavaScript fullscreen, where Keyboard Lock
      // (see syncKeyboardLock) hands them to the game. Consume them here too, so
      // a browser that does deliver them cannot also trigger a game action.
      const digit = /^Digit[1-9]$/.test(e.code)
      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyW' || digit)) {
        // A browser that does deliver these still must not walk forward or
        // change the hotbar slot on its way to closing or switching the tab.
        e.preventDefault()
        return
      }
      // Warn once before the player loses a match to the tab strip.
      if ((e.code === 'ControlLeft' || e.code === 'ControlRight') && !this.shortcutHintShown && !document.fullscreenElement) {
        this.shortcutHintShown = true
        this.hud.toast("Ctrl is the browser's: Ctrl+W closes the tab and Ctrl+1..9 switch tabs. Full screen takes them back.", 6000)
      }
      const action = actionFor(this.settings, e.code)
      // Parkour is keyboard-first, so keep the page from scrolling or tabbing
      // while the arrows and Space drive the game without a mouse.
      if (this.mode.world === 'parkour' && (e.code.startsWith('Arrow') || e.code === 'Space')) e.preventDefault()
      // Tab is the browser's focus key, and G opens the leaderboard while held.
      if (action === 'inventory' || action === 'players') e.preventDefault()
      if (action === 'players' && !e.repeat) this.hud.toggleScoreboard()
      // Escape leaves pointer lock (the browser does that itself), so it must
      // always end up somewhere useful: close a window, or show the pause card.
      if (e.code === 'Escape') {
        e.preventDefault()
        if (this.locked) document.exitPointerLock?.()
        else if (this.uiOpen) this.hud.closeModal(false)
        else this.hud.openPause()
        return
      }
      // Auto-repeat on Tab/B used to reopen and immediately close the window.
      if (e.repeat && (action === 'inventory' || action === 'shop')) return
      if (this.uiOpen) {
        if (e.code === 'Escape' || action === 'inventory' || action === 'shop') this.hud.closeModal()
        return
      }
      if (this.mode.world === 'survival' && e.code === 'KeyF' && !action && !e.repeat && this.locked && this.alive) {
        e.preventDefault()
        this.send({ t: 'shove' })
        return
      }
      if (action === 'use' && this.locked && !e.repeat) {
        // E is the keyboard version of right-click: tap to use, hold to place or shield.
        this.rightDown = true
        this.placeCooldown = 0
        this.clickQueue.push('use')
      }
      if (action === 'forward' && !e.repeat) {
        if (this.settings.doubleTapSprint && performance.now() - this.lastForwardTap < 280) this.sprintLatched = true
        this.lastForwardTap = performance.now()
      }
      if (action === 'sprint' && !e.repeat && this.settings.sprintMode === 'toggle') this.sprintLatched = !this.sprintLatched
      if (e.code.startsWith('Digit')) {
        const n = Number(e.code.slice(5))
        if (n >= 1 && n <= 9) this.select(n - 1)
      }
      if (action === 'chat' || action === 'command') {
        e.preventDefault()
        this.hud.openChat(action === 'command' ? '/' : '')
        return
      }
      if (action === 'perspective' && !e.repeat) this.thirdPerson = !this.thirdPerson
      if (action === 'movement' && !e.repeat) this.cycleMovement()
      if (action === 'debug' && !e.repeat) {
        e.preventDefault()
        this.hud.toggleDebug()
      }
      if (action === 'inventory') this.hud.openInventory()
      if (action === 'shop') this.openNearestShop()
      // Q throws one of what you hold; Ctrl+Q (or Shift+Q) throws the stack.
      // In a browser the full-screen Keyboard Lock owns Ctrl, so this cannot
      // leak into a tab shortcut.
      if (action === 'drop' && this.locked) this.send({ t: 'drop', all: e.ctrlKey || e.shiftKey })
      // Keep the page from scrolling or the browser acting on game keys while playing.
      if (this.locked && (action || e.code === 'Space' || digit)) e.preventDefault()
      this.keys.add(e.code)
    })
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code)
      const action = actionFor(this.settings, e.code)
      if (action === 'use') {
        this.rightDown = false
        this.releaseBow()
      }
      // A double-tap sprint lasts while forward is held; a toggled one until toggled off.
      if (action === 'forward' && this.settings.sprintMode !== 'toggle') this.sprintLatched = false
    })
    window.addEventListener('blur', () => {
      // Alt-tabbing with a mouse button held used to keep mining or placing.
      this.keys.clear()
      this.leftDown = this.rightDown = false
      this.cancelBow()
      this.stopDig()
      this.sprintLatched = false
    })
    // A hidden tab stops delivering keyup, so drop every held key. Coming back
    // to a live round is also the clearest sign that a browser shortcut stole
    // the tab: offer full screen once.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.keys.clear()
        this.leftDown = this.rightDown = false
        this.cancelBow()
        this.stopDig()
        this.sprintLatched = false
        return
      }
      // A hidden tab stops rendering, so the next frame can carry a huge
      // delta. Reset the clocks before resuming instead of letting the
      // accumulator catch up in one jump.
      this.lastFrame = performance.now()
      this.accumulator = 0
      this.placeCooldown = 0
      this.hud.setLocked(this.locked)
      // Browsers drop pointer lock when the tab changes. The server keeps the
      // player alive, so make the resume explicit rather than looking frozen.
      if (!this.locked && this.running && (this.gameView?.phase === 'playing' || this.gameView?.phase === 'countdown')) {
        this.hud.toast('Tab was hidden. Click Back to game to resume.', 5000)
        this.hud.openPause()
      }
      if (!this.shortcutHintShown && !document.fullscreenElement && (this.gameView?.phase === 'playing' || this.gameView?.phase === 'countdown')) {
        this.shortcutHintShown = true
        this.hud.toast('Back from another tab. Full screen keeps Ctrl+W and Ctrl+1 in the game.', 5000)
      }
    })
  }

  /** Whether any key bound to `action` is held. */
  private down(action: Action): boolean {
    return (this.settings.keys[action] ?? []).some((c) => this.keys.has(c))
  }

  /** Applies settings live: render size, fog distance, volume. */
  applySettings(s: Settings) {
    this.settings = s
    this.renderer.setPixelRatio(pixelRatio(s.quality, window.devicePixelRatio))
    this.resize()
    const near = s.renderDistance * this.atmosphere.fogNearFactor
    const far = s.renderDistance * this.atmosphere.fogFarFactor
    this.env.fogNear = near
    this.env.fogFar = far
    for (const m of [this.material, this.glassMaterial]) {
      m.uniforms.uFogNear.value = near
      m.uniforms.uFogFar.value = far
    }
    if (this.sky) {
      this.sky.cloudMaterial.uniforms.uFogNear.value = near * 2
      this.sky.cloudMaterial.uniforms.uFogFar.value = far * 2.4
    }
    if (this.scene.fog instanceof Fog) {
      this.scene.fog.near = near
      this.scene.fog.far = far
    }
    // Far enough for the sky dome (radius 400) whatever the fog distance.
    this.camera.far = Math.max(600, far * 2)
    this.camera.updateProjectionMatrix()
    this.sound.setVolume(s.volume)
    this.hud.setMovementPreset()
  }

  /** The movement preset that applies in this mode. Only the sandbox varies. */
  movementPreset(): MovementPresetId {
    return this.mode.world === 'sandbox' ? this.settings.sandboxMovement : DEFAULT_MOVEMENT
  }

  /** M cycles Classic -> Surefoot -> Snapline -> Flowline in the practice sandbox. */
  cycleMovement(): void {
    if (this.mode.world !== 'sandbox') return
    const next = nextMovement(this.settings.sandboxMovement)
    this.settings = { ...this.settings, sandboxMovement: next }
    saveSettings(this.settings)
    this.hud.setMovementPreset()
    const p = MOVEMENT_PRESETS[next]
    this.hud.toast(`Movement: ${p.name}. ${p.blurb}`)
  }

  /** Applies an arena's palette to the chunk material, scene fog and clear colour. */
  private applyAtmosphere(a: Atmosphere): void {
    this.atmosphere = a
    const env = this.env
    env.skyTop.set(a.skyTop)
    env.skyMiddle.set(a.skyMiddle)
    env.skyBottom.set(a.skyBottom)
    env.sunColor.set(a.sunColor)
    env.sunDirection.set(...a.sunDirection).normalize()
    env.ambientColor.set(a.ambientColor)
    env.sunlightIntensity = a.sunlightIntensity
    env.minLightLevel = a.minLightLevel
    this.sun.color.set(a.sunColor)
    this.sun.position.copy(env.sunDirection).multiplyScalar(100)
    const near = this.settings.renderDistance * a.fogNearFactor
    const far = this.settings.renderDistance * a.fogFarFactor
    env.fogNear = near
    env.fogFar = far
    for (const m of [this.material, this.glassMaterial]) {
      m.uniforms.uSunlightIntensity.value = a.sunlightIntensity
      m.uniforms.uMinLightLevel.value = a.minLightLevel
      m.uniforms.uFogNear.value = near
      m.uniforms.uFogFar.value = far
    }
    if (this.scene.fog instanceof Fog) {
      this.scene.fog.color.copy(env.skyMiddle)
      this.scene.fog.near = near
      this.scene.fog.far = far
    }
    this.renderer.setClearColor(env.skyMiddle)
  }

  /** Bow draw in progress (local clock, for the view model and charge bar). */
  private drawStart: number | null = null

  drawCharge(): number {
    return this.drawStart === null ? 0 : Math.min(1, (performance.now() - this.drawStart) / 1000)
  }

  private releaseBow() {
    if (this.drawStart === null) return
    this.drawStart = null
    this.send({ t: 'release' })
    this.sound.play('bow')
  }

  /**
   * Drop a draw without firing, for Escape, alt-tab and pointer-lock loss.
   * The server may still think a draw is open; the next `draw` overwrites it,
   * and `release` refuses without a held bow, so no arrow appears later.
   */
  private cancelBow() {
    this.drawStart = null
  }

  select(slot: number) {
    if (!this.self) return
    this.releaseBow()
    this.self.selected = slot
    this.stopDig()
    this.send({ t: 'select', slot })
  }

  private openNearestShop() {
    const npc = this.map?.npcs
      .filter((n) => n.kind === 'shop' || n.kind === 'upgrades')
      .map((n) => ({ n, d: Math.hypot(n.x - this.me.x, n.z - this.me.z) }))
      .sort((a, b) => a.d - b.d)[0]
    if (npc && npc.d < 5) this.hud.openShop(npc.n.kind === 'upgrades' ? 'upgrades' : 'shop')
    else this.hud.toast('Walk up to a shopkeeper first.')
  }

  // Simulation ------------------------------------------------------------------

  get alive(): boolean {
    return !!this.self?.alive
  }

  /** Lets scripts and tests drive input without pointer lock (set from the console: game.automation = true). */
  automation = false

  private input(): MoveInput {
    const parkour = this.mode.world === 'parkour'
    if (this.uiOpen || !this.acceptsInput) return { ...IDLE_INPUT, yaw: this.me.yaw, pitch: this.me.pitch, sneak: this.me.sneaking && this.down('sneak') }
    const k = (a: Action) => this.down(a)
    // Parkour is keyboard-first: WASD moves and the arrow keys look. This also
    // lets a player who never clicks the canvas run the course.
    const forward = parkour ? (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0) : (k('forward') ? 1 : 0) - (k('back') ? 1 : 0)
    const strafe = parkour ? (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0) : (k('right') ? 1 : 0) - (k('left') ? 1 : 0)
    // The physics stops a sprint when you stop moving forward, sneak or hit a wall.
    const mode = this.settings.sprintMode
    if (forward <= 0 && mode === 'toggle') this.sprintLatched = false
    const sprint = mode === 'always' || this.sprintLatched || (mode === 'hold' && k('sprint'))
    const held = this.heldDef()
    const effect = (e: 'speed' | 'jump' | 'invisible') => (this.self?.effects?.[e] ?? 0) > this.tick
    // Upgrade Rush tiers raise the walk cap; the server judges input against the same gear speed.
    const gear = this.self?.upgrade?.speed ?? 1
    return {
      speedBoost: (effect('speed') ? SPEED_BOOST : 1) * gear,
      jumpBoost: effect('jump') ? JUMP_BOOST : 0,
      forward,
      strafe,
      jump: k('jump'),
      sneak: k('sneak'),
      sprint,
      shield: this.rightDown && held?.kind === 'shield',
      yaw: this.me.yaw,
      pitch: this.me.pitch,
    }
  }

  heldDef() {
    if (!this.self) return undefined
    return item(this.self.inventory[this.self.selected]?.id)
  }

  private stepTick() {
    if (!this.world || !this.self) return
    if (!this.alive) {
      this.stepSpectator()
      return
    }
    this.prev = { x: this.me.x, y: this.me.y, z: this.me.z }
    const input = this.input()
    stepMovement(this.world, this.me, input, this.movementPreset())
    this.updateBridgeGround()
    this.send({
      t: 'input',
      seq: ++this.inputSeq,
      x: this.me.x,
      y: this.me.y,
      z: this.me.z,
      vx: this.me.vx,
      vy: this.me.vy,
      vz: this.me.vz,
      yaw: this.me.yaw,
      pitch: this.me.pitch,
      sneak: this.me.sneaking,
      sprint: this.me.sprinting,
      shield: !!input.shield,
      tp: this.tp,
    })
    this.remoteBoxes = this.players.boxes(performance.now())
    this.updateTarget()
    if (this.chunks?.usingFallback && !this.fallbackNotified) {
      this.fallbackNotified = true
      this.hud.toast('Graphics compatibility mode: the meshing worker was unavailable.')
    }
    for (const click of this.clickQueue.splice(0)) {
      if (click === 'attack') this.primary()
      else this.secondary()
    }
    this.continueActions()
  }

  /** Take the fixed overview camera, with look independent of the dead body. */
  private enterSpectator(): void {
    this.bridgeCoyote = 0
    const s = this.map?.spectator
    this.spectator = {
      x: s?.[0] ?? 0,
      y: s?.[1] ?? 40,
      z: s?.[2] ?? 0,
      yaw: s?.[3] ?? 0,
      pitch: s?.[4] ?? -0.45,
    }
    this.hud.closeForDeath()
    this.keys.clear()
    this.leftDown = this.rightDown = false
    this.dig = null
    this.clickQueue.length = 0
  }

  /** Arrow-key look for the keyboard-first parkour camera, in radians per second. */
  private stepParkourLook(dt: number): void {
    if (this.mode.world !== 'parkour') return
    const turn = (this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('ArrowLeft') ? 1 : 0)
    const look = (this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('ArrowDown') ? 1 : 0)
    if (!turn && !look) return
    this.me.yaw -= turn * 2.2 * dt
    this.me.pitch = Math.max(-Math.PI / 2 + 0.001, Math.min(Math.PI / 2 - 0.001, this.me.pitch + look * 1.6 * dt))
  }

  private stepSpectator() {
    if (this.uiOpen) return
    // Spectator controls are fixed and keyboard-first: WASD fly, Space/Shift
    // rise and sink, arrow keys look. They do not depend on pointer lock, so a
    // player without a mouse can still watch the round.
    const held = (code: string) => this.keys.has(code)
    const fwd = (held('KeyW') ? 1 : 0) - (held('KeyS') ? 1 : 0)
    const side = (held('KeyD') ? 1 : 0) - (held('KeyA') ? 1 : 0)
    const up = (held('Space') ? 1 : 0) - (held('ShiftLeft') || held('ShiftRight') ? 1 : 0)
    const speed = held('KeyR') ? 1.5 : 0.9
    const turn = (held('ArrowLeft') ? 1 : 0) - (held('ArrowRight') ? 1 : 0)
    const look = (held('ArrowUp') ? 1 : 0) - (held('ArrowDown') ? 1 : 0)
    this.spectator.yaw += turn * 0.045
    this.spectator.pitch = Math.max(-Math.PI / 2 + 0.001, Math.min(Math.PI / 2 - 0.001, this.spectator.pitch + look * 0.035))
    const [dx, dy, dz] = lookDirection(this.spectator.yaw, this.spectator.pitch)
    const rx = Math.cos(this.spectator.yaw)
    const rz = -Math.sin(this.spectator.yaw)
    this.spectator.x += (dx * fwd + rx * side) * speed
    this.spectator.y += (dy * fwd + up) * speed
    this.spectator.z += (dz * fwd + rz * side) * speed
    // A soft leash keeps a lost spectator near the arena instead of in the void.
    if (this.world) {
      this.spectator.x = Math.max(-16, Math.min(this.world.sx + 16, this.spectator.x))
      this.spectator.y = Math.max(1, Math.min(this.world.sy + 32, this.spectator.y))
      this.spectator.z = Math.max(-16, Math.min(this.world.sz + 16, this.spectator.z))
    }
    this.clickQueue.length = 0
  }

  private eyePos(): [number, number, number] {
    return [this.me.x, this.me.y + (this.me.sneaking ? SNEAK_EYE_HEIGHT : EYE_HEIGHT), this.me.z]
  }

  private updateTarget() {
    if (!this.world || !this.map) return
    const eye = this.eyePos()
    const dir = lookDirection(this.me.yaw, this.me.pitch)
    const block = raycastBlock(this.world, eye, dir, BLOCK_REACH)
    // Players and shopkeepers are seen past flowers, poles and chains: only a solid block hides them.
    const wall = raycastBlock(this.world, eye, dir, BLOCK_REACH, true)
    let best: Target = block ? { kind: 'block', hit: block } : null
    let bestD = wall ? wall.distance : Infinity
    this.npcTarget = null
    for (const n of this.map.npcs) {
      if (n.kind === 'dummy') continue
      const hit = rayBox(eye, dir, playerBox(n.x, n.y, n.z, false), BLOCK_REACH)
      if (hit && hit.distance < bestD && (!this.npcTarget || hit.distance < this.npcTarget.distance)) this.npcTarget = { kind: 'npc', npc: n, distance: hit.distance }
    }
    if (this.npcTarget) {
      best = this.npcTarget
      bestD = this.npcTarget.distance
    }
    for (const p of this.remoteBoxes) {
      const hit = rayBox(eye, dir, playerBox(p.x, p.y, p.z, p.sneak), ATTACK_REACH)
      if (hit && hit.distance < bestD) {
        bestD = hit.distance
        best = { kind: 'player', id: p.id, distance: hit.distance }
      }
    }
    this.target = best
  }

  /** Counts input ticks, so the server knows how many ticks a late input covers. */
  private inputSeq = 0

  /** A shopkeeper on the line of sight, even with someone standing in front: right click talks to it. */
  private npcTarget: Extract<Target, { kind: 'npc' }> | null = null

  private primary() {
    if (this.mode.world === 'parkour') return
    const t = this.target
    this.viewModel.swingNow()
    // Remote players are drawn a few ticks in the past (the jitter buffer); say which tick, for lag compensation.
    if (t?.kind === 'player') {
      this.send({ t: 'attack', target: t.id, seen: Math.round(this.players.renderTick(performance.now())) })
      // Remember the swing so the next hurt update for this player shows as our hit (and a crit while falling).
      this.pendingHit = { id: t.id, at: performance.now(), crit: !this.me.onGround && this.me.vy < 0 }
    }
    else if (t?.kind === 'block') this.startDig(t.hit)
  }

  private secondary() {
    if (this.mode.world === 'parkour') return
    const t = this.target
    const held = this.heldDef()
    if (this.npcTarget) {
      const kind = this.npcTarget.npc.kind
      if (kind === 'shop' || kind === 'upgrades') this.hud.openShop(kind)
      else if (kind === 'ender' || kind === 'team') {
        this.send({ t: 'storage', action: 'open', kind })
        this.hud.openStorage(kind)
      }
      this.rightDown = false
      return
    }
    if (held?.kind === 'food' || held?.kind === 'potion') {
      this.send({ t: 'use' })
      this.viewModel.swingNow()
      return
    }
    if (held?.kind === 'bow') {
      // A tap released before this tick already ran releaseBow(), which had
      // nothing to cancel yet. Starting a draw now would charge forever.
      if (!startsBowDraw(held.kind, this.rightDown || this.down('use'))) return
      if (this.self && countItem(this.self.inventory, 'arrow') > 0) {
        this.drawStart = performance.now()
        this.send({ t: 'draw' })
      } else this.hud.toast('No arrows.')
      return
    }
    if (held?.kind === 'throwable') {
      this.send({ t: 'throw' })
      this.viewModel.swingNow()
      this.sound.play('throw')
      return
    }
    if (held?.kind === 'tnt' && t?.kind === 'block') {
      // Lit TNT is a server entity: no local prediction, it appears with the next update.
      this.send({ t: 'place', x: t.hit.x, y: t.hit.y, z: t.hit.z, face: t.hit.face, slot: this.self!.selected })
      this.viewModel.swingNow()
      return
    }
    if (held?.kind === 'block' && t?.kind === 'block') this.place(t.hit)
  }

  private continueActions() {
    if (this.placeCooldown > 0) this.placeCooldown--
    if (this.digCooldown > 0) this.digCooldown--
    if (this.bridgeCooldown > 0) this.bridgeCooldown--
    if (this.bridgeCooldown === 0) this.assistBridge()
    // Holding right click keeps placing, at the rate of a quick clicker.
    if (this.rightDown && this.placeCooldown === 0 && this.heldDef()?.kind === 'block' && this.target?.kind === 'block') this.place(this.target.hit)
    if (!this.leftDown || !this.world) return
    const t = this.target
    if (t?.kind !== 'block') {
      this.stopDig()
      return
    }
    const { x, y, z } = t.hit
    if (!this.dig || this.dig.x !== x || this.dig.y !== y || this.dig.z !== z) {
      if (this.digCooldown === 0) this.startDig(t.hit)
      return
    }
    const id = this.world.get(x, y, z)
    const ticks = breakTicks(id, this.heldDef())
    this.dig.progress = Math.min(1, this.dig.progress + (ticks === 0 ? 1 : 1 / ticks))
    if (this.tick % 4 === 0) this.viewModel.swingNow()
    if (id === AIR) {
      this.dig = null
      this.digCooldown = 5
    } else if (this.dig.progress >= 1) {
      // Break it now on our side, beds included; the server agrees or puts it back.
      this.world.set(x, y, z, AIR)
      this.particles.burst(x + 0.5, y + 0.5, z + 0.5, blockDef(id).texture.top, 14)
      this.sound.play('break')
      this.send({ t: 'dig', target: [x, y, z], done: true })
      this.dig = null
      this.digCooldown = 5
    }
  }

  private startDig(hit: BlockHit) {
    if (!this.world || !this.self) return
    if (checkBreak(this.world, this.map!.build, hit.x, hit.y, hit.z, this.mode.world === 'sandbox' ? 'red' : this.self.team)) return
    this.dig = { x: hit.x, y: hit.y, z: hit.z, progress: 0 }
    this.send({ t: 'dig', target: [hit.x, hit.y, hit.z] })
  }

  private stopDig() {
    if (this.dig) this.send({ t: 'dig', target: null })
    this.dig = null
  }

  /** Laptop touchpads send many tiny wheel deltas; a mouse wheel is coarse. */
  private readonly detectTouchpad = (event: WheelEvent) => {
    if (event.deltaMode !== 0) return
    const step = Math.abs(event.deltaY)
    if (step > 0 && step < 40) this.touchpadScore++
    else if (step >= 40) this.touchpadScore = Math.max(0, this.touchpadScore - 2)
    if (this.touchpadScore < 4 || this.touchpadDetected) return
    this.touchpadDetected = true
    if (this.settings.bridgeAssist === 'auto') {
      const how = this.settings.bridgeStyle === 'forward' ? 'hold use/right-click and walk forward at an edge.' : 'hold use/right-click, sneak, and walk back.'
      this.hud.toast(`Touchpad detected: bridge assist on. Bridge style is ${this.settings.bridgeStyle}; ${how}`, 6000)
    }
  }

  private get bridgeAssistEnabled(): boolean {
    return this.settings.bridgeAssist === 'on' || (this.settings.bridgeAssist === 'auto' && this.touchpadDetected)
  }

  /** Public for the HUD badge and pause-card toggle. */
  get bridgeAssistActive(): boolean {
    return this.bridgeAssistEnabled
  }

  /** Bedrock -> Forward -> Bedrock, saved immediately. */
  cycleBridgeStyle(): void {
    const next = this.settings.bridgeStyle === 'forward' ? 'bedrock' : 'forward'
    this.settings = { ...this.settings, bridgeStyle: next }
    saveSettings(this.settings)
    this.hud.toast(next === 'forward' ? 'Bridge style: Forward. Hold use/right-click and walk forward at an edge.' : 'Bridge style: Bedrock. Hold use/right-click, sneak, and walk back.', 4500)
    this.hud.refreshPause()
  }

  /** Auto -> On -> Off -> Auto, saved immediately. */
  cycleBridgeAssist(): void {
    const order = ['auto', 'on', 'off'] as const
    const next = order[(order.indexOf(this.settings.bridgeAssist) + 1) % order.length]
    this.settings = { ...this.settings, bridgeAssist: next }
    saveSettings(this.settings)
    const style = this.settings.bridgeStyle === 'forward' ? 'Forward' : 'Bedrock'
    this.hud.toast(next === 'auto' ? `Bridge assist: Auto (${style}) for touchpads.` : next === 'on' ? `Bridge assist: On (${style}).` : 'Bridge assist: Off.', 4000)
    this.hud.refreshPause()
  }

  /** Remember the last grounded support cell for the two-tick edge grace. */
  private updateBridgeGround(): void {
    if (this.me.onGround) {
      this.bridgeGround = { x: Math.floor(this.me.x), y: Math.floor(this.me.y) - 1, z: Math.floor(this.me.z) }
      // Stored as three so the first two airborne ticks still see a positive window.
      this.bridgeCoyote = 3
    } else if (this.bridgeCoyote > 0) this.bridgeCoyote--
  }

  /**
   * Bridge assist has two explicit directions:
   * - Bedrock: hold use/right-click, sneak and walk backwards; the last block
   *   still lands during a two-tick coyote window after leaving the lip.
   * - Forward: opt-in; hold use/right-click and walk forward at an edge. It
   *   only extends over a gap, never on flat ground or into a wall.
   * Both use the normal server-validated place path.
   */
  private assistBridge(): void {
    if (!this.bridgeAssistEnabled || this.uiOpen || !this.world || !this.self || !this.alive) return
    if (this.placeCooldown > 0) return
    if (!this.rightDown && !this.down('use')) return
    if (this.heldDef()?.kind !== 'block') return
    const placement = bridgePlacement(
      this.settings.bridgeStyle,
      this.me,
      { forward: this.down('forward'), back: this.down('back') },
      this.world,
      this.bridgeGround,
      this.bridgeCoyote > 0,
    )
    if (!placement) return
    this.bridgeCooldown = 4
    this.place({ x: placement.support.x, y: placement.support.y, z: placement.support.z, face: placement.face, distance: 0 })
  }

  private place(hit: BlockHit) {
    if (!this.world || !this.self || !this.map) return
    const slot = this.self.selected
    const s = this.self.inventory[slot]
    const def = item(s?.id)
    const team = this.self.team ?? 'red'
    const block = def ? placedBlock(def, team) : undefined
    if (block === undefined || !s || s.count <= 0) return
    const [x, y, z] = [hit.x + hit.face[0], hit.y + hit.face[1], hit.z + hit.face[2]]
    const bodies = [playerBox(this.me.x, this.me.y, this.me.z, this.me.sneaking), ...this.remoteBoxes.map((p) => playerBox(p.x, p.y, p.z, p.sneak))]
    if (checkPlace(this.world, this.map.build, x, y, z, bodies)) return
    // Predict the block so bridging feels immediate; the server confirms or corrects it.
    this.world.set(x, y, z, block, true)
    this.sound.play('place', 0.7)
    s.count--
    this.placeCooldown = 4
    this.viewModel.swingNow()
    this.send({ t: 'place', x: hit.x, y: hit.y, z: hit.z, face: hit.face, slot })
  }

  // Rendering -------------------------------------------------------------------

  private resize = () => {
    const w = this.container.clientWidth || window.innerWidth
    const h = this.container.clientHeight || window.innerHeight
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  private frame = (now: number) => {
    if (!this.running) return
    requestAnimationFrame(this.frame)
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000)
    this.lastFrame = now
    if (this.supplyMarker) {
      if (this.gameView?.phase === 'ended') this.clearSupplyMarker()
      else this.supplyMarker.crate.visible = this.tick >= this.supplyMarker.landAt
    }
    for (let i = this.dangerMarkers.length - 1; i >= 0; i--) {
      const mark = this.dangerMarkers[i]
      if (this.tick >= mark.until || this.gameView?.phase === 'ended') {
        for (const mesh of [mark.mesh, mark.meteor]) {
          if (!mesh) continue
          this.scene.remove(mesh)
          mesh.geometry.dispose()
          ;(mesh.material as MeshBasicMaterial).dispose()
        }
        this.dangerMarkers.splice(i, 1)
      } else {
        ;(mark.mesh.material as MeshBasicMaterial).opacity = 0.55 + 0.3 * (0.5 + 0.5 * Math.sin(now / 120))
        if (mark.meteor) {
          mark.meteor.visible = this.tick >= mark.until - METEOR_FLIGHT_TICKS
          if (mark.meteor.visible) {
            mark.meteor.position.set(...meteorPosition(mark.x, mark.y, mark.z, mark.until, this.tick))
            mark.meteor.rotation.set(now / 1100, now / 900, now / 1500)
          }
        }
      }
    }
    this.fps += (1 / Math.max(dt, 1e-3) - this.fps) * 0.05
    this.accumulator += dt * 1000
    let steps = 0
    while (this.accumulator >= TICK_MS && steps++ < 4) {
      this.stepTick()
      this.accumulator -= TICK_MS
    }
    if (this.accumulator > TICK_MS * 4) this.accumulator = 0
    const alpha = this.accumulator / TICK_MS

    this.players.frame(now, dt, this.tick, this.self?.team ?? null)
    this.invisibilityParticles(now)
    this.dropModels.frame(now / 1000)
    this.particles.frame(dt)
    this.gens.frame(now / 1000)
    this.projectiles.frame(now)
    this.damageText.frame(dt)
    const v = this.gameView
    const second = v?.phase === 'countdown' ? Math.ceil(this.clock() / TPS) : 0
    if (second !== this.lastCountdown && second > 0 && second <= 5) this.sound.play('tick')
    this.lastCountdown = second
    const seconds = now / 1000
    this.material.uniforms.uTime.value = seconds
    this.glassMaterial.uniforms.uTime.value = seconds

    const parkour = this.mode.world === 'parkour'
    if (parkour && !this.uiOpen) this.stepParkourLook(dt)
    // Use the same interpolated player position for the body, the chase target
    // and the camera. Aiming at the un-interpolated server position was the
    // source of the 20 Hz camera stutter.
    const fx = this.prev.x + (this.me.x - this.prev.x) * alpha
    const fy = this.prev.y + (this.me.y - this.prev.y) * alpha
    const fz = this.prev.z + (this.me.z - this.prev.z) * alpha
    if (this.alive) {
      const wantEye = this.me.sneaking ? SNEAK_EYE_HEIGHT : EYE_HEIGHT
      this.eye += (wantEye - this.eye) * Math.min(1, dt * 14)
      this.camera.position.set(fx, fy + this.eye, fz)
      this.poseSelf(fx, fy, fz, dt)
    } else this.camera.position.set(this.spectator.x, this.spectator.y, this.spectator.z)
    this.selfAvatar.root.visible = this.alive && (this.thirdPerson || parkour)
    this.camera.rotation.set(this.alive ? this.me.pitch : this.spectator.pitch, this.alive ? this.me.yaw : this.spectator.yaw, this.hurtRoll)
    this.hurtRoll *= Math.pow(0.002, dt)
    // A nearby explosion shakes the view for a moment.
    if (this.shake > 0.01) {
      this.camera.rotation.x += (Math.random() - 0.5) * this.shake * 0.05
      this.camera.rotation.y += (Math.random() - 0.5) * this.shake * 0.05
      this.shake *= Math.pow(0.02, dt)
    }
    const fov = this.settings.fov * (this.me.sprinting && this.alive ? 1.1 : 1) * (1 - this.drawCharge() * 0.12)
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 10)
      this.camera.updateProjectionMatrix()
    }
    // Parkour chase camera: orbit behind the runner along the same view direction.
    // Pull in before a block can clip through it; arrow look is already smoothed
    // in the render frame above.
    if (this.alive && parkour && this.world) {
      const [dx, dy, dz] = lookDirection(this.me.yaw, this.me.pitch)
      const eye = [this.camera.position.x, this.camera.position.y, this.camera.position.z]
      const hit = raycastBlock(this.world, eye, [-dx, -dy, -dz], 5)
      const back = hit ? Math.max(1.2, hit.distance - 0.4) : 4.5
      this.camera.position.set(eye[0] - dx * back, eye[1] - dy * back, eye[2] - dz * back)
      this.camera.lookAt(eye[0] + dx * 8, eye[1] + dy * 8, eye[2] + dz * 8)
    } else if (this.alive && this.thirdPerson && this.world) {
      const [dx, dy, dz] = lookDirection(this.me.yaw, this.me.pitch)
      const eye = [this.camera.position.x, this.camera.position.y, this.camera.position.z]
      const hit = raycastBlock(this.world, eye, [-dx, -dy, -dz], 4)
      const back = hit ? Math.max(0.3, hit.distance - 0.3) : 4
      this.camera.position.set(eye[0] - dx * back, eye[1] - dy * back, eye[2] - dz * back)
    }

    if (this.chunks) this.chunks.update(this.camera.position.x, this.camera.position.y, this.camera.position.z)
    this.sky?.update(this.camera.position.x, this.camera.position.y, this.camera.position.z, seconds)

    const t = this.target
    if (this.alive && t?.kind === 'block' && this.world && this.mode.world !== 'parkour') {
      const h = blockDef(this.world.get(t.hit.x, t.hit.y, t.hit.z)).height
      const p = this.dig && this.dig.x === t.hit.x && this.dig.y === t.hit.y && this.dig.z === t.hit.z ? this.dig.progress : 0
      this.cursor.set([t.hit.x, t.hit.y, t.hit.z], h, p)
    } else this.cursor.set(null, 1, 0)

    const held = this.self?.inventory[this.self.selected]?.id ?? null
    this.viewModel.setHeld(held, this.self?.team ?? null)
    const walking = this.alive && this.me.onGround && this.settings.viewBobbing ? Math.min(1, Math.hypot(this.me.vx, this.me.vz) / 0.2) : 0
    this.viewModel.frame(dt, walking, this.rightDown && this.heldDef()?.kind === 'shield', false, this.camera.aspect, this.drawCharge())

    this.renderer.clear()
    this.renderer.render(this.scene, this.camera)
    if (this.alive && !this.thirdPerson && !parkour) {
      this.renderer.clearDepth()
      this.renderer.render(this.viewModel.scene, this.viewModel.camera)
    }
    this.hud.frame(now)
  }

  /** A big, readable shimmer around invisible enemies: invisibility hides the body, not the magic. */
  private invisibilityParticles(now: number): void {
    if (!this.self) return
    const seen = new Set<number>()
    for (const p of this.views) {
      if (!p.alive || !p.invisible || p.id === this.myId || p.team === this.self.team) continue
      seen.add(p.id)
      const last = this.invisParticleAt.get(p.id) ?? 0
      if (now - last < 140) continue
      this.invisParticleAt.set(p.id, now)
      this.particles.burst(p.x, p.y + 1.1, p.z, '#d8c2ff', 3, 0.85, 0.45, 0.4, 2.6)
      this.particles.burst(p.x, p.y + 1.55, p.z, '#9b7bff', 1, 0.55, 0.25, 0.1, 1.8)
    }
    for (const id of this.invisParticleAt.keys()) if (!seen.has(id)) this.invisParticleAt.delete(id)
  }

  /** Your look, from the wardrobe; sent on joining and whenever it changes. */
  look: Look = loadLook()

  setLook(look: Look) {
    this.look = look
    this.send({ t: 'look', look: encodeLook(look) })
  }

  /** Poses your own figure for the third-person view, and lays your trail. */
  private poseSelf(x: number, y: number, z: number, dt: number) {
    const a = this.selfAvatar
    a.dress(this.look, this.self?.team ?? null, this.self?.armor ?? 'leather')
    a.setHeld(this.self?.inventory[this.self.selected]?.id ?? null, this.self?.team ?? null)
    a.root.position.set(x, y, z)
    a.root.rotation.y = this.me.yaw
    a.setGround(this.groundBelow(x, y, z))
    this.viewModel.setSkin(a.skin)
    const speed = Math.hypot(this.me.vx, this.me.vz) * 20
    a.animate(dt, { sneak: this.me.sneaking, shield: this.rightDown && this.heldDef()?.kind === 'shield', pitch: this.me.pitch, swing: this.viewModel.swingTicks(), hurt: 20, speed, vy: this.me.vy })
    if (this.look.trail > 0 && speed > 1) {
      this.selfTrailClock += dt
      if (this.selfTrailClock > 0.07) {
        this.selfTrailClock = 0
        this.trail(x, y + 0.1, z, this.look.trail)
      }
    }
  }

  /** How far below (x, y, z) the nearest solid surface is, within six blocks. */
  private groundBelow(x: number, y: number, z: number): number | null {
    if (!this.world) return null
    const bx = Math.floor(x)
    const bz = Math.floor(z)
    for (let by = Math.floor(y + 0.01); by >= Math.floor(y) - 6; by--) {
      const def = blockDef(this.world.get(bx, by, bz))
      if (def.solid && by + def.height <= y + 0.01) return y - (by + def.height)
    }
    return null
  }

  /** One puff of a cosmetic trail at someone's feet. */
  private trail(x: number, y: number, z: number, trail: number) {
    const p = this.particles
    switch (TRAILS[trail]) {
      case 'Sparkle':
        return p.burst(x, y + 0.3, z, Math.random() < 0.5 ? '#fff6a0' : '#ffffff', 2, 0.5, 1, -0.5, 0.6)
      case 'Flame':
        return p.burst(x, y, z, Math.random() < 0.5 ? '#ff8a1a' : '#ffd24a', 2, 0.4, 0.6, -3, 0.8)
      case 'Hearts':
        return p.burst(x, y + 0.4, z, '#ff4a6a', 1, 0.4, 0.8, -1.5, 1.2)
      case 'Notes':
        return p.burst(x, y + 0.5, z, `hsl(${Math.floor(Math.random() * 360)},80%,60%)`, 1, 0.4, 0.8, -1.5, 1)
      case 'Cloud':
        return p.burst(x, y + 0.1, z, '#f4f4f4', 2, 0.5, 0.4, -0.3, 1.8)
    }
  }

  /** A killer's kill effect where their victim fell. */
  private killEffect(effect: number, x: number, y: number, z: number) {
    const d = Math.hypot(x - this.me.x, y - this.me.y, z - this.me.z)
    switch (KILL_EFFECTS[effect]) {
      case 'Burst':
        for (const c of ['#ff4a4a', '#ffd24a', '#4ad8ff']) this.particles.burst(x, y + 1, z, c, 16, 0.6, 6, 6)
        this.sound.play('kill', falloff(d, 40) * 0.6)
        break
      case 'Lightning':
        this.lightning(x, y, z)
        this.sound.play('explode', falloff(d, 64) * 0.7, 1.8)
        break
      case 'Confetti':
        for (let i = 0; i < 6; i++) this.particles.burst(x, y + 2.2, z, `hsl(${i * 60},85%,60%)`, 12, 1.2, 5, 4, 0.8)
        this.sound.play('start', falloff(d, 40) * 0.6)
        break
    }
  }

  /** A bright bolt from the sky for a quarter of a second. */
  private lightning(x: number, y: number, z: number) {
    const bolt = new Mesh(new BoxGeometry(0.25, 40, 0.25), new MeshBasicMaterial({ color: '#eaf4ff', transparent: true, opacity: 0.9 }))
    bolt.position.set(x, y + 20, z)
    this.scene.add(bolt)
    this.particles.burst(x, y + 0.2, z, '#eaf4ff', 24, 0.8, 5, 8)
    setTimeout(() => {
      this.scene.remove(bolt)
      bolt.geometry.dispose()
    }, 250)
  }

  /** The latest server tick heard. */
  tickNow(): number {
    return this.tick
  }

  /** The game clock now: the server's value moved on by the ticks since it was sent. */
  clock(): number {
    const v = this.gameView
    if (!v) return 0
    const since = Math.max(0, this.tick - v.clockTick)
    return v.phase === 'countdown' ? Math.max(0, v.clock - since) : v.clock + since
  }

  /** For the debug overlay. */
  debugInfo() {
    const t = this.target
    return {
      pos: [this.me.x, this.me.y, this.me.z],
      vel: [this.me.vx, this.me.vy, this.me.vz],
      onGround: this.me.onGround,
      sneaking: this.me.sneaking,
      sprinting: this.me.sprinting,
      fall: this.me.fallDistance,
      yaw: this.me.yaw,
      pitch: this.me.pitch,
      tick: this.tick,
      target: t?.kind === 'block' ? `${blockDef(this.world!.get(t.hit.x, t.hit.y, t.hit.z)).name} at ${t.hit.x} ${t.hit.y} ${t.hit.z} (${t.hit.distance.toFixed(2)})${this.world!.isPlaced(t.hit.x, t.hit.y, t.hit.z) ? ' placed' : ''}` : t?.kind === 'player' ? `player ${t.id}` : t?.kind === 'npc' ? t.npc.kind : 'none',
      light: this.chunks ? this.chunks.light.get(Math.floor(this.me.x), Math.floor(this.me.y), Math.floor(this.me.z)) : 0,
      dig: this.dig ? this.dig.progress : 0,
      chunks: this.chunks ? `${this.chunks.meshCount} meshed, ${this.chunks.readyCount} queued` : 'none',
      mesher: this.chunks ? (this.chunks.usingFallback ? `main thread (${this.chunks.fallbackReason})` : 'worker') : 'none',
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      renderDistance: this.settings.renderDistance,
      quality: this.settings.quality,
      fog: this.scene.fog instanceof Fog ? [this.scene.fog.near, this.scene.fog.far] : null,
      fps: Math.round(this.fps),
    }
  }
}
