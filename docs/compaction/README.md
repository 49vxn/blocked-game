# Compaction dossier — Clache / KevCraft

Snapshot: **2026-11-03**. This folder is the shortest path back into the project
after a context reset. Re-check runtime/PIDs before trusting them.

## Project root

```text
C:\Users\Kevin\.config\freebuff-desktop\local-projects\18fdee7d-1e3d-4a0e-8a37-9d9f0199b731
```

This is **not a git repository**. Do not initialize git, commit, push or deploy
unless the human explicitly asks.

## Read in this order

1. [`README.md`](README.md) — this snapshot and reading order.
2. [`RUNTIME.md`](RUNTIME.md) — live processes, ports, build and test truth.
3. [`WORKSTREAMS.md`](WORKSTREAMS.md) — worker1/2/3 paths, status and boundaries.
4. [`CHRONOLOGY.md`](CHRONOLOGY.md) — every major change and why it happened.
5. [`DECISIONS.md`](DECISIONS.md) — product/workflow decisions that must survive.
6. [`NEXT.md`](NEXT.md) — the next concrete work and paste-ready prompts.
7. [`../MULTI_AGENT_WORKFLOW.md`](../MULTI_AGENT_WORKFLOW.md) — V2 runbook.
8. [`../BOT_AI_REWRITE.md`](../BOT_AI_REWRITE.md) — bot truth.
9. [`../PARKOUR.md`](../PARKOUR.md) and [`../UPGRADE_RUSH.md`](../UPGRADE_RUSH.md) —
   recovered scope for those two requests.

## One-paragraph state

Clache is a browser voxel BedWars game with a Node/WebSocket LAN host, offline
rooms, bots and an Electron shell. The current source has perception/motor,
opening economy, motor aim, ground A* navigation, Technoblade v1
(wall/clutch/duel telly) and top-tier target commitment/lapses. The public
Freebuff Site is deployed at **1.6.7** with anonymous guest online play; the local
server at `http://127.0.0.1:3002` is live with Aquarium, Archway, Citadel and
Spiral Tower. The main
checkout is green at **439 tests** with
`bun test --max-concurrency 1 --timeout 10000`; default 5s can flake under load.
`bots.ts` is read-only. The reviewer is headless GLM-5.3-Flash Free `#max` via
OpenCode; it does not use a Freebuff chat.

## Worker folders

```text
.agents/worker1/START-HERE.md
.agents/worker1/0021-clache-kevcraft-brand/BRIEF.md
.agents/worker2/START-HERE.md          # headless reviewer, no workspace
.agents/worker3/0015-bot-tactics-technoblade-archive-2026-11-02/   # evidence only
```

The old `worker2/0014/.../workspace` path in Freebuff is intentionally gone; it
was archived to `_attic/worker2-0014-bot-planner-economy/`. For a **writer**
chat, open the matching worker `workspace` folder, not the project root. worker2
is headless and has no chat. The full paths are in `WORKSTREAMS.md`.

## Session handoffs

Chain-numbered handoffs live in [`sessions/`](sessions/README.md) and are
written by [`.agents/skills/before-compaction/SKILL.md`](../../.agents/skills/before-compaction/SKILL.md).
Latest: [`sessions/2026-11-03-02.md`](sessions/2026-11-03-02.md).
Before a compaction or restart, run `/before-compaction`; validate the result
with `bun scripts/before-compaction.ts check <file>`. Raw collector output stays
in `.agents/handoff/` and is not part of the curated dossier.

## What is archived

`_attic/` contains the old `buff-bundle`, integrated worker2/0014 workspace,
failed bot-wiring attempts and `CHECKME.md`. It is ignored by git/build and is
not shipped. `bunfig.toml` excludes `_attic/**` from test discovery.

## Current slate

Worker3/0015 is **integrated** (duel/bed modules, four GLM fixes, 24 focused
tests) and its workspace is cleaned. The modules are not wired into `bots.ts`
yet; that is the next reviewed slice. Only worker1/0021 is active, and its
`review` is rejected on drift; `URGENT.md` has the rebase plan. See
`WORKSTREAMS.md` for the full paths and `NEXT.md` for the prompts.
