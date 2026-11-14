# FFA baseline — 10 bot matches

Date: 2026-11-03. Headless, bot-only, 8 seats.
Command: `bun scripts/ffa-observer.ts 10 1000`.
Raw rows: `.agents/ffa-baseline.jsonl`.

## Method

Each match creates an Upgrade Rush room with `bots: true, minPlayers: 1`,
installs the real `UpgradeBot`, calls `startRound()` directly (8 bots, no human)
and ticks until the round ends at 25 kills or 10 minutes. A death is a "spawn
death" when it happens within 3 seconds of that player's last spawn. Target
concentration is sampled once per second: the share of living bots whose nearest
living player is the same target. `1/7` means spread; `1.0` means all bots
dogpile one player.

## Per match

| # | Seed | Seconds | Kills | First kill (s) | Spawn deaths | Target concentration | Top kill share | Winner |
|---|---|---|---|---|---|---|---|---|
| 1 | 1000 | 90 | 40 | 7.5 | 0/40 | 0.34 | 0.63 | Juniper bot |
| 2 | 1001 | 123.8 | 54 | 8.4 | 0/54 | 0.32 | 0.46 | Tansy bot |
| 3 | 1002 | 236.8 | 103 | 9.0 | 0/103 | 0.34 | 0.24 | Quill bot |
| 4 | 1003 | 96.6 | 42 | 9.4 | 0/42 | 0.34 | 0.59 | Basalt bot |
| 5 | 1004 | 147.1 | 63 | 10.2 | 0/63 | 0.35 | 0.40 | Clover bot |
| 6 | 1005 | 136.1 | 64 | 8.3 | 0/64 | 0.32 | 0.39 | Ember bot |
| 7 | 1006 | 108.7 | 54 | 7.9 | 0/54 | 0.32 | 0.46 | Sorrel bot |
| 8 | 1007 | 106.7 | 51 | 8.1 | 0/51 | 0.34 | 0.49 | Flint bot |
| 9 | 1008 | 130.1 | 61 | 7.8 | 0/61 | 0.33 | 0.41 | Wren bot |
| 10 | 1009 | 126.3 | 57 | 8.8 | 0/57 | 0.34 | 0.44 | Clover bot |

## Aggregate

| Metric | Mean / median |
|---|---|
| Match length (s) | 130.2 / 125.0 |
| Time to first kill (s) | 8.5 / 8.3 |
| Spawn deaths (share of deaths) | 0.0 / 0.0% |
| Bot target concentration | 0.33 / 0.34 |
| Top player kill share | 0.45 / 0.45 |
| Tier at death | 0.61 / 0.00 |
| Final kill margin | 15.50 / 16.50 |
| Timeouts | 0/10 |

## Reading

- 0/10 matches are above the 10% spawn-death target.
- 0/10 matches average more than half the bots on one target.
- 2/10 matches have one player taking more than half of all kills; the average
  is 0.45, so the outliers are worth watching but not a lobby-wide runaway.
- 0 matches hit the 10-minute cap without reaching 25 kills.

This is the **0030 map baseline**: eight one-player islands, bots routing via
the middle. It replaced the pre-0030 run. Human playtest of the opener and the
difficulty director is the next gate; spawn safety/bridge cover and the bounty
are still proposals.
