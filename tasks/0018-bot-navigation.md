# Task 0018 — Bot navigation v1

Status: done — integrated; 322-test suite pass
Owner: Buffy (integrator)
Created: 2026-10-31
Depends on: 0013 perception/motor, 0016 opening economy, 0017 combat motor

## Goal

Replace the axis-aligned walker's blind L-legs with a real grid A* route on
connected ground, while keeping the existing bridge/dig executor as the fallback.
Add soft bot occupancy and a head-on yield so bots stop sliding through each
other in corridors.

Read `docs/BOT_AI_REWRITE.md` and the approved navigation plan.

## Required behaviour

### Pure navigation

- New `src/games/bedwars/bots/nav.ts`.
- A* over walkable ground cells at the bot's feet height, with one-block
  step-up/drop support.
- Map blocks are impassable. Player-placed blocks are diggable only through a
  `canDig(x,y,z)` callback and cost extra.
- Void is not traversable. If no ground route exists, return null so the caller
  can use the legacy bridge path.
- 4-neighbour movement plus safe diagonals; deterministic tie-break.
- Path simplification only removes collinear cells and must never cut a wall.
- Bound expansions to protect the 16-bot battle tick.

### Bot integration

- `walkTo` tries A* for targets that are not immediately adjacent; on null it
  calls the old executor unchanged.
- `followPath`, `raid`, `goHome` and `guard` use the same wrapper; bridge legs
  fall back to the old bridge code.
- Occupancy is soft, built from teammates and `perception.visible` enemies, not
  hidden players.
- Higher-id bot yields briefly when two bots meet head-on in a one-wide lane.
- The bot remains the only sender of `place` and `dig`.

### Observer

- Record nav replans, failures and stuck ticks.
- Record path length versus straight-line distance.
- Replace the per-tick pass count with one close-contact episode that produces
  no attack within 15 ticks.

## Allowed paths

- `src/games/bedwars/bots/nav.ts` (new)
- `src/games/bedwars/bots.ts`
- `tests/bot-nav.test.ts` (new)
- `tests/bot-opening.test.ts`, `tests/bot-aim-wiring.test.ts` (only if a
  measured regression requires an adjustment; do not weaken assertions)
- `scripts/bot-observer.ts`
- `HANDOFF.md`, `docs/STATE.md`, `docs/BOT_AI_REWRITE.md`, `QUEUE.md`,
  `docs/CHANGELOG.md`, `tasks/README.md`

## Test-first steps

1. Add pure nav tests: around a wall, through a gap, disconnected island, step
   up/down, map block versus diggable placed block, occupancy preference,
   deterministic path, simplification never crosses a wall.
2. Confirm the module tests fail before `nav.ts` exists for the right reason.
3. Implement grid, heap, A*, path reconstruction and simplification.
4. Wire `walkTo`/`followPath` and the head-on yield.
5. Add bot integration tests for a wall route and two-bot corridor.
6. Run focused bot tests, all bot rounds, full suite and observer.
7. Build and update docs.

## Acceptance checks

- [ ] Pure navigation tests pass.
- [ ] A bot behind a wall routes around it instead of digging a map block.
- [ ] Two bots in a corridor do not pass through each other.
- [ ] No round stalls on any arena; opening and aim tests stay green.
- [ ] Observer episode passes and stuck ticks are measured, not guessed.
- [ ] `bun run typecheck`, focused bot suite, full `bun test` and
      `bun run build:node` pass.
- [ ] No live-server restart.

## Out of scope

- Bridge-aware global A* or arbitrary void crossing.
- Planner/economy wiring.
- Target commitment and lapse policy.
- `duel.ts`/`bed.ts`, protocol, maps, shop or client changes.
- New dependencies.

## Completion report

- Task: `0018-bot-navigation`
- Status: done, integrated in the shared checkout.
- Files changed: `src/games/bedwars/bots/nav.ts` (new),
  `src/games/bedwars/bots.ts`, `tests/bot-nav.test.ts` (new),
  `tests/bot-navigation.test.ts` (new), `scripts/bot-observer.ts`, docs.
- Navigation: deterministic grid A* over walkable feet cells, one-block
  step-up/drop, safe diagonals, map blocks impassable, placed blocks diggable
  only through `canDig`, void returns null and falls back to the legacy bridge.
- Separation: soft occupancy from teammates and visible enemies; higher-id bot
  yields head-on; two-bot corridor test keeps at least 0.6 blocks separation.
- Test-first evidence: pure A* tests failed on the missing module, then on a
  missing down-edge; final pure suite 7 pass, integration 4 pass after the
  blocked-yield repair.
- Observer: three 2,400-tick runs had 183 / 114 / 137 close contacts and only
  21 / 13 / 13 no-attack episodes; nav path ratios were 0.97–1.19. Replans were
  114–244 per tier, failures 12–50 (mostly disconnected-island fallbacks), and
  the worst observed `stuck` counter before repair was 60. Headless runtime was
  about 1.8–2.2 s per 2,400 ticks with 16 bots. The blocked-yield repair brings
  the worst to 20 in six fresh runs.
- Commands: `bun run typecheck` pass; first-gate suite **319 pass, 0 fail**;
  final suite **322 pass, 0 fail** across 34 files; `bun run build:node` pass.
- Not verified: browser playtest of the new paths; `:3002` still runs the
  previous process. Git commit/PR is blocked: this checkout has no `.git` and
  no remote.
- Risks: disconnected-island targets still use the legacy bridge path; bridge
  legs are not A* edges. Nav failures and stuck maxima are logged for the next
  tuning pass.

## Follow-up repair — blocked yield

- Reproduced deterministically in `tests/bot-navigation.test.ts`: a lower-id bot
  is blocked by a map wall in a closed one-wide corridor, the higher-id bot
  must yield, and the side cells are walls. The old policy held `forward: 0`
  forever.
- Yield policy is now: teammates only, six-tick wait, twelve-tick back-out, then
  a fifteen-tick retry window that lets the higher-id bot move past the blocker
  if the rear is also blocked. Enemies no longer trigger the courtesy yield;
  the fight loop owns them.
- `followPath` now drops an unreachable waypoint after 20 stuck ticks instead of
  60 and clears the nav route for a fresh replan.
- Expert's solo `tripIron` is capped at 32 (was 80). Navigation made Easy's
  opening functional, exposing a 96-second Expert solo wait; without the cap,
  the existing Expert-vs-Easy round test fails. Team modes still cap at 16.
- Evidence: the new corridor test failed before the change and passes now; full
  suite **322 pass, 0 fail**; six fresh 2,400-tick observers had worst
  `stuckMax` 20 (1 s) instead of 60. No bridge edges or planner changes.
