# Three-agent workflow

Status: **active** as of 2026-10-30. The automation layer is
`scripts/workflow.ts`; it sits on top of the isolated-workspace tool
`scripts/agent-task.mjs`.

Goal: up to **three agent sessions** work at once — usually two implementation
agents and one read-only researcher/reviewer — while the integrator keeps the
shared checkout, reviews the diffs and integrates serially.

## Commands

Run from the project root:

```bash
bun run workflow status
bun run workflow plan
bun run workflow start <agent> <task-id>
bun run workflow brief <agent> <task-id>
bun run workflow check <agent> <task-id>
bun run workflow review <agent> <task-id>
bun run workflow review-external <agent> <task-id> [--print]
bun run workflow integrate <agent> <task-id>          # dry run
bun run workflow integrate <agent> <task-id> --yes    # copy + regression gate
```

`status` is the dashboard: active agent slots, changed-file counts, scope
findings and ownership collisions. `plan` picks up to the free slots from
`ready` contracts whose allowed paths do not overlap active work.

## Slots and roles

| Slot | Typical agent | Role | Workspace |
| --- | --- | --- | --- |
| 1 | `worker1` | implementation task | yes |
| 2 | `worker3` | independent implementation task | yes |
| 3 | `worker2` | headless read-only review (GLM `#max`, `plan`) | no |

An agent with a workspace counts as one slot. `start` refuses a fourth agent, a
duplicate agent and a second workspace for a task that is already active.

The third slot is deliberately read-only. With only two coding streams, the
reviewer can read both diffs and run the acceptance checks instead of adding a
third set of merge conflicts.

## Lifecycle

```text
plan
  -> start (copy project + write BRIEF.md)
  -> worker edits only the contract paths
  -> check (typecheck + full test suite in the workspace)
  -> review (scope, forbidden paths, deletions, main-checkout drift,
             file collisions with other workspaces)
  -> integrate --yes (serial copy, backup, main-checkout regression gate)
  -> update board/handoff, clean the workspace
```

### 1. Plan

```bash
bun run workflow plan
```

It reads `tasks/*.md`, ignores anything that is not `ready`, and reports why a
task was skipped. A path collision is a hard stop, not a warning: two agents
must never edit the same file.

The first plan exposed a real conflict: `0002-bot-humanization` optionally
claimed `src/games/bedwars/rules.ts`, which `0011-upgrade-rush` also owns. The
resolution is recorded in the contract: `rules.ts` is frozen to Upgrade Rush;
bot humanization edits only `bots.ts` and `tests/bots.test.ts`.

### 2. Start

```bash
bun run workflow start worker1 0002-bot-humanization
```

This creates `.agents/worker1/0002-bot-humanization/workspace`, links the main
`node_modules`, records a baseline, and writes `BRIEF.md` beside the workspace.
The command prints the exact prompt for the agent session. The brief is outside
the workspace, so it is never part of the diff.

### 3. Worker

The worker reads `AGENT.md`, `HANDOFF.md`, `AGENTS.md` and its contract. It edits
only the allowed paths, writes the failing test first, and does not run
`apply`, `clean`, `integrate`, a deploy or a server restart.

### 4. Check

```bash
bun run workflow check worker1 0002-bot-humanization
```

Runs `bun run typecheck` and `bun test` inside the workspace. The result and a
content signature are stored in `checks.json`; the full output is in
`check.log`. A file edit after a check invalidates the signature.

### 5. Review

```bash
bun run workflow review worker1 0002-bot-humanization
```

Mechanical checks only, but they cover the expensive mistakes:

- changed files outside the contract;
- forbidden paths (including the shorthand names in the contract);
- deletions, which `apply` refuses anyway;
- generated/local files such as `dist/`, logs, `.agents/` and `.env*`;
- changes to the main checkout since the workspace baseline;
- the same file being changed in another active workspace;
- notes for test and doc changes.

A review with blocking findings exits non-zero. It does not pretend to judge
code quality; a human or fresh reviewer still reads the implementation.

### 6. Integrate

```bash
bun run workflow integrate worker1 0002-bot-humanization          # dry run
bun run workflow integrate worker1 0002-bot-humanization --yes
```

`integrate` re-runs the review, requires a matching passing `checks.json`, and
refuses main-checkout drift. It then calls the existing `agent-task apply`,
which backs up overwritten files and refuses deletions, and runs typecheck plus
the full suite again in the main checkout. A regression prints the backup path
and exits non-zero; it never silently claims success.

Integration is **serial**. Do not apply two workspaces at once. After a
successful integration, update the task board and `HANDOFF.md`, then clean:

```bash
bun scripts/agent-task.mjs clean worker1 0002-bot-humanization --yes
```

### 7. Deploy is separate

The workflow tool never builds, restarts or deploys. Those remain integrator
steps in `docs/OPERATIONS.md`, with the live-server warning.

## V2 — two writers + one reviewer (current)

The current operating shape is:

| Session | Role | Workspace | Current work |
| --- | --- | --- | --- |
| `worker1` | implementation | `.agents/worker1/...` | 0021 Clache/KevCraft brand split |
| `worker3` | implementation | `.agents/worker3/...` | 0015 duel/bed tactics; check + GLM review pass |
| `worker2` | **headless read-only reviewer** | none | GLM-5.3-Flash Free `#max`, `plan` agent |
| this thread | integrator | main checkout | contracts, review, serial integration, build/deploy decisions |

This is **two Freebuff writer sessions plus a headless reviewer**. OpenCode does
not take a Freebuff workspace slot. Do not add a fourth writer.

### Start the worker sessions

Full paths are in `docs/compaction/WORKSTREAMS.md`. Open each **workspace**, not
the main checkout:

1. **worker1** — open
   `.agents/worker1/0021-clache-kevcraft-brand/workspace`, read
   `.agents/worker1/START-HERE.md` and the task contract. Run `bun run typecheck`
   and `bun test` inside the workspace; no apply/integrate/deploy.
2. **worker3** — **closed**. 0015 is integrated; there is no active workspace.
   Its archive is `.agents/worker3/0015-bot-tactics-technoblade-archive-2026-11-02`.
3. **worker2** — do **not** open a chat. Run the reviewer headless:

```bash
PASS=$(sed -n 's/^server password //p' .agents/logs/opencode-serve.log | tail -1)
OPENCODE_SERVER_PASSWORD="$PASS" \
OPENCODE_MODEL='opencode/glm-5.3-flash-free#max' \
OPENCODE_AGENT='plan' \
bun run workflow review-external worker1 0021-clache-kevcraft-brand
```

The changed files are inlined into the prompt and tools are disabled, so the
free model returns a verdict instead of looping. Start the loopback server only
if it is not already up:

```bash
CLI="$APPDATA/ai.opencode.desktop/cli/2.1.4-x64/opencode-cli.exe"
"$CLI" serve --hostname 127.0.0.1 --port 4096 --print-logs \
  > .agents/logs/opencode-serve.log 2>&1 &
```

The workflow commands are:

```bash
bun run workflow status
bun run workflow plan
bun run workflow start worker1 0021-clache-kevcraft-brand
bun run workflow check worker1 0021-clache-kevcraft-brand
bun run workflow review worker1 0021-clache-kevcraft-brand
bun run workflow review-external worker1 0021-clache-kevcraft-brand --print
bun run workflow integrate worker1 0021-clache-kevcraft-brand --yes
```

`review-external` requires a passing mechanical review and a fresh
`checks.json`. It writes `external-review.md` and `external-review.json` inside
the workspace directory, never into the workspace diff. It is advisory: the
integrator still reads the diff and integrates serially.

### Current boundary

- `worker1` has 12 changed files and is blocked on 7 drift findings; 0021
  must be rebased against current main (see `../URGENT.md`).
- `worker3`/0015 is integrated with the four GLM fixes (404 suite); its
  workspace is cleared. `bots.ts` wiring is a separate contract.
- `worker2` is headless reviewer-only; no workspace and no Freebuff chat.
- `0011` Upgrade Rush is ready and unassigned.
- `bots.ts` is read-only after 0022.

## Mailbox (overseer ↔ workers)

Filesystem mail lives outside the isolated workspaces:

```text
.agents/mailbox/
  README.md
  worker1.md
  worker2.md
  overseer.md
```

Each worker workspace has a `mailbox/` junction to this folder. It is skipped by
`agent-task`'s manifest/diff, so mail never appears in a worker diff or gets
applied. Rules: append-only, timestamped, no secrets, no source code. Workers
check their file at milestones; the human relays an immediate message. This is
the preferred two-way channel while workers are already running. An MCP mailbox
is the cleaner long-term option, but requires a worker reload.

## What it does not do

- It does not spawn or control model sessions. The human opens the three
  sessions; the tool prepares their workspaces and checks their output.
- It does not auto-edit task statuses or completion reports.
- It does not auto-deploy, restart the LAN server or run a browser playtest.
- It does not resolve semantic merge conflicts. The review gate catches file
  overlap and drift; a human still reads the diff.

## Safety and recovery

- Workspaces are copies; `node_modules` is a junction/link, not a second
  install.
- `apply` refuses deletions and writes a timestamped backup under
  `.agents/<agent>/<task-id>/backup/`.
- If the post-apply gate fails, restore the affected files from that backup and
  keep the workspace for diagnosis.
- `.agents/` is local working state and is ignored by git if the project is
  ever initialized.

## Why three

Three sessions fit the review capacity of one integrator. More agents increase
merge conflicts, test churn and token cost faster than they increase accepted
work. The unit of success is an **accepted, integrated, tested** change, not a
completed agent message.

## Files

- `scripts/workflow.ts` — CLI.
- `scripts/workflow-lib.ts` — contract parsing, path matching, planning and
  review rules.
- `tests/workflow.test.ts` — pure-logic tests.
- `scripts/agent-task.mjs` — workspace copy, diff, apply and clean; now also
  supports `list --json` and `status --json`.
- `tasks/0012-workflow-automation.md` — this phase's contract.
- `docs/AGENT_WORKFLOW.md` — the longer process and prompt pack.
