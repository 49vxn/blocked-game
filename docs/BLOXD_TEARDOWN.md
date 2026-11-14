# Bloxd.io teardown — clean-room UX and engine notes

Status: research; no gameplay code changed.
Date: 2026-11-03.
Scope: why Bloxd.io feels low-friction and responsive, and what Clache can
adapt without copying its code, assets or maps.

## Boundary

Bloxd's Terms of Service forbid copying, modifying or creating derivative works
of the game client and forbid reverse-engineering/decompiling it "in any way".
So this is a **clean-room study**: public wiki and docs, the public ToS, the
public client-options pages and observable behaviour. No bundle was downloaded,
deobfuscated or unpacked, and no Bloxd code, textures, models or map files are
reproduced here. The patterns below are written from observation and public
documentation. Sources and dates are at the end.

## Why it feels amazing

Bloxd's advantage is not one engine trick. It is a **compression of the
Minecraft decision tree** plus a game-feel layer where every verb has a number
and a feedback channel:

- **No login gate.** A guest is assigned a usable random name
  (`AdjectiveNoun123`) with a reroll dice, so a player can be in a match seconds
  after the page loads. Accounts are optional and later become the social layer.
- **No install, one click.** The home page is a wall of game thumbnails with live
  player counts, not a marketing funnel. 28 modes were listed in January 2026.
- **Same product on desktop and mobile.** Touch has movement/camera zones and
  dedicated action buttons; it is not a second-class port.
- **Social is a code, not a form.** A party is a 3-character code; when the host
  joins a lobby, the whole party is pulled in automatically.
- **Familiar grammar.** WASD, LMB/RMB, inventory and crafting mirror Minecraft,
  and the control card appears when a player joins a lobby.
- **Loading is content.** A progress ring, a joke bank, and a self-aware tone
  turn the most fragile moment into something authored instead of broken.
- **Feel numbers are concrete:** walk 4 blocks/s, run 7 (1.75x), jump ~1.47
  blocks, a 400 ms hit window (2.5 hits/s), ~3-block sword reach, +30% crits,
  and knockback as its own weapon axis.
- **Every match has a clock:** a bed is reinforced for 2:30, then normal; a
  shrinking border takes over once beds are gone; respawn is ~5 s while the bed
  lives. That prevents both instant rushes and fifteen-minute stalemates.
- **Retention machinery after the first click:** friends, parties, ranked MMR,
  cosmetics and a very high content cadence. Those matter later; they are not
  what makes the first session work.

The short version: Minecraft asks a kid to pay, install, make an account, pick a
version and find a server. Bloxd asks them to click a link and tap a thumbnail.
That removes the three places where most of the audience actually churns:
payment, installation and account creation.

## Evidence: Bloxd vs Clache

| Dimension | Bloxd (public evidence) | Clache current | Read |
|---|---|---|---|
| Entry | Guest name auto-assigned; optional Google/Microsoft/Discord/Apple login | Name field; blank falls back to `Player` | Add guest name + reroll |
| Fullscreen | Browser pointer lock; mobile and windowed are first-class | Browser play requires fullscreen before input works | **Biggest friction** |
| Menu | 28 mode thumbnails, live player count, party button | Six play buttons, one name field, live online count | Add mode cards, keep it small |
| Loading | Staged `%` ring, six phases, rotating tips/jokes | One `Joining the game` overlay | Add real stages + tips |
| Mobile | First-class touch controls | No phone/touch layer by design | High effort; later |
| Party | 3-character code; host auto-pulls the party | Invite links and room names | Short join code is worth it |
| Movement | 4 walk / 7 run; b-hop tiers; ~1.47 jump | 4.9 walk / 6.5 sprint; coyote 3 ticks, no jump buffer | Test sprint ratio; add jump buffer |
| Combat | 400 ms hit cap, ~3 reach, +30% crits | 2-tick hit gate (100 ms), ~3 reach | Our feedback overlaps; prototype a longer window |
| Audio | Separate music and SFX sliders | One `Volume` slider | Split music/SFX |
| Performance | 32³ chunks, chunk-count distance, atlas toggle, WebGPU option | Three.js, worker mesher, renderDistance 150, quality presets | Not the same problem; add resolution scale |
| Social | Friends, parties, ranked, cosmetics | Invite links, wardrobe, no accounts | Code first; accounts later |
| Content | 28 modes, 200+ logged updates | BedWars, Parkour, FFA, Sandbox | Don't copy the catalogue; copy the cadence habit |

