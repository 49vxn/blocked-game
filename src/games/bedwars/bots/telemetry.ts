import type { BotTelemetryEntry } from './types'

/** In-memory development telemetry. Do not ship the overlay to players. */
export class BotTelemetry {
  private entries: BotTelemetryEntry[] = []

  record(entry: BotTelemetryEntry): void {
    this.entries.push(entry)
    if (this.entries.length > 2000) this.entries.splice(0, this.entries.length - 2000)
  }

  all(): readonly BotTelemetryEntry[] {
    return this.entries
  }

  recent(count = 20): readonly BotTelemetryEntry[] {
    return this.entries.slice(-Math.max(1, count))
  }

  clear(): void {
    this.entries = []
  }
}
