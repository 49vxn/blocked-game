# Task 0019 — Technoblade behavior v1

Status: done — integrated; 324-test suite pass
Owner: Buffy (integrator)
Created: 2026-10-31
Depends on: 0013 perception/motor, 0015 tactics primitives, 0017 combat motor, 0018 navigation

## Goal

Make the existing sandbox-only Technoblade tier use its tactical profile, not
just Expert legacy stats. This slice wires the existing wall and clutch build
primitives into the fight loop and lets the telly profile bridge during sandbox
sparring. The lobby tier is deliberately separate because it changes `BotLevel`,
protocol and UI.

Read `docs/BOT_AI_REWRITE.md`, `tasks/0015-bot-tactics-technoblade.md` and the
bot observer before changing anything.

## Required behaviour

1. Technoblade (`BOT_TIER_PROFILES.technoblade`) uses `combatBuilds = 3`.
2. In a melee fight, when health is low and an enemy is close, place a two-block
   wall between the bot and that enemy using `wallCells`.
3. When airborne and falling over a supportable cell, place one clutch block
   under the bot using `clutchCell`.
4. Respect the existing placement cooldown, block inventory, support and
   protection rules; the server still validates every place.
5. Sandbox sparring (`duel`) movement may use the telly path; other tiers keep
   their current bridge modes.
6. Normal tiers are unchanged: Expert's `combatBuilds = 2` must not trigger the
   new Technoblade-only builds.
7. The sandbox-only `/bot technoblade` entry stays; no lobby/protocol changes.

## Allowed paths

- `src/games/bedwars/bots.ts`
- `tests/bot-technoblade.test.ts`
- `tests/bot-technoblade-build.test.ts` (new)
- `docs/BOT_AI_REWRITE.md`, `docs/GAMEMODES.md`, `HANDOFF.md`,
  `docs/STATE.md`, `QUEUE.md`, `docs/CHANGELOG.md`, `tasks/README.md`

No `nav.ts` change is required. No room, protocol, client, map or economy change.

## Test-first steps

1. Add a test that a Technoblade bot at low health with blocks places a wall
   block toward a nearby enemy; assert an Expert bot in the same setup does not.
2. Add the sandbox duel movement assertion for the telly profile.
3. Confirm the new combat-build test fails before implementation.
4. Wire `wallCells`/`clutchCell` into `fight` behind `combatBuilds >= 3`.
5. Run focused Technoblade tests, all bot suites, full suite and build.

## Acceptance checks

- [ ] Technoblade places a wall at low health; Expert does not.
- [ ] Technoblade places a clutch block while falling over a support.
- [ ] Placement respects cooldown, reserve and server validation.
- [ ] `/bot technoblade` retains its telly profile and sandbox behavior.
- [ ] Existing bot rounds still finish on every arena.
- [ ] `bun run typecheck`, full `bun test`, and `bun run build:node` pass.
- [ ] `bots.ts` is restored to read-only.
- [ ] No live restart and no git command.

## Out of scope

- Lobby Technoblade tier, `BotLevel`, protocol or UI.
- `duel.ts`/`bed.ts`, planner/economy wiring, bridge edges or new maps.
- A full Technoblade win-rate target; this is the first tactical build slice.

## Completion report

- Task: `0019-technoblade-behavior-v1`
- Status: done, integrated in the shared checkout.
- Files changed: `src/games/bedwars/bots.ts`,
  `tests/bot-technoblade-build.test.ts` (new), docs.
- Behaviour: Technoblade (`combatBuilds = 3`) walls off a close enemy at <=8 HP
  and places a clutch block while falling. Expert (`combatBuilds = 2`) does not
  trigger either build. Sandbox duel movement for a telly profile now passes
  `bridge=true`; other tiers keep their previous approach.
- Test-first evidence: the wall test failed with zero placements before the
  implementation; the final tests cover wall placement, Expert non-trigger and
  falling clutch placement.
- Commands: `bun test tests/bot-technoblade.test.ts
  tests/bot-technoblade-build.test.ts tests/bot-tactics.test.ts
  tests/bots.test.ts tests/bot-navigation.test.ts` -> 35 pass; full suite **324
  pass, 0 fail** across 35 files; `bun run typecheck` and `bun run build:node`
  pass.
- Not verified: lobby Technoblade tier (still not exposed), `duel.ts`/`bed.ts`,
  planner/economy, a Technoblade-vs-Expert win-rate target, or a browser
  playtest. `:3002` still runs the previous process.
- Risks: the wall can briefly obstruct the bot's own retreat; clutch only works
  when a supportable cell exists; this is a tactical slice, not a full crown
  brain. No room/protocol/map changes.
