#!/usr/bin/env bun
/**
 * Pre-compaction fact collector and handoff validator.
 *
 * The model writes the judgment. This script writes the mechanical spine:
 * commands, exit codes, test counts, listeners, recently changed files, task
 * statuses and workspace state. That keeps a handoff from paraphrasing facts it
 * never checked.
 *
 *   bun scripts/before-compaction.ts collect [--no-tests] [--build]
 *   bun scripts/before-compaction.ts check docs/compaction/sessions/<file>.md
 *
 * `collect` always exits 0 once it has written facts, even when the suite is
 * red: a red suite is a fact to preserve, not a reason to lose the handoff.
 * `check` exits 1 when the handoff is missing required evidence or sections.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { cpus, platform, release, totalmem } from 'node:os'

const ROOT = process.cwd()
const HANDOFF_ROOT = join(ROOT, '.agents', 'handoff')
const AREAS = ['src', 'tests', 'docs', 'tasks', 'scripts', 'electron', 'public']
const SKIP = new Set(['node_modules', '.git', '_attic', 'dist', 'release', '.wrangler', '.freebuff', 'build', '.agents'])
const REQUIRED_HEADINGS = [
  '## Snapshot',
  '## Mission',
  '## Binding constraints',
  '## Verified',
  '## Unverified',
  '## Decisions',
  '## In flight',
  '## Next actions',
  '## Do not redo',
  '## Sources',
]
const SECRET_PATTERNS: Array<[string, RegExp]> = [
  ['OpenAI-style key', /\bsk-[A-Za-z0-9_-]{20,}/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{20,}/],
  ['AWS key id', /\bAKIA[0-9A-Z]{16}\b/],
  ['private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['assigned password', /\bpassword\s*[:=]\s*["']?[^\s"'<>*]{6,}/i],
]

type CommandResult = {
  label: string
  command: string
  exit: number | null
  ms: number
  pass: number | null
  fail: number | null
  tests: number | null
  files: number | null
  tail: string
  log: string | null
}

function stamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`
}

function rel(path: string): string {
  return relative(ROOT, path).replace(/\\/g, '/')
}

function run(label: string, args: string[], logsDir: string, timeoutMs = 240_000): CommandResult {
  const started = Date.now()
  let result = spawnSync('bun', args, { cwd: ROOT, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 })
  if (result.error && (result.error as NodeJS.ErrnoException).code === 'ENOENT') {
    result = spawnSync('bun.cmd', args, { cwd: ROOT, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024, shell: true })
  }
  const ms = Date.now() - started
  const stdout = typeof result.stdout === 'string' ? result.stdout : ''
  const stderr = typeof result.stderr === 'string' ? result.stderr : ''
  const output = `${stdout}${stderr}`
  const logPath = join(logsDir, `${label}.log`)
  writeFileSync(logPath, `$ bun ${args.join(' ')}\nexit: ${result.status ?? 'null'} (${ms} ms)\n\n${output}`)
  const summary = output.match(/(\d+)\s+pass[\s\S]*?(\d+)\s+fail/)
  const ran = output.match(/Ran\s+(\d+)\s+tests\s+across\s+(\d+)\s+files/)
  return {
    label,
    command: `bun ${args.join(' ')}`,
    exit: result.status,
    ms,
    pass: summary ? Number(summary[1]) : null,
    fail: summary ? Number(summary[2]) : null,
    tests: ran ? Number(ran[1]) : null,
    files: ran ? Number(ran[2]) : null,
    tail: output.trim().split('\n').slice(-40).join('\n'),
    log: rel(logPath),
  }
}

function walk(dir: string, out: Array<{ path: string; mtime: number; size: number }>, budget = 5000): void {
  if (budget <= 0 || !existsSync(dir)) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (out.length >= budget) return
    if (SKIP.has(entry.name)) continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walk(path, out, budget - out.length)
    else if (entry.isFile()) {
      try {
        const s = statSync(path)
        out.push({ path: rel(path), mtime: s.mtimeMs, size: s.size })
      } catch {}
    }
  }
}

function listeners(): Array<{ port: number; pid: number; address: string }> {
  const found: Array<{ port: number; pid: number; address: string }> = []
  if (platform() === 'win32') {
    const r = spawnSync('netstat', ['-ano'], { encoding: 'utf8', timeout: 15_000 })
    const text = typeof r.stdout === 'string' ? r.stdout : ''
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*(TCP|UDP)\s+(\S+):(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/i)
      if (!m) continue
      found.push({ address: m[2].replace(/^\[|\]$/g, ''), port: Number(m[3]), pid: Number(m[4]) })
    }
  } else {
    const r = spawnSync('ss', ['-ltnp'], { encoding: 'utf8', timeout: 15_000 })
    const text = typeof r.stdout === 'string' ? r.stdout : ''
    for (const line of text.split(/\r?\n/).slice(1)) {
      const m = line.match(/LISTEN\s+\d+\s+\d+\s+(\S+):(\d+)\s+.*?pid=(\d+)/)
      if (m) found.push({ address: m[1], port: Number(m[2]), pid: Number(m[3]) })
    }
  }
  return found.filter((l) => l.port >= 3000 && l.port <= 3010)
}

async function health(port: number): Promise<{ port: number; status: number | null; body: string; error?: string }> {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/healthz`, { signal: AbortSignal.timeout(1200) })
    return { port, status: r.status, body: (await r.text()).slice(0, 200) }
  } catch (error) {
    return { port, status: null, body: '', error: error instanceof Error ? error.message : String(error) }
  }
}

function readTasks(): Array<{ id: string; title: string; status: string }> {
  const dir = join(ROOT, 'tasks')
  if (!existsSync(dir)) return []
  const out: Array<{ id: string; title: string; status: string }> = []
  for (const name of readdirSync(dir).filter((n) => /^\d{4}-.*\.md$/.test(n)).sort()) {
    const text = readFileSync(join(dir, name), 'utf8')
    const status = text.match(/^Status:\s*(.+)$/m)?.[1]?.trim() ?? 'unknown'
    const title = text.match(/^#\s*Task\s+\d+\s*[—-]\s*(.+)$/m)?.[1]?.trim() ?? name
    out.push({ id: name.slice(0, 4), title, status })
  }
  return out
}

function workspaces(): Array<{ agent: string; task: string; path: string; files: number; mtime: string }> {
  const base = join(ROOT, '.agents')
  if (!existsSync(base)) return []
  const out: Array<{ agent: string; task: string; path: string; files: number; mtime: string }> = []
  for (const agent of readdirSync(base, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)) {
    if (agent === 'skills' || agent === 'logs' || agent === 'handoff' || agent === 'mailbox') continue
    const agentDir = join(base, agent)
    for (const task of readdirSync(agentDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)) {
      const ws = join(agentDir, task, 'workspace')
      if (!existsSync(ws)) continue
      let files = 0
      const stack = [ws]
      while (stack.length && files < 1000) {
        const current = stack.pop()!
        for (const entry of readdirSync(current, { withFileTypes: true })) {
          if (SKIP.has(entry.name)) continue
          if (entry.isDirectory()) stack.push(join(current, entry.name))
          else if (entry.isFile()) files++
        }
      }
      out.push({ agent, task, path: rel(ws), files, mtime: new Date(statSync(ws).mtimeMs).toISOString() })
    }
  }
  return out
}

function docFreshness(): Array<{ path: string; mtime: string; lines: number }> {
  const paths = ['HANDOFF.md', 'AGENT.md', 'AGENTS.md', 'QUEUE.md', 'URGENT.md', 'docs/STATE.md', 'docs/CHANGELOG.md', 'docs/compaction/README.md', 'docs/compaction/NEXT.md', 'docs/compaction/RUNTIME.md', 'docs/compaction/WORKSTREAMS.md', 'tasks/README.md']
  return paths.filter((p) => existsSync(join(ROOT, p))).map((p) => {
    const full = join(ROOT, p)
    return { path: p, mtime: new Date(statSync(full).mtimeMs).toISOString(), lines: readFileSync(full, 'utf8').split('\n').length }
  })
}

function factsMarkdown(facts: Record<string, unknown>): string {
  const f = facts as {
    snapshot: { at: string; platform: string; release: string; bun: string; cpus: number; memoryGb: string; version: string }
    git: { repository: boolean; branch: string | null; dirty: string | null }
    commands: CommandResult[]
    listeners: Array<{ port: number; pid: number; address: string }>
    health: Array<{ port: number; status: number | null; body: string; error?: string }>
    recentFiles: Array<{ path: string; mtime: number; size: number }>
    tasks: Array<{ id: string; title: string; status: string }>
    workspaces: Array<{ agent: string; task: string; files: number; mtime: string }>
    docs: Array<{ path: string; mtime: string; lines: number }>
    notes: string[]
  }
  const lines: string[] = []
  lines.push(`# Collected facts — ${f.snapshot.at}`)
  lines.push('')
  lines.push('> Mechanical output from `scripts/before-compaction.ts collect`. The handoff must cite these values, not paraphrase them.')
  lines.push('')
  lines.push('## Environment')
  lines.push('')
  lines.push(`- platform: ${f.snapshot.platform} ${f.snapshot.release}`)
  lines.push(`- bun: ${f.snapshot.bun}; package: ${f.snapshot.version}`)
  lines.push(`- cpus: ${f.snapshot.cpus}; memory: ${f.snapshot.memoryGb} GB`)
  lines.push(`- git: ${f.git.repository ? `yes, ${f.git.branch}` : 'no repository'}`)
  lines.push('')
  lines.push('## Commands')
  lines.push('')
  for (const c of f.commands) {
    const counts = c.pass !== null ? ` — ${c.pass} pass, ${c.fail} fail` : ''
    lines.push(`- \`${c.command}\` -> exit ${c.exit}, ${c.ms} ms${counts}`)
    lines.push(`  - log: \`${c.log}\``)
  }
  lines.push('')
  lines.push('## Listeners 3000–3010')
  lines.push('')
  if (!f.listeners.length) lines.push('- none')
  for (const l of f.listeners) lines.push(`- ${l.address}:${l.port} pid ${l.pid}`)
  lines.push('')
  lines.push('## Health')
  lines.push('')
  if (!f.health.length) lines.push('- not checked (no listener)')
  for (const h of f.health) lines.push(`- :${h.port} -> ${h.status ?? 'unreachable'}${h.body ? ` ${h.body}` : ''}${h.error ? ` (${h.error})` : ''}`)
  lines.push('')
  lines.push('## Recently changed files (24h, newest first)')
  lines.push('')
  const cutoff = Date.now() - 24 * 60 * 60 * 1000
  const recent = f.recentFiles.filter((x) => x.mtime >= cutoff).slice(0, 40)
  if (!recent.length) lines.push('- none')
  for (const x of recent) lines.push(`- \`${x.path}\` — ${new Date(x.mtime).toISOString()}, ${x.size} B`)
  lines.push('')
  lines.push('## Task statuses')
  lines.push('')
  for (const t of f.tasks) lines.push(`- ${t.id} ${t.title}: ${t.status}`)
  lines.push('')
  lines.push('## Workspaces')
  lines.push('')
  if (!f.workspaces.length) lines.push('- none')
  for (const w of f.workspaces) lines.push(`- ${w.agent}/${w.task}: ${w.files} files, ${w.mtime}`)
  lines.push('')
  lines.push('## Doc freshness')
  lines.push('')
  for (const d of f.docs) lines.push(`- \`${d.path}\` — ${d.lines} lines, ${d.mtime}`)
  if (f.notes.length) {
    lines.push('')
    lines.push('## Notes and caveats')
    lines.push('')
    for (const n of f.notes) lines.push(`- ${n}`)
  }
  return `${lines.join('\n')}\n`
}

async function collect(argv: string[]): Promise<void> {
  const noTests = argv.includes('--no-tests')
  // Building rewrites dist/ and can change what a live server serves. It is
  // opt-in: a handoff must not mutate the running game.
  const build = argv.includes('--build')
  const outDir = join(HANDOFF_ROOT, stamp())
  mkdirSync(outDir, { recursive: true })
  const pkg = existsSync(join(ROOT, 'package.json')) ? JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) : {}
  const notes: string[] = []

  const commands: CommandResult[] = []
  commands.push(run('typecheck', ['run', 'typecheck'], outDir, 180_000))
  if (!noTests) commands.push(run('tests', ['test', '--max-concurrency', '1', '--timeout', '10000'], outDir, 300_000))
  else notes.push('Full test suite skipped with --no-tests; any pass/fail claim is unverified.')
  if (build) commands.push(run('build', ['run', 'build:node'], outDir, 240_000))
  else notes.push('Build not run: collect is read-only by default. Pass --build to verify it (this rewrites dist/).')
  commands.push(run('workflow', ['run', 'workflow', 'status'], outDir, 60_000))

  const ports = listeners()
  const healthResults = await Promise.all(ports.map((l) => health(l.port)))

  const files: Array<{ path: string; mtime: number; size: number }> = []
  for (const area of AREAS) walk(join(ROOT, area), files, 5000 - files.length)
  for (const name of ['package.json', 'bunfig.toml', 'tsconfig.json', 'vite.config.ts', 'vite.node.config.ts', 'deploy.json']) {
    const full = join(ROOT, name)
    if (existsSync(full)) files.push({ path: name, mtime: statSync(full).mtimeMs, size: statSync(full).size })
  }
  files.sort((a, b) => b.mtime - a.mtime)

  const gitDir = join(ROOT, '.git')
  const git = { repository: existsSync(gitDir), branch: null as string | null, dirty: null as string | null }
  if (git.repository) {
    const branch = spawnSync('git', ['branch', '--show-current'], { cwd: ROOT, encoding: 'utf8' })
    const status = spawnSync('git', ['status', '--short'], { cwd: ROOT, encoding: 'utf8' })
    git.branch = (branch.stdout ?? '').trim() || 'detached'
    git.dirty = ((status.stdout ?? '').trim().split('\n').filter(Boolean).length) + ' changed paths'
  }

  const facts = {
    snapshot: {
      at: new Date().toISOString(),
      platform: platform(),
      release: release(),
      bun: process.versions.bun ?? 'not bun',
      version: pkg.version ?? 'unknown',
      cpus: cpus().length,
      memoryGb: (totalmem() / 1024 ** 3).toFixed(1),
    },
    git,
    commands,
    listeners: ports,
    health: healthResults,
    recentFiles: files.slice(0, 80),
    tasks: readTasks(),
    workspaces: workspaces(),
    docs: docFreshness(),
    notes,
  }

  writeFileSync(join(outDir, 'facts.json'), `${JSON.stringify(facts, null, 2)}\n`)
  writeFileSync(join(outDir, 'facts.md'), factsMarkdown(facts as unknown as Record<string, unknown>))

  console.log(`pre-compaction facts: ${rel(join(outDir, 'facts.md'))}`)
  for (const c of commands) {
    const counts = c.pass !== null ? `, ${c.pass} pass / ${c.fail} fail` : ''
    console.log(`  ${c.command} -> exit ${c.exit}, ${c.ms} ms${counts}`)
  }
  console.log('  listeners:', ports.length ? ports.map((l) => `:${l.port} pid ${l.pid}`).join(', ') : 'none')
  console.log('  health:', healthResults.length ? healthResults.map((h) => `:${h.port} ${h.status ?? 'down'}`).join(', ') : 'not checked')
  const failed = commands.filter((c) => c.exit !== 0)
  if (failed.length) console.log(`  NOTE: ${failed.length} command(s) failed; preserve this in the handoff, do not report green.`)
}

function check(file: string): void {
  const path = resolve(ROOT, file)
  if (!existsSync(path)) {
    console.error(`missing handoff: ${file}`)
    process.exit(1)
  }
  const text = readFileSync(path, 'utf8')
  const errors: string[] = []
  for (const heading of REQUIRED_HEADINGS) if (!text.includes(`\n${heading}`)) errors.push(`missing heading: ${heading}`)
  if (!text.includes('[V]')) errors.push('no [V] verified claims')
  if (!text.includes('[?]')) errors.push('no [?] unverified claims')
  const words = text.trim().split(/\s+/).length
  if (words > 4000) errors.push(`too long: ${words} words (target <= 4000)`)
  if (!/```(?:bash|sh|text)/.test(text)) errors.push('no command/evidence code block')
  for (const [name, pattern] of SECRET_PATTERNS) {
    if (pattern.test(text)) errors.push(`possible secret (${name})`)
  }
  if (errors.length) {
    console.error(`handoff check FAILED: ${file}`)
    for (const e of errors) console.error(` - ${e}`)
    process.exit(1)
  }
  console.log(`handoff check passed: ${file} (${words} words)`)
}

const [mode, ...rest] = process.argv.slice(2)
if (mode === 'check') {
  const file = rest[0]
  if (!file) {
    console.error('usage: bun scripts/before-compaction.ts check <handoff.md>')
    process.exit(1)
  }
  check(file)
} else if (mode === 'collect' || !mode) {
  collect(rest).catch((error) => {
    console.error('collector failed:', error)
    process.exit(1)
  })
} else {
  console.error('usage: bun scripts/before-compaction.ts collect [--no-tests] [--build] | check <handoff.md>')
  process.exit(1)
}
