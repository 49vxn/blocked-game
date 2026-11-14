# Task 0015 — Bot tactics and Technoblade behavior

Status: integrated 2026-11-02 — `tactics/duel.ts`, `tactics/bed.ts`, the shared
build helpers and `tests/bot-tactics.test.ts` (24 tests) are in main; the four
headless-GLM findings are fixed and covered. Still **unwired**: `bots.ts` does
not call `DuelController`/`BedAssault` yet.
The lobby tier/UI is *not* an allowed path here and needs its own contract.
Owner: worker3 / reviewer
Created: 2026-10-30
Depends on: 0013 perception/motor, 0014 planner/economy, frozen
`src/games/bedwars/bots/types.ts` and `profiles.ts`

## Goal

Implement the tactical layer that makes the crown tier real: telly bridging,
combat walls, pillars, block clutches, roofs, bed assault/escape and readable
target pressure. The Technoblade tier wins through blocks and decisions, not
perfect aim. Module-only; the integrator wires it into `Bot`.

Read `docs/BOT_AI_REWRITE.md` and `src/games/bedwars/bots/README.md` first.

## Ownership

- Workspace: `.agents/worker3/0015-bot-tactics-technoblade/`
- Files allowed to change:
  - `src/games/bedwars/bots/tactics/duel.ts` (new)
  - `src/games/bedwars/bots/tactics/bridge.ts` (new)
  - `src/games/bedwars/bots/tactics/build.ts` (new)
  - `src/games/bedwars/bots/tactics/bed.ts` (new)
  - `tests/bot-tactics.test.ts` (new)
  - `tests/bot-technoblade.test.ts` (new)
- Off-limits: `src/games/bedwars/bots.ts`, `bots/types.ts`,
  `bots/profiles.ts`, `bots/telemetry.ts`, `perception.ts`, `memory.ts`,
  `motor.ts`, `planner.ts`, `economy.ts`, `worldModel.ts`, `rules.ts`,
  `room.ts`, `protocol.ts`, client files, maps, package/build config.
- Shared interface owner: integrator.

## Contract

### Bridge tactics

- `slow` and `speed` modes for current-tier crossings.
- `telly` mode only when `profile.bridge === 'telly'`:
  - reserve 24–48 blocks; abort when below the reserve;
  - choose a straight lane, jump and place behind/below on the tier's placement
    cadence;
  - keep moving; recover from a missed placement or a knocked-off block;
  - never bridge into a protected zone or through a solid map block;
  - readable rhythm, not a perfect machine; a small failure/recovery rate is
    allowed.
- Return inputs/commands that go through the existing `room.receive` path.

### Combat builds

- Wall-off: two blocks between bot and enemy when retreating/eating.
- Pillar: jump-place under self for height when the enemy has the better angle.
- Clutch: place under/behind after knockback, before the void kill.
- Roof/cover: protect a bed break or an escape route.
- Route block: block a defender’s approach while a teammate breaks the bed.
- Never spend the last blocks on a non-lethal build; respect `blockReserve`
  unless the reason is documented as escape.
- Do not place inside a player or a protected zone; the server must validate
  every command.

### Duel tactics

- Strafe, sprint-reset/w-tap, crit timing and reach discipline matching the
  existing Expert quality.
- Use a wall/pillar/clutch only when the tactical trigger is met; do not build
  constantly or randomly.
- Keep target commitment and aim constraints from 0013; no perfect aim.
- No new damage or hit-validation rules.

### Bed tactics

- Approach, cover, break, escape and regroup.
- Use blocks to block a defender’s route; do not trap the bot or a teammate.
- If the bed is gone, disengage and buy/use an escape rather than taking a fair
  fight.

## Acceptance checks

- [ ] Telly bridge crosses a fixed gap without falling across seeds; it uses a
      bounded number of blocks and occasionally misses/recover.
- [ ] A low-health retreat triggers a wall within a measured reaction window.
- [ ] A height disadvantage triggers a pillar only when safe.
- [ ] A knockback over the void triggers a clutch attempt with a bounded block
      spend; it does not always succeed at lower tiers.
- [ ] A bed assault uses a route block/roof and respects protection.
- [ ] Technoblade uses blocks more than Expert in a staged duel and still makes
      human-scale aim errors.
- [ ] No illegal placement/command in the full bot round tests.
- [ ] `bun run typecheck`, focused tests and full suite pass.
- [ ] No edits outside the allowed paths.

