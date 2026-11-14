# BedWars module map

This is the game layer. Read `AGENT.md`, `AGENTS.md` and the task contract
before changing a shared file. The engine below this folder is game-agnostic.

## Layers

```text
sim/       pure game rules: combat, beds, looks, parkour, generators, pickups
maps/      generated arenas, the sandbox and map types
room.ts    one authoritative match: players, teams, rounds, shop, damage
server.ts  room factory and room-list parameters
protocol.ts client/server message contract and binary codec
bots.ts    public Bot entry and integration point
bots/      frozen types, tier profiles, perception/motor/planner/tactics modules
arsenal.ts projectiles, TNT and potions
client/    browser prediction, input, HUD, settings and rendering
```

Imports point downward: `client`/`room` may use `sim` and `maps`; `sim` must not
import `room` or `client`. `engine/` must not import any of this.

## Where to change things

| Change | Start here |
| --- | --- |
| Damage, armour, knockback, reach | `sim/combat.ts` |
| Bed placement/breaking rules | `sim/beds.ts` |
| Skins, capes, trails, kill effects | `sim/look.ts` + `client/wardrobe.ts` |
| Parkour timers, checkpoints, rounds | `sim/parkour.ts` + `maps/parkour.ts` |
| Generator piles and pickup eligibility | `sim/generators.ts` + `room.ts` |
| Shop prices/items/team upgrades | `shop.ts`, `items.ts`, `room.ts` |
| Bot tiers, perception, planner, tactics | `bots/README.md` and `bots/` |
| Match flow, teams, beds, combat wiring | `room.ts` |
| Wire messages | `protocol.ts` (client and server ship together) |
| Lobby, HUD, inventory, chat | `client/hud.ts` |
| Prediction, camera, input | `client/game.ts` |
| Arena geometry | `maps/arena.ts`, `maps/base.ts`, `maps/themes.ts` |

## Generator rule

Home forges leave **one pile**. A player must be on the ground within **two
blocks** of that forge to collect it. Diamonds and emeralds also leave one shared
pile and are never copied to every teammate. A pile has at most one taker per
tick; a full inventory leaves the rest on the ground.

## Shared-file discipline

- `room.ts`, `protocol.ts`, `client/game.ts` and `client/hud.ts` are high-risk.
  One writer per file; split a task rather than merging two writers.
- Test-first for behavior. Room/generator changes: `tests/game.test.ts`; map
  changes: `tests/maps.test.ts`; protocol changes: `tests/netcode.test.ts` and
  the snapshot tests; client/controls: full suite plus a browser check.
- Run `bun run typecheck` and `bun test` before handing off.
- Use `bun run workflow plan` / `start` for isolated workspaces. Do not edit the
  shared checkout from an implementation agent.
