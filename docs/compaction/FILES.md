# Files changed / where to look

## Bot implementation

- `src/games/bedwars/bots.ts` — executor, 0016 opening, 0017 motor, 0022
  target commitment/lapses, 0019 wall/clutch/telly hook, navigation wrapper.
- `src/games/bedwars/bots/nav.ts` — ground A*, step-up/drop, dig callback,
  occupancy, collinear simplification.
- `src/games/bedwars/bots/path.ts` — one-cell detour fallback.
- `src/games/bedwars/bots/tactics/bridge.ts` — telly bridge state machine.
- `src/games/bedwars/bots/tactics/build.ts` — wall/clutch/pillar/roof cells.
- `src/games/bedwars/bots/perception.ts`, `memory.ts`, `motor.ts` — wired
  perception/reaction/aim.
- `src/games/bedwars/bots/planner.ts`, `economy.ts`, `worldModel.ts` —
  integrated, not wired.
- `src/games/bedwars/bots/profiles.ts`, `types.ts` — frozen tier profiles.

## Bot tests

- `tests/bot-opening.test.ts` — first sortie/wool economy.
- `tests/bot-aim-wiring.test.ts` — fight uses motor turn caps.
- `tests/bot-nav.test.ts` — pure A* grid.
- `tests/bot-navigation.test.ts` — walls, yield, waypoint recovery.
- `tests/bot-technoblade-build.test.ts` — wall/clutch.
- `tests/bot-targeting.test.ts` — commitment/lapses, 18 focused tests.
- `tests/bot-battle.test.ts`, `bot-tactics.test.ts`, `bot-path.test.ts`,
  `bot-wiring.test.ts`, `bot-technoblade.test.ts`, `bots.test.ts`.

## Workflow/tooling

- `scripts/workflow.ts` — plan/start/check/review/review-external/integrate.
- `scripts/workflow-lib.ts` — contract parser, ownership, review, external
  prompt.
- `tests/workflow.test.ts` — 13 pure workflow tests.
- `package.json` — `workflow`, `review:opencode` scripts.
- `scripts/opencode-review.ts` — loopback OpenCode **v2 `/api`** bridge;
  `#max`/`plan` defaults, final-turn wait, inline files, explicit `--out` write.
- `tests/opencode-review.test.ts` — fake v2 server, final-turn, explicit-path
  and model-variant tests.
- `.agents/worker1/START-HERE.md` — implementation pack.
- `.agents/worker2/START-HERE.md` — headless GLM reviewer pack (no Freebuff chat).
- `.agents/worker1/0021.../BRIEF.md` — generated worker1 brief.
- `src/games/bedwars/bots/tactics/duel.ts`, `bed.ts` — 0015 modules integrated
  but unwired; `tests/bot-tactics.test.ts` covers them.

## Docs

Current truth:

- `HANDOFF.md`, `docs/STATE.md`, `QUEUE.md`, `tasks/README.md`
- `docs/BOT_AI_REWRITE.md`
- `docs/MULTI_AGENT_WORKFLOW.md`
- `docs/OPENCODE_SWARM_RESEARCH.md`
- `docs/PARKOUR.md`
- `docs/UPGRADE_RUSH.md`
- `docs/CHANGELOG.md`

Design/reference docs retained: `ARCHITECTURE.md`, `GAMEMODES.md`,
`CONTROLS.md`, `OPERATIONS.md`, `ENDER_CHESTS.md`, `MOVEMENT_PRESETS.md`,
`BOT_HUMANIZATION.md`, `BEDWARS_RESEARCH.md`, `SPLEEF.md`, `GUN_GAME.md`,
`GAMES_HUB.md`, `TOUCHPAD_BRIDGE.md`.

## Mission artifacts

- `MISSION.md`, `task_plan.md`, `MISSION_PROGRESS.md`, `MISSION_REPORT.md`
- `tasks/0022-bot-target-commitment.md`
- `.agents/skills/autonomous-mission/SKILL.md`

## Cleanup

- `_attic/README.md`
- `_attic/buff-bundle/`
- `_attic/worker2-0014-bot-planner-economy/`
- `_attic/legacy-bot-wiring/`
- `_attic/CHECKME.md`
- `bunfig.toml` excludes `_attic/**`
- `.gitignore` includes `_attic`

## Not changed in 0022/0023

No room, protocol, client, map, shop or bot gameplay file was changed by the
workflow V2 task. No `dist` source file, lockfile or deployment config was
edited. `bots.ts` is read-only.
