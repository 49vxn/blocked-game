# Task 0013 — Bot perception and motor

Status: done — integrated; main regression gate passed
Owner: worker1
Created: 2026-10-30
Depends on: frozen `src/games/bedwars/bots/types.ts` and `bots/profiles.ts`
(the integrator has created them; do not edit them)

## Goal

Give the bot a human-constrained information and movement layer: it sees only
what is in front of it and unobstructed, remembers last-seen positions instead of
live coordinates, reacts after a sampled delay, and turns/aims under a cap.
This is a module change only; the existing `Bot` behavior stays unchanged until
the integrator wires it.

Read `docs/BOT_AI_REWRITE.md` and `src/games/bedwars/bots/README.md` first.

## Ownership

- Workspace: `.agents/worker1/0013-bot-perception-motor/`
- Files allowed to change:
  - `src/games/bedwars/bots/perception.ts` (new)
  - `src/games/bedwars/bots/memory.ts` (new)
  - `src/games/bedwars/bots/motor.ts` (new)
  - `tests/bot-perception.test.ts` (new)
  - `tests/bot-motor.test.ts` (new)
- Off-limits: `src/games/bedwars/bots.ts`, `bots/types.ts`,
  `bots/profiles.ts`, `bots/telemetry.ts`, other `bots/` modules, `rules.ts`,
  `room.ts`, `protocol.ts`, client files, maps, package/build config.
- Shared interface owner: integrator.

## Contract

### Perception

Implement `PerceptionTracker` with:

```ts
update(room: Room, self: Player, profile: BotTierProfile, tick: number): BotPerception
reset(): void
```

Requirements:

- Use `raycastBlock` from `engine/raycast` for line of sight to the target body.
- Active sight is a horizontal FOV of `profile.fovDegrees`, plus a close-range
  noticing radius (e.g. 2.5 blocks) so a target just outside the cone is not
  invisible at touching distance.
- Only visible enemies may have `visible: true` and live coordinates. When LOS
  is lost, keep the last-seen position/velocity in `remembered` with decaying
  confidence for `profile.memorySeconds`; never refresh it from the live player.
- A target hit by the bot (or an attacker that hit the bot) may be noticed even
  if the normal cone is missed, but still requires a plausible event, not global
  knowledge.
- `threat` is the most urgent currently visible/remembered enemy using distance,
  bed proximity and whether they are attacking; it is not a global nearest-player
  scan.
- Preserve deterministic seeded randomness through an injected `random` where
  needed; no `Math.random`.
- Do not import `bots.ts` (avoid a cycle) and do not send messages.

### Memory

Implement a small `TargetMemory` used by perception:

- `observe(enemy, tick)` stores last-seen x/z/velocity and confidence;
- `recall(id, tick, profile)` returns a decaying remembered enemy or null;
- `forget(id)` and `clear()`;
- expiry after `profile.memorySeconds`; confidence falls monotonically;
- optional last-seen age is exposed through `lastSeenTick`.

Keep it deterministic and unit-testable without a Room.

### Motor

Implement `MotorController` with:

```ts
constructor(random: () => number)
reset(): void
scheduleSighting(id: number, tick: number, profile: BotTierProfile): void
canReact(id: number, tick: number): boolean
aim(
  currentYaw: number,
  currentPitch: number,
  desiredYaw: number,
  desiredPitch: number,
  profile: BotTierProfile,
  dtSeconds: number,
): { yaw: number; pitch: number; turnRate: number }
```

Requirements:

- Sample one reaction delay per new sighting from `profile.reactionMs`; use a
  right-skewed distribution (lognormal or mixture with a slow tail) and execute
  on the first 20 TPS tick at/after the sampled deadline. Do not reset the delay
  every tick.
- A tracked target re-actions faster; a new sighting pays the full sample.
- Quantize to 50 ms ticks; stagger phase by bot id/random but keep a seeded,
  deterministic stream.
- Cap yaw/pitch angular velocity at `profile.turnDegPerSecond` and acceleration
  at `profile.turnAcceleration`. Allow at most 0–2 corrective submovements and a
  small overshoot; never assign the perfect angle in one tick.
- Aim error scales with `profile.aimError`, target angular size/distance and
  movement; it must be a real error, not a constant random wobble.
- No `room` or message sending in the motor; it returns angles only.

## Acceptance checks

- [ ] A wall between bot and target prevents acquisition/attack; the last-seen
      point is remembered and expires.
- [ ] A target outside the FOV but at touching distance is noticed; one far
      outside the FOV is not.
- [ ] Remembered positions do not update while LOS is blocked.
- [ ] Reaction delays are not constant: p50 and p90 differ and both fall inside
      the tier's configured range (within one 50 ms tick).
- [ ] Per-tick yaw/pitch change never exceeds the profile's turn cap.
- [ ] Aim overshoot/correction is present at lower tiers and bounded at Expert /
      Technoblade.
- [ ] Deterministic seeds reproduce the same delays/angles.
- [ ] `bun run typecheck` and focused tests pass; full suite passes.
- [ ] No edits outside the allowed paths.

## Test-first steps

1. Add the wall/LOS and FOV tests; confirm they fail (or fail before the module
   exists for the right reason).
2. Add the memory-expiry test.
3. Add the turn-cap and non-constant-delay tests.
4. Implement memory, perception, then motor.
5. Run `bun test tests/bot-perception.test.ts tests/bot-motor.test.ts`, then
   `bun run typecheck` and `bun test`.

## Out of scope

- Wiring into `bots.ts`; that is the integrator.
- Planner, economy, tactics, telly bridge, combat builds.
- Changing `BotLevel`, UI, protocol or server rules.
- Real player telemetry; use the research table as the starting distribution.

## Completion report

- Task: 0013
- Status: done
- Integrated: 5 files applied; main typecheck and full suite passed
- Evidence: focused tests 16/16; full workspace suite 272/272; main suite 293/293
- Files changed: `bots/perception.ts`, `bots/memory.ts`, `bots/motor.ts`,
  `tests/bot-perception.test.ts`, `tests/bot-motor.test.ts`
- What was verified: LOS/FOV, memory expiry, no live tracking, reaction tail,
  turn cap, aim corrections, deterministic seeds
- What was not verified: original module-only gate; the integrator later wired
  perception/motor into `bots.ts` and the full suite (293 pass) verified it.
- Known risks: planner/economy still use the legacy goal executor until the next
  wiring slice
- Next action: wire into `bots.ts` after 0015/tier work

- Original report:
  - Task:
- Status:
- Files changed:
- Observed p50/p90 reaction:
- Max turn rate observed:
- LOS/memory tests:
- Commands run: `<command> -> pass/fail, key output`
- What was verified:
- What was not verified:
- Known risks:
- Next action:
