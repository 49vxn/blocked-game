import { TEAM_NAMES, type TeamId } from '../blocks'
import { TPS } from '../constants'
import type { Resource } from '../items'
import { OFFERS, type TeamUpgrades } from '../shop'
import type { BotGoal, BotIntent, BotPerception, BotTierProfile, PerceivedEnemy } from './types'
import { nextTeamUpgrade } from './economy'
import type { BedInfo, WorldModel, WorldNode, WorldPoint } from './worldModel'

/**
 * Extra information the room already has but `BotPerception` does not carry.
 * Everything here is optional: the planner falls back to a conservative read
 * when the integrator has not wired it yet.
 */
export interface PlannerContext {
  /** Resources in the bot's inventory, by item id. */
  resources?: Partial<Record<Resource, number>>
  /** Blocks carried, for reserve and first-rush decisions. */
  blocks?: number
  /** How many teammates are close enough to help. */
  teammatesNearby?: number
  /** Goals teammates have already committed to, when the room can expose them. */
  teammateGoals?: readonly BotGoal[]
  /** The team's purchased upgrades, for the upgrade goal. */
  teamUpgrades?: Partial<TeamUpgrades>
}

export interface PlannerOptions {
  seed?: number
  /** Goal re-evaluation cadence in ticks; the contract asks for 10-20. */
  replanTicks?: number
}

export interface GoalScore {
  goal: BotGoal
  score: number
  reason: string
  targetId: number | null
  /** Not part of the frozen `BotIntent`; useful for telemetry and tests. */
  targetTeam: TeamId | null
}

export interface PlannerDecision extends GoalScore {
  tick: number
  switched: boolean
  evaluated: boolean
}

interface Eval {
  perception: BotPerception
  profile: BotTierProfile
  context: PlannerContext
  self: BotPerception['self']
  health: number
  wealth: number
  blocks: number
  resources: Partial<Record<Resource, number>>
  ownBed: BedInfo | null
  ownBase: WorldNode | null
  distToBase: number
  known: PerceivedEnemy[]
  nearest: PerceivedEnemy | null
  pressure: number
  pressureEnemy: PerceivedEnemy | null
  enemyBeds: BedInfo[]
  targetBed: BedInfo | null
}

const GOALS: BotGoal[] = ['gather', 'shop', 'upgrade', 'defend', 'guard', 'raid', 'thirdParty', 'retreat', 'regroup', 'escape', 'breakBed']
const REPLAN_TICKS = 12

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function round(value: number, scale = 10000): number {
  return Math.round(value * scale) / scale + 0
}

function distance(a: WorldPoint, b: WorldPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}

function canAfford(cost: { resource: Resource; amount: number }[], resources: Partial<Record<Resource, number>>): boolean {
  return cost.every((part) => (resources[part.resource] ?? 0) >= part.amount)
}

/**
 * Utility planner: scores all goals from perception plus the world model,
 * then holds the chosen goal for a commitment window and demands a margin
 * before switching. It never reads `room.players`; enemies come only from
 * `BotPerception`, so expired memory cannot turn into a target.
 */
export class UtilityPlanner {
  private readonly world: WorldModel
  private readonly seed: number
  private readonly replanTicks: number
  private intent: PlannerDecision | null = null
  private goalSince = 0
  private lastEvaluateTick = Number.NEGATIVE_INFINITY
  private lastEventKey = ''

  constructor(world: WorldModel, options: PlannerOptions = {}) {
    this.world = world
    this.seed = options.seed ?? 1
    this.replanTicks = Math.max(10, Math.min(20, options.replanTicks ?? REPLAN_TICKS))
  }

