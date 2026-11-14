# Agent entry point

This is the file to give any AI that starts work in this project. **No Claude
account is required.** Agent names are just folder names; use `worker1`,
`worker2`, `codex`, `gemini`, `savi`, `reviewer`, or anything else lowercase.

Read in this order:

1. `HANDOFF.md` — what changed last, what is live, and what is next.
2. `AGENTS.md` — the project brief, commands and boundaries.
3. `docs/AGENT_WORKFLOW.md` — roles, lifecycle, review gate and prompt pack.
4. `tasks/README.md` — the current board.
5. `tasks/<task-id>.md` — the exact contract before touching code.
6. `.agents/skills/before-compaction/SKILL.md` — run before compaction, a
   restart, or a handoff; it writes the next agent's starting point.

## Automated three-agent path

If you are the integrator, the preferred commands are:

```bash
bun run workflow plan
bun run workflow start <agent> <task-id>
# the worker session uses the generated BRIEF.md
bun run workflow check <agent> <task-id>
bun run workflow review <agent> <task-id>
bun run workflow integrate <agent> <task-id> --yes
```

The tool enforces three active agents, one writer per file, contract scope,
workspace checks and a serial integration gate. It never deploys or restarts
the live server. Read `docs/MULTI_AGENT_WORKFLOW.md` before starting a slate.

## Two ways to work

### Main session / integrator

The integrator may edit the shared checkout after review, owns the contracts,
decides merge order and runs the final verification. It must not let a worker
edit shared files.

### Worker session

A worker gets one contract and one isolated workspace:

```bash
# From buff/
bun scripts/agent-task.mjs new worker1 0002-bot-humanization
```

Then tell the worker:

```text
Read AGENT.md, HANDOFF.md, AGENTS.md and tasks/0002-bot-humanization.md.
You are worker1. Work only in
.agents/worker1/0002-bot-humanization/workspace and only in the paths the
contract allows. Follow the test-first steps. When done, report the task id,
files, exact commands with pass/fail, what you verified, what you did not, and
any risks. Do not apply the diff yourself.
```

## Review and integrate

```bash
bun scripts/agent-task.mjs list
bun scripts/agent-task.mjs status worker1 0002-bot-humanization
bun scripts/agent-task.mjs diff worker1 0002-bot-humanization
# read the diff against the contract first
bun scripts/agent-task.mjs apply worker1 0002-bot-humanization --yes
bun scripts/agent-task.mjs clean worker1 0002-bot-humanization --yes
```

Apply is serial and only after review. It backs up overwritten files and
refuses deletions. The worker's `workspace` is a full copy, so it can run
`bun run typecheck` and `bun test` without touching this checkout.

## Current state

- **Classic** remains the normal controller at 4.9 walk / 6.5 sprint; the
  sandbox still cycles the four speed presets with **M**.
- Bot 0013 perception/motor is wired into `bots.ts`. 0014 planner/economy is
  integrated but **not wired**. 0015 duel/bed and telly/build are integrated
  but not wired into `bots.ts`; the lobby Technoblade tier is not done.
- LAN `:3000` and local `:3002` are both up; `:3002` is the battle test. The
  4v4v4v4 battle and `scripts/bot-observer.ts` are working.
- `bots.ts` is read-only. Do not let a worker edit main; use reviewed tasks.
- `0002` is blocked/superseded. `0011` Upgrade Rush is ready but not started.
- The project is **not a git repository**. Do not initialize or commit unless
  the human asks. `.agents/` is local working state.

## Quick verification

```bash
bun run typecheck
bun test
bun run build:node
```

For UI or controls changes, also run the built server and check the page; a
test pass alone is not evidence that the HUD works.