## Engine notes (public evidence only)

What Bloxd publicly exposes:

- **Renderer:** TypeScript-first stack with React, WebGL and Node (company job
  posting); today it runs **WebGL2 with an optional WebGPU renderer**. Shader
  packs hook six terrain/liquid stages in raw WGSL with sanitised bindings and
  per-vertex `blockFlags`, which strongly implies packed/merged terrain geometry
  and an atlas. The base is noa-engine, which uses Babylon.js; this is not a custom Three.js
  renderer. See the codebase hunt below.
- **World:** **32×32×32 chunks**; graphics settings measure load distance in
  chunks (horizontal 2–10, vertical 2–3). That is a 3D chunk grid, not columns.
- **Loading:** staged client bootstrap ("Loading required libraries") and a
  separate asset/join phase; static media is CDN-split.
- **Loop and entities:** Bloxd's public GitHub org forks a minimal
  **tick/render shell** and a small **ECS** (`ent-comp`), and uses `nipplejs`
  for touch joysticks. These are public dependency signals, not proof of the
  shipped bundle.
- **Networking:** Bloxd's server and transport are not public; noa is a
  client/engine and does not document Bloxd's netcode.
- **Meshing:** noa's public `terrainMesher.js` verifies a two-pass greedy
  mesher with AO and an atlas; Bloxd likely inherits it, but its current fork
  and worker/WebGPU changes are not public. No bundle was inspected.
- **Performance controls:** chunk distance, fog, lighting, pixel scale, texture
  atlas off, anti-aliasing and WebGPU are exposed as player settings.

Clache, by comparison:

- Three.js/WebGL2 with a **worker chunk mesher**, 16×16 procedural textures,
  fog and a fixed arena that is encoded once on join.
- 20 TPS shared simulation, client prediction, delta snapshots and a jitter
  buffer — already a solid browser-voxel netcode shape.
- Fixed 128³ arenas make Bloxd's 32³ open-world streaming less relevant right
  now. The arena is small enough that a full world payload is acceptable; the
  first-load and stage messaging are the UX gap, not streaming.
- Render distance defaults to 150 with quality presets; browser play currently
  requires **full screen before input is accepted** (`needsFullscreen` in
  `client/game.ts`). Bloxd treats windowed pointer lock and mobile as normal.

### What not to copy

- Bloxd client code, shaders, assets, maps, texture atlases or audio. The ToS
  forbids derivative works, and the project already refuses copied Bloxd maps.
- A WebGPU/ECS/32³-chunk rewrite. Those are architecture bets for a persistent
  open world, not the reason a kid has fun in the first minute.
- The 28-mode catalogue, ads, rank, cosmetic shop or permanent progression.
  Clache is a small LAN game; the relevant lesson is friction and feedback, not
  live-service surface area.
- Exact Bloxd numbers without a playtest. Its 400 ms hit cap and 1.75× run speed
  are calibrated to its own damage, knockback and map scale.

## Codebase hunt: what is public, what is not

The wiki has **no engine source**. It documents the user scripting sandbox:
Code Blocks, boards and World Code, ~69 callbacks, the `api` object and
QuickJS environment. That is a content-mod API, not the renderer or netcode.
The wiki also links a third-party `blocks.js` file that claims to contain item
IDs "taken from the source code"; treat that as extracted proprietary data and
do not vendor it.

The official GitHub organisation has no client repository. It has:

- `Bloxdy/code-api` — public API docs/type definitions, no licence file
  (104 stars, 83 forks, 843 open issues); useful to read, not to copy.
- `Bloxdy/texture-packs` — texture assets, not engine code; do not reuse.
- Forks of the fenomas voxel stack: `micro-game-shell`, `ent-comp`,
  `game-inputs`, `voxel-physics-engine`, `nipplejs`.

### The actual core: noa-engine (MIT)

`fenomas/noa` is an experimental voxel engine, **MIT licensed**, with 694
stars. Its README lists **bloxd.io** as a project using it. `package.json`
shows the architecture: Babylon.js peer dependency, `ent-comp` ECS,
`game-inputs`, `micro-game-shell`, `voxel-physics-engine`, `ndarray`,
`fast-voxel-raycast`, `box-intersect`, `aabb-3d` and `voxel-aabb-sweep`.
Source modules include `world.js`, `chunk.js`, `terrainMesher.js`,
`terrainMaterials.js`, `rendering.js`, `sceneOctreeManager.js`, `entities.js`
and `physics.js`.

This is the legitimate "codebase" trail: **study noa, not Bloxd's client**.
Bloxd's custom layers — its current WebGPU path, shader-pack ABI, 28 modes,
QuickJS sandbox and server — are not public.

### What noa's source actually does

The public noa source is specific enough to compare without guessing:

- `chunk.js` stores voxels in a `Uint16Array` (`ndarray`), keeps a 3×3×3
  neighbor array, tracks dirty terrain/object meshes, and marks edge neighbors
  dirty when solidity or opacity changes. Chunks are queued for remesh rather
  than rebuilt immediately.
- `terrainMesher.js` is a two-pass **greedy mesher**: it builds face masks per
  axis, merges equal faces, packs ambient occlusion per vertex, and uses atlas
  indices per face. It emits Babylon.js meshes per terrain material, then calls
  `freezeNormals()`, `freezeWorldMatrix()` and bounding-sphere culling.
- Bloxd configures 32³ chunks (per the public wiki); noa itself takes chunk size
  as an argument.

Clache currently uses `CHUNK = 16`, a Web Worker mesher, one mesh per chunk with
per-face quads, sunlight/AO and nearest-first remeshing (`mesher.ts`,
`chunk-mesher.ts`, `chunks.ts`). noa's greedy pass produces fewer triangles and
meshes; our 16³ chunks remesh faster and are simpler to edit. That is a
trade-off, not a clear win. Measure triangles, draw calls and remesh time before
porting greedy meshing.

### Licence map

| Repo | Licence | Safe to reuse? |
|---|---|---|
| `fenomas/noa` | MIT | Yes, with copyright/licence notice |
| `fenomas/voxel-physics-engine` | MIT | Yes, with notice |
| `Bloxdy/nipplejs` | MIT | Yes, with notice |
| `Bloxdy/micro-game-shell` | No licence metadata | **No** — treat as all rights reserved |
| `Bloxdy/ent-comp` | No licence metadata | **No** |
| `Bloxdy/game-inputs` | No licence metadata | **No** |
| `Bloxdy/code-api` | No licence metadata | Read docs only; do not copy code |
| `Bloxdy/texture-packs` | Asset repo | **No** — assets, not code |
| Bloxd client | Proprietary (ToS) | **No** — no reverse engineering or derivative works |

noa itself depends on some unlicensed modules (`micro-game-shell`, `ent-comp`,
`game-inputs`), so even vendoring noa as a whole needs a dependency-licence
check. Do not assume noa's MIT licence covers its dependencies.

### What this means for Clache

- We already have a Three.js renderer, worker mesher, 20 TPS simulation,
  prediction and delta snapshots. noa would be a parallel engine, not a
  drop-in upgrade; rewriting onto it would not fix the UX gaps in this memo.
- Read noa for concrete patterns: chunk lifecycle, terrain mesh batching,
  AABB sweep physics, tick/render separation and chunk-sorted loading. If we
  copy actual code, include the MIT notice and keep it isolated.
