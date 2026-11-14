# Task 0030 — FFA eight one-player islands + dynamic bot difficulty

Status: review — implemented; live playtest pending
Owner: Buffy
Created: 2026-11-03
Depends on: 0027 FFA map/bots, current `bots/upgrade.ts`

## Goal

Give every Upgrade Rush seat its own spawn island, and let bot difficulty
respond to how the human is actually doing: easier after repeated deaths,
harder when the human is dominating.

## Map

- Four base islands keep their existing spawn pad.
- The four diamond islands become the second seat for each colour. Each is
  flattened to a 3×3 stone-brick pad, cleared above, protected, and connected
  to the middle by a three-wide diagonal bridge.
- `map.upgradeSpawns[team]` now contains two pads: base island and diamond
  island. `spawnSlot` 0/1 selects one. Eight pads total, no two players share
  an island.
- No new `TeamId` values; colours remain cosmetic seats because `team !== null`
  is required by `canAct()`.
- Tests: eight pads, all distinct, every pad standable/protected, and every
  straight sample from pad to middle is solid.

## Difficulty director

Pure module: `src/games/bedwars/sim/ffa.ts`.

- Samples every **5 seconds** (`FFA_DIFFICULTY_INTERVAL`).
- Changes at most once per **10 seconds** (`FFA_DIFFICULTY_COOLDOWN`).
- Struggling human (`deaths - kills >= 3`, or `deaths >= 4 && tier <= 1`) makes
  bots one step easier, clamped at Easy.
- Otherwise a dominant human (`kills - deaths >= 3`, or `tier >= 6`) makes bots
  one step harder, clamped at Expert.
- No humans (bot-only observer) leaves the level unchanged.
- The room keeps the host's `botLevel`; the live level is `room.ffaBotLevel`.
  Reset at round start and announced in chat when it changes.

## Bot response

`UpgradeBot` reads `room.ffaBotLevel` each tick:

- Easy: long reaction window, never sprints, larger aim error.
- Normal: medium reaction, sprints from 8 blocks.
- Hard/Expert: short reaction, sprints from 5 blocks, lower aim error.

The bot still never builds; the map bridges carry it.

## Evidence

- `tests/upgrade.test.ts`: 22 pass, including eight-island reachability and
  director boundaries/cooldown.
- Full suite: **457 pass / 0 fail**, 43 files, 40.47s.
- Typecheck 0; `build:node` 340.23 kB.
- Bot-only baseline, 10 matches: 130.2s average, first kill 8.5s, 0% spawn
  deaths, target concentration 0.33, top kill share 0.45 (2/10 above 0.5).
- Local `:3002` PID 17616 and LAN `:3000` PID 18672 both run the new build;
  each was restarted after its room emptied.
- Not verified: human playtest of the new opener or difficulty feel.

## Files

- `src/games/bedwars/maps/upgrade.ts`
- `src/games/bedwars/sim/ffa.ts`
- `src/games/bedwars/room.ts`
- `src/games/bedwars/bots/upgrade.ts`
- `tests/upgrade.test.ts`
- docs/changelog/state updates

## Review checklist

- [x] Eight distinct pads, one player each.
- [x] Base and diamond pads protected/standable.
- [x] Every pad has a solid route to the middle.
- [x] Director has cooldown and clamps.
- [x] Bot-only rooms do not change.
- [ ] Human playtest: opener, difficulty easing, difficulty challenge.
