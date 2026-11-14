# Upgrade Rush — researched design

Status: **implemented in 1.6.7**; FFA bridges and bots added in 0027, online
playtest pending. Server, map, HUD, menu, late join and summary are in. Working title: **Upgrade Rush**. Inspired by
Roblox's *+1 Upgrade Per Kill*, but
our own rules, gear ladder, map and art.

## Research

- Roblox game loop: **every kill upgrades your gear one step; every death sends
  you back to zero**.
- The Roblox game has a long ladder (reported 34 steps to MAXED), classes, Gear
  Savers and enchants. We use the one-way ladder idea only; no copied names,
  classes, stats, art or maps.
- Official game page: https://www.roblox.com/games/113273588963037/1-Upgrade-Per-Kill
- Design references (fan wikis; numbers are not authoritative):
  https://1upgradeperkill.top/en/mechanics/1-upgrade-per-kill-upgrade-system

## User rules for our version

- Use blocks, not just melee.
- Blocks **you placed** disappear when you die.
- Killing someone heals you.
- Everything upgrades with the tier.
- Use an online four-island map as a **layout reference**; rebuild original
  geometry. Do not copy map files/assets.

## Match

- Free-for-all, **4–8 players**.
- Round ends at **25 kills** or **10 minutes**, whichever comes first.
- 2-second respawn plus 1 second of spawn protection.
- No beds, generators, shop, team upgrades or permanent progression.
- Bots fill empty seats; one human can start a full 8-seat FFA. The host can
  still toggle bots off in the lobby.
- Scoreboard is kills/deaths/tier; rematch resets all.

## Core loop

- **Kill:** +1 Gear Tier, heal **6 HP** (capped at max), +1 score.
- **Death:** Gear Tier resets to 0; all blocks that player placed this life are
  removed; respawn at a safe spawn.
- Kill credit uses the existing last-attacker/void rules.
- Falling into the void counts as a death, resets tier and clears your blocks.

## Gear ladder (v1: 10 tiers)

One tier package upgrades the whole kit; no shop and no random choices in v1.

| Tier | Sword | Armour | Tools | Blocks | Extras |
|---|---|---|---|---|---|
| 0 | wood | leather | wood | wool | basic kit |
| 1 | stone | leather | wood | wool | +blocks |
| 2 | stone | chain | wood | wool | +walk speed |
| 3 | iron | chain | stone | clay | +2 max HP |
| 4 | iron | iron | stone | clay | +golden apple |
| 5 | iron | iron | iron | clay | +sprint speed |
| 6 | diamond | iron | iron | glass mix | +2 max HP |
| 7 | diamond | diamond | gold | glass mix | bow upgrade |
| 8 | diamond | diamond | diamond | moonstone mix | +speed |
| 9 | diamond+ | diamond | diamond | moonstone | apex; +2 max HP |

Exact numbers live in an `upgrade.ts` table and must be server-authoritative.
Golden apples remain capped at 2 per stack. The mode gives apples at tiers 4
and 8 only.

## Blocks and ownership

- Every player gets a fresh block stack on each tier.
- The room records the owner of player-placed blocks in Upgrade Rush.
- On death, remove only that owner's blocks; map blocks and other players'
  builds stay.
- Breaking a block removes its ownership entry.
- Round reset clears all placed blocks and ownership.
- Server-side only; the client never asks to delete blocks.

Open question: block types should be per-tier (wool -> clay -> glass/moonstone)
or a fixed palette. Default: per-tier, as above, with a full stack each life.

## Map

- Reference shape: islands around a central ring, bridges and a raised middle;
  classic BedWars silhouette. The shipped arena has **eight one-player spawn
  islands** — four base islands at ±30 plus the four diamond islands — each
  with a protected 3×3 pad and a three-wide stone-brick route to the middle,
  so nobody has to hand-bridge just to reach the fight.
- Rebuild original geometry with Clache blocks. No copied online map files.
- No beds/generators, protected spawn cells, central cover and vertical play.
- Bots fill empty seats. `sim/ffa.ts` samples human results every five seconds
  and moves the bot level at most once per ten seconds: easier after repeated
  deaths, harder for a dominant human.
- Module: `src/games/bedwars/maps/upgrade.ts`, `src/games/bedwars/sim/ffa.ts`.
- If a specific online map link is supplied, use its silhouette only.

## HUD / UX

- Gear Tier badge and next-tier preview.
- Kills/deaths and round timer.
- “Tier lost — reset to zero” on death.
- “+1 Tier / +6 HP” on kill.
- Hide bed, shop, team and generator widgets; free-for-all scoreboard.
- Menu entry **Upgrade Rush** and an online room type.
- No special mouse requirement beyond normal combat.

## Architecture

- Add `GameRules.mode = 'upgrade'`, `world: 'upgrade'`, `upgradeRules()`.
- Add `src/games/bedwars/upgrade.ts` for the tier table and per-player tier.
- Add a per-room `placementOwner` map; hook `onPlace`, block breaks, `die`, and
  round reset.
- Reuse movement, melee, block placement, respawn and network.
- Add JSON self-view fields for tier/kills or a compact `upgrade` message.
- No new binary message until the HUD needs per-tick data.

## Tests

- Kill increments exactly one tier, heals 6 HP, adds one score.
- Death resets tier and removes only the dead player's blocks.
- Breaking removes ownership; new life can place again.
- Round ends at 25 kills or 10 minutes; rematch resets.
- Map spawns standable, covered and protected.
- Golden apple max stack 2.
- Client HUD next-tier preview; no bed/shop UI.

## Build order

1. Docs/contract and golden-apple cap.
2. Tier table + room state + tests.
3. Map generator + map tests.
4. Combat/heal/death/block-ownership integration.
5. Client HUD, menu and room type.
6. Full test suite, typecheck, build, manual LAN FFA playtest.

## Out of scope v1

- Classes, enchants, Gear Savers, rarities.
- Duo/squad Upgrade Rush.
- FFA bot bridge-building; bots fight on the built bridges only.
- Per-bot difficulty; the director moves the whole FFA bot level together.
- Shop/economy and permanent progression.
- Copying Roblox maps/assets or exact stat numbers.
