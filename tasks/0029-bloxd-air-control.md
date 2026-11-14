# Task 0029 — Bloxd-style air control

Status: review — sandbox preset implemented; default pending playtest
Owner: Buffy
Created: 2026-11-03
Depends on: `src/engine/physics.ts`, `src/engine/constants.ts`, movement tests

## Goal

Make airborne steering respond like Bloxd’s default movement instead of
carrying the old horizontal velocity. Keep the current 4.9 / 6.5 ground speeds
and 1.59-block jump until a real playtest says the speed should change too.

## Evidence

Bloxd’s published client options say:

- `airAccScale` default `1`
- `airFrictionScale` default `1`
- `airMomentumConservation` default `false`; the docs say only Rocket Obby
  sets it true.

Bloxd’s movement table gives walk **4**, run **7**, crouch **2** blocks/s and a
normal jump around **1.47** blocks. Those speeds are not copied in this task
because Clache’s maps and bots are tuned around 4.9 / 6.5.

Clache currently uses:

```ts
m.vx = m.vx * 0.91 + wx * 0.03
m.vz = m.vz * 0.91 + wz * 0.03
```

That keeps 91% of the old velocity every airborne tick, so reversing or
strafing in the air carries momentum for many ticks. That is the drift the
feedback is about.

## Contract

- Keep the ground blend (`GROUND_FRICTION = 0.546`) unchanged.
- In the air, when there is movement input:
  - target the input direction at the current horizontal speed, or the
    preset walk/sprint/sneak speed if that is higher;
  - blend 50% toward that target each tick (`AIR_CONTROL = 0.5`), so a reversal
    is planted within about 3–4 ticks;
  - do not keep the old direction after the blend.
- In the air with no movement input, retain 99.5% of horizontal velocity per
  tick (`AIR_IDLE_DRAG = 0.995`) so a normal sprint jump still arcs. Do not
  brake a jump to a stop.
- Respect `speedBoost`, sprint, sneak and shield as today.
- Keep jump velocity and sprint-jump boost unchanged.
- No per-player client-option system in this task. A full Bloxd-style options
  layer is a later refactor; this is the physics change only.

## Files allowed

- `src/engine/physics.ts`
- `src/engine/constants.ts`
- `tests/movement.test.ts`
- `docs/MOVEMENT_PRESETS.md`
- `docs/STATE.md`
- `FEATURES.md`
- `docs/CHANGELOG.md`

Off-limits: `bots.ts`, maps, room/protocol, client UI, package/lockfile.

## Test-first plan

1. Add a test that a sprint jump reversed in the air changes horizontal
   direction within 4 ticks, where the old 0.91 model would still be moving the
   old way.
2. Add a test that air strafe does not keep most of the old sideways velocity.
3. Keep the existing stop, ground reversal, jump-peak and sprint-jump checks.
4. Confirm the new air tests fail on the current constants, then implement.
5. Run `bun test tests/movement.test.ts tests/physics.test.ts`, typecheck, full
   suite and `build:node`.
6. Browser sandbox: sprint-jump, reverse mid-air, strafe mid-air, and confirm a
   normal sprint jump still clears the same gaps.

## Acceptance checks

- [ ] Ground stop and ground reversal stay under the current limits.
- [ ] Air reversal changes direction within 4 ticks.
- [ ] Air strafe does not retain most of the old sideways speed.
- [ ] Sprint-jump distance stays under 4.6 blocks.
- [ ] Jump peak stays between 1.5 and 1.75 blocks.
- [ ] Bots still complete a full round.
- [ ] `bun run typecheck`
- [ ] `bun test --max-concurrency 1 --timeout 10000`
- [ ] `bun run build:node`

## Completion report

- Task: 0029
- Status:
- Files changed:
- Commands run:
- What was verified:
- What was not verified:
- Known risks:
- Next action:
