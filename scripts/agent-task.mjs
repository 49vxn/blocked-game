#!/usr/bin/env node
/**
 * Isolated agent task workspaces.
 *
 * The project is not a git repository yet, so a coding agent must never edit
 * the shared checkout directly. This creates a copy of the project, links the
 * existing node_modules, records a hash baseline, and gives the integrator a
 * diff and a deliberate apply step.
 *
 * Every AI gets its own folder: .agents/<agent>/<task-id>/workspace.
 *
 * Usage:
 *   bun scripts/agent-task.mjs new <agent> <task-id>
 *   bun scripts/agent-task.mjs new <agent>/<task-id>
 *   bun scripts/agent-task.mjs list [agent]
 *   bun scripts/agent-task.mjs status <agent> <task-id>
 *   bun scripts/agent-task.mjs diff <agent> <task-id>
 *   bun scripts/agent-task.mjs apply <agent> <task-id> --yes
 *   bun scripts/agent-task.mjs clean <agent> <task-id> --yes
 *
 * The task-id must match a tasks/<task-id>.md contract. `apply` refuses
 * deletions and always backs up overwritten files first.
 */
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const AGENT_ROOT = join(ROOT, '.agents')
const TASK_ROOT = join(ROOT, 'tasks')
const EXCLUDED_TOP = new Set(['node_modules', 'dist', '.agents', '.tools', '.wrangler', '.freebuff', 'release', '.git'])
const EXCLUDED_FILE = /(^\.env|^\.dev\.vars$|\.log$|^\.DS_Store$|^Thumbs\.db$)/

const idPattern = /^[a-z0-9][a-z0-9-]{1,48}$/
const agentPattern = /^[a-z0-9][a-z0-9-]{1,31}$/

function fail(message) {
  console.error(`error: ${message}`)
  process.exit(1)
}

function taskPath(id) {
  return join(TASK_ROOT, `${id}.md`)
}

function checkId(id) {
  if (!id || !idPattern.test(id)) fail('task id must be lowercase letters, numbers and dashes (2-49 chars)')
  if (!existsSync(taskPath(id))) fail(`missing contract: tasks/${id}.md (copy tasks/TEMPLATE.md first)`)
}

function checkAgent(agent) {
  if (!agent || !agentPattern.test(agent)) fail('agent name must be lowercase letters, numbers and dashes (2-32 chars), e.g. claude')
}

/** .agents/<agent>/<task> for one isolated run. */
function agentTaskDir(agent, id) {
  return join(AGENT_ROOT, agent, id)
}

function workspacePath(agent, id) {
  return join(agentTaskDir(agent, id), 'workspace')
}

function metaPath(agent, id) {
  return join(agentTaskDir(agent, id), 'meta.json')
}

function baselinePath(agent, id) {
  return join(agentTaskDir(agent, id), 'baseline.json')
}

function toPosix(path) {
  return path.split(sep).join('/')
}

function included(rel) {
  if (!rel) return true
  const parts = toPosix(rel).split('/')
  if (EXCLUDED_TOP.has(parts[0])) return false
  if (EXCLUDED_FILE.test(parts.at(-1))) return false
  return true
}

/** Copy files one by one so the destination can live inside the source tree. */
function copyProject(src, dest) {
  mkdirSync(dest, { recursive: true })
  for (const name of readdirSync(src)) {
    const from = join(src, name)
    const rel = toPosix(relative(ROOT, from))
    if (!included(rel)) continue
    const st = lstatSync(from)
    if (st.isSymbolicLink()) continue
    if (st.isDirectory()) copyProject(from, join(dest, name))
    else if (st.isFile()) copyFileSync(from, join(dest, name))
  }
}

function hashFile(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

/** Hash every regular file in a project copy. Symlinks (node_modules) are skipped. */
function manifest(project) {
  const files = new Map()
  const visit = (dir) => {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name)
      const rel = toPosix(relative(project, abs))
      if (!included(rel)) continue
      const st = lstatSync(abs)
      if (st.isSymbolicLink()) continue
      if (st.isDirectory()) visit(abs)
      else if (st.isFile()) files.set(rel, hashFile(abs))
    }
  }
  visit(project)
  return files
}

function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return fallback
  }
}

