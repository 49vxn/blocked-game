# Multi-agent workflow

Status: active. This is how research, implementation and review agents work on
Clache. It is intentionally closer to a small studio than to "spawn ten
agents and hope".

Start a new AI at `AGENT.md`, then read `HANDOFF.md`. No Claude account is
required; agent names are only folder names.

## Automated path (use this)

The workspace tool still works directly, but the preferred path is the
three-agent orchestration layer:

```bash
bun run workflow status
bun run workflow plan
bun run workflow start worker1 0002-bot-humanization
bun run workflow check worker1 0002-bot-humanization
bun run workflow review worker1 0002-bot-humanization
bun run workflow integrate worker1 0002-bot-humanization --yes
```

`start` refuses a fourth agent, a duplicate agent and any ownership overlap. It
writes a ready-to-paste brief beside the workspace. `check` runs typecheck and
the full suite in the workspace. `review` checks contract scope, forbidden
paths, deletions, generated files, main-checkout drift and collisions with other
active workspaces. `integrate` requires a fresh passing check, applies serially
with a backup and reruns the main-checkout regression gate. It never deploys or
restarts the live server. See `MULTI_AGENT_WORKFLOW.md` for the command contract
and the current two-task slate.

## Why this shape

The evidence does not support unlimited parallelism. Anthropic's multi-agent
research system reported a large gain on a research benchmark but also roughly
15× the tokens of ordinary chat, and it cautions that coding has fewer truly
independent slices. Google Research's 2026 evaluation found collaboration helped
a parallel finance task but hurt a sequential planning task. METR's 2025 study
found experienced developers were slower with the AI tools it tested, and its
2026 follow-up warned that later adoption made the estimate unreliable.

The practical conclusion for this project:

- Parallelize **research** freely: it is read-only and independent.
- Parallelize at most **two implementation agents** at once.
- Keep **one primary integrator** who owns the architecture and the final diff.
- Never parallelize two writers in the same core file.
- Judge success by **accepted, integrated, tested work**, not by agent
  completion messages.

## Agent folders

Every AI gets its own namespace, so two agents can never confuse their
workspaces:

```text
.agents/
  buffy/                       integrator
    0001-movement-feel/
      workspace/
      baseline.json
      meta.json
  worker1/                     implementation agent
    0002-bot-humanization/
      workspace/
  codex/                       fresh reviewer
```

The folder is created on the first task. Agent names are lowercase letters,
numbers and dashes; suggested names are `buffy` (integrator), `worker1`,
`worker2`, `codex`, `gemini`, `savi` and `reviewer`. The name is only a folder,
not a model integration; whichever tool the AI runs in, it reads the same
`AGENTS.md` and contract. **No Claude account is required.**
`bun scripts/agent-task.mjs list` groups work by agent, and `list worker1`
shows one agent.

A task id still has exactly one contract in `tasks/`. Two agents must not run
the same contract at the same time; give the second one a different task, or
make it the reviewer.

## Roles

| Role | Who | Owns | Does not do |
| --- | --- | --- | --- |
| Human owner | You | Scope, taste, playtests, approvals | Merge code blindly |
| Integrator | Primary coding agent | Architecture, contracts, merge order, final verification | Let workers edit shared files |
| Research agent | Any read-only model | Sources, options, measurements, risks | Write code or change the board |
| Implementation agent | One per task | Only the paths in its contract; tests for its change | Touch other tasks' files or "fix" unrelated code |
| Reviewer | Fresh read-only agent or the human | Diff review against the contract | Rewrite the implementation while reviewing |

The human can replace "integrator" with themselves. The important part is that
one person or agent makes the final call on a conflict.

## Lifecycle

```text
intake
  -> task contract (goal, scope, tests, owner)
  -> isolated workspace
  -> failing test
  -> implementation
  -> self-check (typecheck + focused tests)
  -> diff review (contract + test integrity)
  -> serial integration
  -> full suite + build + browser/gameplay check
  -> update board + short retro
```

### 1. Intake

Write one sentence: who gets what observable behavior. If it cannot be stated
without "and also", split it. A task that changes physics, bots, UI and maps in
one pass is not a task; it is a milestone.

### 2. Contract

Copy `tasks/TEMPLATE.md` to `tasks/NNNN-slug.md`. Fill every section. The
contract is the only brief the implementation agent gets beyond `AGENTS.md` and
the files it needs. Freeze any shared interface before two agents depend on it.

### 3. Isolate

The project has no git history yet, so the active path is a copied workspace
under the agent that owns the task:

```bash
bun scripts/agent-task.mjs new worker1 0001-movement-feel
# edit only .agents/worker1/0001-movement-feel/workspace
cd .agents/worker1/0001-movement-feel/workspace
bun run typecheck
bun test tests/physics.test.ts
```

`new claude/0001-movement-feel` is the same command. The agent folder's
`README.md` is generated once and repeats the boundary rules.

The tool records a SHA-256 baseline and links `node_modules` so tests run
without a second install. It never edits the shared checkout.

If the human later asks to initialize git, switch to worktrees:

```bash
git init
git add .
git commit -m "Baseline before multi-agent work"
git worktree add .agents/worktrees/0001 -b agent/0001-movement-feel
```

Do not run those commands unless the human asks. A git worktree isolates file
edits; it does not prevent merge conflicts in shared interfaces.

### 4. Red test

Add the smallest test that expresses the required behavior. Run it and confirm
it fails for the expected reason, not because of a typo or a missing import.
Freeze the accepted assertion. If the implementation needs a different test,
the contract must change first.

### 5. Implementation

Edit only allowed paths. Keep the change as small as the contract. Do not
reformat, rename, or "clean up" code outside the task. If a dependency is
missing, stop and report it; do not invent an interface.

### 6. Self-check

Run, at minimum:

```bash
bun run typecheck
bun test tests/<focused>.test.ts
```

Run the full `bun test` for core simulation, netcode, room or protocol changes.
Run `bun run build:node` when the client or server entry changed. UI, controls
or game-feel tasks also need a live check; say whether you did one.

### 7. Review gate

The reviewer reads the contract and the diff, not the agent's summary. Check:

- [ ] Only allowed files changed.
- [ ] The behavior matches the contract, including edge cases.
- [ ] Tests were added or updated and were not weakened.
- [ ] No unrelated refactor, rename, dependency or formatting noise.
- [ ] No secrets, build output, `dist/`, logs or generated files.
- [ ] The reported commands are the commands that actually ran, with output.
- [ ] A performance claim has a measurement in the same environment.
- [ ] Known limitations are listed, not hidden.

A reviewer returns findings only. The integrator decides.

### 8. Integrate serially

Review and apply one task at a time. After each integration, rerun the checks
affected by that change. Then run the full suite and a live smoke test on the
combined result. If a conflict appears, stop and inspect both sides against the
contract; never resolve by picking one side blindly.

```bash
bun scripts/agent-task.mjs diff worker1 0001-movement-feel
bun scripts/agent-task.mjs apply worker1 0001-movement-feel --yes
# apply backs up overwritten files; it refuses deletions
```

### 9. Close

Update `tasks/README.md` (status, owner, evidence). If the work changed an
interface or a design decision, add a short note to `docs/`. Clean the workspace
only after the backup is no longer needed:

```bash
bun scripts/agent-task.mjs clean worker1 0001-movement-feel --yes
```

## Parallelization matrix

| Safe to parallelize | Keep with the integrator |
| --- | --- |
| Read-only research questions | Physics, movement feel and knockback in one pass |
| A pure module with its own tests | `game.ts`, `room.ts` or `protocol.ts` shared state |
| Separate UI panels with no shared CSS | Renderer, mesher, game loop |
| Data tables (shop, maps, bot profiles) with frozen types | Build config, package manifests, lockfile |
| Documentation and task contracts | Final integration, visual polish, gameplay feel |
| A test harness for an already-frozen interface | Tests and implementation of the same contract without a test-first handoff |

For this project, two coding agents is the practical maximum. A third is more
useful as a fresh reviewer or a research agent. If the split requires both
agents to edit `src/games/bedwars/room.ts` or `client/game.ts`, it is not
parallel yet.

## Prompt pack

### Integrator prompt

