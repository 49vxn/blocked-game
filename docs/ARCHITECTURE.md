# Clache architecture

## Shape

- `src/engine/` is game-agnostic: blocks, items, inventory, physics/movement,
  world storage, raycast, building, melee, projectiles, explosions, terrain,
  net host/client/codec/lag-comp and three.js rendering. It never imports a game;
  `tests/architecture.test.ts` enforces that.
- `src/games/bedwars/sim/` is the pure rule layer: combat, beds, looks, parkour,
  generator/drop pickup. No room/client/map imports.
- `src/games/bedwars/` is the runtime game: room, server, bots, maps, shop,
  arsenal, protocol and browser client. See its `README.md` for the module map.
- `src/games/bedwars/bots/` contains frozen AI types/profiles plus perception,
  motor, planner/economy/world-model modules and `tactics/`.
- `src/server/main.ts` hosts Node HTTP + WebSocket, serves `dist/node-client`
  and upgrades `/game` sockets.
- `src/sites/` is the optional Sites/browser relay; it is separate from the LAN
  Node path.
- `electron/main.mjs` runs the server inside the desktop shell.

## Simulation and network

- 20 ticks/second. Client, server, bots and tests share `stepMovement`, `Room`,
  raycasts and item rules.
- Client predicts movement and reconciles with server teleports. Remote players
  use a short jitter buffer.
- Binary frames carry input/tick; rare messages are JSON.
- Delta snapshots carry changed players, drops and game state.
- Server validates movement budget, reach, LOS, placement, breaking, purchases,
  storage proximity and round rules.
- `protocol.ts` is the wire contract. Binary changes must ship client and server
  together and force a hard refresh for open tabs.

## Bot stack

- `bots/types.ts` and `bots/profiles.ts` are frozen shared interfaces.
- `bots/perception.ts` / `memory.ts`: FOV, LOS, last-seen memory, confidence.
- `bots/motor.ts`: sampled reaction delays, capped turn/acceleration, aim error.
- `bots/worldModel.ts` / `planner.ts` / `economy.ts`: integrated but not wired.
- `bots/nav.ts`: ground A*, step-up/drop, dig callbacks and path simplification.
- `bots/path.ts`: one-cell detour fallback before digging.
- `bots/tactics/bridge.ts`: telly bridge state machine.
- `bots/tactics/build.ts`: wall, clutch, pillar and roof placements.
- `bots.ts`: current executor and integration point. It is read-only outside a
  reviewed integration.
- `scripts/bot-observer.ts`: headless behavior telemetry.

## Room and modes

- `Room` implements the engine's `RoomLike`, created by `createBedwarsRoom`.
- `GameRules.mode` is `arena`, `sandbox` or `parkour`.
- Arena: four teams, beds, generators, shop, timeline, bots and team sizes.
- `RoomParams.battle` / `battle=1`: 16 bots, four per team, mixed tiers; a human
  joins as a spectator via `Room.startBotBattle()`.
- Sandbox: immediate play, cheats, test stations and `/bot`.
- Parkour: generated spiral, checkpoints, timers, three rounds.
- Map metadata/world snapshot travel on `welcome`; maps are generated in code.

## Client

- `client/main.ts`: menu, room list, invite/battle URLs.
- `client/game.ts`: three.js scene, input, prediction, camera, HUD wiring.
- `client/hud.ts`: lobby, hotbar, inventory/shop, scoreboard, chat, parkour,
  pause and summary.
- Renderer uses procedural 16x16 textures and an off-thread mesher with fallback.
- Bedrock bridge (use + sneak + back) is client-side; the server validates
  every `place`.

## Persistence

- Rooms are in memory. No database/accounts for LAN play.
- Settings/looks/parkour best times use localStorage.
- Cosmetics are validated look codes.
- Ender/team storage is round-scoped in-memory state.
- Desktop window state is managed by Electron.

## Testing

- `bun run typecheck`
- `bun test` — 319 pass, 34 files at handoff
- Focused: `tests/bots.test.ts`, `bot-battle.test.ts`, `bot-tactics.test.ts`,
  `bot-path.test.ts`, `bot-nav.test.ts`, `bot-navigation.test.ts`,
  `bot-wiring.test.ts`, `bot-technoblade.test.ts`, `game.test.ts`,
  `maps.test.ts`
- `bun run build:node` for the Node/LAN artifact
- `bun run smoke` / `smoke:sites`
- `bun scripts/bot-observer.ts` for headless behavior observations

## Change discipline

- Use a task contract for large features; one writer per file.
- Do not edit the shared checkout from a worker workspace.
- Test-first for behavior; do not weaken assertions.
- Keep engine/game boundaries intact.
- Do not restart the LAN server without warning.
