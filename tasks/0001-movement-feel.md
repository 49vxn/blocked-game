# Task 0001 — Movement feel presets

Status: done — Classic chosen and tuned; experimental controller retired
Owner: Buffy
Created: 2026-10-29
Completed: 2026-10-29

## Goal

Let the human feel three movement alternatives without changing normal
matches. After a choice, make the winning controller the normal default.

## Decision

Classic, with a little less speed, is the normal controller:

- walk **4.9** blocks/s (was 5.2)
- sprint **6.5** blocks/s (was 7.0)
- jump about **1.59** blocks (unchanged)
- sprint-jump arc **4.44** blocks (was 5.51), by lowering the launch push and
  sprint air acceleration

The three experimental accelerate/brake presets were retired because their low
acceleration let the old direction survive a turn. That was the “moving without
pressing keys” bug. Surefoot, Snapline and Flowline remain sandbox-only speed
variants, all using Classic's steering.

## Source of truth

- `docs/MOVEMENT_PRESETS.md`
- `src/engine/movement.ts`
- `src/engine/physics.ts`
- `src/engine/constants.ts`
- `tests/movement.test.ts`
- `tests/physics.test.ts`

## Ownership

- Workspace: `.agents/buffy/0001-movement-feel/`
- Files changed:
  - `src/engine/movement.ts`
  - `src/engine/physics.ts`
  - `src/engine/constants.ts`
  - `src/games/bedwars/client/game.ts`
  - `src/games/bedwars/client/hud.ts`
  - `tests/movement.test.ts`
  - `tests/physics.test.ts`
  - `docs/MOVEMENT_PRESETS.md`
  - `README.md`, `FEATURES.md`, `HANDOFF.md`

## Contract

- One shared `stepMovement`; no client-only fork.
- All presets use the Classic blend.
- Classic is the normal default for matches and bots.
- Sandbox **M** still cycles the presets; the HUD card shows the current speed.
- Direction changes must be measured: reversal drift under 0.1 block.
- Sprint-jump arc must stay under 4.6 blocks.
- Jump height stays about 1.6 blocks; no bunny-hop or landing speed bonus.
- No protocol change.

## Acceptance checks

- [x] Classic is 4.9 walk / 6.5 sprint blocks/s.
- [x] Stop after sprint is under 0.5 block.
- [x] Reversal drift is under 0.1 block for every preset.
- [x] Jump peak is 1.5-1.75 blocks; no preset reaches two.
- [x] Sprint-jump arc is under 4.6 blocks.
- [x] Diagonal input is normalised.
- [x] Sandbox M cycles the presets and the choice persists.
- [x] `bun run typecheck`, focused tests and the full suite pass.
- [x] Production build rebuilt and the LAN server restarted.

## Completion report

- Files changed: see ownership list.
- Commands: `bun run typecheck` → pass; `bun test tests/movement.test.ts
  tests/physics.test.ts tests/settings.test.ts` → 36 pass; full `bun test` →
  pass; `bun run build:node` → pass.
- Measured: Classic 4.9 / 6.5, stop 0.39, reversal 0.07, jump 1.59,
  sprint-jump 4.44.
- Not verified: another person's feel preference after the change.
- Known risk: the jump arc is still long enough that a badly timed sprint-jump
  can overshoot a small platform; release forward before landing to shorten it.
- Next action: play the live sandbox and report whether the pace is right.
