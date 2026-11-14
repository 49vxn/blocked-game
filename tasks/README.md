# Task board

Product priorities live in [`../QUEUE.md`](../QUEUE.md). This board only tracks
executable contracts. Create a contract before starting a task.

## Statuses

| Status | Meaning |
|---|---|
| `backlog` | Idea/milestone; not ready |
| `ready` | Contract complete, dependencies met |
| `blocked` | Waiting on a decision/interface/another task |
| `in-progress` | An agent owns it in an isolated workspace |
| `review` | Work stopped; diff waiting |
| `done` | Reviewed, integrated and verified |

## Board

| ID | Task | Status | Owner | Scope |
|---|---|---|---|---|
| 0001 | Movement presets | `done` — Classic 4.9 / 6.5 | Buffy | physics/movement, tests |
| 0002 | Human-like bots (old) | `blocked` — superseded by Q-030 | unassigned | bots/tests only; do not start |
| 0003 | Spectator follow/requeue | `backlog` | unassigned | client/HUD/tests |
| 0004 | Quick match | `backlog` | unassigned | rules/lobby/tests |
| 0005 | Bed reinforcement/alarm | `backlog` | unassigned | room/beds/shop/tests |
| 0006 | Parkour Rush | `done` — deployed | Buffy | course, room, HUD, tests |
| 0007 | Spleef Rush | `backlog` | unassigned | fixed camera/2D prototype |
| 0008 | Gun Game | `backlog` — mouse required | unassigned | hub/weapons/server validation |
| 0009 | Trios/team-size rooms | `done` — deployed | Buffy | params/protocol/lobby/tests |
| 0010 | Ender/team chests | `review` — source complete, pending deploy | Buffy | storage/protocol/modal/tests |
| 0011 | Upgrade Rush | `done` — 1.6.7; tier package, FFA map/HUD/tests | integrator | upgrade/map/HUD/tests |
| 0012 | Three-agent workflow | `done` | Buffy | workflow CLI/review/tests |
| 0013 | Bot perception/motor | `done` — wired; 303 suite | worker1 | perception/memory/motor/tests |
| 0014 | Bot planner/economy | `done` — modules integrated; not wired | worker2 | world model/planner/economy/tests |
| 0015 | Bot tactics/Technoblade | `done` — duel/bed modules + four review fixes integrated; bots.ts wiring pending | worker3 | tactics/telly/tests |
| 0016 | Bot opening economy | `done` — first sortie, observer, 307 gate | Buffy | bots/opening test/observer/docs |
| 0017 | Bot combat motor | `done` — motor aim, 309 gate | Buffy | bots/aim test/docs |
| 0018 | Bot navigation v1 | `done` — ground A*, blocked-yield repair, 322 gate | Buffy | bots/nav, bots, tests/docs |
| 0019 | Technoblade behavior v1 | `done` — wall/clutch, duel telly, 324 suite | Buffy | bots, technoblade tests/docs |
| 0020 | OpenCode reviewer bridge | `done` — loopback API, fake-server tests, 330 suite | Buffy | scripts/tests/docs |
| 0021 | Clache/KevCraft brand split | `in-progress` — worker1 workspace started | worker1 | brand/client/tests/docs |
| 0022 | Bot target commitment | `done` — top-tier commitment/lapses, 348 suite | GPT-6.1 Sol mission | bots.ts/targeting test/docs |
| 0023 | Workflow v2 + external review | `done` — review-external, packs, 349 suite | Buffy | workflow/tests/docs/.agents |
| 0024 | OG map remasters (Aquarium, Archway, Spiral Tower) | `done` — both arenas + tower default; Citadel; 439 pass | Buffy | maps/themes/rules/server/tests/docs |
| 0025 | Autobridge repair (forward assist + edge grace) | `review` — implemented; browser playtest pending | Buffy | client/settings/tests/docs |
| 0026 | Lag investigation and repair | `ready` | unassigned | perf probe/room/client/tests/docs |
| 0028 | Bloxd-style mineable ore nodes | `review` — implemented; browser playtest pending | Buffy | blocks/room/maps/tests/docs |
| 0029 | Bloxd-style air control | `review` — sandbox preset; default pending playtest | Buffy | engine/tests/docs |
| 0030 | FFA eight islands + dynamic difficulty | `review` — implemented; human playtest pending | Buffy | map/sim/room/bots/tests/docs |
| 0027 | FFA map connection and bots | `review` — bridges + 8-seat FFA bots, 441 suite, live | Buffy | upgrade map/rules/server/room/bots/tests/docs |
| 0031 | More healing items | `review` — potion + regen + enchanted apple, FFA tiers, 464 suite | Buffy | items/shop/arsenal/room/hud/upgrade/tests/docs |

## Rules

- One writer per file across active tasks.
- The contract lists allowed paths; everything else is off-limits.
- Freeze shared interfaces before parallel work.
- `bots.ts`, `protocol.ts`, `room.ts`, `client/game.ts` and `client/hud.ts` are
  high-risk; only one reviewed writer.
- Workers never edit the main checkout; use `bun run workflow`.
- No agent deploys or restarts the live LAN server.

## Commands

```bash
bun run workflow status
bun run workflow plan
bun run workflow start <agent> <task-id>
bun run workflow check <agent> <task-id>
bun run workflow review <agent> <task-id>
bun run workflow integrate <agent> <task-id> --yes
```

Direct workspace tool: `bun scripts/agent-task.mjs`.
