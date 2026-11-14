# Clache game modes

## Status matrix

| Mode | Status | Players | Mouse? | Notes |
|---|---|---|---|---|
| Bed Wars arena | Current build | 4 teams; Solos 4, Duos 8, Trios 12, Squads 16 | Yes for combat | Flagship; bots fill seats |
| Practice sandbox | Current build | 1-16 | Optional | Test stations, cheats, `/bot` |
| Parkour race | Current 1.6.7 | 1-8 | Optional; keyboard look | Spiral Tower 10 checkpoints, 3 rounds |
| 4v4v4v4 bot battle | Current local test build | 16 bots + spectators | Spectator look is keyboard/mouse | One Easy/Normal/Hard/Expert per team |
| Technoblade sandbox tier | Current build, sandbox only | 1 + bots | Yes for duel | `/bot technoblade`; wall/clutch builds, telly duel movement; no lobby UI |
| Upgrade Rush | Current 1.6.7 | 2-8 FFA | Yes for combat | +1 tier per kill, death reset, own blocks vanish, 25 kills/10 min |
| Spleef Rush | Backlog | 4-8 | Fixed-camera prototype | Design in `SPLEEF.md` |
| Gun Game | Backlog | 4-8 | Required | Design in `GUN_GAME.md` |
| Hub/party rotation | Backlog | 2-8 | Mixed | Design in `GAMES_HUB.md` |

## Bed Wars

- Four teams, one bed each, forge iron/gold, diamond/emerald generators, shop,
  team upgrades, respawns and final kills.
- Team size is a room parameter (`teamSize`: 1 Solo, 2 Duos, 3 Trios, 4 Squads).
- Bots fill empty seats; late joiners take a bot's seat.
- Home forge income is one ground pile. Living teammates on the ground within
  two blocks split it one item each per tick; remote teammates get nothing.
  Diamond/emerald piles keep one taker and are never copied.
- Lobby: team pick, map vote, bot level, start, invite link.
- Timeline: 35 minutes standard; `fast=1` scales it.
- Bed destruction is a chat/feed event only.
- Ender/team chests work at the base stations in the local `:3002` build;
  opening is server-checked within five blocks and during play only.

## Practice sandbox

- Flat test platform with movement, fall, sneak, bridge, pillar, break, bed,
  generator and shop stations.
- Every item; `/give`, `/tp`, `/heal`, `/kit`, `/kill`, `/bot`, `/nobots`,
  `/killaura`.
- `M` cycles Classic/Surefoot/Snapline/Flowline movement.
- `/bot technoblade` spawns the sandbox-only telly-profile bot. In sparring it
  fights directly; it does not demonstrate telly bridging.

## Parkour race

- Default: Spiral Tower, 10 checkpoints; `map=classic` keeps the five-checkpoint
  quartz tutorial.
- Three rounds, timer, personal best, keyboard arrow look and chase camera.
- No combat/beds/shop; server-authoritative checkpoints and finish order.

## 4v4v4v4 bot battle

- `battle=1` creates a 16-bot arena; the human is a spectator.
- Four teams; each team has one Easy, one Normal, one Hard and one Expert.
- Starts immediately, no countdown. The human never takes a bot seat.
- Spectator: WASD fly, Space/Shift up/down, arrows look, G players.
- Menu button and direct URL:

```text
http://127.0.0.1:3002/?play=1&world=arena&battle=1&room=bot-battle&name=Watcher
```

- This is the current legacy strategy with the perception/motor and navigation
  layers, not the final smart Technoblade behavior. The crown tier has wall and
  clutch builds in fights and telly movement in sandbox duels; full `duel.ts`
  and `bed.ts` tactics are still pending.

## Upgrade Rush

Implemented in 1.6.7. Every kill moves gear one tier up a fixed ladder and heals
6 HP; every death resets to tier 0 and removes only that player's placed blocks.
Free-for-all, 2–8 players, 25 kills or 10 minutes, eight one-player spawn
islands with three-wide routes to the middle, late join on any open colour, no
beds/shop/generators. Bots fill empty seats and a performance director eases or
hardens them from the human's kills/deaths/tier. The HUD shows tier, next
upgrade, kills and timer; the summary shows kills, tier and deaths. See
`UPGRADE_RUSH.md`, `tasks/0027-ffa-map-and-bots.md` and
`tasks/0030-ffa-islands-difficulty.md`.

## Map policy

- Build original maps in code from our block palette.
- Online/Minecraft/Bloxd maps are layout references only; do not redistribute
  copied geometry or assets.
- Map tests cover standable spawns/NPCs, headroom, protected zones, bot-safe
  lanes and textures.
