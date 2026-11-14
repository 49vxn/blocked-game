# Task 0014 — Bot planner and economy

Status: done — integrated; main regression gate passed
Owner: worker2
Created: 2026-10-30
Depends on: frozen `src/games/bedwars/bots/types.ts` (integrator-owned; do not
edit it) and the map/Room APIs already in the game

## Goal

Replace the fixed `gather/shop/defend/raid` routine with a utility planner that
chooses goals from what the bot currently knows, and an economy plan that keeps a
block reserve, buys for the next objective and spends emeralds on a purpose.
Module-only; the existing `Bot` behavior stays unchanged until integration.

Read `docs/BOT_AI_REWRITE.md` and `src/games/bedwars/bots/README.md` first.

## Ownership

- Workspace: `.agents/worker2/0014-bot-planner-economy/`
- Files allowed to change:
  - `src/games/bedwars/bots/worldModel.ts` (new)
  - `src/games/bedwars/bots/planner.ts` (new)
  - `src/games/bedwars/bots/economy.ts` (new)
  - `tests/bot-planner.test.ts` (new)
  - `tests/bot-economy.test.ts` (new)
- Off-limits: `src/games/bedwars/bots.ts`, `bots/types.ts`,
  `bots/profiles.ts`, `bots/telemetry.ts`, other `bots/` modules, `rules.ts`,
  `room.ts`, `protocol.ts`, client files, maps, package/build config.
- Shared interface owner: integrator.

## Contract

### World model

Implement `WorldModel` (or equivalent exported class) from the real `Room` map:

- Base pads, bed positions and team ownership.
- Diamond/emerald generator positions and which are home vs contested.
- Walkable lanes/graph edges with approximate block cost and danger.
- Height/void risk per lane and safe escape nodes.
- NPC shop/upgrade positions and own-base heal pool.
- Query methods for nearest safe route, bed distance, lane block cost and
  generator ownership.
- Deterministic; no protocol change; no `heuristic` global player scan.

### Planner

Implement `UtilityPlanner` with:

```ts
choose(perception: BotPerception, profile: BotTierProfile): BotIntent
```

Requirements:

- Goals: gather, shop, upgrade, defend, guard, raid, thirdParty, retreat,
  regroup, escape, breakBed.
- Score expected value, success estimate, risk, time/cost and personality bias.
  Use `profile.personality`; do not hardcode one optimal style.
- Prefer the most dangerous or exposed enemy bed, not the nearest enemy, when
  choosing a raid; use visible/remembered enemies only.
- `defend`/`guard` when the home bed is threatened; `retreat` when low health
  and carrying resources; `escape` when bedless and isolated; `thirdParty` only
  when the approach is safe and a fight is already in progress.
- Re-evaluate on a cadence (10–20 ticks) or on a major event; require a switch
  margin and a minimum commitment. Do not recompute the goal every tick.
- Return a reason string and score for telemetry; never read `room.players`
  directly for enemy positions (use perception).
- Team awareness: prefer a teammate's available role only if exposed by the
  existing team/player state; no new protocol in this task.

### Economy

Implement `EconomyPlan` with:

- Desired next purchase given current inventory, tier/profile, bed status and
  next goal.
- A block reserve (`profile.blockReserve`) that is not spent on non-lethal
  wants; allow an emergency spend only for a bridge/escape with a documented
  reason.
- First-rush budget: map route cost, not a fixed 64 wool.
- Diamond priority after first rush (protection/trap, then sharpness) and a
  plan-specific emerald choice (obsidian while bed alive, pearl if bedless).
- No shop/room mutation; return wants and costs, let the integrator execute.

## Acceptance checks

- [ ] Planner chooses `defend` for a bed threat, `retreat` for low health with
      resources, and `raid` for an exposed enemy bed.
- [ ] Planner does not target a hidden enemy whose memory has expired.
- [ ] Goal switches obey the commitment/switch-margin policy in a staged state.
- [ ] Economy keeps the block reserve unless an explicit escape reason exists.
- [ ] Economy chooses the cheaper route budget instead of always 64 wool.
- [ ] Emerald choice follows bed status (obsidian while bed alive; pearl when
      bedless) in a staged state.
- [ ] Deterministic seeds produce stable plans.
- [ ] `bun run typecheck`, focused tests and full suite pass.
- [ ] No edits outside the allowed paths.

## Allowed paths

Follow-up MCP mailbox work under this same agent workspace (authorized
2026-10-30; no game code):

- `scripts/mcp-mailbox.ts` (new)
- `tests/mcp-mailbox.test.ts` (new)
- `docs/MCP_MAILBOX.md` (new)
- `.mcp.json.example` (new)

These do not overlap `bots.ts`, the bot modules or worker3's tactics files.

## Test-first steps

1. Add staged planner tests with synthetic `BotPerception` values.
2. Add the block-reserve and first-rush budget tests.
3. Implement `WorldModel`, then `UtilityPlanner`, then `EconomyPlan`.
4. Run `bun test tests/bot-planner.test.ts tests/bot-economy.test.ts`, then
   `bun run typecheck` and `bun test`.

## Out of scope

- Wiring into `bots.ts`; that is the integrator.
- Perception/motor (0013), tactics/telly (0015), UI or protocol.
- Machine learning, new maps, new items, team chat protocol.
- Changing shop prices or balance.

## Completion report

- Task: 0014
- Status: done
- Integrated: 5 files applied; main typecheck and full suite passed
- Evidence: focused tests 21/21; main suite 293/293
- Files changed: `bots/worldModel.ts`, `bots/planner.ts`, `bots/economy.ts`,
  `tests/bot-planner.test.ts`, `tests/bot-economy.test.ts`
- What was verified: bed/generator/NPC/heal-pool model, utility goals, target
  commitment, block reserve, route cost, deterministic plans
- What was not verified: live `bots.ts` wiring (integrator task)
- Known risks: planner/economy are not yet called by the running Bot
- Next action: wire into `bots.ts` after 0015/tier work

- Original report:
  - Task:
- Status:
- Files changed:
- Planner scenarios verified:
- Block-reserve observations:
- Commands run: `<command> -> pass/fail, key output`
- What was verified:
- What was not verified:
- Known risks:
- Next action:
