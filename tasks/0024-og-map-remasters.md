# Task 0024 — OG-style map remasters (Aquarium, Archway, Spiral Tower)

Status: done, pending review.
Owner: Buffy (integrator, directed by the human).
Created: 2026-11-02. (First drafted as 0023 — renamed; 0023 was workflow v2.)

## Goal

Rebuild two of the classic 2017 Hypixel Bed Wars arenas and the classic Hielke
spiral parkour map as in-house MapDefs, from layout research only:

- `aquarium` — OG Aquarium (release-day 4v4v4v4): white/coral cross arena,
  diamonds low on the diagonals, two emeralds by the middle promenade, water
  features.
- `archway` — OG Archway: corner bases around a tight middle, the great arch
  with one emerald on the ground under it and one on the deck above, diamonds
  at awkward angles, weathered stone.
- `Spiral Tower` parkour course — the enormous themed spiral tower: start on a
  plaza at its foot, climb the outside on jumping pads through ten themed
  levels to a beacon deck on top. **The parkour world opens on it by default**;
  `?map=classic` keeps the small original tutorial course reachable.

Faithful **layout** translations only, per `docs/GAMEMODES.md` map policy and
`QUEUE.md` "won't do": no copied Minecraft maps, NBT, textures or art; every
block comes from the existing palette and the geometry is authored in code.

## Decisions

- Two new theme ids: `coral` (quartz + cyan/red terracotta, flat roofs, pools)
  and `stronghold` (weathered stone bricks, ruined/flat edges, the arch).
- Archway uses corner bases (middle landmarks must never sit on lanes);
  Aquarium uses cross bases with an open, bot-safe middle.
- Emerald generator spots may carry a y offset (the Archway deck emerald).
- `spiralTower()` is a solid-cylinder tower (80×204×80) with one materials
  band per level and no per-cell hash speckle — solid runs keep
  `world.encode()` far under the join payload budget (guard: < 200 KB).
- Parkour room default flipped to the tower (user request); `map=classic`
  keeps the tutorial; unknown `map` values fall back to the tower.
- No bots.ts, protocol.ts, room.ts or client edits. `tests/parkour.test.ts`
  gained one intended-behavior assertion change (default room is now the
  tower); nothing weakened.

## Allowed paths

- `src/games/bedwars/maps/plan.ts`, `themes.ts`, `arena.ts`, `parkour.ts`
- `src/games/bedwars/rules.ts`, `src/games/bedwars/server.ts`
- `scripts/inspect-aquarium.ts` (build-debug helper),
  `scripts/inspect-tower.ts` (course audit, added for the spawn fix)
- `tests/bots.test.ts` (new-arena seeds only),
  `tests/parkour-spiral.test.ts` (new), `tests/parkour.test.ts` (one line)
- `docs/PARKOUR.md`, `docs/CHANGELOG.md`, `QUEUE.md`, `tasks/README.md`,
  `TODO.html`

## Steps

1. Contract + board row.
2. Themes: `coral`, `stronghold`; layouts `AQUARIUM`, `ARCHWAY`; register in
   `ARENAS` and `arenaRules().maps` (same order).
3. Bot seeds for both arenas; rounds end with a winner.
4. Tower course + `parkourCourse(id)` resolver + server default flip; course
   and room tests.
5. Focused suites → typecheck → full suite → `build:node`.
6. Browser check on a local test port (`:3005`): lobby vote for both arenas,
   battle start, the tower run start + HUD, classic fallback.

## Acceptance

- [x] Both arenas pass the full per-arena suite in `tests/maps.test.ts`
      (65/66 after one fix: the coral tree for walkable ground is a
      slimPalm — a slender trunk stood at body height).
- [x] Bot rounds on both arenas end with a winner (seeds 9 / 10, first pick).
- [x] Spiral Tower: 10 ordered checkpoints, ordered climbs, falls, finish;
      default parkour room opens it; `map=classic` opens Parkour; RLE encode
      < 200 KB.
- [x] **Spawn-in-blocks (user report) fixed.** The tower face is inset to
      r ≤ 11.2 (was 13.3, which swallowed the r = 13 pads), every pad carves
      two blocks of headroom, and checkpoint lanterns moved outward (one
      stood in the first jump line at (42,15,27)). `scripts/inspect-tower.ts`
      (new helper, see allowed paths) audits the spawn, all 373 pads, all
      372 arcs, the finish and the payload for both courses: `AUDIT CLEAN`,
      encode ≈ 77.0 KB.
- [x] Test arc audit added to `tests/parkour-spiral.test.ts` (first version
      had a self-inconsistent expected/received template that failed even on
      clear arcs; fixed to compare like-for-like). Parkour suites
      **14 pass, 0 fail**. Full suite **404 pass, 0 fail** with
      `bun test --max-concurrency 1 --timeout 10000` (one easy-bot timeout
      flaked in a parallel run and passed on rerun); typecheck clean;
      `build:node` green.
- [x] No new block ids; palette-only geometry (BLOCKS count untouched).
- [x] Browser smoke on `:3005` (host-only, no deploy/restart of public
      servers): default `?world=parkour` join opens Spiral Tower; the room
      list shows it playing (phase `playing`, map `Spiral Tower`); a raw
      probe socket with `&map=classic` builds a room named `Parkour`.

## Follow-ups (for the integrator to route)

- **Client `main.ts` drops `?map=`**: the play-URL whitelist rebuild leaves
  the param behind, so a browser URL can't open the classic course yet
  (worker1/0021's file — one line: read + forward `map`). The server honors
  `map=classic` today (verified live via socket probe).
- `main.js` `:3005` smoke server is running this task's build locally; the
  TODO board stays on its own port. LAN `:3000` and any public URLs are
  untouched.
