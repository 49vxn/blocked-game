# Task 0011 — Upgrade Rush

Status: implemented in 1.6.7 — server, map, HUD, menu, late join and summary.
Owner: integrator.
Integrator: Buffy.
Created: 2026-10-30.

## Goal

Build a free-for-all Upgrade Rush mode: every kill raises one Gear Tier and heals
6 HP; every death resets the player to Tier 0 and removes only that player's
placed blocks. Everything in the kit upgrades with the tier. Read
`docs/UPGRADE_RUSH.md` first.

## Decisions

- 4–8 players, 25 kills or 10 minutes.
- 10 tiers; one package per tier.
- No beds, shop, generators or bots in v1.
- Blocks are player-placed and owned; owner's blocks vanish on death.
- Map is an original four-island layout using an online BedWars map only as a
  silhouette reference.
- Golden apples stack to 2.

## Allowed paths

- `src/games/bedwars/upgrade.ts` (new)
- `src/games/bedwars/maps/upgrade.ts` (new)
- `src/games/bedwars/maps/types.ts`
- `src/games/bedwars/rules.ts`
- `src/games/bedwars/room.ts`
- `src/games/bedwars/server.ts`
- `src/games/bedwars/protocol.ts`
- `src/games/bedwars/client/game.ts`
- `src/games/bedwars/client/hud.ts`
- `src/games/bedwars/client/main.ts`
- `src/games/bedwars/client/rooms.ts`
- `src/games/bedwars/client/styles.css`
- `src/games/bedwars/items.ts`
- `tests/upgrade.test.ts` (new)
- `tests/maps.test.ts`, `tests/game.test.ts`, `tests/items.test.ts`
- `docs/UPGRADE_RUSH.md`, `QUEUE.md`, `README.md`, `FEATURES.md`, `HANDOFF.md`,
  `tasks/README.md`

## Test-first steps

1. Golden apple 2-stack test.
2. Tier table and kill/death/heal unit tests.
3. Map spawn/coverage/protection tests.
4. Block ownership cleanup tests.
5. Room round-end/rematch tests.
6. HUD/menu smoke and full suite.

## Acceptance

- [x] Two players can start an Upgrade Rush room.
- [x] Kill = +1 tier, +6 HP, +1 score.
- [x] Death = tier 0, own blocks gone, respawn.
- [x] All gear categories follow the tier.
- [x] Map has four safe spawns and a readable central arena.
- [x] HUD shows tier, next upgrade, kills and timer.
- [x] Full tests, typecheck and build pass.
- [ ] Manual LAN playtest.
- [x] Live restart performed after the 3-player match.

## Out of scope

- Classes/enchants/Gear Savers, duos, bots, shop, permanent progression.
- Copying online maps/assets.
