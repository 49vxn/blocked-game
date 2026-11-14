import { describe, expect, test } from 'bun:test'
import { rng } from '../src/engine/random'
import { TPS } from '../src/games/bedwars/constants'
import { Bot } from '../src/games/bedwars/bots'
import { BOT_TIER_PROFILES } from '../src/games/bedwars/bots/profiles'
import type { BotTier } from '../src/games/bedwars/bots/types'
import { TestClient, sandbox } from './room-helpers'

const RAD = Math.PI / 180

function shortest(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

/** Face away from an enemy, run one fight tick, and measure the yaw step. */
function fightStep(tier: BotTier): number {
  const room = sandbox()
  const brain = new Bot('blue', rng(1), false, tier)
  const self = room.connect('Bot', null, brain)
  self.team = 'blue'
  self.alive = true
  room.teleport(self, 40.5, 20, 44.5, 0, 0)
  const enemy = new TestClient(room, 'Human')
  enemy.p.team = 'red'
  room.teleport(enemy.p, 40.5, 20, 48.5, 0, 0)
  ;(brain as any).updatePerception(room, self)
  const input = (brain as any).fight(room, self, enemy.p)
  return Math.abs(shortest(input.yaw - self.yaw)) / RAD
}

describe('bot fight aim uses the motor', () => {
  test('a 180-degree target change is capped by the tier turn rate', () => {
    for (const tier of ['easy', 'normal', 'hard', 'expert'] as const) {
      const profile = BOT_TIER_PROFILES[tier]
      const cap = profile.turnDegPerSecond / TPS
      const step = fightStep(tier)
      expect(step).toBeLessThanOrEqual(cap + 1e-6)
      expect(step).toBeGreaterThan(0)
    }
  })

  test('Easy turns more slowly than Expert in the same setup', () => {
    expect(fightStep('easy')).toBeLessThan(fightStep('expert'))
  })
})