  choose(perception: BotPerception, profile: BotTierProfile, context: PlannerContext = {}): BotIntent {
    const tick = perception.tick
    const eventKey = this.eventKey(perception, profile, context)
    const majorEvent = this.intent !== null && eventKey !== this.lastEventKey
    const due = this.intent === null || tick - this.lastEvaluateTick >= this.replanTicks || majorEvent || tick < this.lastEvaluateTick

    if (due) {
      const scores = this.evaluateAll(perception, profile, context)
      const best = scores[0]
      if (!this.intent) {
        this.commit(best, tick, true)
      } else {
        const current = this.scoreFor(this.intent, scores)
        if (this.shouldSwitch(current, best, profile, tick)) {
          this.commit(best, tick, true)
        } else {
          this.intent = {
            ...(current ?? this.intent),
            tick,
            switched: false,
            evaluated: true,
          }
        }
      }
      this.lastEvaluateTick = tick
    }

    this.lastEventKey = eventKey
    const decision = this.intent!
    return { goal: decision.goal, targetId: decision.targetId, reason: decision.reason, score: round(decision.score) }
  }

  lastDecision(): PlannerDecision | null {
    return this.intent ? { ...this.intent } : null
  }

  /** Pure scoring pass; useful for tuning, telemetry and tests. Does not change the committed goal. */
  evaluateAll(perception: BotPerception, profile: BotTierProfile, context: PlannerContext = {}): GoalScore[] {
    const e = this.prepare(perception, profile, context)
    const scores = GOALS.map((goal) => this.scoreGoal(goal, e))
    return scores.sort((a, b) => b.score - a.score || GOALS.indexOf(a.goal) - GOALS.indexOf(b.goal))
  }

  private prepare(perception: BotPerception, profile: BotTierProfile, context: PlannerContext): Eval {
    const self = perception.self
    const resources = context.resources ?? {}
    const ownBed = this.world.bed(self.team)
    const ownBase = this.world.baseNode(self.team)
    const known = this.validEnemies(perception, profile)
    const pressure = ownBed ? this.bedPressure(perception, ownBed, known) : { pressure: 0, enemy: null }
    const enemyBeds = this.world.exposedBeds(self.team)
    return {
      perception,
      profile,
      context,
      self,
      health: Math.max(0, Math.min(20, self.health)),
      wealth: (resources.emerald ?? 0) * 3 + (resources.diamond ?? 0) * 2 + (resources.gold ?? 0) * 0.15 + (resources.iron ?? 0) * 0.02,
      blocks: Math.max(0, context.blocks ?? 0),
      resources,
      ownBed,
      ownBase,
      distToBase: ownBase ? distance(self, ownBase) : Number.POSITIVE_INFINITY,
      known,
      nearest: known[0] ?? null,
      pressure: pressure.pressure,
      pressureEnemy: pressure.enemy,
      enemyBeds,
      targetBed: enemyBeds[0] ?? null,
    }
  }

  private scoreGoal(goal: BotGoal, e: Eval): GoalScore {
    switch (goal) {
      case 'gather':
        return this.gatherScore(e)
      case 'shop':
        return this.shopScore(e)
      case 'upgrade':
        return this.upgradeScore(e)
      case 'defend':
        return this.defendScore(e)
      case 'guard':
        return this.guardScore(e)
      case 'raid':
        return this.raidScore(e)
      case 'thirdParty':
        return this.thirdPartyScore(e)
      case 'retreat':
        return this.retreatScore(e)
      case 'regroup':
        return this.regroupScore(e)
      case 'escape':
        return this.escapeScore(e)
      case 'breakBed':
        return this.breakBedScore(e)
    }
  }

  private gatherScore(e: Eval): GoalScore {
    if (!e.ownBase || !e.ownBed) return this.none('gather', 'no home base on this map')
    const route = this.world.route(e.self, e.ownBase)
    const short = Math.max(0, e.profile.blockReserve - e.blocks)
    const atBase = e.distToBase < 14
    const expected = short > 0 ? 0.9 + Math.min(0.4, short / 32) : e.ownBed.alive ? 0.16 : 0.3
    const risk = 0.12 + route.danger * 0.45
    const time = 1 + route.cost / 20 + e.distToBase / 60
    const survivalScale = e.health <= 9 ? 0.35 : 1
    const bedlessScale = e.ownBed.alive ? 1 : 0.6
    const score = ((expected * 0.7) / (risk * time) + (atBase ? 0.1 : 0)) * survivalScale * bedlessScale + this.bias('gather', e.profile)
    return {
      goal: 'gather',
      score: round(score),
      reason: short > 0 ? `gather ${Math.ceil(short)} more blocks for the reserve` : 'top up resources at the forge',
      targetId: null,
      targetTeam: null,
    }
  }

