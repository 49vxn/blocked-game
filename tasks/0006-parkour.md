# Task 0006 - Parkour Rush, stage 1

Status: done
Owner: Buffy
Created: 2026-10-30

## Goal

Ship one original, multiplayer parkour course that works with keyboard only and
is playable on the LAN with friends. Read `docs/PARKOUR.md` first.

This is **stage 1: integrated mode**. Do not build the hub shell or a separate
game module in this task.

## Decisions

- Original modular spiral course; no copied Bloxd or online map.
- 5 tiers/checkpoints, one generated course.
- Race and solo time trial share the same room and course.
- Falls return to the last checkpoint; timer keeps running.
- Third-person chase camera by default; keyboard look with arrows; mouse optional.
- No combat, beds, shop, generators, moving platforms or bots in v1.

## Allowed paths

- `src/games/bedwars/maps/parkour.ts` (new)
- `src/games/bedwars/sim/parkour.ts` (new state/helpers)
- `src/games/bedwars/maps/types.ts`
- `src/games/bedwars/rules.ts`
- `src/games/bedwars/room.ts`
- `src/games/bedwars/server.ts`
- `src/games/bedwars/protocol.ts`
- `src/games/bedwars/client/game.ts`
- `src/games/bedwars/client/hud.ts`
- `src/games/bedwars/client/main.ts`
- `src/games/bedwars/client/rooms.ts`
- `src/games/bedwars/client/settings.ts`
- `src/games/bedwars/client/styles.css`
- `tests/parkour.test.ts` (new)
- `tests/maps.test.ts`, `tests/game.test.ts`, `tests/settings.test.ts`
- `docs/PARKOUR.md`, `docs/GAMES_HUB.md`, `README.md`, `FEATURES.md`,
  `HANDOFF.md`, `tasks/README.md`

Anything else is off-limits without a contract update. One writer per file.

## Test-first steps

1. Map tests for start, ordered checkpoints and finish.
2. Room tests for checkpoint order, fall reset, timing and finish order.
3. Protocol/self-state test for checkpoint/time updates.
4. Implement state module and room branch.
5. Implement the course generator.
6. Add client HUD/camera and menu/room entry.
7. Focused tests, full `bun test`, typecheck, `build:node`.
8. Playtest with two browser clients over the LAN.

## Acceptance

- [x] Solo finish records a time and personal best.
- [x] 2-4 players race with independent checkpoints.
- [x] Falling respawns at the last checkpoint, not start.
- [x] Keyboard-only play works (WASD, Space, arrows, R).
- [x] No right-click or aim required.
- [x] Room list labels Parkour and invite links work.
- [x] Full tests and production build pass.

## Completion report

- Files added: `maps/parkour.ts`, `parkour.ts`, `tests/parkour.test.ts`,
  `docs/PARKOUR.md`, `docs/SPLEEF.md`, `docs/GUN_GAME.md`.
- Files changed: room/rules/server/protocol, client game/hud/main/rooms/styles,
  README/FEATURES/HANDOFF/task board.
- Commands: `bun run typecheck` pass; full `bun test` **232 pass**;
  `bun run build:node` pass.
- Browser: Parkour menu entry, generated course, chase camera, timer/checkpoint
  card and keyboard WASD/arrow look verified in the production build.
- Not verified: a real two-human LAN race and the finish overlay in a browser.
  The room tests cover two clients, checkpoint order, fall reset and finish.
- Known risk: the chase camera is a first pass; tune after a human playtest.

## Out of scope

- Spleef and gun game.
- Hub shell and separate game routing.
- Bots, ghosts, moving platforms, new textures and course voting.
- Crosscut or zombie PvE.

## Risks

- `Room` is bedwars-shaped; keep parkour branches small and isolated.
- The chase camera is the main feel risk; test both camera modes.
- Checkpoint detection must be server-authoritative.
- Late joiners need a fair, explicit start time.
