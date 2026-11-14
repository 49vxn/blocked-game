# Chronology and change record

This is a task-level record of what happened in this workspace. The exhaustive
older feature history is in [`../CHANGELOG.md`](../CHANGELOG.md); this page
focuses on the current bot/AI/workflow state.

## Delivered / integrated

| Task | Change | Evidence |
| --- | --- | --- |
| 0001 | Classic movement: 4.9 walk / 6.5 sprint blocks/s; sandbox presets share steering | movement tests |
| 0006 | Parkour Rush stage 1: generated spiral, five checkpoints, three rounds, keyboard look/chase camera | parkour/map tests |
| 0009 | Trios/team-size rooms: Solo/Duos/Trios/Squads, 12-seat Trios, bots fill seats | lobby tests |
| 0010 | Personal/team ender chests source; 27 slots, base proximity, team sharing | storage tests |
| 0012 | Three-agent workflow CLI: plan/start/check/review/integrate, copy workspaces | workflow tests |
| 0013 | Bot perception/memory/motor: LOS/FOV, sampled reaction, capped turn/aim | bot perception/motor tests |
| 0016 | Opening economy: team first trip 4 iron, wool first, 16-block sortie; bed cover later | `bot-opening.test` |
| 0017 | Combat motor: `fight()` uses `MotorController.aim`; legacy random snap removed | `bot-aim-wiring.test` |
| 0018 | Ground A* navigation: step up/drop, dig callback, occupancy, head-on yield, 20-tick waypoint recovery | `bot-nav.test`, `bot-navigation.test` |
| 0019 | Technoblade v1: wall at ≤8 HP, falling clutch, telly-capable sandbox duel | `bot-technoblade-build.test` |
| 0020 | Loopback OpenCode reviewer bridge: auth, polling, timeout, mailbox report | `opencode-review.test` |
| 0024 | GLM-ported maps: Aquarium, Archway, Spiral Tower (10 checkpoints) | map/parkour tests |
| feedback | Forge split, Expert guard/intercept, invis hiding, manual Bedrock bridge, arena ender test | game/bot/settings tests |
| mouse | Per-event clamp (±180 px) plus one ignored event after pointer lock; bow-tap and alt-tab draw fixes | `look.test`; 439 suite |
| 1.6.7 | Upgrade Rush server/map/HUD/menu/late join/summary; Citadel; Spiral Tower audit; auth-free anonymous online; school clock; quartz pillar fix | `upgrade.test`, `parkour-spiral.test`, `play-window.test`, `sites-worker.test` |
| 0023a | Headless GLM reviewer: v2 `/api`, `#max` + `plan`, final-turn wait, inline files, explicit report path | live 33 KB PASS review |
| 0022 | Target commitment/lapses for Expert/Technoblade; 3.5-block melee boundary | `bot-targeting.test` |
| 0023 | Workflow v2: external-review command, worker packs, prompt helper | `tests/workflow.test.ts` |

## Integrated but deliberately unwired

- **0014 planner/economy/world model**: modules are present and tested but the
  legacy gather/shop/defend/raid executor remains authoritative. Full wiring
  attempts are archived; do not re-apply them wholesale.
- **0015 tactics**: telly bridge, wall/clutch/pillar/roof cells and duel/bed
  state machines are integrated, with the four GLM fixes and 24 focused tests.
  `bots.ts` wiring is still pending.
- Bridge-aware A*: ground A* exists; bridge legs and disconnected-island targets
  still use the legacy bridge walker.
- Visible Technoblade lobby tier: sandbox-only; no protocol/UI tier yet.

## Bot behavior now in source

- Perception: only visible enemies become live targets; last-seen memory decays.
- Opening: 4 iron first trip, wool before gear, leave after 16 blocks.
- Aim: tier motor, turn caps, coherent aim error, no one-tick snap.
- Navigation: ground A*, occupancy, teammate-only yield, busy-lane backoff.
- Technoblade v1: wall at low health, clutch while falling, telly sandbox duel.
- Target commitment: Expert/Technoblade hold a 3.5-block melee target for
  `commitmentMs`; attackers, bed intruders and much-closer targets override.