## Test-first steps

1. Add the telly-gap and block-budget tests with a fixture map.
2. Add wall/pillar/clutch trigger tests.
3. Add a staged Technoblade-vs-Expert duel that proves block usage, not perfect
   aim.
4. Implement bridge, build, duel, then bed tactics.
5. Run focused tests, then full suite.

## Out of scope

- Wiring into `bots.ts`; that is the integrator.
- Lobby tier/UI/protocol (`BotLevel` plumbing is a separate integrator slice).
- Perception/motor or planner/economy.
- New maps, items, damage rules or machine learning.
- Making Technoblade unbeatable; target 55–75% vs Expert in controlled rounds.

## Completion report

- Task: 0015 — Bot tactics and Technoblade behavior (duel + bed scope)
- Status: integrated 2026-11-02 through the serial workflow gate (review PASS,
  check PASS, post-apply main gate PASS). Main suite: 404 across 38 files.
- Files changed:
  - `src/games/bedwars/bots/tactics/duel.ts` (new)
  - `src/games/bedwars/bots/tactics/bed.ts` (new)
  - `src/games/bedwars/bots/tactics/build.ts` (shared `placeable`/`overVoid`)
  - `tests/bot-tactics.test.ts` (15 -> 24 tests; 9 new)
- Telly success/fall rate across seeds: not re-measured; existing bridge tests
  still pass. The new work is the duel/bed layer.
- Block spend and reserve observations: wall builds require
  `blocks >= blockReserve + 2`; the proactive wall requires `+4`; a clutch may
  spend the last block as an escape.
- Wall/pillar/clutch trigger evidence: focused tests cover low-health wall,
  reserve refusal, jump-then-pillar, one-block clutch over void, no clutch over
  ground, w-tap, strafe sides, jump-before-crit, and Technoblade placing more
  blocks than Expert in the same staged duel.
- Commands run:
  - `bun test tests/bot-tactics.test.ts` -> 15 pass, 0 fail
  - `bun run typecheck` -> exit 0
  - `workflow check worker3 0015...` -> typecheck pass; 335 tests pass with
    `--max-concurrency 1 --timeout 10000` (the default 5s runner flaked one
    ranged-shot test, not an assertion failure)
  - `workflow review worker3 0015...` -> PASS, no blocking findings
  - `workflow review-external worker3 0015...` -> PASS; GLM-5.3-Flash Free
    `#max`, read-only `plan` agent, report in `external-review.md`
  - Follow-up (review fixes): `bun test tests/bot-tactics.test.ts` -> 19 pass,
    5 fail before the fix, each for the reported reason; then 24 pass, 0 fail
  - `bun test --max-concurrency 1 --timeout 10000` -> 344 pass, 0 fail in the
    workspace; `bun run workflow review` -> PASS (4 files); `workflow check` ->
    typecheck pass, tests pass; `integrate --yes` -> main gate pass; sequential
    re-run in main -> 404 pass, 0 fail across 38 files
- What was verified: the workspace passes typecheck and its full suite; the four
  external-review findings are fixed with a failing test first for each (alias,
  block-gated clutch, wall body occupancy, symmetric void save); the elevated
  defender roof, wall/cover cooldowns, `canPillar` head clearance and 0-block
  clutches are covered; no edits outside allowed paths; the external review
  confirmed the server-authoritative design.
- What was not verified: browser feel, real match block usage and wiring into
  `Bot` (integrator scope). No bot-round or server playtest, because nothing
  calls these modules yet; no build or deploy; the telly cross-gap sweep was not
  re-run.
- Known risks: the four external-review findings are **fixed** — `pillarCell` is
  now an alias of `clutchCell`, the duel clutch requires `blocks > 0`, wall cells
  are checked against bot/enemy/ally bodies through the shared `cellFree`, and
  `break` / `leave` / own-bed share one `voidSave`. Fragile profile-value coupling
  in two tests remains (the staged Technoblade-vs-Expert comparison depends on
  `combatBuilds`/`blockReserve`), and occupancy filtering can yield a 1-block
  wall when only one cell is free. Cover uses one block per cooldown rather than
  a full shell, by design.
- Next action: a wiring contract for `DuelController`/`BedAssault` in `bots.ts`
  (`bots.ts` is frozen and integrator-owned), then the visible Technoblade tier.
  The telly cross-gap sweep belongs to the bridge work.
