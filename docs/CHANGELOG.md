# Changelog (durable summary)

## 2026-11-03 — mineable ores

- Added iron, gold and diamond ore map blocks. They are exposed on arena rims,
  are the only map blocks a player may mine, and drop one matching resource.
- Pickaxe tiers gate them: wood for iron, iron for gold, diamond for diamond.
  Wrong tools and empty hands cannot start the break.
- Ores are deterministic per arena and kept off reserved walkways, spawn pads
  and bed cells. Every arena places at least one.
- Ores are appended after every existing block, so wool/bed/map ids do not
  shift; this fixes the wool-as-diamond / bed-as-wool texture mismatch caused by
  the first insertion point.
- Focused `tests/ores.test.ts`: **5 pass**. Full suite **469 pass / 0 fail /
  44 files**, 37.49s; typecheck 0; `build:node` 343.42 kB.
- Both hosts restarted on the ore build even with the live room: LAN `:3000`
  PID 2032, local `:3002` PID 5016. One player reconnected to the waiting room.

## 2026-11-03 — tab return, grass placement, pole texture, diamond cap

- Returning from a hidden tab resets the frame clock, clears the placed-block
  cooldown and shows an explicit “Click Back to game to resume” pause instead of
  looking frozen. Pointer lock is still browser-controlled; this does not fake
  a resume gesture.
- Tall grass and flowers are now replaceable when placing a block. Solid blocks,
  water, poles and chains still occupy their cell.
- The wooden pole under lanterns now uses horizontal timber grain instead of
  vertical bands, so it no longer reads as a striped fence panel at close range.
- Diamond generator piles cap at **10** instead of 4.
- The pause card has a direct **Style: Bedrock/Forward** bridge toggle; the
  Settings choice remains.
- Full suite **464 pass / 0 fail / 43 files** (with 0031 healing items); typecheck
  0; `build:node` 341.20 kB. Hosts restarted: LAN `:3000` PID 10104, local
  `:3002` PID 18068. Tab-switch and pole-texture visual checks are still human
  playtests.

## 2026-11-03 — more healing items (0031)

- Added a **healing potion** (6 HP, 1 emerald), a **regeneration potion**
  (10 s, 1 HP per 1.5 s, 2 emeralds) and an **enchanted golden apple** (8 HP +
  6 s regeneration, 6 gold). Golden apples keep their 8 HP heal and two-stack.
- Food use now reads `heal`/`regen` metadata; the room ticks regeneration
  through the post-damage delay and clears it on death/respawn. The HUD lists
  Regen next to Speed/Jump/Invisible. No protocol change.
- Golden apple cost raised from 3 to 5 gold. Upgrade Rush tier packages at 2,
  5, 7, 8 and 9 now grant a healing potion, regen potion or enchanted apple, so
  FFA has more recovery without a shop.
- Focused tests **44 pass**; full suite **464 pass / 0 fail / 43 files**;
  typecheck and `build:node` pass (server 341.20 kB).

## 2026-11-03 — FFA eight islands and dynamic difficulty (0030)

- Upgrade Rush now has eight one-player spawn islands: the four base islands
  plus the four diamond islands, each flattened to a protected 3×3 pad and
  connected to the middle by a three-wide bridge.
- Added `sim/ffa.ts`: samples human results every 5s, changes bot difficulty at
  most once per 10s, eases after repeated deaths, hardens for a dominant human,
  and leaves bot-only rooms alone.
- `UpgradeBot` reads `room.ffaBotLevel`: Easy reacts late and never sprints;
  Expert reacts fast, sprints earlier and has less aim error.
- Focused `tests/upgrade.test.ts`: **22 pass**. Full suite **457 pass / 0 fail /
  43 files**, 40.47s; typecheck 0; `build:node` 340.23 kB.
- Bot-only baseline, 10 matches: 130.2s average, first kill 8.5s, 0% spawn
deaths, target concentration 0.33, top kill share 0.45 (2/10 matches above 0.5).
- Local `:3002` restarted on the new build (PID 17616); LAN `:3000` restarted
  after its room emptied (PID 18672). Both health 1.6.7, `online: 0`.
- Live human playtest of the new opener and difficulty feel is still pending.

## 2026-11-03 — Bloxd air-control preset (0029)

- Added a sandbox-only `bloxd` movement preset at Bloxd’s published 4 / 7 / 2
  blocks/s. Classic remains the normal/bot controller.
- Air control in the Bloxd preset replaces 30% of the old velocity per tick with
  the input direction at 0.333 blocks/tick; no-input jumps keep 99.5% of their
  horizontal arc. Knockback keeps its momentum grace.
- Tests: air reversal inside 4 ticks, strafe old-forward under 0.08, no-input
  retention above 0.95. Classic and the Spiral Tower course unchanged.
- Full suite **452 pass / 0 fail / 43 files**; typecheck 0; `build:node`
  333.82 kB. Browser/touchpad playtest and default switch not done.
- Hosts restarted on the new build at 11:17: LAN `:3000` PID 5476, local
  `:3002` PID 13408; both health 1.6.7, `online: 0`, menu renders with no new
  console errors. The public site is still the previous 1.6.7 deploy.

## 2026-11-03 — Bridge assist styles (0025)

- Added `bridgeStyle: 'bedrock' | 'forward'` (settings v4); old saves migrate
  to Bedrock. Bedrock remains the default: use/right-click + sneak + back.
- Forward is opt-in: use/right-click + forward at a gap; it never places on
  flat ground, into a wall, or while backing up.
- Added a two-tick grounded-cell grace so the last block still places after
  stepping off the lip. Both styles use the normal server-validated place path.
- New pure helper `client/bridge.ts`; 7 focused bridge tests and the settings
  suite (13 tests). Full suite **449 pass / 0 fail / 43 files**; typecheck 0; `build:node`
  332.94 kB. Browser/touchpad playtest not run in this pass.
- Ores are not included; the bounded ore-node contract is `tasks/0028-bloxd-ores.md`.

## 2026-11-03 — FFA map connection and bots (0027)

- Upgrade Rush islands moved from ±44 to ±30 and now have real three-wide
  stone-brick bridges to the middle. The generated lanes only reserved air; a
  spawn-to-middle audit had 23–70 gaps per island, so FFA was isolated.
- Added `bots/upgrade.ts`: a small FFA brain that selects a sword, targets the
  nearest player, walks only on solid ground and attacks in reach. It never
  builds; the map bridges carry it to the fight.
- Server-created FFA rooms use `bots: true, minPlayers: 1`; one human fills all
  eight seats (1 human + 7 bots). The host can toggle bots in the lobby.
- `bots.ts` untouched. Focused `tests/upgrade.test.ts`: 17 pass. Full suite
  **441 pass / 0 fail / 42 files**; typecheck 0; `build:node` 332.94 kB.
- Live hosts restarted: `:3000` PID 4620, `:3002` PID 14712, health 1.6.7.

## 2026-11-02 — 1.6.7

- **Upgrade Rush** is live: 2–8-player free-for-all on an original four-island
  map, 10 gear tiers, +1 tier and +6 HP per kill, death resets to tier 0 and
  removes only your placed blocks, 25 kills or 10 minutes. HUD shows tier, next
  upgrade, kills and timer; summary shows kills/tier/deaths; late join takes an
  open colour instead of spectating. Menu and online room type added.
- **Spiral Tower** flight audit is green: widened the outer shelf, removed the
  two double gaps that no plain sprint jump could clear, and ended the tread
  ribbon one step before the finish deck. Full audit now passes.
- **Spiral Tower's discrete pad-hops are gone**: the course is now a
  continuous spiral walkway — overlapping 3-wide tread lenses whose shared
  front cells are the risers you climb, 18 single-tread gap jumps (two per
  lap), 10 checkpoints — and `scripts/inspect-tower.ts` retired its stale
  tower-half audit; the tower's walkway/continuity/flight-fleet invariants
  live in `tests/parkour-spiral.test.ts`.
- **Mouse look** clamps each event to ±180 px and ignores one event after
  pointer lock; the bow tap/pointer-loss draw leaks are fixed. Version 1.6.7.
- **Quartz pillar** texture no longer draws the old x % 5 centre bands that
  looked like a fence with wood strips in the middle.
- **Citadel** joins the arena rotation: corner bases, village walls, pinwheel
  diamonds and a tight central keep. Original layout, no copied assets.
- **Online play no longer uses Freebuff sign-in.** The Sites Worker sets an
  anonymous `clache_guest` cookie, derives the realtime user id from it and
  mints same-origin tickets. The client sign-in UI and `@freebuff/auth`
  dependency are gone. The room validator now accepts the client's `:t1`–`:t4`
  suffix, which was the real reason hosted Host/Join returned 400.
- **Always-on clock:** menu and HUD show local time and the school-hours/
  Freebuff window; see `docs/PLAY_WINDOWS.md`.
- Full suite **439 pass, 0 fail**, 42 files, 35.05s; typecheck and `build:node`
  pass. LAN and local `:3002` run the rebuilt 1.6.7 server.
- Sites preview and production are deployed on 1.6.7 at
  `https://clache.freebuff.page`; online play uses anonymous guest tickets.

## 2026-11-02 — mouse freeze reverted; tower test repaired

- Reverted the 14:40 mouse-look spike filter: it dropped every event above
  800 px, which froze the camera on high-DPI or coalesced input. The old raw
  handler is restored, then wrapped in a **non-blocking** clamp: every event
  still turns the view, capped at 180 px, and exactly one event per pointer
  lock is ignored (the browser re-centre). `look-input.ts` and its 4 tests are
  replaced by `look.ts` + 3 tests.
- Pointer lock is now requested in the same click as full screen. Awaiting the
  full-screen promise before asking for the pointer lost user activation, which
  made lock fail now and then; a failed full screen now releases the pointer so
  the pause card stays clickable.
- Rebuilt the client bundle (`dist/node-client`) and verified the live `:3000`
  page serves the clamp + gesture fix. Old tabs need a hard refresh.
- Spiral Tower: restored the per-pad headroom carve, inset the finish apron to
  the tower face, and aligned the pad/arc test with the intentional gap treads.
- Focused look tests **3 pass**; typecheck 0. The full suite is currently red
  on the Spiral Tower tests because another session is editing that file
  concurrently — do not treat the suite as green until that lands.
- Added `tasks/0025-autobridge-fix.md` and `tasks/0026-lag-investigation.md`.

## 2026-11-02 — reviewer merge pass

- Reconciled runtime, bot, brand and task-board claims to the measured state:
  LAN `:3000` and local `:3002` both live, **404 pass / 0 fail / 38 files**,
  typecheck 0. `docs/STATE.md` is now the
  single runtime table.
- Removed the stray `buff/` scratch folder and fixed the two docs that told
  agents to run from it.
- Added `URGENT.md`: version inventory, 0021 rebase plan, expected 410-test
  gate and merge order. No source, build or server change.

## 2026-11-02 — play-feedback batch

- Home forge now splits its pile one item per standing teammate per tick; remote
  teammates still get nothing, and diamond/emerald piles keep one taker. Added
  a two-teammate split test that checks the pile is not duplicated.
- Expert bed defence: guard radius 14, and a direct intruder within 8 blocks is
  met between the bed and the intruder. Far from home only a bed intruder
  recalls the bot, so Experts keep raiding and taking bridge shots.
- Invisibility now hides a player from bot perception completely unless the bot
  hit them or was hit by them in the last two seconds. Removed the three-block
  arm's-length exception.
- Touchpad bridging is Bedrock-style and manual: hold use/right-click + sneak +
  back. Forward autobridge is removed.
- Ender chest: added an arena ender-chest test; the local `:3002` build includes
  the source. LAN `:3000` (PID 17524) and local `:3002` (PID 3136) run the same build.
