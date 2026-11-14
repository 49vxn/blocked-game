#!/usr/bin/env bun
/**
 * Clache three-agent workflow.
 *
 * The existing agent-task tool makes isolated copies. This adds the coordination
 * around them: slot limits, ownership planning, briefs, checks, review and a
 * serial integration gate. It never deploys or restarts the live server.
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  contractConflicts,
  parseContract,
  patternsOverlap,
  externalReviewPrompt,
  planBatch,
  reviewChanges,
  type ChangeSet,
  type Contract,
} from './workflow-lib'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const AGENT_ROOT = join(ROOT, '.agents')
const TASK_ROOT = join(ROOT, 'tasks')
const MAX_AGENTS = 3

interface Workspace {
  agent: string
  id: string
  workspace: string
  createdAt: string | null
  changes: ChangeSet
  changed: number
}

interface CheckResult {
  ok: boolean
  status: number | null
  output: string
  error?: string
}

interface ReviewReport {
  task: Contract
  changes: ChangeSet
  signature: string
  blocking: string[]
  notes: string[]
  outside: string[]
  drift: string[]
  fileConflicts: string[]
}

function fail(message: string): never {
  console.error(`error: ${message}`)
  process.exit(1)
}

function run(command: string, args: string[], cwd = ROOT, timeoutMs = 300_000, input?: string): CheckResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    timeout: timeoutMs,
    ...(input === undefined ? {} : { input }),
  })
  return {
    ok: result.status === 0 && !result.error,
    status: result.status,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
    error: result.error?.message,
  }
}

function agentTask(args: string[], cwd = ROOT): CheckResult {
  return run('bun', ['scripts/agent-task.mjs', ...args], cwd)
}

function readContracts(): Contract[] {
  if (!existsSync(TASK_ROOT)) return []
  return readdirSync(TASK_ROOT)
    .filter((name) => /^\d{4}-.+\.md$/.test(name))
    .sort()
    .map((name) => {
      const id = name.slice(0, -3)
      return parseContract(id, readFileSync(join(TASK_ROOT, name), 'utf8'), `tasks/${name}`)
    })
}

function contractFor(id: string): Contract {
  const path = join(TASK_ROOT, `${id}.md`)
  if (!existsSync(path)) fail(`missing contract: tasks/${id}.md`)
  return parseContract(id, readFileSync(path, 'utf8'), `tasks/${id}.md`)
}

function workspaces(): Workspace[] {
  const result = agentTask(['list', '--json'])
  if (!result.ok) fail(`agent-task list failed\n${result.output}`)
  try {
    return JSON.parse(result.output) as Workspace[]
  } catch {
    fail(`agent-task list returned invalid JSON\n${result.output}`)
  }
}

function workspaceStatus(agent: string, id: string): Workspace {
  const result = agentTask(['status', agent, id, '--json'])
  if (!result.ok) fail(`no readable workspace for ${agent}/${id}\n${result.output}`)
  try {
    return JSON.parse(result.output) as Workspace
  } catch {
    fail(`agent-task status returned invalid JSON\n${result.output}`)
  }
}

function workspacePath(agent: string, id: string): string {
  return join(AGENT_ROOT, agent, id, 'workspace')
}

function workspaceDir(agent: string, id: string): string {
  return join(AGENT_ROOT, agent, id)
}

function requireWorkspace(agent: string, id: string): Workspace {
  if (!existsSync(workspacePath(agent, id))) {
    fail(`no workspace for ${agent}/${id}; run: bun run workflow start ${agent} ${id}`)
  }
  return workspaceStatus(agent, id)
}

function activeContracts(all: Contract[], active: Workspace[]): Contract[] {
  return active.map((workspace) => {
    const known = all.find((task) => task.id === workspace.id)
    return known ?? contractFor(workspace.id)
  })
}

function changedFiles(changes: ChangeSet): string[] {
  return [...changes.added, ...changes.modified, ...changes.removed]
}

function hashFile(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function signature(workspace: string, changes: ChangeSet): string {
  const hash = createHash('sha256')
  for (const path of [...changes.added, ...changes.modified].sort()) {
    hash.update(`changed:${path}:`)
    const file = join(workspace, path)
    hash.update(existsSync(file) ? hashFile(file) : 'missing')
    hash.update('\n')
  }
  for (const path of [...changes.removed].sort()) hash.update(`removed:${path}\n`)
  return hash.digest('hex')
}

function blockedByForbidden(task: Contract, changes: ChangeSet): string[] {
  const out: string[] = []
  for (const path of changedFiles(changes)) {
    const name = basename(path)
    if (task.forbidden.some((rule) => rule === path || rule === name || path.endsWith(`/${rule}`))) {
      out.push(`forbidden by the contract: ${path}`)
    }
  }
  return out
}

function reviewWorkspace(agent: string, id: string): ReviewReport {
  const status = requireWorkspace(agent, id)
  const task = contractFor(id)
  const base = reviewChanges(task, status.changes)
  const blocking = [...base.blocking, ...blockedByForbidden(task, status.changes)]
  const drift: string[] = []
  const baselinePath = join(workspaceDir(agent, id), 'baseline.json')
  if (existsSync(baselinePath)) {
    try {
      const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as {
        files?: Record<string, string>
      }
      const files = baseline.files ?? {}
      for (const path of [...status.changes.added, ...status.changes.modified]) {
        const mainFile = join(ROOT, path)
        const original = files[path]
        if (path in files) {
          if (!existsSync(mainFile) || hashFile(mainFile) !== original) {
            drift.push(`main checkout changed since this workspace was created: ${path}`)
          }
        } else if (existsSync(mainFile)) {
          drift.push(`new file already exists in the main checkout: ${path}`)
        }
      }
    } catch {
      drift.push('baseline.json is unreadable; cannot check main-checkout drift')
    }
  } else {
    drift.push('baseline.json is missing; cannot check main-checkout drift')
  }
  const fileConflicts: string[] = []
  const mine = new Set(changedFiles(status.changes))
  for (const other of workspaces()) {
    if (other.agent === agent && other.id === id) continue
    for (const path of changedFiles(other.changes)) {
      if (mine.has(path)) fileConflicts.push(`${path} is also changed by ${other.agent}/${other.id}`)
    }
  }
  return {
    task,
    changes: status.changes,
    signature: signature(workspacePath(agent, id), status.changes),
    blocking: [...new Set([...blocking, ...drift, ...fileConflicts])],
    notes: base.notes,
    outside: base.outside,
    drift,
    fileConflicts,
  }
}

function printReview(report: ReviewReport, agent: string, id: string): void {
  console.log(`Review: ${agent}/${id} (${report.task.title})`)
  console.log(`Changed: ${changedFiles(report.changes).length}`)
  if (report.notes.length) console.log(`Notes:\n${report.notes.map((line) => `  - ${line}`).join('\n')}`)
  if (report.blocking.length) {
    console.log(`Blocking:\n${report.blocking.map((line) => `  - ${line}`).join('\n')}`)
  } else {
    console.log('Blocking: none')
  }
  console.log(`Result: ${report.blocking.length ? 'REJECT' : 'PASS'}`)
}

function briefText(agent: string, task: Contract): string {
  return `# Brief — ${task.id}

Agent: ${agent}
Contract: ${task.source}
Workspace: .agents/${agent}/${task.id}/workspace
Status: ${task.status}

Work only inside the workspace and only in these paths:

${task.allowed.map((path) => `- ${path}`).join('\n')}

Rules:
- Read AGENT.md, HANDOFF.md, AGENTS.md and the contract before editing.
- Test first; do not weaken an assertion to get green.
- Do not touch package.json, lockfiles, build config or another agent's folder.
- Do not run apply, clean, integrate, deploy or restart the live server.
- Keep the engine/game boundary intact.

Checks:
\`\`\`bash
cd .agents/${agent}/${task.id}/workspace
bun run typecheck
bun test
\`\`\`

Report in this order: task, status, files, commands with pass/fail, what was
verified, what was not, and known risks.
`
}

function promptText(agent: string, task: Contract): string {
  return `Read AGENT.md, HANDOFF.md, AGENTS.md and ${task.source}.
You are ${agent}. Work only in .agents/${agent}/${task.id}/workspace and only in
the paths the contract allows. Follow the test-first steps. Do not apply the
diff. Report the task id, files, exact commands with pass/fail, what you
verified, what you did not, and any risks.`
}

function writeBrief(agent: string, task: Contract): string {
  const dir = workspaceDir(agent, task.id)
  mkdirSync(dir, { recursive: true })
  const path = join(dir, 'BRIEF.md')
  writeFileSync(path, `${briefText(agent, task)}\n\n## Session prompt\n\n${promptText(agent, task)}\n`)
  return path
}

function cmdStatus(): void {
  const tasks = readContracts()
  const active = workspaces()
  const agents = [...new Set(active.map((workspace) => workspace.agent))]
  console.log(`Clache workflow — ${agents.length}/${MAX_AGENTS} agent slots active`)
  console.log('The live server is not touched by this tool.\n')
  if (!active.length) {
    console.log('Active: none')
  } else {
    console.log('Active:')
    for (const workspace of active) {
      const task = tasks.find((entry) => entry.id === workspace.id)
      if (!task) {
        console.log(`  ${workspace.agent.padEnd(12)} ${workspace.id.padEnd(30)} ${workspace.changed} changed (missing contract)`)
        continue
      }
      const report = reviewChanges(task, workspace.changes)
      const verdict = report.blocking.length ? `${report.blocking.length} blocking` : 'scope clean'
      console.log(`  ${workspace.agent.padEnd(12)} ${workspace.id.padEnd(30)} ${String(workspace.changed).padStart(2)} changed  ${verdict}`)
    }
  }
  const conflicts = contractConflicts(activeContracts(tasks, active))
  console.log(`\nOwnership conflicts: ${conflicts.length ? '' : 'none'}`)
  for (const conflict of conflicts) {
    console.log(`  ${conflict.a} vs ${conflict.b}: ${conflict.paths.join(', ')}`)
  }
  const activeIds = new Set(active.map((workspace) => workspace.id))
  const ready = tasks.filter((task) => task.status === 'ready' && !activeIds.has(task.id))
  console.log(`\nReady, not active: ${ready.length ? '' : 'none'}`)
  for (const task of ready) console.log(`  ${task.id.padEnd(32)} ${task.owner}`)
  console.log('\nNext: bun run workflow plan')
}

function cmdPlan(): void {
  const tasks = readContracts()
  const active = workspaces()
  const activeTasks = activeContracts(tasks, active)
  const plan = planBatch(tasks, activeTasks, MAX_AGENTS)
  const usedAgents = new Set(active.map((workspace) => workspace.agent))
  const names = ['worker1', 'worker2', 'research1']
  console.log(`Workflow plan — ${usedAgents.size}/${MAX_AGENTS} slots in use\n`)
  if (!plan.selected.length) {
    console.log('No ready contract can start without overlapping active work.')
  } else {
    let cursor = 0
    for (const task of plan.selected) {
      while (cursor < names.length && usedAgents.has(names[cursor])) cursor++
      const agent = names[cursor] ?? 'worker'
      usedAgents.add(agent)
      console.log(`${agent.padEnd(12)} ${task.id}`)
      console.log(`  ${task.source} — ${task.title}`)
      console.log(`  bun run workflow start ${agent} ${task.id}`)
    }
  }
  if (plan.skipped.length) {
    console.log('\nNot selected:')
    for (const entry of plan.skipped) console.log(`  ${entry.id}: ${entry.reason}`)
  }
  const free = MAX_AGENTS - usedAgents.size
  if (free > 0) console.log(`\n${free} slot(s) left for a read-only researcher or reviewer; that agent gets no workspace.`)
  console.log('\nRules: one writer per file; integrate serially; no agent deploys.')
}

function cmdStart(agent: string, id: string): void {
  const task = contractFor(id)
  if (task.status !== 'ready') fail(`${id} is ${task.status}; a worker needs a ready contract`)
  const active = workspaces()
  const agents = new Set(active.map((workspace) => workspace.agent))
  if (agents.has(agent)) fail(`${agent} already has an active workspace; finish or clean it first`)
  const sameTask = active.find((workspace) => workspace.id === id)
  if (sameTask) fail(`${id} is already active under ${sameTask.agent}`)
  if (agents.size >= MAX_AGENTS) fail(`all ${MAX_AGENTS} agent slots are in use; review and integrate first`)
  const activeTasks = activeContracts(readContracts(), active)
  const conflicts = activeTasks
    .map((other) => {
      const paths: string[] = []
      for (const left of task.allowed) {
        for (const right of other.allowed) {
          if (!left || !right) continue
          if (patternsOverlap(left, right)) paths.push(left)
        }
      }
      return { other, paths }
    })
    .filter((entry) => entry.paths.length)
  if (conflicts.length) {
    fail(
      `ownership conflict before creating a workspace:\n${conflicts
        .map((entry) => `  ${entry.other.id}: ${entry.paths.join(', ')}`)
        .join('\n')}`,
    )
  }
  const created = agentTask(['new', agent, id])
  if (!created.ok) fail(`could not create the workspace\n${created.output}`)
  process.stdout.write(created.output)
  const brief = writeBrief(agent, task)
  console.log(`Brief: .agents/${agent}/${id}/BRIEF.md`)
  console.log(`\nPaste this into the ${agent} session:\n`)
  console.log(promptText(agent, task))
  console.log(`\nAfter the worker stops:\n  bun run workflow check ${agent} ${id}\n  bun run workflow review ${agent} ${id}`)
  console.log(`  bun run workflow integrate ${agent} ${id} --yes`)
  console.log(`Keep the brief: ${brief}`)
}

function cmdBrief(agent: string, id: string): void {
  const task = contractFor(id)
  if (!existsSync(workspacePath(agent, id))) fail(`no workspace for ${agent}/${id}`)
  const path = writeBrief(agent, task)
  console.log(`Wrote .agents/${agent}/${id}/BRIEF.md\n`)
  console.log(promptText(agent, task))
  console.log(`\n${path}`)
}

function cmdCheck(agent: string, id: string): void {
  const status = requireWorkspace(agent, id)
  const ws = workspacePath(agent, id)
  console.log(`Checking ${agent}/${id} in ${ws}`)
  const typecheck = run('bun', ['run', 'typecheck'], ws)
  const tests = run('bun', ['test', '--max-concurrency', '1', '--timeout', '10000'], ws)
  const log = [
    `# ${agent}/${id} — ${new Date().toISOString()}`,
    '',
    '$ bun run typecheck',
    typecheck.output,
    `exit: ${typecheck.status}`,
    '',
    '$ bun test --max-concurrency 1 --timeout 10000',
    tests.output,
    `exit: ${tests.status}`,
  ].join('\n')
  writeFileSync(join(workspaceDir(agent, id), 'check.log'), log)
  const result = {
    at: new Date().toISOString(),
    signature: signature(ws, status.changes),
    typecheck: { ok: typecheck.ok, status: typecheck.status },
    test: { ok: tests.ok, status: tests.status },
    ok: typecheck.ok && tests.ok,
  }
  writeFileSync(join(workspaceDir(agent, id), 'checks.json'), `${JSON.stringify(result, null, 2)}\n`)
  console.log(`typecheck: ${typecheck.ok ? 'pass' : 'FAIL'} (exit ${typecheck.status})`)
  console.log(`tests:     ${tests.ok ? 'pass' : 'FAIL'} (exit ${tests.status})`)
  if (!result.ok) {
    console.log('\nLast output:')
    console.log(`${typecheck.ok ? '' : typecheck.output}\n${tests.ok ? '' : tests.output}`.trim().split('\n').slice(-18).join('\n'))
    console.log(`\nFull log: .agents/${agent}/${id}/check.log`)
    process.exit(1)
  }
  console.log(`Fresh signature: ${result.signature.slice(0, 12)}`)
  console.log('Now: bun run workflow review ' + agent + ' ' + id)
}

function cmdReview(agent: string, id: string): void {
  const report = reviewWorkspace(agent, id)
  printReview(report, agent, id)
  writeFileSync(
    join(workspaceDir(agent, id), 'review.json'),
    `${JSON.stringify(
      {
        agent,
        id,
        at: new Date().toISOString(),
        signature: report.signature,
        changes: report.changes,
        blocking: report.blocking,
        notes: report.notes,
        outside: report.outside,
        drift: report.drift,
        fileConflicts: report.fileConflicts,
      },
      null,
      2,
    )}\n`,
  )
  if (report.blocking.length) process.exit(1)
  console.log(`Fresh signature: ${report.signature.slice(0, 12)}`)
  console.log('Now: bun run workflow check ' + agent + ' ' + id)
}


function cmdReviewExternal(agent: string, id: string, printOnly: boolean): void {
  const status = requireWorkspace(agent, id)
  const report = reviewWorkspace(agent, id)
  if (report.blocking.length) {
    printReview(report, agent, id)
    fail('mechanical review has blocking findings; nothing sent for external review')
  }
  const checksPath = join(workspaceDir(agent, id), 'checks.json')
  if (!existsSync(checksPath)) fail('no checks.json; run workflow check first')
  const checks = JSON.parse(readFileSync(checksPath, 'utf8')) as { ok?: boolean; signature?: string }
  if (!checks.ok) fail('the last workspace check failed; fix it before external review')
  if (checks.signature !== report.signature) fail('files changed after the last check; rerun workflow check')
  const files = changedFiles(status.changes)
  const contents = files.map((path) => {
    const file = join(workspacePath(agent, id), path)
    if (!existsSync(file)) return { path, text: '(file is missing from the workspace)' }
    const size = statSync(file).size
    if (size > 120_000) return { path, text: `(omitted: ${size} bytes; inspect this file manually)` }
    return { path, text: readFileSync(file, 'utf8') }
  })
  const prompt = externalReviewPrompt(report.task, agent, files, workspacePath(agent, id), contents)
  if (printOnly) {
    console.log(prompt)
    return
  }
  const out = join(workspaceDir(agent, id), 'external-review.md')
  // Pass the prompt on stdin. On Windows `bun` is a .cmd shim and cmd.exe cannot
  // safely carry a multi-line prompt containing its special characters as argv.
  const result = run('bun', ['scripts/opencode-review.ts', '--out', out], ROOT, 660_000, prompt)
  const receipt = {
    at: new Date().toISOString(),
    agent,
    id,
    signature: report.signature,
    ok: result.ok,
    status: result.status,
    error: result.error ?? null,
    file: out,
    output: result.output.slice(-4000),
  }
  writeFileSync(join(workspaceDir(agent, id), 'external-review.json'), `${JSON.stringify(receipt, null, 2)}\n`)
  if (!result.ok) fail(`external review failed; see .agents/${agent}/${id}/external-review.json\n${result.output.slice(-1200)}`)
  console.log(`External review: .agents/${agent}/${id}/external-review.md`)
  console.log('This is advisory. Read it, then run workflow integrate separately.')
}

function cmdIntegrate(agent: string, id: string, yes: boolean): void {
  const status = requireWorkspace(agent, id)
  const report = reviewWorkspace(agent, id)
  if (report.blocking.length) {
    printReview(report, agent, id)
    fail('review has blocking findings; nothing applied')
  }
  const checksPath = join(workspaceDir(agent, id), 'checks.json')
  if (!existsSync(checksPath)) fail('no checks.json; run workflow check first')
  const checks = JSON.parse(readFileSync(checksPath, 'utf8')) as { ok?: boolean; signature?: string }
  if (!checks.ok) fail('the last workspace check failed; fix it before integrating')
  if (checks.signature !== report.signature) fail('files changed after the last check; rerun workflow check')
  if (!yes) {
    console.log(`Ready to integrate ${agent}/${id} (${changedFiles(status.changes).length} files).`)
    console.log('Dry run only. Re-run with --yes to copy into the main checkout.')
    const preview = agentTask(['apply', agent, id])
    if (preview.output) console.log(preview.output)
    return
  }
  const applied = agentTask(['apply', agent, id, '--yes'])
  process.stdout.write(applied.output)
  if (!applied.ok) fail('agent-task apply failed')
  console.log('\nRunning the main-checkout regression gate...')
  const typecheck = run('bun', ['run', 'typecheck'])
  const tests = run('bun', ['test', '--max-concurrency', '1', '--timeout', '10000'])
  if (!typecheck.ok || !tests.ok) {
    console.log(typecheck.output)
    console.log(tests.output)
    console.error('\nREGRESSION: the applied change failed the main checkout gate.')
    console.error(`Backup: .agents/${agent}/${id}/backup/ (restore the affected files manually).`)
    process.exit(1)
  }
  console.log('typecheck: pass')
  console.log('tests:     pass')
  console.log('\nIntegrated. Update tasks/README.md status and the task completion report.')
  console.log('Build and restart are separate integrator steps; this tool did not deploy.')
}

function usage(): void {
  console.log(`Clache workflow — manage up to ${MAX_AGENTS} agents

  bun run workflow status
  bun run workflow plan
  bun run workflow start <agent> <task-id>
  bun run workflow brief <agent> <task-id>
  bun run workflow check <agent> <task-id>
  bun run workflow review <agent> <task-id>
  bun run workflow review-external <agent> <task-id> [--print]
  bun run workflow integrate <agent> <task-id> [--yes]

Contracts live in tasks/<task-id>.md. Workspaces live in
.agents/<agent>/<task-id>/workspace. Integration is serial and backs up files.`)
}

const args = process.argv.slice(2)
const flags = new Set(args.filter((arg) => arg.startsWith('--')))
const positional = args.filter((arg) => !arg.startsWith('--'))
const [command, first, second] = positional
const yes = flags.has('--yes')

try {
  switch (command) {
    case 'status':
      cmdStatus()
      break
    case 'plan':
      cmdPlan()
      break
    case 'start':
      if (!first || !second) fail('usage: workflow start <agent> <task-id>')
      cmdStart(first, second)
      break
    case 'brief':
      if (!first || !second) fail('usage: workflow brief <agent> <task-id>')
      cmdBrief(first, second)
      break
    case 'check':
      if (!first || !second) fail('usage: workflow check <agent> <task-id>')
      cmdCheck(first, second)
      break
    case 'review':
      if (!first || !second) fail('usage: workflow review <agent> <task-id>')
      cmdReview(first, second)
      break
    case 'review-external':
      if (!first || !second) fail('usage: workflow review-external <agent> <task-id> [--print]')
      cmdReviewExternal(first, second, flags.has('--print'))
      break
    case 'integrate':
      if (!first || !second) fail('usage: workflow integrate <agent> <task-id> [--yes]')
      cmdIntegrate(first, second, yes)
      break
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      usage()
      break
    default:
      fail(`unknown command "${command}"`)
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error))
}
