# Task 0002 — Human-like bots, phase 1

Status: blocked — superseded by `docs/BOT_AI_REWRITE.md`
Owner: unassigned
Created: 2026-10-29
Depends on: `0001-movement-feel` (shared physics), integrator-frozen bot interface

> **Do not start this contract in its current form.** The full bot AI rewrite
> (`docs/BOT_AI_REWRITE.md`, Q-027) folds these goals into a five-tier
> perception/planner/motor/tactics architecture. The integrator must replace
> this contract before a worker starts.

## Goal

Make the bots read as players, not aimbots: they only react to what they can
see, their heads turn instead of snapping, they commit to a target, and their
mistakes look like human mistakes. Keep the existing gathering, building,
raiding and bed-defence competence.

## Source of truth

- `docs/BOT_HUMANIZATION.md`
- `src/games/bedwars/bots.ts`
- `tests/bots.test.ts`
- Existing profiles in `BOT_PROFILES`

## Ownership

- Workspace: `.agents/worker1/0002-bot-humanization/` (or your chosen implementation agent)
- Files allowed to change:
  - `src/games/bedwars/bots.ts`
  - `tests/bots.test.ts`
- Off-limits: `rules.ts` (owned by 0011 this batch), `room.ts`, `protocol.ts`, client files, maps, package/build config.
  If a profile field must move, stop and ask the integrator to freeze it first.
- Shared interface owner: integrator.

## Contract

Phase 1 only:

1. **Perception gate.** Build a per-think perceived-enemy list from line of
   sight, noticing FOV, last-known position and expiry. No target acquisition,
   attack, chase or guard reaction to an enemy the bot could not see. Keep a
   short memory of last-seen position/velocity; do not track through walls.
2. **Human response distribution.** Replace fixed `reactionTicks` with a sampled
   delay per new actionable sighting: lognormal core plus a small delayed
   response chance, as in the parameter table. A tracked target re-acts faster.
3. **Smooth aim.** Cap yaw/pitch angular velocity and acceleration. Move toward
   a noisy aim point, allow a small overshoot, then correct. Never assign the
   perfect angle in one tick. Aim error scales with apparent target size.
4. **Target commitment.** Keep the current target for a minimum window unless a
   higher-priority threat appears (enemy at our bed, teammate about to die,
   imminent void). Require a switch margin; no nearest-target flip-flopping.
5. **Readable misses.** Only miss when aim/timing confidence is marginal. Do not
   add a random “make the bot miss” roll that overrides a valid attack.

Preserve:

- all existing gather/shop/defend/raid goals and bot levels;
- bot actions still go through `room.receive` like a client;
- server authority and current test harness;
- expert still wins against easy, but not perfectly.

## Acceptance checks

- [ ] New test: a wall between bot and player prevents acquisition and attack.
- [ ] New test: a tracked target produces a reaction delay within the configured
      distribution, not a constant.
- [ ] New test: per-tick yaw/pitch change never exceeds the turn cap.
- [ ] New test: target switches per engagement stay under 1.5 in a staged duel.
- [ ] Existing bot rounds still finish on every arena.
- [ ] Expert still beats easy in the existing majority test.
- [ ] `bun run typecheck`, `bun test`, `bun run build:node` pass.
- [ ] A short blind human check: can a tester identify the bot from movement?
      Record the exact tell; do not claim “human-like” without it.

## Test-first steps

1. Add the wall/LOS test and the turn-cap test first; both should fail.
2. Add the staged duel/switch test.
3. Implement perception, response sampling, smooth aim and commitment in that
   order.
4. Run `bun test tests/bots.test.ts`, then the full suite.
5. Log reaction delay, turn rate and switch count for one full bot round.

## Out of scope

- New bot goals, team communication protocol, resource sharing.
- Machine learning.
- New maps or items.
- Client UI for bot settings.
- Changing player movement or combat damage.

## Completion report

- Task:
- Files changed:
- Reaction-delay distribution observed:
- Max turn rate observed:
- Target switches per engagement:
- Commands run: <command> -> pass/fail, key output
- Blind human result / tells:
- What was not verified:
- Known risks:
- Next action:
