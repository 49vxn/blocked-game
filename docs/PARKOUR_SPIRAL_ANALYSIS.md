# OG Parkour Spiral — design analysis

Status: analysis only; no map files imported or code changed.
Date: 2026-11-03.
Subject: Hielke Maps' **Parkour Spiral** (Java/Bedrock), compared with Clache's
**Spiral Tower**.

## What the original actually is

From Hielke's official page and listings:

- Goal: reach the top of an enormous spiral tower, beating parkour challenges
  on the way up. It is a bottom-to-top vertical course, not a flat obby.
- Roughly **100 short levels** (a showcase description says "about 100
  fast-paced levels"; the official page calls it "MASSIVE" and does not print
  a level count, so treat 100 as approximate).
- **Many unique level themes**, multiplayer support, **integrated checkpoints**,
  a **ranking system** for replayability, and **10 Easter eggs**.
- Rank times are long by Clache standards: the page's indexed table is around
  **S 11:40, A 25 min, B 45 min, C 90 min**; a normal first run is not a
  90-second sprint.
- Java and Bedrock downloads are behind the Hielke Maps terms; the map is a
  copyrighted build, not an open asset.

Sources: [official map page](https://hielkemaps.com/maps/parkour-spiral),
[Hielke maps index](https://hielkemaps.com/maps),
[StickyPiston listing](https://trial.stickypiston.co/map/parkourspiral),
[Bedrock listing](https://bedrock.gg/@hielke-maps/parkour-spiral).

## Why it works

**1. Granular progress.** About 100 levels means a checkpoint every few minutes
or less. The player is never far from a save, so a fall costs seconds, not the
run. This is the single biggest difference from a 10-level tower.

**2. Short, legible challenges.** Each level is a small idea: a gap, a jump
sequence, a precision landing, a themed mechanic. The player learns the rule in
the first two attempts and repeats it until it clicks. The course is a chain of
tiny mastery loops, not one long endurance test.

**3. Novelty as a pacing tool.** "Many unique level themes" is not just art:
a new palette/room resets attention. The tower's height is visible, and each
band gives the player a fresh "what is this one?" moment.

**4. Failure is cheap.** Integrated checkpoints plus a fall reset mean the
loop is: try, fail, respawn at the last level, retry in seconds. There is no
walk back and no lost inventory. Rage is bounded by the checkpoint distance.

**5. The ranking layer.** S/A/B/C/D times turn the same course into a replay
target and a speedrun ladder. The map is multiplayer-friendly, so the same
structure supports a race and a personal best.

**6. Vertical spectacle.** You can see the tower, the next band and the finish
above you. The goal is always spatially legible, which makes "one more level"
easy to sell.

The formula is: **many short levels × frequent checkpoints × one new idea per
level × visible vertical progress × a time rank to beat.**

## Clache's Spiral Tower, by comparison

Current build (`maps/parkour.ts`, `spiralTower()`):

- **10 levels**, one checkpoint every 38 treads (10 checkpoints), 372 treads in
  total, 18 intentional gaps, continuous 3-wide walkway, 80×204×80.
- 10 themed material bands, one per level; target run 90–150 seconds; no time
  rank, no Easter eggs, no per-level names in the HUD.
- Audited by `tests/parkour-spiral.test.ts` for solidity, headroom, arcs and
  payload size; `docs/PARKOUR.md` describes it as an original build "after the
  classic community spiral maps", not a port.

| Dimension | OG Parkour Spiral | Clache Spiral Tower |
|---|---|---|
| Levels | ~100 short levels | 10 long levels |
| Checkpoints | integrated, roughly one per level | 10, one every 38 treads |
| Run length | ~12–90 min by rank | target 90–150 s |
| Challenge | one idea per small level | risers + gaps along one ribbon |
| Themes | many unique level themes | 10 material bands |
| Replay | S/A/B/C/D rank + speedrun | personal best only |
| Multiplayer | race-friendly | race-friendly (already) |
| Scale | massive tower | 204 blocks tall |

**Why ours feels different even though it is a spiral:** we compressed the
macro shape (tower + spiral + top finish) but not the *cadence*. Ten 38-tread
levels are endurance sections, not 100 tiny mastery loops. The checkpoint is
frequent relative to a BedWars match, but not relative to the OG. We also have
no rank ladder, no level-name novelty every few minutes, and no Easter eggs.

## Options

**A. Keep the 10-level sprint.**
Call it **Spiral Sprint**, not "the OG". Good for a 2–4 minute class break;
it is what we already have.

**B. Add Spiral Classic: 30 levels, 8–12 minutes.**
Best school compromise. Cut the level length to ~12 treads, checkpoint every
level, group themes in bands of three, add S/A/B/C ranks and 3 Easter eggs.
This keeps a full class period viable while restoring the OG's granular loop.

**C. Add Spiral 100: the literal scale.**
~100 levels at 12 treads each is ~1,200 treads and 20–60+ minutes. It needs
save/resume, a checkpoint browser and a longer session than a class. Only worth
it if "parkour marathon" becomes its own mode; do not replace the current
course with it.

**D. Import the actual map.**
For private Minecraft use, you can install Hielke's map. For Clache, that needs
an NBT/.schem converter and permission to redistribute the build; it is a
separate project, not an analysis shortcut.

## Recommended plan for Spiral Classic

1. **Generate levels, not one long ribbon.** Add a `LEVEL_STEPS = 12` cadence
   and a `levels = 30` loop; checkpoint at every level boundary. Keep the
   existing tower geometry and gap/riser builders.
2. **Theme bands of three.** Reuse the ten material bands across 30 levels
   (three levels per band) instead of one band per 38 treads. Show
   `Level N/30 — <band name>` on the checkpoint toast.
3. **One idea per band.** Levels 1–3 basic gaps; 4–6 risers; 7–9 ice; 10–12
   narrow beams; 13–15 double gaps; 16–18 turns; 19–21 precision; 22–24
   sprint jumps; 25–27 mixed; 28–30 finale. Use only mechanics the engine has.
4. **Rank times.** S/A/B/C/D from a clean-run target; start with S 8 min,
   A 12 min, B 20 min, C 30 min, then tune from playtests. Show rank on the
   finish card and personal best in the sidebar.
5. **Three Easter eggs.** Optional side pads or hidden lanterns; no power,
   just a badge. This is the OG's exploration layer without a 100-level map.
6. **Keep the race shape.** Ordered checkpoints, fall → last checkpoint,
   30-second finish window, three rounds; add split times per level.
7. **Test the cadence.** Assert 30 ordered checkpoints, every band theme,
   every arc clear, payload under 200 KB; extend the existing spiral tests.

## What not to do

- Do not paste Hielke's map file or assets into Clache and call it original.
- Do not claim the current 10-level tower is the OG; label it **Spiral Sprint**.
- Do not add 100 checkpoints to the current 372-tread ribbon as a shortcut;
  a checkpoint every 3 treads is not the same as 100 designed levels.
- Do not make a 20–60 minute course the default for a school class without
  save/resume.
- Do not add Minecraft-only mechanics (command blocks, slime, ladders) just to
  imitate the original; use gaps, ice, beams and risers we can test.

## Bottom line

The OG's magic is **~100 tiny levels, a checkpoint at each, a new theme every
few minutes, and a time rank**. Our tower copied the silhouette but compressed
the cadence 10×. The honest fix is not to import the map; it is to build a
30-level Spiral Classic with 12-tread levels and ranks, keep the 10-level
Spiral Sprint as the short mode, and reserve a literal 100-level marathon for
a separate save/resume mode.

## Sources

- [Hielke Parkour Spiral](https://hielkemaps.com/maps/parkour-spiral) —
  bottom-to-top spiral, many themes, multiplayer, ranking, 10 Easter eggs,
  download/ToS.
- [Hielke maps index](https://hielkemaps.com/maps) — Spiral is described as
  massive; the "100 little levels" line belongs to Parkour Paradise.
- [StickyPiston listing](https://trial.stickypiston.co/map/parkourspiral) —
  integrated checkpoints.
- [Bedrock listing](https://bedrock.gg/@hielke-maps/parkour-spiral) —
  themes, multiplayer, Easter eggs, ranking.
- [Showcase description](https://www.youtube.com/watch?v=3rKLDdqnACA) —
  "about 100 fast-paced levels" (approximate, not an official count).
- Clache: `docs/PARKOUR.md`, `src/games/bedwars/maps/parkour.ts`,
  `tests/parkour-spiral.test.ts`.
