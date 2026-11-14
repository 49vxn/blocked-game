# Task 0026 — Lag investigation and repair

Status: ready
Owner: unassigned
Created: 2026-11-02
Depends on: a reproducible scenario and a baseline measurement; no gameplay
change before the baseline

## Goal

Find and fix the actual cause of the reported lag. Target: a 16-bot 4v4v4v4
battle holds **20 TPS** on the server and **~60 FPS** in Chrome on a mid-range
laptop, with no frame or tick stall over 100 ms for five minutes. Do not ship
speculative “optimisations” without before/after measurements from the same
machine and scenario.

## Why now

Players report the game feels laggy and “very bugged”; the LAN host and the
local battle host run the same simulation, and the 16-bot room is the heaviest
regular case. We currently have load tools (`scripts/loadtest.ts`,
`scripts/netprobe.ts`, `scripts/bot-observer.ts`) but no single trace that
separates server tick cost, snapshot size, network jitter and client frame cost.

## Source of truth

- `src/games/bedwars/room.ts` — tick loop, snapshots, bot installation.
- `src/games/bedwars/bots.ts` — 16 bots, perception/nav/combat per tick.
- `src/games/bedwars/protocol.ts` — snapshot encoding.
- `src/games/bedwars/client/game.ts`, `client/hud.ts` — frame loop and HUD DOM.
- `src/engine/render/chunks.ts`, `mesh-worker.ts` — remesh/upload path.
- `scripts/loadtest.ts`, `scripts/netprobe.ts`, `scripts/bot-observer.ts`.
- `docs/OPERATIONS.md`, `docs/STATE.md` — runtime commands.

## Ownership

- Workspace: `.agents/<agent>/0026-lag-investigation/`
- Files allowed to change:
  - `scripts/perf-probe.ts` (new; server tick + snapshot + client trace)
  - `src/games/bedwars/room.ts` (instrumentation and measured fixes only)
  - `src/games/bedwars/protocol.ts` (only if snapshot size is the proven cause)
  - `src/games/bedwars/client/game.ts`, `client/hud.ts`
  - `src/engine/render/chunks.ts` (only with a measured remesh bottleneck)
  - `tests/perf.test.ts` or focused tests for any changed pure logic
  - `docs/STATE.md`, `docs/CHANGELOG.md` (evidence section)
- Off-limits: bot behavior/tiers, map layouts, `bots.ts` (read-only), server
  protocol semantics without a separate contract, package/lockfile.
- Shared interface owner: integrator.

## Contract

### Phase 1 — measure (required before any fix)

Record, for the 16-bot battle and a 4-human room, for at least 3 minutes:

- server: tick duration p50/p95/p99, longest tick, snapshot bytes per tick,
  room count, bot count, event-loop delay;
- client: rAF frame time p50/p95/p99, long tasks > 50 ms, draw calls, chunk
  remesh count/queue depth, JS heap;
- network: message rate, snapshot size, jitter/loss (`netprobe`).

The probe must be opt-in and must not run in production by default. Emit one
JSONL row per second plus a summary. Do not log per-block or per-player data.

### Phase 2 — fix the top measured cause

Priorities, only if the trace supports them:

1. **HUD DOM churn** — throttle scoreboard/action-bar rebuilds to 4–10 Hz and
   reuse nodes; no `innerHTML` from the frame loop.
2. **Snapshot cost** — if encode size or rate dominates: reduce redundant
   fields, batch block edits, or add a delta/interesting-set; never silently
   change semantics.
3. **Bot CPU** — if `bots.ts` dominates: budget A*/perception per bot per N
   ticks without changing behavior contracts; coordinate with the bots owner.
4. **Chunk remesh** — batch edits per tick, cap uploads per frame, reuse
   geometry buffers.
5. **Render** — particle/projectile caps, render distance/quality defaults,
   pixel-ratio guard.

Each fix must land with the before/after trace in the completion report.

### Constraints

- No new dependency.
- No gameplay rule change hidden inside a perf patch.
- Keep 20 TPS authoritative; do not lower it to hide cost.
- Profiling hooks must be removable and off by default.
- Do not weaken existing tests; add a focused regression test for a pure fix.

## Acceptance checks

- [ ] Baseline trace committed to the completion report (same machine, same
      scenario, 3+ minutes).
- [ ] Server p95 tick < 25 ms and no tick > 100 ms with 16 bots.
- [ ] Client p95 frame < 20 ms at 1080p on the test laptop; no long task > 50 ms
      in a steady-state minute.
- [ ] Snapshot p95 size recorded; no unbounded growth over 5 minutes.
- [ ] `bun run typecheck`, full suite, `bun run build:node` pass.
- [ ] Before/after numbers use the same scenario and hardware.
- [ ] Browser check on `:3000` with the battle URL.

## Test-first steps

1. Build the probe; capture the baseline before touching game code.
2. Add a failing regression test only for a pure logic change; otherwise keep
   the measurement as evidence.
3. Implement one fix at a time; re-run the probe after each.
4. Stop when the acceptance numbers are met; list what remains.

## Review checklist

- [ ] A measured cause, not a guess, for every change.
- [ ] No behavior/protocol change without explicit approval.
- [ ] Probe is opt-in, bounded and secret-free.
- [ ] Numbers reproducible; report machine, browser, resolution and room size.
- [ ] Known gaps listed (network ISP, school Wi-Fi, other players' devices).

## Completion report

- Task: 0026
- Status:
- Files changed:
- Scenario + machine:
- Baseline → after (tick/frame/snapshot):
- Commands run:
- What was verified:
- What was not verified:
- Known risks:
- Next action:
