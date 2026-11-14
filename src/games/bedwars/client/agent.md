# Agent notes: src/games/bedwars/client

The browser client: prediction, input, HUD, settings, menus and rendering glue.

- `main.ts` — menu, URL parameters, connection choice.
- `game.ts` — the game loop, predicted movement, camera, input and messages.
- `hud.ts` — all screen-space UI, pause menu, chat, shop and scoreboard.
- `settings.ts` / `settings-ui.ts` — validated saved settings and the window.
- `styles.css` — the blocky stone/pixel UI.
- `movement` — the sandbox selector reads `settings.sandboxMovement`, cycles
  with **M**, and calls `stepMovement(..., game.movementPreset())`. Normal play
  uses Classic at 4.9 / 6.5 blocks/s. Every preset uses the same Classic
  steering; only speed changes.

Rules:

- Do not add a client-only physics fork; prediction and bots share
  `src/engine/physics.ts`.
- UI changes need a live browser check, not only `bun test`.
- Keep settings backward compatible; validate every saved field.
- Normal matches use Classic. The sandbox preset only changes speed; never add a
  second movement controller.
- `bun run build:node` after client changes; then check the built server.
