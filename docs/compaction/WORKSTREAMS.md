# Workstreams and worker paths

## Freebuff project root

This root is for the **integrator only**:

```text
C:\Users\Kevin\.config\freebuff-desktop\local-projects\18fdee7d-1e3d-4a0e-8a37-9d9f0199b731
```

Writers open their own `workspace` folder below, not this root. worker2 is
headless and opens nothing.

The old path below no longer exists by design; it was archived:

```text
...\18fdee7d-1e3d-4a0e-8a37-9d9f0199b731\.agents\worker2\0014-bot-planner-economy\workspace
```

## Session project root rule

- **worker1:** open its *workspace* folder as the Freebuff project; do not open
  the main checkout. worker3 has no active workspace (0015 is integrated).
- **worker2:** **no Freebuff chat.** The integrator runs it headless with
  OpenCode GLM-5.3-Flash Free `#max` and the read-only `plan` agent.
- **integrator (this thread):** main checkout.

The workflow copy is file isolation, not a security sandbox. A shell-capable
agent can still reach absolute main paths, so the contract/review gate and the
read-only `bots.ts` remain the enforcement.

## worker1 — implementation

```text
.agents/worker1/START-HERE.md
.agents/worker1/0021-clache-kevcraft-brand/BRIEF.md
.agents/worker1/0021-clache-kevcraft-brand/workspace
```

- Task: **0021 Clache/KevCraft brand split**.
- Status: 12 changed files, scope clean; `review` rejected it on 7 drift
  findings (the workspace predates 0022/0024/0015). Rebase it, do not apply it.
- Do not touch server, Electron, package, maps, room, protocol or bots.
- Brand helper must be host-aware: public Clache, LAN/localhost KevCraft.

## worker2 — headless read-only reviewer

```text
.agents/worker2/START-HERE.md
```

- **No workspace and no Freebuff session by design.** Do not create one.
- Model `opencode/glm-5.3-flash-free#max`, OpenCode `plan` agent, loopback v2 API.
- Run with `workflow review-external`; changed files are inlined and tools are
  disabled, so the free model returns a verdict instead of looping.
- No edits, no apply/integrate, no deploy/restart.

## worker3 — integrated / closed

```text
.agents/worker3/0015-bot-tactics-technoblade-archive-2026-11-02/   (evidence only)
```

- Task 0015 duel/bed tactics is **integrated** in main with the four GLM fixes
  and 24 focused tests. `DuelController`/`BedAssault` are still unwired in
  `bots.ts`; wiring is a separate reviewed slice.
- There is no active worker3 workspace; the archive is evidence only.
- No new worker3 session is needed until a new wiring contract exists.

## Workflow slots

`bun run workflow status` currently reports **1/3 active workspaces**:
worker1/0021. worker2 is the headless reviewer and does not consume a workspace
slot. Do not add a fourth writer.

## Ownership rules

- One writer per file; one workspace per task.
- `bots.ts`, `room.ts`, `protocol.ts`, `client/game.ts`, `client/hud.ts` are
  high-risk; only one reviewed writer.
- Integration is serial and only by the integrator.
- Workers never edit the main checkout.
- No agent deploys or restarts the LAN server.

## Commands

```bash
bun run workflow status
bun run workflow plan
bun run workflow start <agent> <task-id>
bun run workflow brief <agent> <task-id>
bun run workflow check <agent> <task-id>
bun run workflow review <agent> <task-id>
bun run workflow review-external <agent> <task-id> --print
bun run workflow integrate <agent> <task-id> --yes
```

## Exact Windows paths

Use forward slashes here; Windows accepts both.

```text
C:/Users/Kevin/.config/freebuff-desktop/local-projects/18fdee7d-1e3d-4a0e-8a37-9d9f0199b731
C:/Users/Kevin/.config/freebuff-desktop/local-projects/18fdee7d-1e3d-4a0e-8a37-9d9f0199b731/.agents/worker1/START-HERE.md
C:/Users/Kevin/.config/freebuff-desktop/local-projects/18fdee7d-1e3d-4a0e-8a37-9d9f0199b731/.agents/worker1/0021-clache-kevcraft-brand/workspace
C:/Users/Kevin/.config/freebuff-desktop/local-projects/18fdee7d-1e3d-4a0e-8a37-9d9f0199b731/.agents/worker2/START-HERE.md
C:/Users/Kevin/.config/freebuff-desktop/local-projects/18fdee7d-1e3d-4a0e-8a37-9d9f0199b731/.agents/worker3/0015-bot-tactics-technoblade-archive-2026-11-02   (evidence only)
```

worker2 has no workspace and no Freebuff session. The old worker2/0014 workspace is archived at
`C:/Users/Kevin/.config/freebuff-desktop/local-projects/18fdee7d-1e3d-4a0e-8a37-9d9f0199b731/_attic/worker2-0014-bot-planner-economy/workspace`.
