# Task 0016 — Bot opening economy and first sortie

Status: done — integrated; 307-test suite pass
Owner: Buffy (integrator)
Created: 2026-10-31
Depends on: 0013 perception/motor (wired), current `bots.ts` launch behaviour

## Goal

Make every bot tier leave its base for a first sortie early enough to fight.
The observer showed Hard and Expert spending most of a 2,400-tick battle in
`gather` because four bots share one forge and each waited for 16 iron. This
task changes the opening trip and leave policy, not the whole planner.

Measured baseline (2,400 ticks, 4v4v4v4):

- Normal 26 attacks, Easy 17, Hard 4, Expert 0.
- Expert was in `gather` for 93 of 96 sampled ticks.
- A separate diagnostic put Expert's first shop trip at about tick 2,300.

## Required behaviour

1. The first team-mode trip targets **4 iron**, enough for one wool stack, not
   the full `tripIron`/`bridgeBlocks` target.
2. `shop` buys wool before gear on the opening trip.
3. `afterShop` sends a bot out after it has **16 blocks**, before bed cover.
4. Bed cover is still built, but only on a later trip and only when it leaves
   at least 16 blocks for bridging.
5. A bot still gathers normally after its first sortie; the opening shortcut
   does not remove the rest of the economy.
6. `IRON_RESERVE` drops from 8 to 4 so the first gear purchase is reachable.

## Allowed paths

- `src/games/bedwars/bots.ts`
- `tests/bot-opening.test.ts` (new)
- `scripts/bot-observer.ts`
- `HANDOFF.md`, `docs/STATE.md`, `docs/BOT_AI_REWRITE.md`, `QUEUE.md`,
  `docs/CHANGELOG.md`, `tasks/README.md`

`bots.ts` is frozen for workers; this is a reviewed integrator change. No other
source file may change.

## Test-first steps

1. Add `tests/bot-opening.test.ts`: two teams of four bots at each tier, run
   45 seconds, and require no more than one living bot per team still inside
   its base radius and at least three bots carrying blocks.
2. Confirm the test fails for the current launch behaviour.
3. Implement the opening trip, wool-first shop, sortie flag and later bed cover.
4. Run the focused bot tests and the full suite.
5. Run the observer before/after and record attack counts and base residency.

## Acceptance checks

- [ ] The new opening test passes for Easy, Normal, Hard and Expert.
- [ ] Existing full bot rounds still end with a winner on every arena.
- [ ] Bed cover still appears after a later trip.
- [ ] No bot is stranded because bed cover consumed its bridge blocks.
- [ ] Observer shows every tier leaving base and Hard/Expert no longer camp the
      forge for most of the round.
- [ ] `bun run typecheck` and the full suite pass.
- [ ] No live-server restart.

## Out of scope

- Full A* pathfinding; that is the next navigation task.
- Planner/endgame wiring.
- New tiers, maps, items or protocol changes.
- Live deploy.

## Completion report

- Task: `0016-bot-opening-economy`
- Status: done, integrated in the shared checkout.
- Files changed: `src/games/bedwars/bots.ts`,
  `tests/bot-opening.test.ts` (new), `scripts/bot-observer.ts`, plus the
  handoff/state/bot/queue/changelog/task-board docs.
- Behaviour: first team trip at 4 iron, wool bought before gear, first sortie
  after 16 blocks, bed cover deferred to a later trip with a 16-block bridge
  reserve, solo rounds keep the old full shop/cover cycle.
- Regression test: four tiers, two teams of four bots, 45 seconds; every bot
  still on its original life must have sortied with at least 16 blocks and
  reached the field. It failed 4/4 before the change.
- Observer: first shop at ticks 105 / 201 / 297 / 393 for Easy / Normal / Hard /
  Expert (about 5.3 / 10.1 / 14.9 / 19.7 s). Before, Expert's diagnostic first
  shop was about tick 2,300. Attacks over 2,400 ticks improved from 17 / 26 / 4 /
  0 to 22–36 / 64–76 / 41–61 / 82–85 across repeated runs (the battle seed is
  random, so count the range).
- Commands: `bun run typecheck` pass; `bun test` **307 pass, 0 fail**;
  `bun scripts/bot-observer.ts 2400` pass and wrote
  `.agents/bot-observer-opening.jsonl`.
- Not verified: a human watch of the new opening on the live `:3002` process;
  that process still runs the previous build until restarted. A* and motor
  combat wiring remain out of scope.
- Risks: Hard/Expert still return to defend when their bed is threatened; bed
  cover now appears on a later trip, so a fast rush can catch an uncovered bed.
  The observer's pass count remains approximate because it includes swing
  cooldown.