function summary(agent, id) {
  const base = readJson(baselinePath(agent, id))
  const ws = workspacePath(agent, id)
  if (!base?.files || !existsSync(ws)) return null
  const current = manifest(ws)
  const added = []
  const removed = []
  const modified = []
  for (const rel of current.keys()) {
    if (!(rel in base.files)) added.push(rel)
    else if (base.files[rel] !== current.get(rel)) modified.push(rel)
  }
  for (const rel of Object.keys(base.files)) if (!current.has(rel)) removed.push(rel)
  return { added: added.sort(), removed: removed.sort(), modified: modified.sort() }
}

function formatList(items, label) {
  if (!items.length) return ''
  return `${label} (${items.length}):\n${items.map((x) => `  ${x}`).join('\n')}`
}

function agentReadme(agent) {
  return `# Agent: ${agent}

This folder holds isolated workspaces for **${agent}**. Each task gets its own
subfolder:

    .agents/${agent}/<task-id>/workspace

Edit only inside that workspace, and only the paths allowed by
\`tasks/<task-id>.md\`. Do not edit the shared checkout or another agent's
folder.

Start a task:

    bun scripts/agent-task.mjs new ${agent} <task-id>

Review and integration are done by the integrator:

    bun scripts/agent-task.mjs diff ${agent} <task-id>
    bun scripts/agent-task.mjs apply ${agent} <task-id> --yes
    bun scripts/agent-task.mjs clean ${agent} <task-id> --yes

Read \`AGENTS.md\` and \`docs/AGENT_WORKFLOW.md\` before you start.
`
}

function ensureAgentFolder(agent) {
  const dir = join(AGENT_ROOT, agent)
  mkdirSync(dir, { recursive: true })
  const readme = join(dir, 'README.md')
  if (!existsSync(readme)) writeFileSync(readme, agentReadme(agent))
}

