# Making the bots feel human

Status: superseded by [`BOT_AI_REWRITE.md`](BOT_AI_REWRITE.md). This page remains
the focused research note on the original phase-1 humanization; the full
five-tier architecture, decision matrix and multi-agent plan are in the newer
document. The old implementation contract is
`tasks/0002-bot-humanization.md` (blocked).

## The problem in the current code

The bots are already capable: they gather, shop, layer their bed, bridge, raid,
fight, use bows, fireballs and pearls, and play full rounds. The robotic feel
comes from four specific choices in `src/games/bedwars/bots.ts`:

1. **They are omniscient.** `nearestEnemy()` scans every living enemy's exact
   position with no line-of-sight or field-of-view check. Invisibility is the
   only exception, and only within 3 blocks. A bot can start reacting to a
   player behind a wall.
2. **The reaction clock is a fixed number.** `reactionTicks` is 16 / 8 / 4 / 2
   ticks: 800 / 400 / 200 / 100 ms. Expert's 100 ms is faster than a human can
   reliably perceive, decide and aim; there are no lapses or slow tails.
3. **The head snaps.** `fight()` computes a perfect yaw/pitch and assigns it
   directly every tick, with a small random offset. There is no turn-rate cap,
   no overshoot, no correction. That is the “snapping heads” tell.
4. **Target selection is immediate.** `nearestEnemy()` is called every tick and
   the nearest valid enemy wins. There is no commitment window and no hysteresis,
   so a bot can switch targets frame by frame.

The movement and pathfinding are separate, already decent, and should not be
rewritten in the first humanization pass.

## What the research says

There is little peer-reviewed work on Minecraft/BedWars PvP specifically. The
useful evidence is broader:

- Reaction times are positively skewed with a slow tail; a lognormal core plus
  occasional delayed responses is a better model than one fixed delay.
  ([Leclaire et al., 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC8638535/))
- Aiming is a speed-accuracy tradeoff with corrective submovements, not a
  single snap. ([Huys et al., 2010](https://pmc.ncbi.nlm.nih.gov/articles/PMC2842815/))
- Human-like navigation is judged by more than success: sudden camera swings,
  wall collisions and unnatural pacing are tells.
  ([Milani et al., CHI 2023](https://arxiv.org/html/2303.02160))
- Halo 2's AI postmortem argues for coherent behavior over time and avoiding
  rapid dithering between actions; readable intent matters more than perfect
  optimization. ([Isla, 2005](https://www.gamedeveloper.com/programming/gdc-2005-proceeding-handling-complexity-in-the-i-halo-2-i-ai))
- F.E.A.R.'s GOAP is a useful pattern for actions with preconditions/effects,
  but its plans were short and revalidated constantly.
  ([Thompson, 2020](https://www.gamedeveloper.com/design/building-the-ai-of-f-e-a-r-with-goal-oriented-action-planning))
- Unreal's perception model is a good reference for sight ranges, last-known
  positions and expiring stimuli.
  ([Epic AI Perception](https://dev.epicgames.com/documentation/unreal-engine/ai-perception-in-unreal-engine?lang=en-US))
- Unity's navigation split—global route plus local steering—is the right shape
  for voxel islands, bridges and gaps.
  ([Unity AI Navigation](https://docs.unity3d.com/Packages/com.unity.ai.navigation@2.0/manual/NavInnerWorkings.html))

Community Minecraft PvP guides are useful for tactics (strafing, sprint resets,
height advantage), but they are not controlled performance data.

## Target architecture

```text
perception / memory
  -> strategic planner (gather, shop, defend, raid, regroup, survive)
  -> tactical controller (fight, retreat, break bed, guard, follow)
  -> motor controller (turn rate, aim correction, movement bursts, jumps)
  -> personality (seeded aggression, greed, confidence, strafe preference)
```

The important boundary: **perception must expose only what the bot could know.**
The planner and motor controller must not read `room.players` positions
directly. In this codebase that can be a small `BotPerception` object built each
think tick, not a protocol change.

## Suggested starting parameters

These are design recommendations, not measured human percentiles. Units are
milliseconds unless noted.

| Parameter | Easy | Normal | Hard | Expert |
| --- | ---: | ---: | ---: | ---: |
| Median response delay | 480 | 380 | 300 | 250 |
| Extra delayed-response chance | 18% | 12% | 7% | 4% |
| Delayed-response extra | 250-500 | 250-500 | 250-500 | 250-500 |
| Initial aim spread (relative to target angular size) | 0.90× | 0.65× | 0.45× | 0.32× |
| Aim correction interval | 180-260 | 140-220 | 110-180 | 90-160 |
| Maximum movement lead | 100 | 140 | 180 | 200 |
| Minimum target commitment | 900 | 750 | 600 | 500 |
| In-range swing miss chance (marginal aim only) | 28% | 20% | 13% | 8% |
| Typical strafe burst | 600-1000 | 500-900 | 400-800 | 350-750 |

Do not give expert perfect aim. Higher tiers should react faster, track better,
evaluate threats more consistently and recover better—not ignore the human
constraints.

## First five changes

1. **Perception gate.** Build a visible-enemy list from line of sight, a field
   of view (for noticing), last-known positions and expiry. No attacks or
   target locks on unseen players. Keep a short memory so a bot can chase where
   it last saw someone, not omnisciently follow them.
2. **Human response distribution.** Replace the fixed `reactionTicks` with a
   sampled delay per new actionable sighting: lognormal core plus a small
   delayed-response chance. A target already tracked gets a faster re-action.
3. **Smooth aim.** Cap angular velocity and acceleration; move yaw/pitch toward
   a noisy aim point, allow a small overshoot, then correct. Never assign the
   perfect yaw/pitch in one tick.
4. **Target commitment.** Keep the current target for a minimum window unless a
   higher-priority threat appears (enemy at your bed, teammate about to die,
   imminent void/knockback). Add a switch margin so two similar targets do not
   flip-flop.
5. **Readable movement and misses.** Variable strafe bursts, contextual jumps
   (gap, escape, crit), and misses that follow from aim/timing confidence rather
   than a random “make him miss” roll. Add a visible pre-action: turn before
   chasing, select the tool before mining, back off before eating.

## What not to do

- Do not add random falls or random pathing failures. They look broken, not
  human.
- Do not give the bot hidden information and then add aim jitter to cover it.
- Do not make “hard” mean perfect aim with a longer reaction. Human constraints
  stay at every level; the quality of decisions changes.
- Do not rewrite pathfinding and combat in the same pass. The first pass should
  be perception + reaction + aim + target commitment.
- Do not use machine learning. The game is small and deterministic; a readable
  utility/perception model is easier to test and tune.

## How to evaluate “human”

Automated:

- A bot must not acquire a target with no line of sight.
- Maximum yaw/pitch change per tick stays under the configured turn cap.
- Target switches per engagement stay under a threshold (e.g. 1.5).
- Reaction-delay distribution has a median and a tail, not a constant.
- Existing bot rounds still finish; expert still beats easy, but not perfectly.
- Hit rate and accuracy are logged per level, not asserted to a fantasy number.

Human:

- Blind test: watch short clips and guess bot vs human. If bots are obvious,
  find the tell.
- Ask testers to describe the bot in three words. “Aimbot”, “snappy” and
  “instant” are failures; “aggressive”, “careful” and “missed a few” are useful.
- Record deaths caused by a bot that had no right to know the player was there.
  Those are the highest-priority bugs.

Add a telemetry line to the debug/development build: target id, reaction delay,
aim error, turn rate, switch count, and why the bot chose its goal. Do not ship
that overlay to players.

## Phased contract

- **Phase 1 (first):** perception object, response distribution, smooth aim,
  target commitment. Tests in `tests/bots.test.ts`.
- **Phase 2:** strategic priorities (bed threat, regroup, resource/tool needs,
  failed-rush recovery).
- **Phase 3:** teammate awareness and timestamped reports; no protocol change
  until the information model is settled.
- **Phase 4:** per-bot personality, director-style pacing, blind human tests.

The first phase is the one that removes the “snapping heads” feel. Do it before
adding more tactics.

## Sources

- Dye, Green & Bavelier, action-game reaction times, 2009:
  https://pmc.ncbi.nlm.nih.gov/articles/PMC2871325/
- Huys et al., reciprocal aiming, 2010:
  https://pmc.ncbi.nlm.nih.gov/articles/PMC2842815/
- Leclaire et al., reaction-time distributions, 2020:
  https://pmc.ncbi.nlm.nih.gov/articles/PMC8638535/
- Milani et al., “Navigates Like Me”, CHI 2023:
  https://arxiv.org/html/2303.02160
- Isla, Halo 2 AI, 2005:
  https://www.gamedeveloper.com/programming/gdc-2005-proceeding-handling-complexity-in-the-i-halo-2-i-ai
- Thompson, F.E.A.R. GOAP, 2020:
  https://www.gamedeveloper.com/design/building-the-ai-of-f-e-a-r-with-goal-oriented-action-planning
- Epic, AI Perception:
  https://dev.epicgames.com/documentation/unreal-engine/ai-perception-in-unreal-engine?lang=en-US
- Unity AI Navigation:
  https://docs.unity3d.com/Packages/com.unity.ai.navigation@2.0/manual/NavInnerWorkings.html
- Hypixel PvP guide, 2019:
  https://hypixel.net/threads/guide-complete-pvp-guide-for-all-ladders-with-videos-and-pictures.2152006/
- Hypixel rushing guide, 2020:
  https://hypixel.net/threads/guide-how-to-rush-in-bed-wars.3065855/