```text
You are the integrator for Clache. Read AGENTS.md and docs/AGENT_WORKFLOW.md.
Do not implement the delegated task yourself unless the worker is blocked.
Break the milestone into contracts in tasks/, freeze shared interfaces, create
isolated workspaces, review diffs against contracts, integrate one at a time,
and run the full verification. Report accepted work, rejected work and why.
```

### Research agent prompt

```text
Read AGENTS.md. Answer this question for Clache: <question>.
Do not edit files. Prefer primary sources and measured values over marketing.
Give exact URLs and dates. Separate confirmed facts, approximations and your
own design recommendations. Return at most <N> actionable options and name the
tradeoffs. Keep the result under <N> words.
```

### Implementation agent prompt

```text
You are the implementation agent for tasks/<id>.md.
Read AGENTS.md and that contract. Work only in .agents/<agent>/<id>/workspace
and only in the allowed paths. Follow the test-first steps; do not weaken
tests. Do not change dependencies, build config or unrelated files. When done,
report: agent, task id, files, exact commands and results, known gaps, and any
unrequested change you made.
```

### Reviewer prompt

```text
You are a read-only reviewer. Read tasks/<id>.md and the diff from
`bun scripts/agent-task.mjs diff <agent> <id>`. Check behavior, edge cases, test
integrity, scope, and whether the reported commands match the evidence. Do not
rewrite code. Return a short list of blocking findings, non-blocking nits, and
a clear accept/reject recommendation.
```

## Handoff format

Every agent ends with this, in this order:

```text
Task:
Status: done | blocked | needs-review
Files changed:
Commands run: <command> -> <pass/fail, key output>
What I verified:
What I did not verify:
Known risks:
Next action:
```

No transcript dumps. The next agent should be able to act from this block plus
the contract and diff.

## Context budget

- Give each worker the contract, `AGENTS.md`, and only the files it needs.
- Do not paste the whole conversation or the whole repository.
- Keep task files short; put shared background in `docs/` and link it.
- Ask for a result plus artifact paths, not a diary.
- Start a fresh session for a genuinely different task. Long sessions accumulate
  stale assumptions and old failures.
- If a worker is blocked, ask for the exact command, error and two options; do
  not let it wander.

## Failure modes to watch

1. **Dependency chain disguised as parallel work.** Agents guess different
   interfaces and create merge work.
2. **Shared-file collision.** Two agents edit the same core file and both pass
   their own tests.
3. **Test overfitting.** The test is rewritten to match the implementation.
4. **Completion without evidence.** "Done" with no command output.
5. **Scope drift.** A movement fix also refactors the HUD.
6. **Invisible work.** Generated files, logs or `dist/` get applied.
7. **Too many agents.** Coordination cost exceeds the saved time.
8. **A hidden human decision.** The agent invents product direction because the
   contract was vague.

## Metrics

Track per task, not per agent:

- wall-clock time from contract to **accepted** change;
- review findings per task;
- rework after integration;
- focused/full test pass rate;
- conflicts and files touched outside scope;
- bugs found in the next playtest;
- token or usage cost when available.

If parallel work does not improve accepted-change time, reduce the number of
workers. The goal is throughput of correct changes, not the number of sessions.

## Current board

See `tasks/README.md`. Current state:

- `0013` perception/motor — done and wired.
- `0014` planner/economy — integrated, not wired.
- `0015` tactics/Technoblade — partial: telly/build primitives and sandbox tier;
  duel/bed and lobby UI pending.
- `0012` workflow automation — done.
- `0002` — blocked/superseded; `0011` Upgrade Rush — ready.

The three worker workspaces are idle; do not let them edit main. The next
implementation focus is grid pathfinding, then finishing 0015 and the
planner/endgame controller.

## Sources

- Anthropic, multi-agent research system, 2025-06-13:
  https://www.anthropic.com/research/multi-agent-research-system
- Google Research, scaling agent systems, 2026-01-28:
  https://research.google/blog/towards-a-science-of-scaling-agent-systems-when-and-why-agent-systems-work/
- METR, developer productivity study, 2025-07-10:
  https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/
- Claude Code subagents and worktrees:
  https://code.claude.com/docs/en/sub-agents
  https://code.claude.com/docs/en/common-workflows
- Git worktree reference: https://git-scm.com/docs/git-worktree
- Cursor agent best practices, 2026-01-09:
  https://cursor.com/blog/agent-best-practices
