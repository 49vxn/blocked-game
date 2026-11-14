import { TPS } from '../constants'
import type { ParkourSelf } from '../protocol'

export const PARKOUR_ROUNDS = 3
export const PARKOUR_FINISH_WINDOW = 30 * TPS
export const PARKOUR_ROUND_BREAK = 8 * TPS

export interface ParkourProgress {
  /** The next checkpoint index to touch. The start counts as checkpoint 1. */
  next: number
  startedAt: number
  finishAt: number | null
  place: number | null
  falls: number
}

export function newParkourProgress(tick: number): ParkourProgress {
  return { next: 1, startedAt: tick, finishAt: null, place: null, falls: 0 }
}

export function parkourSelf(progress: ParkourProgress, total: number, round: number): ParkourSelf {
  return {
    checkpoint: progress.next,
    total,
    startedAt: progress.startedAt,
    finishAt: progress.finishAt,
    place: progress.place,
    round,
    rounds: PARKOUR_ROUNDS,
    falls: progress.falls,
  }
}

/** `m:ss.t` for a duration in ticks. */
export function formatParkourTime(ticks: number): string {
  const seconds = Math.max(0, ticks) / TPS
  const minutes = Math.floor(seconds / 60)
  const rest = seconds - minutes * 60
  return `${minutes}:${rest.toFixed(1).padStart(4, '0')}`
}