- Ported maps are in the local build: Aquarium, Archway and Spiral Tower
  (10-checkpoint parkour). Full suite **404 pass, 0 fail**, 38 files, 47.12s;
  typecheck and `build:node` pass.

## 2026-11-02 — OG map remasters (0024)

- Two classic 2017 arenas rebuilt as in-house code maps (layout-faithful, no
  copied assets): **Aquarium** (`aquarium`) — quartz islands on a cross, cyan
  trim, four sunken pools in the middle promenade, diamonds low on the
  diagonals; **Archway** (`archway`) — corner bases, tight middle, the great
  arch with one emerald beneath it and one on its deck, pinwheel diamonds.
- Two new themes: `coral` and `stronghold`; `Theme.middle` may return an
  elevated emerald `[x, z, y]`. Both arenas registered in `ARENAS` +
  `arenaRules().maps` and lobbied as usual (server-driven vote list).
- Walkable-ground theme trees must not carry solid trunks: the coral safe-tree
  is a `slimPalm` (found by the maps suite's base-walls test).
- Parkour: **Spiral Tower** is a 10-level, 80×204×80 solid-cylinder tower open
  by default in the parkour world (`?world=parkour`); `&map=classic` keeps the
  five-checkpoint tutorial; unknown `map` values fall back to the tower.
  Server builds the course through `RoomOptions.createMap`; no room.ts/client
  edits.
- **Spawn-in-wall bug (user report) fixed**: the original tower face (r 13.3)
  swallowed the pads (also r 13), so the start pad sat inside solid shell.
  The face is now inset to r ≤ 11.2 with window slots and trim belts on it,
  every pad carves two blocks of headroom above itself, and checkpoint
  lanterns hang off the pad's *outer* edge (a lantern once stood in the first
  jump line at (42,15,27)). `scripts/inspect-tower.ts` audits the spawn, all
  373 pads, all 372 jump arcs, the finish and the payload for BOTH courses —
  `AUDIT CLEAN`, encode ≈ 77.0 KB (< 200 KB guard).
