# Task 0027 — FFA map connection and bots

Status: review — code and live build done; manual FFA playtest pending
Owner: integrator (Buffy)
Created: 2026-11-03
Depends on: 0011 Upgrade Rush, 1.6.7

## Goal

Fix Upgrade Rush's free-for-all arena and make it playable without waiting for
eight humans:

- the four spawn islands sit closer to the middle, Pit-style;
- every island has a solid, walkable bridge to the middle — no player has to
  bridge over void just to reach the fight;
- bots fill empty FFA seats, can navigate the bridges, fight, and tier up.

## Why

The current `createUpgradeMap()` reserves lanes but never builds a floor. An
audit from every spawn to the middle at `y = TOP - 1` found 23–70 air cells out
of 24–70 sampled, i.e. all four islands are isolated. Players who do not bridge
manually are stuck. The mode also has `bots: false`, so a solo player cannot
play it at all.

## Ownership

- Workspace: main checkout (integrator task; no worker slot).
- Files allowed to change:
  - `src/games/bedwars/maps/upgrade.ts`
  - `src/games/bedwars/rules.ts` (only if a default changes)
  - `src/games/bedwars/server.ts` (FFA room rules + bot factory)
  - `src/games/bedwars/room.ts` (only the spawn-slot ordering for bots)
  - `src/games/bedwars/bots/upgrade.ts` (new simple FFA brain)
  - `tests/upgrade.test.ts`
  - `docs/UPGRADE_RUSH.md`, `docs/STATE.md`, `HANDOFF.md`, `QUEUE.md`,
    `tasks/README.md`, `docs/CHANGELOG.md`
- Off-limits: `src/games/bedwars/bots.ts` (read-only), `protocol.ts`, client
  gameplay, maps other than `upgrade.ts`, package/lockfile.
- Shared interface owner: integrator.

## Contract

- Layout bases move from ±44 to ±30 on their axes; middle stays at radius 12.
- `createUpgradeMap()` paints a 3-wide stone-brick bridge at `TOP - 1` from each
  island edge to the middle edge, filling only air cells. No map decoration or
  existing terrain is removed.
- `createBedwarsRoom({ world: 'upgrade' })` uses `upgradeRules({ bots: true,
  minPlayers: 1 })`; direct `new Room({ rules: upgradeRules() })` stays
  human-only so existing unit tests and explicit rooms are unchanged.
- Bots fill every empty seat at `startRound` (4 colours × 2 seats = 8). Each bot
  gets a distinct `spawnSlot` on its colour.
- The FFA brain (`bots/upgrade.ts`) selects a sword, targets the nearest living
  player (teams are only seats in FFA), walks only onto solid ground, jumps
  obstacles, and sends `attack` within reach. It does not use beds, shops,
  generators, team upgrades or bridge building.
- No `bots.ts` change. No protocol change. No new dependency.
- Late-joining humans may still find all 8 seats bot-filled; replacing a bot
  mid-round is out of scope for this task.

## Acceptance checks

- [ ] Every base has a continuous solid line to the middle at `TOP - 1`.
- [ ] `hypot(base.center - MID) <= 31` for every base.
- [ ] A server-created FFA room with one human fills 8 seats: 1 human + 7 bots.
- [ ] Bots have unique spawn slots per colour and move from spawn.
- [ ] Existing Upgrade Rush kill/death/rematch tests still pass.
- [ ] `bun test tests/upgrade.test.ts`
- [ ] `bun run typecheck`
- [ ] Full suite `bun test --max-concurrency 1 --timeout 10000`
- [ ] `bun run build:node`
- [ ] Live check: FFA room shows bots and both bridges are walkable.

## Test-first steps

1. Add the bridge/distance assertions and the 8-seat bot test.
2. Run `bun test tests/upgrade.test.ts`; confirm the bridge test fails.
3. Move the layout, paint the bridges, install the FFA brain and bot rules.
4. Re-run the focused test, typecheck, full suite and build.
5. Restart the LAN/local hosts only after the build passes.

## Review checklist

- [ ] Only allowed files changed; `bots.ts` untouched.
- [ ] Bridges connect, no holes, no removed map blocks.
- [ ] FFA damage still ignores teams; bots do not team up.
- [ ] Bot movement does not walk into void.
- [ ] No performance regression in the 16-bot tests.
- [ ] Known gaps: no bot bridge-building, no mid-round bot replacement.

## Completion report

- Task: 0027
- Status:
- Files changed:
- Commands run:
- What was verified:
- What was not verified:
- Known risks:
- Next action:
