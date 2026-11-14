import { BOT_LEVELS, type BotLevel } from '../rules'

/** How often the FFA director samples human performance. */
export const FFA_DIFFICULTY_INTERVAL = 5 * 20
/** Minimum time between difficulty changes, so a single death does not flip it. */
export const FFA_DIFFICULTY_COOLDOWN = 10 * 20

export interface FfaHumanStat {
  kills: number
  deaths: number
  tier: number
}

export interface FfaDifficultyInput {
  current: BotLevel
  humans: FfaHumanStat[]
  tick: number
  lastChangeTick: number
}

/** One step easier, clamped at easy. */
export function easierBotLevel(level: BotLevel): BotLevel {
  return BOT_LEVELS[Math.max(0, BOT_LEVELS.indexOf(level) - 1)]
}

/** One step harder, clamped at expert. */
export function harderBotLevel(level: BotLevel): BotLevel {
  return BOT_LEVELS[Math.min(BOT_LEVELS.length - 1, BOT_LEVELS.indexOf(level) + 1)]
}

/**
 * Pick the next FFA bot level from the humans' results.
 *
 * The room samples every five seconds, but a change needs a ten-second
 * cooldown. A human who is dying more than killing gets relief first; only
 * when nobody is struggling does a dominant human raise the bots. That keeps a
 * losing player from being punished by a harder lobby.
 */
export function ffaBotLevel(input: FfaDifficultyInput): BotLevel {
  const { current, humans, tick, lastChangeTick } = input
  if (humans.length === 0) return current
  if (tick - lastChangeTick < FFA_DIFFICULTY_COOLDOWN) return current

  const struggling = humans.some((h) => h.deaths - h.kills >= 3 || (h.deaths >= 4 && h.tier <= 1))
  if (struggling) return easierBotLevel(current)

  const dominant = humans.some((h) => h.kills - h.deaths >= 3 || h.tier >= 6)
  if (dominant) return harderBotLevel(current)

  return current
}
