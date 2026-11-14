# FFA improvements — decision memo

Status: partly implemented. 0030 added eight one-player islands and the dynamic
difficulty director; spawn protection changes, bridge cover and bounty remain
proposals.
Date: 2026-11-03
Scope: Upgrade Rush free-for-all.

## TL;DR

- **Done in 0030:** eight one-player spawn islands and a performance director
  that eases or hardens bots from the human's results.
- **Still next:** spawn protection/bridge cover. The current opener can still
  be a coin flip and every bridge is a flat, exposed chokepoint.
- **Best next design change: a visible bounty + Gear Saver.** It turns the
  leader into a shared objective and gives the losing side a path back.
- **Measure first.** Add FFA telemetry before tuning match length or bot skill.
- **Do not start with** more bots, tier-choice menus, or a Pit-sized progression
  system.

If the question is “what will make FFA feel less broken?”, the answer is
**spawn safety + bridge cover**. If the question is “what will make FFA more
fun?”, the answer is **the bounty**.

## Current state

- **0030:** eight one-player spawn islands — four base islands at ±30 plus the
  four diamond islands — each with a protected 3×3 pad and a three-wide route
  to the middle. Middle radius 12.
- One second of spawn protection, then FFA damage ignores colour.
- 25 kills or 10 minutes; 10 tiers; kill = +1 tier and +6 HP; death = tier 0
  and the player's placed blocks vanish.
- One human fills the other seven seats with bots. The five-second director
  eases bots after repeated human deaths and hardens them for a dominant human.
- Late joiners already replace a bot (`takeBotSeat`), so that is not a gap.
- The FFA HUD hides the team rows and the bot toggle, but the docs/contract
  still imply the host can toggle bots. Correct one side of that.

Code: [map](../src/games/bedwars/maps/upgrade.ts),
[bot](../src/games/bedwars/bots/upgrade.ts), [rules](../src/games/bedwars/rules.ts),
[room](../src/games/bedwars/room.ts), [HUD](../src/games/bedwars/client/hud.ts).

## Baseline (Phase 0, done)

`bun scripts/ffa-observer.ts 10 1000` ran ten bot-only matches. Full report:
[FFA_BASELINE.md](FFA_BASELINE.md).

- 130.2 s per match; first kill at 8.5 s; 0% spawn deaths; target
  concentration 0.33; top kill share 0.45; 2/10 matches above 0.5 top share.
- Bots now route through the middle; the pre-0030 baseline had them stopping at
  the first void edge in the eight-island layout.
- Bot-only data does **not** reproduce a lobby-wide dogpile. It still cannot
  judge the human opener or whether the difficulty shifts feel fair; a human
  playtest is required.

## Verdict: which one is good

### 1. Best first change — spawn safety + bridge cover

Why this one:

- 0030 removed the shared-island spawn: each player now materialises alone.
  The remaining opener risk is the one-second protection and the exposed
  approach from each island.
- Every bridge is three wide, flat, with no cover and no alternate route. At
  tier 7 the bow turns each bridge into a free-shot lane; third parties own the
  middle.
- The fixes are local: spawn selection/protection in `room.ts`, bridge cover in
  `maps/upgrade.ts`, tests in `tests/upgrade.test.ts`. No protocol redesign.

What “good” means here:

- Spawn at the least-threatened pad; never spawn two players within ~12 blocks
  or in each other's line of sight.
- Two seconds of protection that ends early on attack or place.
- Widen the bridges, add two offset cover pillars and a side-step route so a
  crossing is not a single exposed commitment.
- Acceptance: fewer than ~10% of deaths within 3 seconds of spawning; no
  bridge with a single unavoidable sightline; bots can still path across.

Evidence: The Pit spawns players in a separate PvP-off area above the arena and
lets them drop in voluntarily, which makes spawn camping structurally
impossible ([Hypixel wiki](https://hypixel.fandom.com/wiki/The_Pit)). Level
design guidance says spawns should be least-threatened and no position should
see everything ([Chill Out study](https://book.leveldesignbook.com/studies/mp/chill-out.md),
[map balance](https://book.leveldesignbook.com/process/combat/balance.md)).
Flat open bridges fail both tests: no juke, no cover, no second route
([Door Problem](https://andrewyoderdesign.blog/2019/08/04/the-door-problem-of-combat-design/)).

### 2. Best next design change — visible bounty + Gear Saver

Why this one:

- The ladder is +1 tier per kill with a full reset on death, and the leader also
  gets speed, armour, a bow and more HP. There is no catch-up lever.
- Mark the leader (five kills or tier 5) with a visible crown/bounty. Killing
  them grants +2 tiers or a **Gear Saver** token that keeps, say, three tiers on
  the next death. Show the bounty in the HUD and feed.
- Bots should prefer the bounty when it is reasonable, but not all at once.
- This is the cheapest *fun* change: it reuses tier state, kill events and HUD.

Evidence: The Pit attaches visible bounties at streak 6 and adds anti-snowball
penalties at high streaks ([Bounty](https://pit.wiki/Bounty),
[Overdrive](https://pit.wiki/Overdrive)). The snowball literature prefers an
earned bounty over a random “blue shell” punishment because it is predictable
and paid for by the leader ([Tuts+](https://code.tutsplus.com/the-snowball-effect-and-how-to-avoid-it-in-game-design--cms-21892a)).

### 3. Best long-term structural bet — Pit-style spawn pod

The cleanest fix is a protected spawn room above the arena with four drop
points. It removes spawn camping by construction and gives respawn a moment of
choice. It is also the biggest change: map, protocol, input and bot spawn
handling. Do it only if the cheap spawn safety still feels insufficient.

### 4. Best measurement step — FFA telemetry (prerequisite)

Before tuning anything, record: time to first kill, deaths within 3 seconds of
spawn, share of bots targeting one player, top player's kill share, tier at
death, match length and final margin. Ten headless matches plus one human
playtest. This is not player-facing, but it prevents guessing.

## Options at a glance

| Option | Impact | Effort | Risk | Verdict |
|---|---|---|---|---|
| Spawn selection + 2 s protection | High | Medium | Protection exploit; end on action | **Do first** |
| Bridge cover + alternate route | High | Low–Medium | Bot pathing, map legibility | **Do first** |
| Visible bounty + Gear Saver | High | Medium | Focus-fire; tune the reward | **Do second** |
| Bot target spread + skill levels | High | Medium | Too easy/hard | Pair with bounty |
| Mid objective / power pickup | Medium | Medium | Snowballs the leader | After fairness |
| Death-streak pity | Medium | Low | Rewards losing; cap it | Cheap add-on |
| HUD crown/streak/onboarding | Medium | Low | Clutter | With bounty |
| Match-length tuning | Medium | Low | Needs data | After telemetry |
| Tier choices at 3/6/9 | High | High | Balance/UI scope | Only if data says stale |
| More bots | Low | Low | Makes dogpiling worse | No |

## Why not the others yet

- **Mid objective:** good idea, but it multiplies an existing snowball if the
  leader can hold it. Fix spawns and add a bounty first.
- **Bot AI overhaul:** needed, but a smarter bot on a flat bridge is still a
  bridge problem. Pair target spread with the bounty and cover.
- **Tier choices:** the strongest depth change, but the highest effort. Do it
  after telemetry shows the automatic ladder is actually stale.
- **Match length:** 25 kills / 10 minutes may be too long with seven bots, but
  changing it now is a guess.
- **Pit progression/mystics:** intentionally out of scope. Keep FFA
  match-scoped; permanent power would recreate The Pit's progression cliff.

## Recommended sequence

0. **Telemetry** — done; 10-match 0030 baseline in `FFA_BASELINE.md`.
1. **Fairness pass** — 0030 isolated every seat on its own island and added the
   difficulty director. Remaining: stronger action-ending protection and bridge
   cover/side routes.
2. **Bounty pass** — visible leader bounty, Gear Saver, bot target spread.
3. **Depth pass** — mid pickup, death-streak pity, match-length tuning from data.
4. **Polish** — crown/streak/onboarding, then tier choices only if warranted.

## Acceptance for the first two passes

- Focused FFA tests and the full suite stay green (currently 457 tests).
- Spawn deaths under 3 seconds fall below ~10%.
- No bridge is a single unavoidable sightline; bots still cross it.
- Bounty kills are visible in the feed and HUD; the leader is identifiable.
- No single player is the target of more than ~half the bots for long stretches.
- A human playtest reports the opener no longer feels like a coin flip.

## Sources

- [The Hypixel Pit](https://pit.wiki/The_Hypixel_Pit),
  [Bounty](https://pit.wiki/Bounty), [Overdrive](https://pit.wiki/Overdrive),
  [Megastreaks](https://pit.wiki/Megastreaks)
- [Chill Out study](https://book.leveldesignbook.com/studies/mp/chill-out.md),
  [Map balance](https://book.leveldesignbook.com/process/combat/balance.md),
  [The Door Problem](https://andrewyoderdesign.blog/2019/08/04/the-door-problem-of-combat-design/)
- [The Snowball Effect](https://code.tutsplus.com/the-snowball-effect-and-how-to-avoid-it-in-game-design--cms-21892a),
  [Machinations on feedback loops](https://machinations.io/articles/game-systems-feedback-loops-and-how-they-help-craft-player-experiences)
- Roblox “+1 Upgrade Per Kill” specifics could not be verified from primary
  pages; treat Gear Saver pricing and tier counts as leads, not facts.
