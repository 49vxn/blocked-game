import { describe, expect, test } from 'bun:test'
import {
  contractConflicts,
  externalReviewPrompt,
  matchesPath,
  parseContract,
  patternsOverlap,
  planBatch,
  reviewChanges,
  scopeViolations,
  type Contract,
} from '../scripts/workflow-lib'

const upgradeRush = `# Task 0011 — Upgrade Rush

Status: ready, not started.
Owner: unassigned.
Depends on: 0001-movement-feel

## Allowed paths

- \`src/games/bedwars/upgrade.ts\` (new)
- \`src/games/bedwars/maps/upgrade.ts\` (new)
- \`docs/UPGRADE_RUSH.md\`

## Test-first steps

- \`tests/upgrade.test.ts\` (new)
`

const botHumanization = `# Task 0002 — Human-like bots, phase 1

Status: backlog — start after movement is integrated
Owner: unassigned
Depends on: \`0001-movement-feel\`

## Ownership

- Workspace: \`.agents/worker1/0002-bot-humanization/\`
- Files allowed to change:
  - \`src/games/bedwars/bots.ts\`
  - \`tests/bots.test.ts\`
  - optionally \`src/games/bedwars/rules.ts\` only if a profile field must move
- Off-limits: \`room.ts\`, \`protocol.ts\`, client files, maps, package/build config.
- Shared interface owner: integrator.
`

const contract = (id: string, allowed: string[], status = 'ready'): Contract => ({
  id,
  title: id,
  status,
  owner: 'unassigned',
  dependsOn: [],
  allowed,
  forbidden: [],
  source: `tasks/${id}.md`,
})

describe('contract parsing', () => {
  test('reads status, allowed paths and ignores the test-first section', () => {
    const parsed = parseContract('0011-upgrade-rush', upgradeRush)
    expect(parsed.status).toBe('ready')
    expect(parsed.allowed).toEqual([
      'src/games/bedwars/upgrade.ts',
      'src/games/bedwars/maps/upgrade.ts',
      'docs/UPGRADE_RUSH.md',
    ])
    expect(parsed.allowed).not.toContain('tests/upgrade.test.ts')
  })

  test('reads the ownership block and stops at off-limits', () => {
    const parsed = parseContract('0002-bot-humanization', botHumanization)
    expect(parsed.status).toBe('backlog')
    expect(parsed.allowed).toContain('src/games/bedwars/rules.ts')
    expect(parsed.forbidden).toContain('room.ts')
    expect(parsed.forbidden).toContain('protocol.ts')
  })
})

describe('scope and ownership', () => {
  test('matches exact files, wildcards and directory prefixes', () => {
    expect(matchesPath('src/game/room.ts', 'src/game/room.ts')).toBe(true)
    expect(matchesPath('src/game/**/*.ts', 'src/game/client/hud.ts')).toBe(true)
    expect(matchesPath('src/game/*.ts', 'src/game/client/hud.ts')).toBe(false)
    expect(matchesPath('docs/', 'docs/STATE.md')).toBe(true)
    expect(matchesPath('src/game/room.ts', 'src/game/bots.ts')).toBe(false)
  })

  test('reports files outside the contract but normalizes separators', () => {
    const changed = ['src\\game\\room.ts', 'src/game/client/hud.ts', 'README.md']
    expect(scopeViolations(changed, ['src/game/room.ts', 'README.md'])).toEqual([
      'src/game/client/hud.ts',
    ])
  })

  test('overlaps exact files, directories and wildcards conservatively', () => {
    expect(patternsOverlap('src/game/room.ts', 'src/game/room.ts')).toBe(true)
    expect(patternsOverlap('src/game/', 'src/game/room.ts')).toBe(true)
    expect(patternsOverlap('src/game/**/*.ts', 'src/game/room.ts')).toBe(true)
    expect(patternsOverlap('src/game/room.ts', 'src/game/bots.ts')).toBe(false)
    expect(patternsOverlap('docs/', 'src/')).toBe(false)
  })

  test('finds conflicting contracts and ignores disjoint ones', () => {
    const bots = contract('0002', ['src/game/bots.ts', 'tests/bots.test.ts'])
    const rush = contract('0011', ['src/game/room.ts', 'docs/UPGRADE_RUSH.md'])
    const clash = contract('0013', ['src/game/room.ts', 'src/game/upgrade.ts'])
    expect(contractConflicts([bots, rush])).toEqual([])
    expect(contractConflicts([rush, clash])).toEqual([
      { a: '0011', b: '0013', paths: ['src/game/room.ts'] },
    ])
  })
})

