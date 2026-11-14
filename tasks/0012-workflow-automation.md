# Task 0012 — Workflow automation

Status: done
Owner: Buffy
Created: 2026-10-30
Depends on: `scripts/agent-task.mjs`, `docs/AGENT_WORKFLOW.md`

## Goal

Let three agent sessions work at once without the human hand-checking every
workspace. One command shows the active slate, refuses overlapping file
ownership, writes each worker's brief, runs each workspace's checks, reviews the
diff against its contract, and integrates only after the review and tests pass.

## Source of truth

- `docs/AGENT_WORKFLOW.md` — roles, lifecycle and review gate.
- `docs/MULTI_AGENT_WORKFLOW.md` — active three-agent split and commands.
- `scripts/agent-task.mjs` — isolated workspace backend.
- `tasks/TEMPLATE.md` — contract shape.

## Ownership

- Workspace: integrator checkout (this is tooling, not a worker task).
- Files allowed to change:
  - `scripts/workflow.ts` (new)
  - `scripts/workflow-lib.ts` (new)
  - `scripts/agent-task.mjs`
  - `tests/workflow.test.ts` (new)
  - `package.json`
  - `AGENT.md`, `AGENTS.md`
  - `docs/AGENT_WORKFLOW.md`, `docs/MULTI_AGENT_WORKFLOW.md`
  - `docs/OPERATIONS.md`, `docs/STATE.md`, `docs/CHANGELOG.md`
  - `HANDOFF.md`, `QUEUE.md`, `tasks/README.md`
  - `tasks/0012-workflow-automation.md`
- Off-limits: simulation, client, maps, protocol and any live-server code.

## Contract

- A maximum of **three active agents**; an agent with a workspace counts once.
- `status` reads task contracts and workspaces, reports changed files, scope
  violations and ownership conflicts.
- `plan` chooses up to the free slots from `ready` contracts whose allowed paths
  do not overlap each other or active work.
- `start` refuses a fourth agent, a duplicate agent and any path overlap before
  creating a workspace. It writes `BRIEF.md` outside the workspace.
- `check` runs `bun run typecheck` and `bun test` inside the workspace and stores
  the result and content signature.
- `review` blocks files outside the contract, deletions, generated output and
  edits made after the last check. It reports test/doc changes as notes.
- `integrate` requires a fresh passing review and check, refuses main-checkout
  drift since the workspace baseline, applies serially with the existing backup
  tool, then reruns typecheck and the full suite in the main checkout.
- No new dependency. The tool never deploys or restarts the LAN server.
- `agent-task.mjs status --json` and `list --json` expose the existing scan
  without changing default human output.

## Acceptance checks

- [x] `bun test tests/workflow.test.ts` covers contract parsing, glob matching,
      scope violations, ownership overlap, planning and review blocking.
- [x] `bun run typecheck` passes.
- [x] Full suite passes (250 tests, 0 failed).
- [x] `bun scripts/workflow.ts status` reports slots, active work and conflicts.
- [x] `bun scripts/workflow.ts plan` chooses a non-overlapping slate.
- [x] `bun scripts/workflow.ts start` refuses a fourth agent and overlapping paths;
      duplicate agent and duplicate task checks also pass.
- [x] `bun scripts/workflow.ts review` catches an out-of-scope file.
- [x] No live-server restart.

## Out of scope

- Spawning model sessions automatically. The human opens the three sessions; this
  tool prepares and verifies their workspaces.
- Auto-editing `tasks/README.md` statuses.
- Auto-deploy or live smoke tests.
- Git initialization.

## Completion report

- Task: `0012-workflow-automation`
- Status: done
- Files changed: `scripts/workflow.ts`, `scripts/workflow-lib.ts`,
  `scripts/agent-task.mjs`, `tests/workflow.test.ts`, `package.json`, the
  agent/workflow docs and the task board.
- Commands run:
  - `bun test tests/workflow.test.ts` -> 12 pass, 0 fail.
  - `bun run typecheck` -> pass.
  - `bun test` -> 250 pass, 0 fail.
  - `bun run workflow plan` -> 0002 on worker1, 0011 on worker2.
  - `bun run workflow start worker1 0002-bot-humanization` -> workspace + brief.
  - `bun run workflow review` -> rejected `src/engine/workflow-scope-check.ts`;
    passed a change inside `bots.ts`.
  - `bun run workflow check` -> typecheck and tests pass in the workspace.
  - `bun run workflow integrate` (dry run) -> listed only `bots.ts`.
  - `bun run workflow integrate --yes` on a disposable docs-only workspace ->
    copied the file, reran typecheck and 250 tests, then was removed.
  - Four-slot guard -> exit 1; duplicate agent/task guards -> exit 1.
- What was verified: parser, ownership, planning, slot limit, briefs, workspace
  checks, scope rejection, dry-run integration, real `--yes` integration and
  cleanup.
- What was not verified: integration of a real code diff from an implementation
  agent (the mechanics are the same, but no accepted worker diff exists yet).
- Known risks: mechanical review cannot judge code quality; semantic conflicts
  still need a human diff read. The tool uses Bun and the local filesystem; it
  is not part of the shipped game.
- Next action: start the two ready contracts when approved.