  private shopScore(e: Eval): GoalScore {
    if (!e.ownBase || e.health <= 9 || e.distToBase > 18) return this.none('shop', 'not safe to shop')
    const affordable = OFFERS.some(
      (offer) =>
        offer.category !== 'potions' &&
        offer.category !== 'utility' &&
        canAfford(offer.cost, e.resources),
    )
    if (!affordable) return this.none('shop', 'nothing affordable')
    const route = this.world.route(e.self, e.ownBase)
    const risk = 0.1 + route.danger * 0.4
    const score = (0.55 * 0.8) / (risk * 1.15) + this.bias('shop', e.profile)
    return { goal: 'shop', score: round(score), reason: 'spend resources at the shop', targetId: null, targetTeam: null }
  }

  private upgradeScore(e: Eval): GoalScore {
    if (!e.ownBase || e.health <= 9 || e.distToBase > 18) return this.none('upgrade', 'not safe to upgrade')
    const next = nextTeamUpgrade(e.context.teamUpgrades)
    if (!next) return this.none('upgrade', 'all team upgrades complete')
    const diamonds = e.resources.diamond ?? 0
    if (diamonds < next.cost) return this.none('upgrade', `save ${next.cost - diamonds} more diamonds for ${next.id}`)
    const route = this.world.route(e.self, e.ownBase)
    const risk = 0.1 + route.danger * 0.4
    const score = (0.85 * 0.75) / (risk * 1.1) + this.bias('upgrade', e.profile)
    return {
      goal: 'upgrade',
      score: round(score),
      reason: `team ${next.id} level ${next.level} (${next.cost} diamonds)`,
      targetId: null,
      targetTeam: null,
    }
  }

  private defendScore(e: Eval): GoalScore {
    if (!e.ownBed || !e.ownBed.alive || e.pressure <= 0.05) return this.none('defend', 'home bed is quiet')
    const d = distance(e.self, e.ownBed.center)
    const expected = 0.8 + e.pressure * 0.8
    const risk = 0.2 + e.pressure * 0.5
    const time = 1 + d / 50
    const success = 0.55 + (e.health / 20) * 0.25 + e.profile.personality.commitment * 0.05
    let score = (expected * success) / (risk * time) + this.bias('defend', e.profile) + (d < 18 ? 0.15 : 0)
    if (e.context.teammateGoals?.includes('defend') && e.pressure < 0.7) score *= 0.85
    return {
      goal: 'defend',
      score: round(score),
      reason: `home bed threatened (${Math.round(e.pressure * 100)}%)`,
      targetId: e.pressureEnemy?.id ?? null,
      targetTeam: e.pressureEnemy?.team ?? null,
    }
  }

  private guardScore(e: Eval): GoalScore {
    if (!e.ownBed || !e.ownBed.alive || e.pressure <= 0.04) return this.none('guard', 'home bed is quiet')
    const d = distance(e.self, e.ownBed.center)
    const expected = 0.4 + e.pressure * 0.6
    const risk = 0.16 + e.pressure * 0.3
    const time = 1 + d / 70
    const score = (expected * 0.6) / (risk * time) + this.bias('guard', e.profile)
    return {
      goal: 'guard',
      score: round(score),
      reason: `guard the home bed (${Math.round(e.pressure * 100)}%)`,
      targetId: e.pressureEnemy?.id ?? null,
      targetTeam: e.pressureEnemy?.team ?? null,
    }
  }

  private raidScore(e: Eval): GoalScore {
    const bed = e.targetBed
    if (!bed) return this.none('raid', 'no enemy bed left to raid')
    const route = this.world.route(e.self, bed.center)
    const d = distance(e.self, bed.center)
    const atBed = d <= 6
    const expected = (atBed ? 1 : 0.65) + bed.exposure * 0.5
    const risk = 0.22 + route.danger * 0.6 + (atBed ? 0.15 : 0) + (e.perception.danger.void ? 0.2 : 0)
    const time = 1 + route.cost / 24 + d / 60
    const success = 0.45 + (e.health / 20) * 0.2 + e.profile.personality.risk * 0.12
    let score = (expected * success) / (risk * time) + this.bias('raid', e.profile) + this.jitter('raid', bed.team)
    if (e.context.teammateGoals?.includes('raid') && e.enemyBeds.length > 1) score *= 0.92
    const target = this.enemyNear(bed.center, 12, e.known)
    return {
      goal: 'raid',
      score: round(score),
      reason: `${atBed ? 'break' : 'raid'} the exposed ${TEAM_NAMES[bed.team]} bed (exposure ${Math.round(bed.exposure * 100)}%)`,
      targetId: target?.id ?? null,
      targetTeam: bed.team,
    }
  }

  private breakBedScore(e: Eval): GoalScore {
    const bed = e.targetBed
    if (!bed) return this.none('breakBed', 'no enemy bed left')
    const d = distance(e.self, bed.center)
    if (d > 6) return this.none('breakBed', 'not at the bed yet')
    const raid = this.raidScore(e)
    return {
      goal: 'breakBed',
      score: round(raid.score * 1.8 + 0.25),
      reason: `break the exposed ${TEAM_NAMES[bed.team]} bed`,
      targetId: raid.targetId,
      targetTeam: bed.team,
    }
  }

