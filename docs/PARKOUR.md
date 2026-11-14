# Parkour Rush - design and build plan

Status: stage 1 implemented and verified. Hub extraction and course variants are later.
Last updated: 2026-11-02 (0024: Spiral Tower default course, continuous walkway)

## The courses (2026-11-02)

The parkour world opens on **Spiral Tower** (`maps/parkour.ts`,
`spiralTower()`), an original build after the classic community spiral maps:

- 80×204×80 world over the void. Start on a gravel plaza at the foot of a
  solid cylindrical tower; run a **continuous spiral walkway** up its outside
  and finish on the beacon deck on top (tread step 371, deck at y 199/200).
- The walkway is overlapping 3-wide tread lenses wound around the wall: each
  tread shares a front cell with its successor, so where the path climbs that
  shared cell is the riser you hop — a staircase, not island hops, with a
  1-block rise every two steps. The band spans radius 11.2–16.2 and the tower
  face stops at radius 11.2 (the first cut had the shell swallow the pads and
  players spawned inside blocks); the outer shelf was widened from 15.0 to
  16.2 after the sprint-jump audit saw still-clean landings fall through the
  old visible edge.
- **18 real gaps** break the ribbon — two single-tread jumps per lap over
  nine laps — and a checkpoint tread every 38 steps marks each level board.
  The early double gaps were not clearable by a plain sprint jump; the audit
  caught them and they were removed. Roadside lanterns sit on the outermost
  tread cell off the walking line, and every fourth step carries a stud under
  the outer edge.
- **Ten themed levels**, one checkpoint tread each: village planks, sand, cut
  sandstone, stone, castle bricks, glacier ice, mesa terracotta, dark-oak
  cabin, brickworks, and a gilded quartz keep. Each level shows its own face
  material with an accent stripe, window slots and a trim belt.
- Audits live in `tests/parkour-spiral.test.ts`: walkway solidity and
  headroom along the whole ribbon, ribbon continuity with both gap edges
  walkable, and a headless sprint-jump fleet that clears every riser and gap
  (10 tower tests). `scripts/inspect-tower.ts` keeps the spawn/pad/arc audit
  for the **classic tutorial only** — the redesign retired its tower half,
  where the old 3×3 pad model no longer matched the walkway and raised
  hundreds of false problems.
- The tower stays a clean cylinder (no per-cell speckle) so the join payload's
  RLE encode stays tiny; `tests/parkour-spiral.test.ts` guards it under
  200 KB (≈ 77 KB today).
- The little tutorial spiral (five checkpoints, 64×48×64) is selected with
  `map=classic`; `parkourCourse(id)` falls back to the tower for everything
  else. Server-side this works over `/game?world=parkour&…&map=classic`;
  the browser's play-URL whitelist (client `main.ts`) does not forward `map`
  yet, so opening the tutorial from a URL needs that one-line addition
  (worker1's file).
- Race shape is unchanged: ordered checkpoints, fall → last checkpoint, shared
  30-second finish window, three rounds.

## Decision

Build an **original, modular spiral course** in code. Do not port a Bloxd map or
copy an online map wholesale.

Why this option:

- **Original spiral** is the best layout reference: a readable tower, short
  repeated sections, a checkpoint rhythm, and a finish at the top. We build our
  own geometry with our own blocks, so it fits the world size, collisions,
  renderer and rules.
- **Copying a Bloxd map** brings a different block set and scale, is not a
  licensed asset for this project, and creates a map we cannot safely edit or
  fix when the game changes. It also hides texture and collision work.
- **One giant handcrafted map** is expensive to build and test. Modular sections
  give the same variety with smaller, testable pieces.

The spiral is a reference, not a clone.

Open user decision (2026-11-02): the user asked why the original Parkour
Spiral cannot just be ported wholesale, then hand-edited where it needs
ladders or slime. A hand-rolled NBT/.schem → `World` converter is technically
feasible in pure TypeScript, but it conflicts with the no-copied-map rule
above (`QUEUE.md` has the same "won't do" line, plus a P3 owned/CC0 import
pipeline), and no map file is on hand. Until the human relaxes the rule and
supplies the file, the build stays in-code.

## Course shape

Target: **90-150 seconds** for an average clean run, 5 tiers, 5 checkpoints.

| Section | What it teaches | Notes |
|---|---|---|
| Start pad | movement, camera | four spawn spots, a short run-up |
| Jump ladder | 1, 2 and 3-block gaps | forgiving landings, no precision pixel jumps |
| Spiral tier 1 | turning while jumping | ring of pads, one checkpoint |
| Ice run | momentum | short, with a safe reset pad |
| Bounce pad | timing | optional in v2 |
| Balance beam | patience | one block wide, checkpoint at the end |
| Spiral tiers 2-5 | combined skills | each tier adds one idea, never a new control |
| Finish | payoff | beacon/lantern, finish pad, results |

Rules:

- A fall returns you to the **last checkpoint** after 1.5 seconds, not spawn.
- Checkpoints are ordered. Touching a later one does not skip an earlier one.
- No combat, shop, beds, generators, fall damage or moving platforms in v1.
- V1 uses existing quartz, moss, ice, planks and lanterns. A checkpoint pad and
  bounce pad are optional v2 blocks with procedural textures.

## Formats

### Multiplayer race

- 1-8 players in one room; 4 is the normal group.
- Everyone starts at once. Each player has their own checkpoint and timer.
- A fall respawns at the player's checkpoint; the timer keeps running.
- The first finisher opens a 30-second finish window. After that the round ends.
- Three rounds, points for places (3/2/1), a small crown screen after round three.
- Total session target: under 10 minutes.

### Solo time trial

- The same room and course, with no opponent required.
- Personal best time is stored in the browser; a ghost replay is later.

## Controls and no-mouse camera

Parkour should be playable without a mouse.

- WASD: move. Arrows are not movement in parkour; they look.
- Space: jump.
- R: sprint (hold/toggle per Settings).
- Mouse: optional look.
- Arrow keys: turn and pitch in parkour.
- Camera: third-person chase camera behind the runner; mouse can take over.
- No right-click, aiming or precision cursor is needed.
- Settings toggle: **Chase** (default) and **First person keyboard**; playtest
  both before locking the default for the hub.

## HUD

- Top centre: timer and checkpoint count (`2 / 5`).
- Top right: personal best and finish places.
- Centre toast: "Checkpoint 3", "You fell - back to checkpoint 2".
- Finish overlay: time, place, best, next-round countdown.
- No bed, team or shop widgets in parkour.

## Architecture

### Stage 1: integrated mode (this task)

Reuse the existing room, movement, renderer and network.

- Add `world: 'parkour'` and a `parkour` rule set.
- Add a generated course map in `src/games/bedwars/maps/parkour.ts`.
- Add a small `src/games/bedwars/sim/parkour.ts` state module for checkpoints,
  timers and finish order. Keep course logic out of bedwars shop/beds.
- Extend the room tick with a parkour branch; do not touch bot combat.
- Add a protocol message for checkpoint/time/finish updates.
- Add client HUD/camera branches and a menu entry.
- Online rooms use the same room list and invite links.

### Stage 2: hub extraction (later)

Move the course/state into `src/games/parkour/`, add a game router and shared
lobby. Do not build the full hub in the same change as the first course.

## Tests and acceptance

- Course map: start, ordered checkpoints, finish, no bed/generator dependency.
- Room: spawn, checkpoint order, fall reset, timer, finish, round reset.
- Protocol: self parkour state reaches the client.
- Browser: timer/checkpoint HUD, finish overlay, keyboard look, no console errors.
- Acceptance:
  - [x] Solo finish records a time and personal best.
  - [x] 2-4 players race on the same course.
  - [x] Falling respawns at the last checkpoint.
  - [x] Keyboard-only play works.
  - [x] No right-click or aim required.
  - [x] Full tests and production build pass.
  - [ ] Live LAN playtest with two human clients.

## Research notes

- Bloxd Hop and Parkour Race: checkpoints and replay loops.
  https://bloxd-io.fandom.com/wiki/Bloxd_Hop
- Bloxd Minigames (short rotating challenges):
  https://bloxd-io.fandom.com/wiki/Minigames
- Roblox Tower of Hell as a short high-pressure obby reference; its
  no-checkpoint design is deliberately not copied:
  https://www.hindustantimes.com/genesis/best-roblox-obby-games-tower-of-hell-mega-fun-obby-difficulty-chart-challenges-101761299581456.html
- Minecraft parkour movement reference:
  https://www.mcpk.wiki/wiki/Horizontal_Movement_Formulas

Research caveat: Bloxd's official site was not reliably reachable; community
wiki values are design references, not specs. Course length and timings above
are playtest targets for this game.