- The test's arc assertion had a self-inconsistent expected/received template
  (`expect('arc …').toBe(… 'clear')) that failed even on clear arcs; it now
  compares like-for-like. Parkour suites **14 pass, 0 fail** (2,382 expects).
- Known follow-up (client, worker1's frozen `main.ts`): the play-URL
  whitelist rebuild drops `?map=`, so the browser can't open the classic
  course by URL yet. The server honors it — a raw `/game?…&map=classic`
  socket on :3005 built room `probe-classic` with map **"Parkour"**; the
  default join opens Spiral Tower (room summary verified, phase playing).
- Tests: new `tests/parkour-spiral.test.ts`; bots-test seeds for the new
  arenas (9/10, both rounds end with a winner); full per-arena invariants in
  `tests/maps.test.ts` pass for both; the parkour suite covers course, rooms
  and the join-payload encode guard.
- Full suite **404 pass, 0 fail** with `bun test --max-concurrency 1
  --timeout 10000` (one easy-bot timeout flaked in a parallel run and passed
  on rerun); typecheck clean; `build:node` green. Browser smoke on a spare
  local port (`:3005`): default parkour join → Spiral Tower round playing.
  No deploy, no restarts of live servers.

## 2026-11-02 — headless GLM reviewer (workflow v3)

- worker2 is now a **headless read-only reviewer**, not a Freebuff chat:
  `opencode/glm-5.3-flash-free#max`, OpenCode `plan` agent, loopback v2 API.
- Fixed the bridge for the real v2 routes (`/api/session`,
  `/api/session/{id}/prompt`, `/api/session/{id}/message`), waited for the final
  assistant turn instead of an intermediate `tool-calls` sentence, wrote the
  explicit `--out` report, and moved the prompt to stdin so Windows `cmd.exe`
  cannot break on multi-line arguments.
- `workflow review-external` now inlines the changed files and forbids tools;
  this stopped the free model looping on tool calls and produced a real 33 KB
  PASS review for worker3/0015.
- `workflow check` and `integrate` now use
  `bun test --max-concurrency 1 --timeout 10000`; the default 5s parallel runner
  flaked a ranged-shot simulation test.
- Full suite **377 pass, 0 fail**, 38 files, 28.66s; typecheck pass.
- worker3/0015 check passes (335 tests), mechanical review PASS, GLM review PASS
  with four minor findings. Not integrated. No deploy, restart or git.

## 2026-11-02 — workflow v2

- Added `workflow review-external <agent> <task-id> [--print]`: fresh passing
  workspace check required, read-only prompt output, loopback OpenCode review
  receipt. It never integrates or edits.
- Added `externalReviewPrompt` and a pure test; workflow tests 13 pass.
- Added self-contained `worker1` and `worker2` START-HERE packs: implementation
  and read-only reviewer roles, with mailbox and external-review instructions.
- Full suite 349 pass with sequential Bun (`--max-concurrency 1`); standard
  parallel mode can hit 5s CPU timeouts in two bot simulation tests.
- Starting the three sessions and the current slate are in
  `docs/MULTI_AGENT_WORKFLOW.md`. No deploy, restart or git.
## 2026-11-02 — bot target commitment

- Added Expert/Technoblade close-range target commitment (3.5 blocks): hold the
  current visible target for `commitmentMs`, release to a visible attacker, a
  home-bed intruder, a dead/disconnected target or a much closer enemy.
- Added one bounded seeded lapse per engagement (12 ticks) on the first
  eligible swing. Easy/Normal/Hard keep legacy switching after full-round
  regressions and timeout evidence.
- `tests/bot-targeting.test.ts`: 18 focused tests. Full suite **348 pass, 0
  fail**, 37 files; typecheck and build pass.
- Restarted the LAN host on `0.0.0.0:3000`, PID 11224, LAN
  `http://10.47.1.88:3000`; it serves the pre-mission build.
- Public Sites remains 502; no deploy. `bots.ts` restored to read-only.

## 2026-11-01 — reviewer bridge and brand-split slate

- Added `scripts/opencode-review.ts`: a loopback-only OpenCode v2 reviewer
  bridge with optional Basic auth, blocking reply, empty-reply polling, timeout
  handling and `.agents/mailbox` reports. Passwords are never written to
  results or reports. Fake-server tests cover the failure modes.
- `tests/opencode-review.test.ts` — 6 tests; full suite **330 pass, 0 fail**
  across 36 files. Typecheck and `build:node` pass.
- Created `tasks/0021-clache-kevcraft-brand.md` and started the worker1
  workspace; Clache is public and KevCraft remains the school/LAN brand.
- The local live free-model review is still unverified; OpenCode’s
  `glm-5.3-flash-free` smoke timed out and no v2 API server is running on 4096.
- Archive cleanup remains in `_attic/`; `bunfig.toml` excludes it from tests.

## 2026-10-29 — foundation and LAN

- Ran the Buffcraft template; installed Bun/deps.
- Added use/place on E, inventory on Tab, player list on G, migration.
- Added texture/arena atmosphere, renderer F3 diagnostics, worker fallback.
- Removed the Freebuff promo from the Node production build.
- Added LAN Node hosting and server restart/health workflow.
- Added `/killaura` admin cheat for sandbox/offline solo.
- Merged movement presets: Classic 4.9 walk / 6.5 sprint, sandbox M cycle.
- Added browser guards, full-screen/Keyboard Lock, Shift+Q.
- Added parkour mode (spiral, checkpoints, HUD, three rounds).
- Added Trios/team-size rooms.
- Added TNT buff, Ctrl+Q stack drop, invisible shimmer particles.
- Added shared forge income for all living teammates in team modes.
- Added touchpad bridging assist (Auto/On/Off).
- Fixed parkour camera: frame-rate look, interpolated target, collision pull-in.
- Renamed visible product to **KevCraft**.

## 2026-10-30 — current patch state

Live deployed: KevCraft, bed-chat fix, Trios, TNT, full-screen, Ctrl+Q,
invisibility shimmer, forge income, touchpad bridge, parkour camera.

Source-ready, pending deploy:
- Personal + team ender chests and storage modal.
- G player-list toggle.
- Golden apples max stack 2.
- Home-forge pickup rule: one pile, on-ground within two blocks, no remote
  team income, no diamond/emerald splitting.
- Pure rules grouped under `src/games/bedwars/sim/`.
- `start-clache.cmd` host launcher.
- Tests: 303 pass; typecheck pass.

Approved but not implemented:
- Upgrade Rush (+1 gear tier per kill; death resets; blocks vanish on death;
  kill heals; original four-island map using online silhouette reference).
- Humanized bots, accessories, UI polish, Spleef, hub, quick match, spectator,
  bed reinforcement, idle simulator, gun game, public hosting.

Known issues:
- Real-browser full-screen/pointer-lock and touchpad checks pending.
- Chest UI/model browser check pending.
- Missing-block report needs F3 screenshot/device.
- Public hosting unavailable on this network.

## 2026-10-30 — three-agent workflow automation

- Added `scripts/workflow.ts` and `scripts/workflow-lib.ts`: three-slot plan,
  ownership collision checks, generated worker briefs, workspace typecheck/full
  tests, mechanical diff review and a serial integration gate with regression
  check.
- Added `list --json` / `status --json` to `scripts/agent-task.mjs`.
- Added 12 tests in `tests/workflow.test.ts`; full suite 250 pass.
- `plan` selects `0002-bot-humanization` and `0011-upgrade-rush` as the two
  implementation streams, with one read-only slot.
- Found and resolved a real ownership collision: `rules.ts` is frozen to 0011,
  so 0002 edits only `bots.ts` and `tests/bots.test.ts`.
- The tool never deploys or restarts the live server; integration is separate
  from build/deploy.

## 2026-10-30 — generator pickup and sim layout

- Fixed home forges paying every living teammate from anywhere. They now leave
  one ground pile; a player must be on the ground within two blocks of the
  forge to collect it. Full inventories leave the remainder on the ground.
- Diamond and emerald piles have one taker per tick and are never copied to
  every teammate.
- Moved pure rules into `src/games/bedwars/sim/`: combat, beds, look, parkour
  and generator/pickup rules. Added the module map at
  `src/games/bedwars/README.md` and updated every import and test path.
- Tests: 252 pass, 0 fail; typecheck and `build:node` pass. Not deployed; live
  server and PID were untouched.

## 2026-10-30 — bot AI research

- Added `docs/BOT_AI_REWRITE.md`: a five-tier (Easy/Normal/Hard/Expert/
  Technoblade) behavior matrix, perception/planner/motor/tactics architecture,
  telly-bridging and combat-build plan, test strategy and multi-agent split.
- Key finding: Bed Wars stars measure progression, not skill; the rewrite maps
  bots to behavior archetypes and keeps human limits at every tier.
- Superseded the narrow `0002-bot-humanization` contract.
- Added frozen bot AI interfaces in `src/games/bedwars/bots/types.ts`, the
  five-tier `profiles.ts`, a bounded `telemetry.ts` and 4 profile/telemetry
  tests. Full suite 303 pass; the existing `Bot` behavior is unchanged.
- Split the work into 0013 perception/motor, 0014 planner/economy and 0015
  tactics/Technoblade.

## 2026-10-30 — bot perception/planner integration

- Integrated 0013 (perception/memory/motor) and 0014 (world model/planner/
  economy) into the main checkout. Ten files total, all inside their contracts.
- Main `bun run typecheck` and full `bun test` pass: **293 tests, 0 failed**.
- The running `Bot` is intentionally unchanged until `bots.ts` is wired; 0015
  tactics/Technoblade is now ready.
- No live-server restart, no deploy.

## 2026-10-30 — bot perception/motor wiring

- `bots.ts` now builds the frozen `PerceptionTracker` and `MotorController`,
  updates perception each tick, routes enemy selection through
  `perception.visible`, and gates attacks on the sampled reaction deadline.
- Legacy gather/raid/defend execution remains, so bot rounds still finish.
- `0014` planner/economy remains integrated but unwired; the full attempt is
  saved at `.agents/partial-bots-wiring-v2.ts`.
- Typecheck, full suite (303 pass) and `build:node` pass. No live restart.

## 2026-10-30 — EasyBridge forward extension

- Touchpad EasyBridge now extends the floor **ahead** while holding a block and
  moving forward; sneak is optional for forward. Backward Bedrock-style
  bridging still requires sneak + back.
- Renamed the UI copy from “Bridging assist” to **EasyBridge**; Auto/On/Off is
  unchanged, and Auto still detects a laptop touchpad from small wheel deltas.
- No phone touch-control layer: this is a laptop touchpad feature.
- Included in the current local test build; public `:3000` is down.

## 2026-10-31 — Clache public launch and promo removal

- Removed the in-app Freebuff promotion entirely: menu sponsor card, “Made with
  Freebuff” footer, pause-menu Remix button, round-summary line, promo module,
  CSS and build flag. The deployed page now shows only the game and version.
- The `Freebuff` badge visible in the preview browser is injected by the preview
  UI, not served by Clache. The `freebuff.page` hostname and Freebuff account
  ownership remain platform-side; hosting elsewhere would require a different
  host and, for online rooms, a different realtime transport.

- Renamed the visible product from KevCraft to **Clache** across the app, title,
  meta tags, desktop shell, launcher (`start-clache.cmd`), package product name
  and current docs. Internal `buffcraft` package/deploy paths remain for
  compatibility.
- Fixed `scripts/postbuild.mjs` on Windows: `fileURLToPath` replaces the raw
  `URL.pathname`, which produced `C:\C:\...` and failed the Sites build.
- Built and deployed the Sites Worker plus assets. Production is published at
  https://site-b14a623b242947829ada4c6e48ac609e.freebuff.page with Freebuff auth
  and the REALTIME binding.
- Verified: production returns 200, `/healthz` reports browser-hosted
  multiplayer, the menu renders Clache with no console errors, `/api/player`
  reports `configured:true, signedIn:false`, signed-out ticket returns 401, and
  the sign-in link redirects to Freebuff OIDC with the correct production
  callback.
- Not verified: a completed sign-in/callback/session flow or a two-account
  online match, because no Freebuff account session was available in this tab.
  Solo and sandbox remain available without sign-in.

## 2026-10-31 — Technoblade behavior v1

- Wired the existing combat build primitives into the Technoblade fight loop:
  wall off a close enemy at <=8 HP and place a clutch block while falling.
  Expert (`combatBuilds = 2`) does not trigger either path.
- Telly-capable sandbox duel movement now asks `walkTo` to bridge; other tiers
  keep their normal approach.
- Added `tests/bot-technoblade-build.test.ts`: the wall test failed with zero
  placements before the change, Expert non-trigger is asserted, and falling
  clutch placement is covered.
- Full suite **324 pass, 0 fail** across 35 files; typecheck and `build:node`
  pass. Technoblade remains sandbox-only; no lobby/protocol/UI changes.

## 2026-10-31 — blocked-yield repair

- Added a deterministic closed-corridor test: a lower-id bot is blocked by a
  map wall, the higher-id bot must yield, and the side cells are walls. The old
  policy held `forward: 0` forever; the test failed before the fix.
- Yield rules are now teammate-only, with a 6-tick wait, 12-tick back-out and
  15-tick retry window. If the rear is blocked, the yielder moves past the
  blocker rather than freezing; enemies are handled by the fight loop.
- `followPath` drops unreachable waypoints after 20 stuck ticks instead of 60
  and clears the nav route for replanning. Four fresh 2,400-tick observers had
  worst `stuckMax` 20 (1 s), down from 60.
- Expert solo `tripIron` is 32 instead of 80. Navigation made Easy's opening
  functional, exposing Expert's 96-second solo wait; the existing Expert-vs-Easy
  test fails without this cap. Team modes remain capped at 16.
- Full suite **322 pass, 0 fail**; typecheck and `build:node` pass. No live
  restart. Delivery is intentionally not attempted in this pass.

## 2026-10-31 — bot navigation v1

- Added `src/games/bedwars/bots/nav.ts`: deterministic ground A* with
  step-up/drop, safe diagonals, map-block refusal, placed-block digging through
  a callback, collinear simplification and a hard expansion cap.
- `Bot.walkTo` now follows a nav waypoint, replanning on a changed goal, a
  blocked cell or 20 ticks; if A* finds no ground route (an island gap), it falls
  back to the existing bridge/dig walker. `followPath`, raids, home and guard all
  pass through the same wrapper.
- Added soft occupancy from teammates and visible enemies, plus a higher-id
  head-on yield. Two-bot corridor test keeps at least 0.6 blocks of separation.
- Observer now records nav replans/failures/stuck/path ratio and one pass per
  15-tick no-attack contact episode. Three 2,400-tick runs: 183/114/137 contacts,
  21/13/13 passes, path ratios 0.97–1.19, 1.8–2.2 s headless.
- Tests: pure nav 7, navigation integration 3; full suite **319 pass, 0 fail**;
  typecheck and `build:node` pass. No live restart; git commit/PR is blocked
  because this checkout has no `.git` or remote.

## 2026-10-31 — bot combat motor

- `fight()` now aims through the tier `MotorController` with distance, apparent
  size and target angular speed. Removed the legacy `aimOffset`/`aimRollAt`
  random snap.
- New `tests/bot-aim-wiring.test.ts`: a 180-degree facing change must stay under
  `turnDegPerSecond / 20`; Easy also turns less than Expert. It failed at 172.7
  degrees in one tick before the change.
- Focused bot suite **43 pass**; full suite **309 pass, 0 fail**; typecheck and
  `build:node` pass. Three 2,400-tick observer runs averaged attacks 18.7 /
  44.7 / 56 / 53.7 for Easy/Normal/Hard/Expert — readable aim costs raw swings.
- No live restart; `:3002` still runs the process from before 0016/0017.

## 2026-10-31 — bot opening economy

- Fixed the shared-forge opening stall: in team modes the first trip is 4 iron,
  wool is bought before gear, and the bot leaves after 16 blocks. Bed cover now
  waits for a later trip and keeps a 16-block bridge reserve. Solo rounds keep
  the old full shop/cover cycle.
- Before: Expert's first shop was around tick 2,300; Hard/Expert spent most of a
  2,400-tick battle in `gather` (Expert 0 attacks). After: first shop at ticks
  105/201/297/393 for Easy/Normal/Hard/Expert, and attacks across repeated runs
  are roughly 22–36 / 64–76 / 41–61 / 82–85.
- Added `tests/bot-opening.test.ts` (4 tiers, two teams of four, 45 seconds).
  It failed 4/4 before the fix.
- Extended `scripts/bot-observer.ts` with first shop, first sortie, sortie
  blocks, first field, first attack, base share and goal mix; it writes
  `.agents/bot-observer-opening.jsonl`.
- Full suite **307 pass, 0 fail**; typecheck and `build:node` pass. No live
  restart; `:3002` still runs the previous process until restarted.

## 2026-10-31 — bot battle, observer and path detour

- Added a 4v4v4v4 all-bot arena (`battle=1`): four teams, one
  Easy/Normal/Hard/Expert per team, human spectator, menu button and URL.
- Added `scripts/bot-observer.ts`: headless goals/targets/paths/attacks and
  close-range pass telemetry.
- Added `bots/path.ts` and a one-cell detour before digging at an obstacle.
- Close-range forward movement now stops at 2.5 blocks instead of walking
  through the target.
- Team-mode forge trips are capped at 16 iron; Hard/Expert no longer camp the
  forge.
- `bots.ts` is read-only. Full suite **303 pass**; build passes. Public `:3000`
  and the Cloudflare tunnel are down; local battle server is `:3002`.
- Not finished: A* pathfinding, `duel.ts`/`bed.ts`, planner/endgame wiring,
  lobby Technoblade tier.