  private thirdPartyScore(e: Eval): GoalScore {
    if (e.health <= 9) return this.none('thirdParty', 'too hurt to join a fight')
    const visible = e.perception.visible.filter((enemy) => enemy.visible && this.memoryValid(enemy, e.perception, e.profile))
    let pair: [PerceivedEnemy, PerceivedEnemy] | null = null
    let closestFight = Number.POSITIVE_INFINITY
    for (let i = 0; i < visible.length; i++)
      for (let j = i + 1; j < visible.length; j++) {
        const a = visible[i]
        const b = visible[j]
        if (a.team === b.team) continue
        const separation = Math.hypot(a.x - b.x, a.z - b.z)
        if (separation > 8) continue
        const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 }
        if (distance(e.self, midpoint) > 45) continue
        if (separation < closestFight) {
          closestFight = separation
          pair = [a, b]
        }
      }
    if (!pair) return this.none('thirdParty', 'no fight in progress')
    const midpoint = { x: (pair[0].x + pair[1].x) / 2, y: (pair[0].y + pair[1].y) / 2, z: (pair[0].z + pair[1].z) / 2 }
    const route = this.world.route(e.self, midpoint)
    if (route.danger > 0.7) return this.none('thirdParty', 'approach is not safe')
    const target = distance(e.self, pair[0]) <= distance(e.self, pair[1]) ? pair[0] : pair[1]
    const expected = 0.55 + 0.3 * (1 - Math.min(1, closestFight / 12))
    const risk = 0.3 + route.danger * 0.5
    const time = 1 + route.cost / 25 + distance(e.self, midpoint) / 50
    const success = 0.5 + (1 - route.danger) * 0.2
    const score = (expected * success) / (risk * time) + this.bias('thirdParty', e.profile) + this.jitter('thirdParty', `${pair[0].id}:${pair[1].id}`)
    return {
      goal: 'thirdParty',
      score: round(score),
      reason: `third party ${TEAM_NAMES[pair[0].team]} vs ${TEAM_NAMES[pair[1].team]} ${Math.round(distance(e.self, midpoint))} blocks away`,
      targetId: target.id,
      targetTeam: target.team,
    }
  }

  private retreatScore(e: Eval): GoalScore {
    if (e.health > 9 || e.wealth < 1) return this.none('retreat', 'healthy enough to keep playing')
    const threat = e.nearest
    const threatDistance = threat ? distance(e.self, threat) : 40
    const expected = 0.75 + Math.min(1, e.wealth / 6) * 0.7 + ((10 - e.health) / 10) * 0.3
    const time = 1 + Math.min(30, threatDistance) / 30
    const success = 0.75 + (10 - e.health) / 40
    const score = (expected * success) / (0.25 * time) + this.bias('retreat', e.profile)
    return {
      goal: 'retreat',
      score: round(score),
      reason: `retreat at ${e.health} health carrying ${Math.round(e.wealth)} resources`,
      targetId: null,
      targetTeam: null,
    }
  }

  private regroupScore(e: Eval): GoalScore {
    if (!e.ownBase) return this.none('regroup', 'no home base on this map')
    const bedless = !e.ownBed?.alive
    const hurt = e.health <= 9
    if (!bedless && !hurt) return this.none('regroup', 'no reason to regroup')
    if (!bedless && e.wealth >= 1) return this.none('regroup', 'retreat with the resources instead')
    const isolated = (e.context.teammatesNearby ?? 0) === 0
    const route = this.world.route(e.self, e.ownBase)
    const expected = (bedless ? 0.65 : 0.5) + (isolated ? 0 : 0.25)
    const risk = 0.2 + route.danger * 0.5
    const time = 1 + route.cost / 25 + e.distToBase / 50
    const score = (expected * 0.65) / (risk * time) + this.bias('regroup', e.profile)
    return {
      goal: 'regroup',
      score: round(score),
      reason: bedless ? 'regroup after losing the bed' : 'heal and regroup at base',
      targetId: null,
      targetTeam: null,
    }
  }

  private escapeScore(e: Eval): GoalScore {
    if (!e.ownBed || e.ownBed.alive) return this.none('escape', 'the bed still stands')
    const isolated = (e.context.teammatesNearby ?? 0) === 0
    const threat = e.nearest
    const threatDistance = threat ? distance(e.self, threat) : 40
    const threatNear = clamp01(1 - threatDistance / 16)
    const safe = this.world.nearestSafeNode(e.self.x, e.self.y, e.self.z)
    const distSafe = safe ? distance(e.self, safe) : 30
    const expected = 0.6 + (isolated ? 0.5 : 0.15) + threatNear * 0.7 + (e.perception.danger.void ? 0.3 : 0)
    const risk = 0.35 + (e.blocks < 8 ? 0.1 : 0)
    const time = 1 + distSafe / 50
    const success = 0.6 + clamp01(1 - e.blocks / Math.max(1, e.profile.blockReserve)) * 0.15
    const score = (expected * success) / (risk * time) + this.bias('escape', e.profile) + (isolated ? 0.25 : 0)
    return {
      goal: 'escape',
      score: round(score),
      reason: `bed is gone; ${isolated ? 'isolated' : 'with teammates'} and ${threat ? `enemy ${Math.round(threatDistance)} blocks away` : 'no enemy in sight'}`,
      targetId: null,
      targetTeam: null,
    }
  }

  private bias(goal: BotGoal, profile: BotTierProfile): number {
    const p = profile.personality
    switch (goal) {
      case 'gather':
        return p.greed * 0.25 + p.patience * 0.05
      case 'shop':
        return (1 - p.greed) * 0.22
      case 'upgrade':
        return p.commitment * 0.12
      case 'defend':
        return (1 - p.aggression) * 0.35 + p.patience * 0.2
      case 'guard':
        return p.patience * 0.25 + (1 - p.aggression) * 0.1
      case 'raid':
        return p.aggression * 0.3 + p.risk * 0.15
      case 'thirdParty':
        return p.aggression * 0.25 + p.risk * 0.3
      case 'retreat':
        return (1 - p.risk) * 0.35
      case 'regroup':
        return p.patience * 0.12 + (1 - p.aggression) * 0.08
      case 'escape':
        return (1 - p.risk) * 0.2
      case 'breakBed':
        return p.build * 0.15 + p.commitment * 0.15
    }
  }

  /** Stable per-goal jitter from the seed, so two bots with one profile still differ. */
  private jitter(goal: BotGoal, target: string | number | null = null): number {
    const text = `${this.seed}:${goal}:${target ?? ''}`
    let hash = 2166136261
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i)
      hash = Math.imul(hash, 16777619)
    }
    return ((Math.abs(hash) % 1000) / 1000 - 0.5) * 0.04
  }

  private validEnemies(perception: BotPerception, profile: BotTierProfile): PerceivedEnemy[] {
    const byId = new Map<number, PerceivedEnemy>()
    const candidates = perception.threat ? [...perception.visible, ...perception.remembered, perception.threat] : [...perception.visible, ...perception.remembered]
    for (const enemy of candidates) {
      if (enemy.confidence <= 0.01 || !this.memoryValid(enemy, perception, profile)) continue
      const current = byId.get(enemy.id)
      if (!current || (!current.visible && enemy.visible) || enemy.confidence > current.confidence) byId.set(enemy.id, enemy)
    }
    return [...byId.values()].sort((a, b) => distance(perception.self, a) - distance(perception.self, b))
  }

  private memoryValid(enemy: PerceivedEnemy, perception: BotPerception, profile: BotTierProfile): boolean {
    return perception.tick - enemy.lastSeenTick <= profile.memorySeconds * TPS
  }

  private bedPressure(
    perception: BotPerception,
    bed: BedInfo,
    known: PerceivedEnemy[],
  ): { pressure: number; enemy: PerceivedEnemy | null } {
    let pressure = perception.danger.bedThreat ? 0.75 : 0
    let enemy: PerceivedEnemy | null = null
    for (const candidate of known) {
      const d = Math.hypot(candidate.x - bed.center.x, candidate.z - bed.center.z)
      if (d > 18 || Math.abs(candidate.y - bed.y) > 8) continue
      const weight = (candidate.visible ? 1 : Math.max(0.25, candidate.confidence)) * (1 - d / 18)
      if (weight > pressure) {
        pressure = weight
        enemy = candidate
      }
    }
    return { pressure: clamp01(pressure), enemy }
  }

  private enemyNear(point: WorldPoint, radius: number, known: PerceivedEnemy[]): PerceivedEnemy | null {
    let best: PerceivedEnemy | null = null
    let bestDistance = radius
    for (const enemy of known) {
      const d = Math.hypot(enemy.x - point.x, enemy.z - point.z)
      if (d <= bestDistance) {
        best = enemy
        bestDistance = d
      }
    }
    return best
  }

  private scoreFor(intent: PlannerDecision, scores: GoalScore[]): GoalScore | null {
    return scores.find((score) => score.goal === intent.goal && score.targetTeam === intent.targetTeam) ?? null
  }

  private shouldSwitch(current: GoalScore | null, best: GoalScore, profile: BotTierProfile, tick: number): boolean {
    if (!current || current.score <= 0.01) return best.score > 0
    const commitmentTicks = Math.max(1, Math.round(profile.commitmentMs / 50))
    if (tick - this.goalSince < commitmentTicks) return false
    if (best.goal === current.goal && best.targetTeam === current.targetTeam) return false
    return best.score > current.score * (1 + profile.targetSwitchMargin)
  }

  private commit(score: GoalScore, tick: number, switched: boolean): void {
    this.intent = { ...score, tick, switched, evaluated: true }
    this.goalSince = tick
  }

  private eventKey(perception: BotPerception, profile: BotTierProfile, context: PlannerContext): string {
    const ownBed = this.world.bed(perception.self.team)
    const known = this.validEnemies(perception, profile)
    const shop = OFFERS.some((offer) => canAfford(offer.cost, context.resources ?? {})) ? 1 : 0
    const ownBedState = ownBed?.alive ? 1 : 0
    const enemyBeds = this.world.exposedBeds(perception.self.team).length
    return `${ownBedState}:${perception.self.health <= 9 ? 1 : 0}:${perception.danger.bedThreat ? 1 : 0}:${known[0]?.id ?? 0}:${shop}:${enemyBeds}`
  }

  private none(goal: BotGoal, reason: string): GoalScore {
    return { goal, score: 0, reason, targetId: null, targetTeam: null }
  }
}
