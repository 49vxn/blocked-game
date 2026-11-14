# Blocked — instructions for agents

A browser voxel game with two modes: School Survival (the campus under scheduled
disasters) and Bed Wars. Read this file and the task contract before changing
anything.
`AGENTS.md` is the short version; `docs/AGENT_WORKFLOW.md` is the full process.

## What this project is

A browser voxel game with two modes — School Survival and Bed Wars — on a
Node/WebSocket server, with a pure-TypeScript simulation, bots and an offline
mode. The simulation runs at **20 ticks/second** and is shared by the client,
server and bots.

## Commands

Run from the project root (the folder containing `package.json`):

| Purpose | Command |
| --- | --- |
| Typecheck | `bun run typecheck` |
| Full suite | `bun test` |
| Focused tests | `bun test tests/<file>.test.ts` |
| Production client + server | `bun run build:node` |
| Node dev server | `bun run dev:node` |
| Production server | `bun run start` |
| Server smoke test | `bun run smoke` |
| Load test | `bun run loadtest` |
| Agent workflow | `bun run workflow status` / `plan` |

Do not use `bun test` as the only evidence for a UI or control change. State
exactly what was run and what was not.

## Working rules

1. **Work from a task contract.** If `tasks/<id>.md` does not exist, stop and ask
   the integrator for one. Do not invent a large feature from a chat message.
2. **Never edit the shared checkout.** The integrator can use
   `bun run workflow start <agent> <id>`; it creates the isolated workspace and
   a brief. Workers then edit only `.agents/<agent>/<id>/workspace` and only the
   paths in the contract. Never touch another agent's folder.
3. **One writer per file.** If another task owns a file, coordinate before
   touching it. Do not reformat or rename unrelated code.
4. **Test first when behavior changes.** Add or update a test, confirm it fails
   for the right reason, then implement. Never weaken an assertion to get green.
5. **Keep the engine/game boundary.** `src/engine/` must not import a game.
   `tests/architecture.test.ts` enforces the boundary.
6. **No new dependency** without an explicit task and integrator approval.
7. **Do not commit, push, publish or deploy** unless the task says so and the
   human has approved it.
8. **Report evidence, not a story.** End with the task id, files, commands,
   pass/fail, risks and anything you did not verify.

## Context checkpoints

- Before compaction, a Freebuff restart, or handing the thread to another
  agent, run `/before-compaction` (`.agents/skills/before-compaction/SKILL.md`).
- It runs `bun scripts/before-compaction.ts collect`, writes a chain-numbered
  handoff under `docs/compaction/sessions/`, updates `docs/STATE.md`, and must
  pass `bun scripts/before-compaction.ts check <file>`.
- Do not claim a test, build or runtime state you did not observe in this
  session; tag recalled claims `[?]`.

## Architecture map

- `src/engine/` — pure simulation: physics and movement presets, world, blocks,
  inventory, raycast, net codec, renderer primitives. No DOM and no BedWars imports.
- `src/games/bedwars/` — the runtime game: room, server, bots, maps, arsenal,
  protocol. See `src/games/bedwars/README.md` for the module map.
- `src/games/bedwars/sim/` — pure rules: combat, beds, looks, parkour and
  generator/pickup eligibility. No room/client/map imports.
- `src/games/bedwars/client/` — browser client, HUD, renderer, controls.
- `src/server/` — Node HTTP/WebSocket host.
- `tests/` — headless tests for simulation, netcode, bots and maps.
- `docs/` — design notes; `tasks/` — executable work contracts.

## Current state / priorities

- Spectator camera and death-overlay bugs are fixed and live.
- Classic is the chosen movement controller at 4.9 walk / 6.5 sprint blocks/s;
  normal play and bots use it. The practice sandbox still cycles Classic,
  Surefoot, Snapline and Flowline with **M**, but all four share the same
  controller and only differ in speed. See `docs/MOVEMENT_PRESETS.md` and
  `tasks/0001-movement-feel.md`.
- Bot state: 0013 perception/motor is wired; 0014 planner/economy is
  integrated but unwired; 0015 duel/bed tactics and telly/build are integrated
  but not wired into `bots.ts`. A 4v4v4v4 battle room and
  `scripts/bot-observer.ts` exist. LAN `:3000` is the live host; local `:3002`
  is the battle test. `bots.ts` is read-only outside a reviewed integration.
- Tests: **439 pass, 0 fail** with
  `bun test --max-concurrency 1 --timeout 10000`; typecheck passes and `dist`
  is current. `docs/STATE.md` is the single runtime snapshot — update it
  instead of copying PIDs into other docs.
- 1.6.7 adds Upgrade Rush (2–8 FFA), Spiral Tower's proven course and the
  mouse-look clamp. LAN live host is `http://192.168.0.102:3000`; local
  `:3002` is the feedback server.
- 0021 (host-aware Clache/KevCraft brand) is the only open worker task. Its
  workspace is based on pre-0022 main and is blocked on drift; do not apply it.
  See `URGENT.md` for the rebase plan.
- The workflow is `bun run workflow`; see `docs/MULTI_AGENT_WORKFLOW.md`. It
  never deploys or restarts the server.
- The project is **not a git repository**. Use the workspace tool; do not
  initialize git or make commits unless the human asks.
- **Always keep a player-facing local clock.** School hours are weekdays
  08:00–15:59 local; outside them send players to
  <https://clache.freebuff.page>. The menu and HUD must show the clock. See
  `docs/PLAY_WINDOWS.md` and `src/games/bedwars/client/play-window.ts`.