- Do not copy Bloxd's assets, maps, extracted block data, shader packs or
  client code. The ToS forbids derivative works and reverse engineering.
- The strategic lesson is the opposite of "find the secret engine": Bloxd
  built on a public MIT engine, then invested in UX, content and custom
  layers. Our leverage is the same — product layers, not a renderer rewrite.


## What Clache should change, ranked

### 1. Windowed pointer-lock mode (highest impact)

Today browser play requires full screen before input is accepted:
`needsFullscreen` in `client/game.ts` makes movement idle and `lock()` requests
full screen first. That is a hard gate for school Chromebooks, embedded
previews, users who dislike full screen, and anyone whose browser refuses the
request. Bloxd's public control docs describe pointer lock and touch; they document no
full-screen prerequisite.

Proposal: make full screen **optional**. Request pointer lock directly; keep a
one-time warning that Ctrl+W can close the tab in windowed mode (full screen
still enables Keyboard Lock); keep the full-screen button in the pause card.
Acceptance: join a match windowed, look around, place/break, Esc opens pause,
full screen remains available; no input dead zone.

### 2. Guest identity and mode cards

`main.ts` currently asks for a name and falls back to `Player`. Bloxd gives every
guest an adjective+noun+number and a reroll dice, so there is zero setup. Add a
generated name, a dice button, and persist it (already saved in localStorage).
Replace the six play buttons with mode cards that carry one line and live
counts: BedWars, Upgrade Rush, Parkour, Sandbox. Put one primary "Play" action
above them.

### 3. Staged loading and tips

`hud.setLoading` shows one "Joining the game" card. Add real stages
(connecting → room → world → spawning) and a rotating tip/controls card. Do not
fake a percentage; show a stage and an indeterminate bar until a real progress
signal exists. This is the cheapest way to make a 3–8 second wait feel authored.

### 4. A short join code

Invite links are long and hard to read aloud. Add a 4–6 character room code,
a "Join code" field on the online screen, and a copy button. A party auto-pull
can follow later; the code alone removes most of the social friction for a
classroom.

### 5. A focused feel pass

- **Jump buffer:** there is coyote time (3 ticks / 150 ms) but no explicit jump
  buffer in the movement path. Add 100–150 ms of buffered jump so a press just
  before landing works.
- **Sprint ratio:** current Classic is 4.9 walk / 6.5 sprint (1.33×); the
  constant is 1.35×. Bloxd uses 1.75×. Do not jump to 1.75 blindly; test
  1.45–1.55× (roughly 7.1–7.6 blocks/s) with the movement suite and a short
  playtest.
- **Hit window:** our server accepts a hit every 2 ticks (100 ms, 10 hits/s);
  Bloxd caps at 400 ms (2.5 hits/s). Ten hits per second makes hit sounds,
  knockback and damage numbers overlap, and it gives latency jitter more chances
  to disagree. Prototype a 4–5 tick window (200–250 ms) and retune sword damage
  to keep time-to-kill; measure before shipping.
- **Hit feedback:** add 2–4 frames of hitstop, a distinct crit sound/particle,
  and knockback on both attacker and target. The existing hit marker, hurt
  vignette and directional indicator are a good base.
- **Audio:** split the single `Volume` slider into Music and SFX. Combat
  information should survive a player muting the music.

### 6. Performance controls

Current quality presets map to pixel ratio 0.75 / 1 / min(2, device). Add an
explicit **resolution scale** (0.5–2.0) and a "Performance" preset; expose a
"reduce camera motion" option. This is Bloxd's pixel-scale lesson without
copying its renderer. Measure FPS and draw calls before adding WebGPU.

### 7. Mobile/touch, later

Bloxd's touch controls are first-class and are a large part of its reach. Clache
has no phone layer by design. Treat this as a separate project: move zone, look
zone, jump/place/break/shop buttons, and a layout that does not assume a mouse.
Do it only if phone play is a real target; it is not a quick win.

