# Task 0025 — Autobridge repair (forward assist + edge grace)

Status: ready
Owner: unassigned
Created: 2026-11-02
Depends on: current `assistBridge` in `client/game.ts`; settings v3 migration

## Goal

Make bridging usable again for touchpad and low-dexterity players without
bringing back the removed always-on scaffold. Add an **explicit, opt-in forward
auto-bridge**, and fix the Bedrock bridge so it still places the last block
after the player steps off the edge. A player who never turns it on sees no
change.

## Why now

- Forward auto-bridge was removed after play feedback, but the replacement
  (hold use/right-click + sneak + back) is still the top touchpad complaint.
- `assistBridge` returns as soon as `!this.me.onGround`, so the last block at
  the lip often never places; players fall while reversing.
- The setting only has Auto/On/Off. It describes detection, not direction, so a
  player cannot choose “forward” without re-enabling the old scaffold globally.

## Source of truth

- Current logic: `src/games/bedwars/client/game.ts` — `assistBridge()`,
  `detectTouchpad()`, `cycleBridgeAssist()`, `bridgeAssistEnabled`.
- Settings: `src/games/bedwars/client/settings.ts` (`BridgeAssist`, version 3).
- Copy/UI: `settings-ui.ts` “Bedrock bridge”, `hud.ts` pause/help text.
- History: `docs/TOUCHPAD_BRIDGE.md`, `docs/CHANGELOG.md` (2026-10-30
  EasyBridge forward extension, later removal).

## Ownership

- Workspace: `.agents/<agent>/0025-autobridge-fix/`
- Files allowed to change:
  - `src/games/bedwars/client/game.ts`
  - `src/games/bedwars/client/settings.ts`
  - `src/games/bedwars/client/settings-ui.ts`
  - `src/games/bedwars/client/hud.ts`
  - `src/games/bedwars/client/bridge.ts` (new, if a pure helper is extracted)
  - `tests/bridge-assist.test.ts` (new), `tests/settings.test.ts`
  - `docs/TOUCHPAD_BRIDGE.md`, `docs/CONTROLS.md`
- Off-limits: `room.ts`, `protocol.ts`, `bots.ts`, maps, server validation,
  package/lockfile, `index.html`.
- Shared interface owner: integrator.

## Contract

- New setting `bridgeStyle: 'bedrock' | 'forward'`, default `'bedrock'`.
  Persist it in settings v4 and migrate missing/invalid values to `'bedrock'`.
  Keep `bridgeAssist: 'auto' | 'on' | 'off'` as the on/off/detection control.
- **Bedrock mode** (default, unchanged direction): hold use/right-click +
  sneak + back with a block. Fix: keep a 2-tick coyote window using the last
  grounded cell, so stepping off the lip does not cancel the last placement.
- **Forward mode** (opt-in): hold forward with a block while grounded (or within
  the same 2-tick coyote window). Place one cell ahead at foot level when:
  - the support cell under the player is solid;
  - the target foot cell is air and the cell under it is air/void (an edge);
  - no modal/chat is open, the player is alive, and a block is selected;
  - the 4-tick placement cooldown has elapsed.
- Never place both modes on one tick. Never place while walking backward in
  forward mode. Normal right-click/E placement stays authoritative.
- Server-side `onPlace` validation, reach and protection rules are unchanged.
- No automatic aiming, no scaffold above the player, no placement while
  airborne beyond the coyote window, no placement into map/protected cells.
- UI must state the mode and that forward assist is optional. Do not describe it
  as “EasyBridge” in new copy; the current name is Bedrock bridge.

## Acceptance checks

- [ ] Default settings place nothing on forward movement.
- [ ] Bedrock mode still places behind while use + sneak + back, including one
      block after leaving the lip (coyote window).
- [ ] Forward mode places at most one block per 0.2 s and only at an edge.
- [ ] No placement with UI/chat open, while dead, with no block, or into a
      protected/map cell.
- [ ] Settings v3 saves migrate to `bridgeStyle: 'bedrock'`.
- [ ] Focused: `bun test tests/bridge-assist.test.ts tests/settings.test.ts`
- [ ] `bun run typecheck`
- [ ] Full suite: `bun test --max-concurrency 1 --timeout 10000`
- [ ] `bun run build:node`
- [ ] Browser: real Chrome/Edge, touchpad + mouse, 64 wool, one-block ledge over
      void; check On/Off/forward/bedrock and normal placement.

## Test-first steps

1. Add the pure placement-cell test (`bridgeTarget`) and the settings migration
   test; run and confirm the forward case fails.
2. Implement the smallest helper + wiring; do not change server validation.
3. Rerun focused tests; then typecheck and the full suite.
4. Build and playtest in Chrome; record device, sensitivity and result.

## Review checklist

- [ ] Only allowed files changed.
- [ ] One writer; no protocol/room/bot/map change.
- [ ] Copy matches the actual behavior, including “optional”.
- [ ] No new dependency.
- [ ] Performance: no per-frame allocation in `assistBridge`.
- [ ] Known gaps listed (phone touch controls remain out of scope).

## Completion report

- Task: 0025
- Status:
- Files changed:
- Commands run:
- What was verified:
- What was not verified:
- Known risks:
- Next action:
