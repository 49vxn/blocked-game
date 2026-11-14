# Bots — design, implementation and handoff

This is the single source of truth for bot behavior. It replaces the old
phase-1-only plan. `docs/BOT_HUMANIZATION.md` remains background research.

## Status at a glance

| Layer | Status |
|---|---|
| Bot interfaces, five tier profiles, telemetry | Done |
| 0013 perception/memory/motor | **Wired** into `bots.ts` |
| 0016 opening economy / first sortie | **Wired** into `bots.ts` |
| 0017 combat motor aim | **Wired** into `bots.ts` |
| 0019 Technoblade wall/clutch | **Wired** for sandbox behavior |
| 0022 target commitment/lapses | **Wired** for Expert/Technoblade |
| 0014 world model / utility planner / economy | Integrated, **not wired** |
| 0015 telly bridge / combat builds | Primitives + tests done; telly wired in `walkTo` only for telly profiles |
| `duel.ts`, `bed.ts` tactics | Not implemented |
| A* pathfinding | **Ground A* wired**; bridge legs and disconnected targets still use the legacy bridge path |
| `/bot technoblade` | Sandbox-only, works |
| Lobby Technoblade tier/UI | Not implemented |
| 4v4v4v4 bot battle | Working locally on `:3002` |
| Headless observer | Working |

## What is actually wired

- `PerceptionTracker` and `MotorController` are constructed per bot with
  independent seeds.
- `enemies()` only returns `perception.visible`; hidden players are last-seen
  memory, not live targets. Invisibility now hides a player completely unless
  the bot hit them or was hit by them in the last two seconds; the old
  three-block arm's-length exception is gone.
- `MotorController` schedules a sampled reaction per sighting and gates attacks.
- Perception resets on respawn; the motor state resets too.
- Opening economy: in team modes the first trip targets 4 iron, buys wool
  before gear, leaves after 16 blocks and defers bed cover to a later trip.
  Solo keeps the older full shop/cover cycle. `openingTelemetry` exposes
  `sortied`, `firstSortieBlocks` and `leftBase` for tests and the observer.
- Combat aim: `fight()` calls `MotorController.aim` with distance, apparent
  size and target angular speed. The old `aimOffset`/`aimRollAt` are gone; a
  180-degree turn is capped by the tier instead of snapping in one tick.
- Technoblade v1: `combatBuilds >= 3` uses `wallCells` at low health and
  `clutchCell` while falling. Sandbox duel movement passes `bridge=true` only
  for a telly profile.
- Expert bed defence: guard radius 14. A direct intruder within 8 blocks of the
  bed is met between the bed and the intruder (`guardAnchor`); a farther bridge
  fight keeps the old pursuit so the bow is still used. Far from home, only an
  enemy actually at the bed recalls the bot; a passerby does not abandon a raid.
- Ground navigation: `bots/nav.ts` runs deterministic A* over walkable feet
  cells (step-up/drop, safe diagonals). Map blocks are impassable; placed blocks
  are diggable only through `canDig`; void returns null and falls back to the
  legacy bridge walker. `walkTo` follows one simplified waypoint at a time and
  replans on a changed goal, a blocked cell or 20 ticks. Soft occupancy includes
  teammates and visible enemies; the higher-id bot yields head-on.
- `TellyBridge` is called from `Bot.walkTo` only when
  `tierProfile.bridge === 'telly'`.
- Sandbox `/bot technoblade` selects `BOT_TIER_PROFILES.technoblade` but keeps
  Expert legacy stats until the executor is replaced.
- `/bot` sandbox sparring bypasses perception for the dummy so it always comes
  to the player; real arena bots do not.

## What is not wired

The 0014 planner/economy is **not** deciding goals or purchases. The legacy
`gather/shop/defend/raid/leave` executor is still authoritative. Full planner
wiring stalled seeded bot rounds; preserved attempts:

- `.agents/partial-bots-wiring-v2.ts`
- `.agents/partial-bots-wiring-v3.ts`
- `.agents/partial-bots-wiring-v4.ts`

Do not re-apply them wholesale. The next attempt must use a dedicated endgame
controller and advisory planner; see `HANDOFF.md`.

## Pathfinding

Current behavior:

- `bots/nav.ts` A* on connected ground, 4-neighbour plus safe diagonals,
  step-up/drop, dig callbacks, occupancy cost and collinear simplification.
- `Bot.walkTo` tries nav for targets beyond 2.5 blocks; if the path is null it
  falls back to the old axis-aligned bridge/dig walker.
- Replans when the goal cell changes, the next cell is blocked, the path is
  empty, or 20 ticks pass. `followPath` drops a waypoint after 60 stuck ticks.
- Bridge legs and disconnected-island targets are still legacy L paths.

Known behavior: corridor head-on yield is teammate-only and the two-bot test
holds at least 0.6 blocks of separation. A yielder waits six ticks, backs out
for twelve, then has a fifteen-tick retry window, so a closed side-step no
longer holds both bots. `followPath` drops an unreachable waypoint after 20 stuck
ticks instead of 60. Six fresh observer runs had worst `stuckMax` 20, down from
60. The next navigation work is explicit bridge edges, not a full tile-world
rewrite.

## Tactics

`src/games/bedwars/bots/tactics/bridge.ts`:

- `TellyBridge.step` jumps at a gap, `stepAir` places the next floor cell.
- Respects a block reserve and requires a support cell.
- Server validates every placement.

`src/games/bedwars/bots/tactics/build.ts`:

- `wallCells`: two-block wall between bot and enemy.
- `clutchCell`: block under the bot when airborne.
- `pillarCell`: pillar support cell.
- `roofCells`: cover cells over an objective.

Not implemented: `duel.ts`, `bed.ts`, real telly combat usage in normal raids.

## 4v4v4v4 battle

`RoomParams.battle` and `battle=1` create a 16-bot arena:

- Four teams, four bots each.
- One Easy, Normal, Hard and Expert per team.
- `Room.startBotBattle()` creates them and starts the round.
- A human joining sees `self.alive=false`, `team=null` and uses the spectator
  camera; no bot seat is stolen.
- Menu button: **Watch 4v4v4v4 bots**.

Open:

```text
http://127.0.0.1:3002/?play=1&world=arena&battle=1&room=bot-battle&name=Watcher
```

The battle is the current legacy strategy with the new perception/motor layer,
not the final Technoblade brain.

## Observer

`scripts/bot-observer.ts` runs a headless 16-bot battle and records goals,
targets, paths, positions, attacks per tier and close-range passes that did not
produce an attack. It writes `.agents/bot-observer.jsonl` and
`bot-observer-samples.jsonl`.

```bash
bun scripts/bot-observer.ts 2400
```

The observer also writes `.agents/bot-observer-opening.jsonl` and
`.agents/bot-observer-navigation.jsonl` with first shop, first sortie, sortie
blocks, first field arrival, first attack, base share, goal mix, nav replans,
nav failures, worst stuck counter and path length versus straight-line distance.
Passes are now one per close-contact episode with no attack for 15 ticks, not
one per swing-cooldown tick.

Before 0016, a 2,400-tick battle had Easy 17, Normal 26, Hard 4, Expert 0 attacks;
Expert was in `gather` for 93 of 96 samples and reached its first shop around
tick 2,300. After 0016, first shop is at ticks 105/201/297/393 for
Easy/Normal/Hard/Expert. After 0017, three 2,400-tick runs averaged attacks
18.7 / 44.7 / 56 / 53.7; the motor trades raw swing count for readable turns.
After 0018, three runs had 183/114/137 close contacts and only 21/13/13
no-attack episodes, with path ratios 0.97–1.19. The blocked-yield repair added a
fourth set of fresh runs: 136/144/154/151 contacts, 12/9/18/20 passes and worst
`stuckMax` 20 (was 60). Replans were roughly 114–244 per tier; failures 12–52
were mostly disconnected-island fallbacks. Headless cost was about 1.8–2.2 s per
2,400 ticks with 16 bots. The pass count is now an episode metric, so earlier
per-tick counts are not directly comparable.

## Tier profile

`bots/profiles.ts` exposes Easy, Normal, Hard, Expert and Technoblade. The lobby
still uses only the four `BOT_LEVELS`; Technoblade is sandbox-only. Do not add
the lobby tier without protocol/UI and ownership review.

## Next milestones

1. Finish `duel.ts`/`bed.ts`; wire telly into normal raid bridging. The current
   Technoblade slice is wall/clutch plus sandbox duel telly.
2. Add the visible Technoblade lobby tier/UI; target commitment and lapses are
   now wired for Expert/Technoblade.
3. Add explicit bridge edges to navigation after the ground router is tuned;
   keep the legacy bridge fallback until then.
4. Advisory planner plus a dedicated endgame controller; only then wire
   economy purchases.
5. Blind human/chase-camera playtest.

## Non-goals

- No machine learning.
- No aimbot or instant reaction; human limits stay.
- No copied Minecraft/Bloxd maps or art.
- No agent edits `bots.ts` in the shared checkout without a reviewed task.
