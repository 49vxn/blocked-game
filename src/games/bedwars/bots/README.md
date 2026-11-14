# Bot AI modules

The rewrite is split by file so the three-agent workflow can work without two
writers in the same module. `src/games/bedwars/bots.ts` remains the public `Bot`
entry and the only integration point; it will import these modules after each
contract is integrated.

## Frozen interfaces

`types.ts` is integrator-owned and frozen. Workers implement against it; they do
not edit it without asking the integrator.

- `BotTier` — `BotLevel` plus `technoblade` (visible tier plumbing is separate).
- `BotPerception` / `PerceivedEnemy` — only what the bot could know; hidden
  enemies carry last-seen positions, not live coordinates.
- `BotIntent` — the planner's goal, target, reason and score.
- `BotTierProfile` — reaction/decision distributions, FOV, memory, turn caps,
  aim, bridge mode, combat-build level, block reserve and personality.
- `BotAction` — one `MoveInput` plus commands to send through `room.receive`.
- `BotTelemetryEntry` — decision and motor telemetry for development.

## Modules

| File | Owner | Purpose |
|---|---|---|
| `types.ts` | integrator | frozen shared interfaces |
| `profiles.ts` | integrator | five tier profiles / personality seeds |
| `telemetry.ts` | integrator | bounded development event log |
| `perception.ts` | 0013 worker | FOV, LOS, last-seen memory, threat list |
| `memory.ts` | 0013 worker | decaying target memory |
| `motor.ts` | 0013 worker | reaction scheduler, turn caps, aim corrections |
| `worldModel.ts` | 0014 worker | map graph, lanes, beds, danger, block budget |
| `planner.ts` | 0014 worker | utility goal selection and commitment |
| `economy.ts` | 0014 worker | block reserve, shop/upgrade/emerald plan |
| `tactics/duel.ts` | 0015 worker | strafing, w-tap, crits, walls, pillars, clutches |
| `tactics/bridge.ts` | 0015 worker | slow/speed/telly bridge state machines |
| `tactics/build.ts` | 0015 worker | wall, roof, pillar, bed shell, route blocking |
| `tactics/bed.ts` | 0015 worker | assault, defend, break, escape |

The `Bot` class is still behavior-identical to the pre-rewrite build until the
integrator wires these modules. Do not change `bots.ts` from a worker contract.

## Tests

Focused tests should use the real `Room`/`TestClient` harness where possible.
Pure module tests can use the types directly. Never weaken the existing bot
round tests to make a new tier pass.

Run from the project root:

```bash
bun test tests/bots.test.ts
bun test tests/bot-ai.test.ts
bun run typecheck
```
