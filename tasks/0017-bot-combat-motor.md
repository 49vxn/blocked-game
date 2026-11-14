# Task 0017 — Bot combat motor wiring

Status: done — integrated; 309-test suite pass
Owner: Buffy (integrator)
Created: 2026-10-31
Depends on: 0013 perception/motor, 0016 opening economy

## Goal

Use the existing `MotorController` for the fight aim, not only the reaction
gate. The bot currently computes a perfect desired yaw/pitch and adds a random
`aimOffset`; the motor already has turn-rate/acceleration caps, coherent aim
error, overshoot and corrections. Wire it in and remove the legacy offset.

## Required behaviour

1. `fight()` calls `motor.aim(currentYaw, currentPitch, desiredYaw, desiredPitch,
   tierProfile, 1/TPS, context)` every tick it is fighting.
2. The returned yaw/pitch drives the movement input and the melee swing.
3. Remove `aimOffset` and `aimRollAt`; no second random aim model.
4. Aim error context uses distance, apparent target size and target angular
   speed, so far/fast targets are harder.
5. Reaction gating and target selection stay unchanged.
6. Ranged aim (`bow`/`fireball`/pearl) is not part of this task.

## Allowed paths

- `src/games/bedwars/bots.ts`
- `tests/bot-aim-wiring.test.ts` (new)
- `scripts/bot-observer.ts`
- `HANDOFF.md`, `docs/STATE.md`, `docs/BOT_AI_REWRITE.md`, `QUEUE.md`,
  `docs/CHANGELOG.md`, `tasks/README.md`

`bots.ts` is a reviewed integrator change. No other source file may change.

## Test-first steps

1. Add a test that sets the bot facing away from an enemy and calls the private
   `fight()` path once. The returned yaw must respect the tier turn cap; the
   legacy code snaps directly to the target.
2. Confirm the test fails against the current fight loop.
3. Wire `motor.aim` into `fight()` and delete the old offset.
4. Run focused bot tests, full suite and the observer.
5. Confirm bot rounds still end and attacks do not collapse at Expert.

## Acceptance checks

- [ ] A 180-degree facing change in one fight call is capped by the tier's
      `turnDegPerSecond / 20`.
- [ ] Easy turns slower than Expert in the same setup.
- [ ] No `aimOffset`/`aimRollAt` remains in `bots.ts`.
- [ ] Existing full bot rounds, all arenas, expert-vs-easy and ranged tests pass.
- [ ] `bun run typecheck` and the full suite pass.
- [ ] Observer still shows every tier reaching the field and attacking.
- [ ] No live-server restart.

## Out of scope

- A* pathfinding.
- Target commitment/switch logic and lapses beyond what the motor already does.
- Ranged aim, planner/economy, tactics, new tiers or protocol changes.

## Completion report

- Task: `0017-bot-combat-motor`
- Status: done, integrated in the shared checkout.
- Files changed: `src/games/bedwars/bots.ts`,
  `tests/bot-aim-wiring.test.ts` (new), plus the handoff/state/bot/queue/
  changelog/task-board docs. `scripts/bot-observer.ts` was already extended by
  0016 and is unchanged by this task.
- Behaviour: `fight()` now calls `MotorController.aim` every fighting tick with
  distance, apparent size and target angular speed; the legacy `aimOffset` and
  `aimRollAt` were removed.
- Test: a 180-degree facing change is capped at `turnDegPerSecond / 20`. Before
  the change, Easy stepped 172.7 degrees in one `fight()` call; after, every
  tier is under its cap and Easy turns less than Expert in the same setup.
- Commands: `bun run typecheck` pass; focused bot suite **43 pass**; full suite
  **309 pass, 0 fail**; `bun run build:node` pass; three 2,400-tick observer
  runs completed.
- Observer after the motor: average attacks per 2,400 ticks over three runs are
  Easy 18.7, Normal 44.7, Hard 56, Expert 53.7. Expert and Hard are within run
  noise; the important check is that Expert still reaches the field and attacks.
- Not verified: a human watching close-range duels in the browser; `:3002` still
  runs the process from before 0016/0017 until restarted.
- Risks: slower aim reduces raw attack count at close range, by design. Expert
  is not clearly ahead of Hard in the short observer window; target commitment
  and decision quality are still the next combat work. The pass metric remains
  approximate.
