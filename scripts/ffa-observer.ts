/**
 * Headless Upgrade Rush FFA observer.
 *
 * Runs bot-only 8-seat matches and records the Phase 0 baseline:
 * time to first kill, deaths within 3 s of spawn, bot target concentration,
 * top-player kill share, tier at death, match length and final margin.
 *
 * Usage: bun scripts/ffa-observer.ts [matches=10] [seed=1000]
 * Writes .agents/ffa-baseline.jsonl and docs/FFA_BASELINE.md.
 */
import { writeFileSync } from 'node:fs'
import { TPS } from '../src/games/bedwars/constants'
import { UpgradeBot } from '../src/games/bedwars/bots/upgrade'
import { upgradeRules } from '../src/games/bedwars/rules'
import { Room } from '../src/games/bedwars/room'
import { UPGRADE_ROUND_TICKS } from '../src/games/bedwars/upgrade'

const matches = Math.max(1, Math.min(50, Number(process.argv[2] ?? 10)))
const baseSeed = Math.max(1, Number(process.argv[3] ?? 1000))
const SPAWN_DEATH_TICKS = 3 * TPS
const CAP = UPGRADE_ROUND_TICKS + 100
const now = new Date()
const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-')

interface MatchResult {
  seed: number
  ticks: number
  seconds: number
  ended: boolean
  timedOut: boolean
  winner: string | null
  totalKills: number
  firstKillTick: number | null
  deaths: number
  spawnDeaths: number
  tierAtDeath: number[]
  targetShares: number[]
  topKills: number
  secondKills: number
  topShare: number
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
}
function median(values: number[]): number | null {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
function stat(values: number[], digits = 2): string {
  const m = mean(values)
  const med = median(values)
  return m === null ? '—' : `${m.toFixed(digits)} / ${med!.toFixed(digits)}`
}

function runMatch(seed: number): MatchResult {
  const room = new Room({ rules: upgradeRules({ bots: true, minPlayers: 1, countdownTicks: 1 }), seed })
  room.botsEnabled = true
  room.createBot = () => new UpgradeBot()
  room.startRound()

  const previousAlive = new Map<number, boolean>()
  const previousKills = new Map<number, number>()
  const spawnAt = new Map<number, number>()
  for (const p of room.players.values()) {
    previousAlive.set(p.id, p.alive)
    previousKills.set(p.id, p.stats.kills)
    spawnAt.set(p.id, 0)
  }

  let firstKillTick: number | null = null
  let deaths = 0
  let spawnDeaths = 0
  const tierAtDeath: number[] = []
  const targetShares: number[] = []

  // Read the tier before the room resets it. Polling after tick() sees tier 0.
  const originalDie = room.die.bind(room)
  room.die = (p, cause, attacker) => {
    deaths++
    tierAtDeath.push(p.tier)
    if (room.tickCount - (spawnAt.get(p.id) ?? 0) <= SPAWN_DEATH_TICKS) spawnDeaths++
    return originalDie(p, cause, attacker)
  }

  while (room.phase === 'playing' && room.tickCount < CAP) {
    room.tick()
    const tick = room.tickCount
    for (const p of room.players.values()) {
      const wasAlive = previousAlive.get(p.id) ?? false
      if (!wasAlive && p.alive) spawnAt.set(p.id, tick)
      previousAlive.set(p.id, p.alive)

      const kills = p.stats.kills
      if (firstKillTick === null && kills > (previousKills.get(p.id) ?? 0)) firstKillTick = tick
      previousKills.set(p.id, kills)
    }

    // Every second, count how many bots pick the same nearest player. This is
    // the dogpiling signal: 1/7 means spread out, 1.0 means everyone on one.
    if (tick % TPS === 0) {
      const alive = [...room.players.values()].filter((p) => p.alive)
      const bots = alive.filter((p) => p.brain)
      const counts = new Map<number, number>()
      for (const bot of bots) {
        let target: number | null = null
        let best = Number.POSITIVE_INFINITY
        for (const other of alive) {
          if (other.id === bot.id) continue
          const d = Math.hypot(other.x - bot.x, other.z - bot.z)
          if (d < best) { best = d; target = other.id }
        }
        if (target !== null) counts.set(target, (counts.get(target) ?? 0) + 1)
      }
      if (bots.length) targetShares.push(Math.max(0, ...counts.values()) / bots.length)
    }
  }

  const players = [...room.players.values()]
  const kills = players.map((p) => p.stats.kills).sort((a, b) => b - a)
  const totalKills = kills.reduce((a, b) => a + b, 0)
  return {
    seed,
    ticks: room.tickCount,
    seconds: Number((room.tickCount / TPS).toFixed(1)),
    ended: room.phase === 'ended',
    timedOut: room.phase === 'playing',
    winner: room.winnerName,
    totalKills,
    firstKillTick,
    deaths,
    spawnDeaths,
    tierAtDeath,
    targetShares,
    topKills: kills[0] ?? 0,
    secondKills: kills[1] ?? 0,
    topShare: totalKills ? Number(((kills[0] ?? 0) / totalKills).toFixed(3)) : 0,
  }
}

const results: MatchResult[] = []
for (let i = 0; i < matches; i++) {
  const result = runMatch(baseSeed + i)
  results.push(result)
  console.log(`match ${i + 1}/${matches}: seed ${result.seed}, ${result.seconds}s, kills ${result.totalKills}, spawn deaths ${result.spawnDeaths}/${result.deaths}, winner ${result.winner ?? 'none'}${result.timedOut ? ' (timed out)' : ''}`)
}

writeFileSync('.agents/ffa-baseline.jsonl', results.map((r) => JSON.stringify(r)).join('\n') + '\n')

const firstKills = results.flatMap((r) => (r.firstKillTick === null ? [] : [r.firstKillTick / TPS]))
const spawnRates = results.map((r) => (r.deaths ? r.spawnDeaths / r.deaths : 0))
const targetMeans = results.map((r) => (r.targetShares.length ? r.targetShares.reduce((a, b) => a + b, 0) / r.targetShares.length : 0))
const tiers = results.flatMap((r) => r.tierAtDeath)
const topShares = results.map((r) => r.topShare)
const lengths = results.map((r) => r.seconds)
const margins = results.map((r) => r.topKills - r.secondKills)
const timeouts = results.filter((r) => r.timedOut).length

const table = results.map((r, i) => `| ${i + 1} | ${r.seed} | ${r.seconds} | ${r.totalKills} | ${r.firstKillTick === null ? '—' : (r.firstKillTick / TPS).toFixed(1)} | ${r.spawnDeaths}/${r.deaths} | ${r.targetShares.length ? (r.targetShares.reduce((a, b) => a + b, 0) / r.targetShares.length).toFixed(2) : '—'} | ${r.topShare.toFixed(2)} | ${r.winner ?? (r.timedOut ? 'timeout' : '—')} |`).join('\n')

const markdown = `# FFA baseline — ${matches} bot matches

Date: ${today}. Headless, bot-only, 8 seats.
Command: \`bun scripts/ffa-observer.ts ${matches} ${baseSeed}\`.
Raw rows: \`.agents/ffa-baseline.jsonl\`.

## Method

Each match creates an Upgrade Rush room with \`bots: true, minPlayers: 1\`,
installs the real \`UpgradeBot\`, calls \`startRound()\` directly (8 bots, no human)
and ticks until the round ends at 25 kills or 10 minutes. A death is a "spawn
death" when it happens within 3 seconds of that player's last spawn. Target
concentration is sampled once per second: the share of living bots whose nearest
living player is the same target. \`1/7\` means spread; \`1.0\` means all bots
dogpile one player.

## Per match

| # | Seed | Seconds | Kills | First kill (s) | Spawn deaths | Target concentration | Top kill share | Winner |
|---|---|---|---|---|---|---|---|---|
${table}

## Aggregate

| Metric | Mean / median |
|---|---|
| Match length (s) | ${stat(lengths, 1)} |
| Time to first kill (s) | ${stat(firstKills, 1)} |
| Spawn deaths (share of deaths) | ${stat(spawnRates.map((x) => x * 100), 1)}% |
| Bot target concentration | ${stat(targetMeans, 2)} |
| Top player kill share | ${stat(topShares, 2)} |
| Tier at death | ${stat(tiers, 2)} |
| Final kill margin | ${stat(margins, 2)} |
| Timeouts | ${timeouts}/${matches} |

## Reading

- ${spawnRates.filter((x) => x > 0.1).length}/${matches} matches are above the 10% spawn-death target.
- ${targetMeans.filter((x) => x > 0.5).length}/${matches} matches average more than half the bots on one target.
- ${topShares.filter((x) => x > 0.5).length}/${matches} matches have one player taking more than half of all kills.
- ${timeouts} matches hit the 10-minute cap without reaching 25 kills.

These are baseline facts, not a verdict: Phase 1 should re-run this same command
after spawn safety and bridge cover.
`

writeFileSync('docs/FFA_BASELINE.md', markdown)
console.log(`\nbaseline written to docs/FFA_BASELINE.md`)
console.log(`length ${stat(lengths, 1)}s | first kill ${stat(firstKills, 1)}s | spawn deaths ${stat(spawnRates.map((x) => x * 100), 1)}% | target concentration ${stat(targetMeans, 2)} | top share ${stat(topShares, 2)}`)
