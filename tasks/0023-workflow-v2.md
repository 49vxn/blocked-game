# Task 0023 — Workflow v2 and external review

Status: done — integrated; 349-test suite pass
Owner: Buffy (integrator)
Created: 2026-11-02
Depends on: 0012 workflow, `docs/OPENCODE_SWARM_RESEARCH.md`

## Goal

Make the existing three-session workflow explicit and usable with the current
OpenCode/GLM setup:

- two implementation workers with isolated workspaces;
- one read-only reviewer session (no workspace);
- an optional OpenCode/GLM external review gate;
- self-contained starter packs in `.agents/worker1` and `.agents/worker2`.

The workflow still never deploys, restarts the LAN server or auto-merges.

## Required behaviour

1. `scripts/workflow-lib.ts` exports `externalReviewPrompt(task, agent, files,
   workspace)` — a pure read-only reviewer prompt.
2. `scripts/workflow.ts` gets `review-external <agent> <task-id>`:
   - requires a passing mechanical review and fresh `checks.json`;
   - `--print` prints the exact prompt without calling OpenCode;
   - otherwise invokes `scripts/opencode-review.ts` through a loopback server;
   - writes `.agents/<agent>/<id>/external-review.md` and a JSON receipt;
   - never edits source and never integrates.
3. `package.json` exposes `review:opencode` for the existing bridge.
4. `.agents/worker1/START-HERE.md` is the implementation brief for the current
   or next worker1 task.
5. `.agents/worker2/START-HERE.md` is the read-only reviewer brief; it must not
   create a workspace or edit source.
6. `docs/MULTI_AGENT_WORKFLOW.md` documents the two-writer + reviewer slate,
   commands, GLM-free caveat and exact startup sequence.
7. Existing tests stay green; add pure prompt tests.

## Allowed paths

- `scripts/workflow-lib.ts`, `scripts/workflow.ts`
- `tests/workflow.test.ts`
- `package.json`
- `docs/MULTI_AGENT_WORKFLOW.md`, `docs/OPENCODE_SWARM_RESEARCH.md`
- `HANDOFF.md`, `docs/STATE.md`, `QUEUE.md`, `docs/CHANGELOG.md`,
  `tasks/README.md`
- `.agents/worker1/START-HERE.md`, `.agents/worker2/START-HERE.md`

No game source, room, protocol, client, maps, bots, package lock or live server.

## Acceptance

- [ ] `workflow review-external --print` produces a safe read-only prompt.
- [ ] The command refuses a stale/missing check or failing mechanical review.
- [ ] The actual command fails clearly when no loopback OpenCode server exists.
- [ ] `worker1` and `worker2` each have a self-contained START-HERE brief.
- [ ] Workflow docs tell the human exactly how to start the three sessions.
- [ ] Typecheck, focused workflow tests, full suite and build pass.
- [ ] No deploy/restart/git.

## Completion report

- Task: `0023-workflow-v2`
- Status: done.
- Files: `scripts/workflow-lib.ts`, `scripts/workflow.ts`,
  `tests/workflow.test.ts`, `package.json`, docs and worker starter packs.
- Added `workflow review-external <agent> <task-id> [--print]`: requires a
  passing mechanical review and fresh `checks.json`, prints the read-only
  prompt with `--print`, or invokes the loopback OpenCode bridge and writes
  `external-review.md` / `external-review.json`. It never edits or integrates.
- Added `externalReviewPrompt` pure helper and test; 13 workflow tests pass.
- Added `.agents/worker1/START-HERE.md` and
  `.agents/worker2/START-HERE.md` for the two implementation/reviewer roles.
- Full suite: **349 pass, 0 fail** with `bun test --max-concurrency 1 --timeout 10000`.
  The default 5s timeout can flake under CPU contention; no assertion failed.
- Not verified: live GLM review; worker3's stale 0015 workspace fails its
  workspace check (easy/expert timeouts), so external review correctly refuses
  it. No deploy/restart/git.

## Addendum 2026-11-02 — headless v3 verification

- The reviewer is now headless: `opencode/glm-5.3-flash-free#max` with the
  read-only `plan` agent through the v2 `/api` routes. worker2 has no Freebuff
  chat.
- Live worker3/0015 review: **PASS**, 33 KB report, four minor findings.
- Fixed during verification: old root routes, returning an intermediate
  `tool-calls` sentence, `--out` not writing a file, and Windows `cmd.exe`
  choking on the multi-line prompt argument (now stdin).
- Changed files are inlined and tools are disabled so the free model returns a
  verdict instead of looping.
- `workflow check` and `integrate` use
  `bun test --max-concurrency 1 --timeout 10000`. Current full suite: **377
  pass, 0 fail**, 38 files, 28.66s; typecheck pass.