- Lapses: Expert/Technoblade get one bounded 12-tick hesitation per engagement.
  Easy/Normal/Hard keep the old aggressive nearest switching.
- 0022 was narrowed after full-round regressions: broad commitment/lapses caused
  Easy/Hard timeouts, Dunes stalls and zero Expert ranged shots. The top-tier
  gate and 3.5-block range fixed those. Do not widen without tests.

## Workflow V3

- Two Freebuff implementation workers + one **headless** reviewer. The reviewer
  does not take a Freebuff chat or workspace slot.
- `workflow review-external <agent> <task-id> [--print]`:
  - requires passing mechanical review + fresh `checks.json`;
  - `--print` emits the read-only prompt;
  - changed files are inlined and tools are disabled;
  - actual mode calls the loopback OpenCode v2 `/api` bridge, writes
    `external-review.md`/`.json`, and never integrates.
- Reviewer model `opencode/glm-5.3-flash-free#max`, OpenCode `plan` agent.
- Bridge fixes in this pass:
  - old root routes -> `/api/session`, `/api/session/{id}/prompt`,
    `/api/session/{id}/message`;
  - wait for the final assistant turn, not an intermediate `tool-calls` text;
  - write the explicit `--out` report (it previously only printed the path);
  - pass the prompt on stdin because Windows `cmd.exe` cannot carry the
    multi-line prompt in argv;
  - inline changed files so the free model does not loop on tools.
- `workflow check` and `integrate` use
  `bun test --max-concurrency 1 --timeout 10000`; the 5s parallel runner flaked
  a ranged-shot simulation test.
- Worker starter packs:
  - `.agents/worker1/START-HERE.md` implementation/0021.
  - `.agents/worker2/START-HERE.md` headless reviewer/no workspace.

## Cleanup / archive

- Created `_attic/` with README.
- Moved `buff-bundle` (old Roblox/hot-seat/Crosscut) into `_attic`.
- Moved integrated `worker2/0014` workspace, old partial bot wiring and
  `CHECKME.md` into `_attic`.
- Removed empty `screenshots/`.
- Added `bunfig.toml` excluding `_attic/**` from tests; without it the archived
  workspace duplicate tests inflated the suite to 613.
- `.gitignore` includes `_attic`.

## OpenCode / GLM research

- OpenCode Desktop/CLI 2.1.4 installed; CLI supports `serve`, `run`, `acp`,
  `api`, `mcp`, sessions and `--prompt`.
- `opencode/glm-5.3-flash-free#max` is **verified live** through the v2 API
  with the read-only `plan` agent. A 33 KB worker3/0015 review returned PASS.
- `opencode run` one-shot is not reliable here (exit 0, empty stdout); use
  `serve` + the `/api` routes.
- No official Freebuff outbound bridge; Freebuff has no headless/ACP outbound
  path. The practical bridge is the local script and workflow command.
- GLM-5.3-Flash free is OpenCode-only and quota-gated; long diffs and daily
  limits are the remaining risks. DeepSeek/current Freebuff stays the coding
  fallback and second opinion.

## Runtime/operations changes

- Local server at `http://127.0.0.1:3002`, PID 3144; LAN `:3000` PID 3572 at `http://10.47.1.88:3000`.
- `dist` rebuilt at 1.6.7 (329.05 kB); both run Upgrade Rush and the mouse clamp.
- LAN was restarted after the 3-player Skyreach match, as approved.
- Public Freebuff Site deployed on 1.6.7 at `https://clache.freebuff.page`; production and preview both published. Online play uses anonymous guest tickets, no sign-in.
- No git commit, push, PR or deploy exists because the project is not a git
  repository and the human prohibited it.

## Verification history

- Latest full suite: **439 pass, 0 fail**, 42 files,
  `bun test --max-concurrency 1 --timeout 10000`.
- Standard parallel `bun test` can hit two 5s simulation timeouts; no assertion
  failed and both pass isolated.
- Typecheck pass; `build:node` pass.
- Observer 2,400 ticks: phase ended at 2,314, 127 contacts, 18 passes.
- LAN/local health: `{"ok":true,"version":"1.6.7"}`.