## What not to do

- Do not copy Bloxd's client, shaders, assets, maps or audio. The ToS forbids
  derivative works and reverse engineering "in any way".
- Do not rewrite the renderer to WebGPU or the entity model to ECS because
  Bloxd has them. Our Three.js + worker mesher is not the bottleneck for a
  fixed 128³ arena.
- Do not add 32³ chunk streaming until there is an open-world/hub requirement.
- Do not import the 28-mode catalogue, ads, ranked ladder, cosmetic shop or
  permanent progression. They are retention systems for a live-service game,
  not first-session fun.
- Do not copy Bloxd's exact movement/combat numbers without retuning damage,
  knockback, map scale and bot difficulty.

## Suggested sequence

| Phase | Changes | Acceptance |
|---|---|---|
| A. Friction | Windowed pointer lock, guest name + dice, mode cards, staged loading, split audio | Join in windowed mode; no name typing; loading stages match real phases; music/SFX independent |
| B. Feel/social | Jump buffer, sprint-ratio experiment, hit window/feedback, short join code | Buffered jump works; TTK unchanged after hit-window retune; code joins a room |
| C. Only with data | Mobile touch, adaptive resolution, WebGPU/streaming | Real device/FPS evidence before the rewrite |

Track: time from page load to first match, fullscreen-refusal rate, name-entry
abandonment, first-match completion, room joins per session, FPS/draw calls, and
a one-question "did the controls feel responsive?" check after playtests.

## Sources

- [noa engine](https://github.com/fenomas/noa) — MIT, README lists bloxd.io;
  [chunk.js](https://github.com/fenomas/noa/blob/master/src/lib/chunk.js) /
  [terrainMesher.js](https://github.com/fenomas/noa/blob/master/src/lib/terrainMesher.js)
  examined for the chunk and greedy mesher notes.
- [noa package.json](https://raw.githubusercontent.com/fenomas/noa/master/package.json)
  — Babylon.js peer dependency and dependency list.
- [voxel-physics-engine](https://github.com/fenomas/voxel-physics-engine) — MIT.
- [Bloxdy/code-api](https://github.com/Bloxdy/code-api) — public scripting API docs.
- Bloxd wiki: [Home Page](https://bloxd-io.fandom.com/wiki/Home_Page),
  [Player Controls](https://bloxd-io.fandom.com/wiki/Player_Controls),
  [Settings](https://bloxd-io.fandom.com/wiki/Settings),
  [Loading Screen](https://bloxd-io.fandom.com/wiki/Loading_Screen),
  [Parties](https://bloxd-io.fandom.com/wiki/Parties),
  [Bedwars](https://bloxd-io.fandom.com/wiki/Bedwars),
  [Movement](https://bloxd-io.fandom.com/wiki/Movement),
  [PvP and Weapons](https://bloxd-io.fandom.com/wiki/Player_Versus_Player_(PVP)_and_Weapons)
- [Bloxd Terms of Service](https://bloxd.io/terms-of-service) — §5/§6 forbid
  reverse engineering, decompiling and derivative works.
- [Bloxd engine job posting](https://builtin.com/job/game-engine-developer/7019769)
  — TypeScript/React/WebGL/Node.
- [Bloxd public GitHub org](https://api.github.com/orgs/Bloxdy/repos) — public
  tick/render shell, ECS and touch-input forks.
- [Bloxd shader-pack guide](https://bloxdhub.com/guides/how-to-make-a-bloxd-shader-pack)
  — public six-hook WGSL ABI; architecture signal only, not copied.
- Clache code: `client/game.ts` (`needsFullscreen`, input gate),
  `client/main.ts` (name/menu), `client/settings.ts` (volume, pixel ratio),
  `engine/constants.ts` (coyote 3 ticks, sprint 1.35, reach 3),
  `room.ts` (2-tick attack gate), `client/hud.ts` (loading).
