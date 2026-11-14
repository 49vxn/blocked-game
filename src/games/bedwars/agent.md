# Agent notes: src/games/bedwars

The BedWars simulation, protocol and browser client. See `README.md` for the
module map and where-to-change table.

Layers:

- `sim/` — pure rules: combat, beds, looks, parkour, generators/pickups.
- `maps/` — generated arenas, sandbox and map types.
- `room.ts` — authoritative match, players, teams, shop and damage wiring.
- `protocol.ts` / `server.ts` — wire contract and room factories.
- `bots.ts` — public Bot entry and integration point.
- `bots/` — frozen AI types, five-tier profiles, perception, motor, planner,
  economy and tactics; see `bots/README.md`.
- `client/` — prediction, input, HUD, settings and rendering.

High-risk shared files:

- `room.ts` — authoritative room, combat, beds, generators, shop, commands.
- `protocol.ts` — client/server message shapes; changing it touches the codec.
- `bots.ts` — bot brains and pathfinding.
- `rules.ts` / `server.ts` — mode rules and room factories.
- `client/game.ts` — prediction, rendering, input and HUD wiring.

Rules:

- Read the task contract before touching `room.ts`, `protocol.ts` or
  `client/game.ts`; they are shared by many tests.
- Keep `sim/` free of room/client/map imports.
- One writer per file. Split a task instead of having two agents edit the same
  core file.
- Run `bun test tests/game.test.ts tests/bots.test.ts` for rules, and the full
  suite for room or protocol changes.
- The engine must not import this game.
- Movement presets are in `src/engine/movement.ts`; the sandbox selector lives in
  `client/game.ts`, `client/hud.ts` and `client/settings.ts`.