function commandNew(agent, id) {
  checkAgent(agent)
  checkId(id)
  const dir = agentTaskDir(agent, id)
  const ws = workspacePath(agent, id)
  if (existsSync(dir)) fail(`.agents/${agent}/${id} already exists; use status/diff or clean it first`)
  ensureAgentFolder(agent)
  console.log(`Copying project to .agents/${agent}/${id}/workspace ...`)
  copyProject(ROOT, ws)
  let linked = true
  try {
    symlinkSync(join(ROOT, 'node_modules'), join(ws, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
  } catch (error) {
    linked = false
    console.warn(`warning: could not link node_modules (${error.message}); run bun install in the workspace`)
  }
  const files = Object.fromEntries(manifest(ws))
  writeFileSync(
    baselinePath(agent, id),
    JSON.stringify({ agent, id, createdAt: new Date().toISOString(), files }, null, 2) + '\n',
  )
  writeFileSync(
    metaPath(agent, id),
    JSON.stringify({ agent, id, task: `tasks/${id}.md`, workspace: toPosix(relative(ROOT, ws)), createdAt: new Date().toISOString() }, null, 2) + '\n',
  )
  console.log(`\nAgent: ${agent}`)
  console.log(`Workspace: .agents/${agent}/${id}/workspace`)
  console.log(`Contract:  tasks/${id}.md`)
  console.log(`Node modules: ${linked ? 'linked to the main checkout' : 'NOT linked; install before testing'}`)
  console.log('\nRules: edit only the allowed paths in the contract; run the contract checks; then:')
  console.log(`  bun scripts/agent-task.mjs diff ${agent} ${id}`)
  console.log(`  bun scripts/agent-task.mjs apply ${agent} ${id} --yes   # integrator only, after review`)
}

function workspaces(filterAgent) {
  if (!existsSync(AGENT_ROOT)) return []
  const agents = filterAgent
    ? [filterAgent]
    : readdirSync(AGENT_ROOT, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
  const found = []
  for (const agent of agents) {
    const dir = join(AGENT_ROOT, agent)
    if (!existsSync(dir)) continue
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      if (!entryIsTask(agent, name.name)) continue
      found.push({ agent, id: name.name })
    }
  }
  return found
}

function entryIsTask(agent, name) {
  return existsSync(join(AGENT_ROOT, agent, name, 'meta.json'))
}

function commandList(filterAgent, json = false) {
  if (filterAgent) checkAgent(filterAgent)
  if (!existsSync(AGENT_ROOT)) {
    if (json) console.log('[]')
    else console.log('No agent workspaces. Create one with: bun scripts/agent-task.mjs new <agent> <task-id>')
    return
  }
  const found = workspaces(filterAgent)
  if (json) {
    const rows = found.map(({ agent, id }) => {
      const meta = readJson(metaPath(agent, id), {})
      const changes = summary(agent, id) ?? { added: [], modified: [], removed: [] }
      return {
        agent,
        id,
        workspace: toPosix(relative(ROOT, workspacePath(agent, id))),
        createdAt: meta.createdAt ?? null,
        changes,
        changed: changes.added.length + changes.modified.length + changes.removed.length,
      }
    })
    console.log(JSON.stringify(rows))
    return
  }
  if (!found.length) {
    console.log(filterAgent ? `No workspaces for ${filterAgent}.` : 'No agent workspaces.')
    return
  }
  let lastAgent = null
  for (const { agent, id } of found) {
    if (agent !== lastAgent) {
      if (lastAgent !== null) console.log('')
      console.log(`${agent}/`)
      lastAgent = agent
    }
    const meta = readJson(metaPath(agent, id), {})
    const changes = summary(agent, id)
    const count = changes ? changes.added.length + changes.modified.length + changes.removed.length : 0
    console.log(`  ${id.padEnd(28)} ${String(count).padStart(3)} changed  ${meta.createdAt ?? ''}`)
  }
}

function commandStatus(agent, id, json = false) {
  checkAgent(agent)
  checkId(id)
  const ws = workspacePath(agent, id)
  if (!existsSync(ws)) fail(`no workspace for ${agent}/${id}; run new ${agent} ${id}`)
  const changes = summary(agent, id)
  if (!changes) fail(`baseline missing for ${agent}/${id}`)
  if (json) {
    console.log(JSON.stringify({ agent, id, workspace: toPosix(relative(ROOT, ws)), changes }))
    return
  }
  console.log(`Agent: ${agent}`)
  console.log(`Task: ${id}`)
  console.log(`Workspace: .agents/${agent}/${id}/workspace`)
  const total = changes.added.length + changes.modified.length + changes.removed.length
  if (!total) {
    console.log('No changes.')
    return
  }
  for (const line of [formatList(changes.modified, 'modified'), formatList(changes.added, 'added'), formatList(changes.removed, 'removed')]) {
    if (line) console.log(line)
  }
}

function isBinary(path) {
  const data = readFileSync(path).subarray(0, 8192)
  return data.includes(0)
}

function commandDiff(agent, id) {
  checkAgent(agent)
  checkId(id)
  const ws = workspacePath(agent, id)
  if (!existsSync(ws)) fail(`no workspace for ${agent}/${id}; run new ${agent} ${id}`)
  const changes = summary(agent, id)
  if (!changes) fail(`baseline missing for ${agent}/${id}`)
  const total = changes.added.length + changes.modified.length + changes.removed.length
  if (!total) {
    console.log('No changes.')
    return
  }
  console.log(`Modified: ${changes.modified.length}  Added: ${changes.added.length}  Removed: ${changes.removed.length}\n`)
  let patch = ''
  const empty = join(agentTaskDir(agent, id), '.empty')
  writeFileSync(empty, '')
  const unified = (labelA, labelB, before, after) => {
    const result = spawnSync('diff', ['-u', '--label', labelA, '--label', labelB, before, after], {
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    })
    if (result.error) fail(`diff failed: ${result.error.message}`)
    // diff exits 1 when the files differ and 2 on a real error.
    if (result.status !== 0 && result.status !== 1) fail(`diff failed for ${labelB}`)
    return result.stdout ?? ''
  }
  for (const rel of changes.modified) {
    const before = join(ROOT, rel)
    const after = join(ws, rel)
    if (isBinary(after)) {
      console.log(`binary modified: ${rel}`)
      continue
    }
    const text = unified(`a/${rel}`, `b/${rel}`, before, after)
    patch += text
    console.log(text)
  }
  for (const rel of changes.added) {
    if (isBinary(join(ws, rel))) console.log(`binary added: ${rel}`)
    else {
      const text = unified('/dev/null', `b/${rel}`, empty, join(ws, rel))
      patch += text
      console.log(text)
    }
  }
  for (const rel of changes.removed) {
    if (isBinary(join(ROOT, rel))) console.log(`binary removed: ${rel}`)
    else {
      const text = unified(`a/${rel}`, '/dev/null', join(ROOT, rel), empty)
      patch += text
      console.log(text)
    }
  }
  const patchPath = join(agentTaskDir(agent, id), 'changes.diff')
  writeFileSync(patchPath, patch)
  console.log(`\nPatch summary written to .agents/${agent}/${id}/changes.diff`)
}

function commandApply(agent, id, yes) {
  checkAgent(agent)
  checkId(id)
  const ws = workspacePath(agent, id)
  if (!existsSync(ws)) fail(`no workspace for ${agent}/${id}; run new ${agent} ${id}`)
  const changes = summary(agent, id)
  if (!changes) fail(`baseline missing for ${agent}/${id}`)
  if (changes.removed.length) fail(`refusing to apply: ${changes.removed.length} file(s) would be deleted. Review them manually.`)
  const total = changes.added.length + changes.modified.length
  if (!total) {
    console.log('No added or modified files to apply.')
    return
  }
  if (!yes) {
    console.log('Dry run. These files would be copied into the main checkout:')
    for (const rel of [...changes.modified, ...changes.added]) console.log(`  ${rel}`)
    console.log(`\nRe-run with --yes after review. A backup is written to .agents/${agent}/${id}/backup/.`)
    return
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backup = join(agentTaskDir(agent, id), 'backup', stamp)
  for (const rel of changes.modified) {
    if (isAbsolute(rel) || rel.startsWith('..')) fail(`unsafe path: ${rel}`)
    const dest = join(backup, rel)
    mkdirSync(dirname(dest), { recursive: true })
    copyFileSync(join(ROOT, rel), dest)
  }
  for (const rel of [...changes.modified, ...changes.added]) {
    if (isAbsolute(rel) || rel.startsWith('..')) fail(`unsafe path: ${rel}`)
    const dest = join(ROOT, rel)
    mkdirSync(dirname(dest), { recursive: true })
    copyFileSync(join(ws, rel), dest)
  }
  console.log(`Applied ${total} file(s). Backup: .agents/${agent}/${id}/backup/${stamp}`)
  console.log('Now run the full verification listed in the contract, then update tasks/README.md.')
}

function commandClean(agent, id, yes) {
  checkAgent(agent)
  checkId(id)
  const dir = agentTaskDir(agent, id)
  if (!existsSync(dir)) fail(`no workspace for ${agent}/${id}`)
  if (!yes) {
    console.log(`Would remove .agents/${agent}/${id}. The task contract and any backup are not in that folder.`)
    console.log('Re-run with --yes to remove it.')
    return
  }
  rmSync(dir, { recursive: true, force: true })
  console.log(`Removed .agents/${agent}/${id}`)
}

function usage() {
  console.log(`Agent task workspaces

  bun scripts/agent-task.mjs new <agent> <task-id>
  bun scripts/agent-task.mjs new <agent>/<task-id>
  bun scripts/agent-task.mjs list [agent] [--json]
  bun scripts/agent-task.mjs status <agent> <task-id> [--json]
  bun scripts/agent-task.mjs diff <agent> <task-id>
  bun scripts/agent-task.mjs apply <agent> <task-id> --yes
  bun scripts/agent-task.mjs clean <agent> <task-id> --yes

Each AI gets its own folder: .agents/<agent>/<task-id>/workspace.
A task id must have a matching tasks/<task-id>.md contract.`)
}

function targetFrom(args) {
  if (args.length === 1) {
    const [agent, id, extra] = args[0].split('/')
    if (agent && id && !extra) return { agent, id }
  }
  if (args.length === 2) return { agent: args[0], id: args[1] }
  fail('expected <agent> <task-id> or <agent>/<task-id>')
}

const [command, ...rest] = process.argv.slice(2)
const yes = rest.includes('--yes')
const json = rest.includes('--json')
const positional = rest.filter((arg) => !arg.startsWith('--'))
switch (command) {
  case 'new': {
    const { agent, id } = targetFrom(positional)
    commandNew(agent, id)
    break
  }
  case 'list':
    commandList(positional[0], json)
    break
  case 'status': {
    const { agent, id } = targetFrom(positional)
    commandStatus(agent, id, json)
    break
  }
  case 'diff': {
    const { agent, id } = targetFrom(positional)
    commandDiff(agent, id)
    break
  }
  case 'apply': {
    const { agent, id } = targetFrom(positional)
    commandApply(agent, id, yes)
    break
  }
  case 'clean': {
    const { agent, id } = targetFrom(positional)
    commandClean(agent, id, yes)
    break
  }
  case 'help':
  case '--help':
  case '-h':
  case undefined:
    usage()
    break
  default:
    fail(`unknown command "${command}"`)
}