describe('planning', () => {
  test('fills free slots without overlapping active work', () => {
    const active = contract('0001', ['src/game/movement.ts'])
    const bots = contract('0002', ['src/game/bots.ts'])
    const rush = contract('0011', ['src/game/room.ts'])
    const spectator = contract('0013', ['src/game/room.ts'])
    const plan = planBatch([bots, rush, spectator], [active], 3)
    expect(plan.selected.map((task) => task.id)).toEqual(['0002', '0011'])
    expect(plan.skipped).toEqual([{ id: '0013', reason: expect.stringContaining('full') }])
  })

  test('skips a contract that overlaps active work', () => {
    const active = contract('0001', ['src/game/room.ts'])
    const bots = contract('0002', ['src/game/bots.ts'])
    const rush = contract('0011', ['src/game/room.ts'])
    const plan = planBatch([bots, rush], [active], 3)
    expect(plan.selected.map((task) => task.id)).toEqual(['0002'])
    expect(plan.skipped).toEqual([{ id: '0011', reason: expect.stringContaining('0001') }])
  })

  test('does not exceed the free slot count', () => {
    const active = [contract('0001', ['a/']), contract('0002', ['b/'])]
    const plan = planBatch([contract('0003', ['c/']), contract('0004', ['d/'])], active, 3)
    expect(plan.selected.map((task) => task.id)).toEqual(['0003'])
    expect(plan.skipped).toEqual([{ id: '0004', reason: expect.stringContaining('full') }])
  })
})

describe('review', () => {
  test('blocks deletions, out-of-scope edits and generated files', () => {
    const task = contract('0011', ['src/game/upgrade.ts'])
    const review = reviewChanges(task, {
      added: ['dist/assets/app.js'],
      modified: ['src/game/client/hud.ts'],
      removed: ['src/game/room.ts'],
    })
    expect(review.blocking.join('\n')).toContain('delete')
    expect(review.blocking.join('\n')).toContain('src/game/client/hud.ts')
    expect(review.blocking.join('\n')).toContain('dist/assets/app.js')
    expect(review.outside).toEqual(['dist/assets/app.js', 'src/game/client/hud.ts', 'src/game/room.ts'])
  })

  test('passes an in-scope change and notes touched tests', () => {
    const task = contract('0002', ['src/game/bots.ts', 'tests/bots.test.ts'])
    const review = reviewChanges(task, {
      added: [],
      modified: ['src/game/bots.ts', 'tests/bots.test.ts'],
      removed: [],
    })
    expect(review.blocking).toEqual([])
    expect(review.notes.join('\n')).toContain('test')
  })

  test('blocks an empty diff and a contract with no allowed paths', () => {
    const task = contract('0014', [])
    const review = reviewChanges(task, { added: [], modified: [], removed: [] })
    expect(review.blocking.join('\n')).toContain('no allowed paths')
    expect(review.blocking.join('\n')).toContain('no changes')
  })
})

describe('external review prompt', () => {
  test('is read-only and carries contract/workspace/file context', () => {
    const task = contract('0021', ['src/game/brand.ts', 'tests/brand.test.ts'])
    const prompt = externalReviewPrompt(task, 'worker1', ['src/game/brand.ts'], '.agents/worker1/0021/workspace')
    expect(prompt).toContain('read-only code reviewer')
    expect(prompt).toContain('Do not edit')
    expect(prompt).toContain('Do not call tools')
    expect(prompt).toContain('0021')
    expect(prompt).toContain('src/game/brand.ts')
    expect(prompt).toContain('.agents/worker1/0021/workspace')
    expect(prompt).toContain('PASS')
  })

  test('inlines the changed contents so a headless reviewer needs no tools', () => {
    const task = contract('0021', ['src/game/brand.ts'])
    const prompt = externalReviewPrompt(
      task,
      'worker1',
      ['src/game/brand.ts'],
      '.agents/worker1/0021/workspace',
      [{ path: 'src/game/brand.ts', text: 'export const brand = 1' }],
    )
    expect(prompt).toContain('### src/game/brand.ts')
    expect(prompt).toContain('export const brand = 1')
    expect(prompt).toContain('Use only the information in this message')
  })
})
