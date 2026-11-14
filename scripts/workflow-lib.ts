/**
 * Pure helpers for the three-agent workflow.
 *
 * Kept separate from the CLI so the contract parser, ownership checks and
 * review rules can be tested without creating workspaces or spawning processes.
 */

export interface Contract {
  id: string
  title: string
  status: string
  owner: string
  dependsOn: string[]
  allowed: string[]
  forbidden: string[]
  source: string
}

export interface ChangeSet {
  added: string[]
  modified: string[]
  removed: string[]
}

export interface Review {
  blocking: string[]
  notes: string[]
  outside: string[]
}

export interface Conflict {
  a: string
  b: string
  paths: string[]
}

export interface Plan {
  selected: Contract[]
  skipped: { id: string; reason: string }[]
}

export function normalizePath(path: string): string {
  return path.trim().replace(/\\/g, '/').replace(/^\.\//, '')
}

function headingLine(line: string): boolean {
  return /^#{1,2}\s+/.test(line)
}

/** Lines inside a `## Heading` section, excluding the heading itself. */
function section(text: string, heading: RegExp): string[] {
  const lines = text.split(/\r?\n/)
  const start = lines.findIndex((line) => heading.test(line.trim()))
  if (start < 0) return []
  const out: string[] = []
  for (const line of lines.slice(start + 1)) {
    if (headingLine(line)) break
    out.push(line)
  }
  return out
}

function codeSpans(line: string): string[] {
  return [...line.matchAll(/`([^`]+)`/g)].map((match) => normalizePath(match[1]))
}

function looksLikePath(value: string): boolean {
  if (!value || /\s/.test(value) || value.startsWith('http')) return false
  return value.includes('/') || value.includes('.')
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function field(text: string, name: string): string {
  const match = text.match(new RegExp(`^${name}:\\s*(.*)$`, 'im'))
  return match?.[1]?.trim() ?? ''
}

function normalizeStatus(raw: string): string {
  return raw.toLowerCase().match(/^[a-z-]+/)?.[0] ?? 'unknown'
}

function allowedFromOwnership(text: string): { allowed: string[]; forbidden: string[] } {
  const block = section(text, /^##\s+Ownership\s*$/i)
  if (!block.length) return { allowed: [], forbidden: [] }
  const allowedAt = block.findIndex((line) => /Files allowed to change:/i.test(line))
  const forbiddenAt = block.findIndex((line) => /Off-limits:/i.test(line))
  const allowedLines =
    allowedAt < 0
      ? block
      : block.slice(allowedAt + 1, forbiddenAt > allowedAt ? forbiddenAt : undefined)
  const forbiddenLines =
    forbiddenAt < 0
      ? []
      : block.slice(forbiddenAt).map((line) => line.replace(/^.*?Off-limits:\s*/i, ''))
  return {
    allowed: unique(allowedLines.flatMap(codeSpans).filter(looksLikePath)),
    forbidden: unique(forbiddenLines.flatMap(codeSpans).filter(looksLikePath)),
  }
}

export function parseContract(id: string, text: string, source = `tasks/${id}.md`): Contract {
  const heading = text.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? id
  const title = heading.replace(/^Task\s+\d+\s+[—–-]\s+/, '')
  const explicit = section(text, /^##\s+Allowed paths\s*$/i)
  const ownership = allowedFromOwnership(text)
  const allowed = unique([
    ...explicit.flatMap(codeSpans).filter(looksLikePath),
    ...ownership.allowed,
  ])
  const dependsRaw = field(text, 'Depends on')
  const dependsOn = unique(
    [...dependsRaw.matchAll(/`([^`]+)`/g)].map((match) => match[1]),
  )
  return {
    id,
    title,
    status: normalizeStatus(field(text, 'Status')),
    owner: field(text, 'Owner').replace(/[.\s]+$/, '') || 'unassigned',
    dependsOn,
    allowed,
    forbidden: ownership.forbidden,
    source,
  }
}

const ESCAPE = String.fromCharCode(92)

/** True when a path is covered by one contract path or glob. */
export function matchesPath(pattern: string, path: string): boolean {
  const p = normalizePath(pattern)
  const target = normalizePath(path)
  if (!p || !target) return false
  if (!/[*?]/.test(p)) {
    if (p === target) return true
    if (p.endsWith("/")) return target.startsWith(p)
    return target.startsWith(p + "/")
  }
  let expression = "^"
  for (let i = 0; i < p.length; i++) {
    const ch = p[i]
    if (ch === "*") {
      if (p[i + 1] === "*") {
        i++
        if (p[i + 1] === "/") {
          i++
          expression += "(?:.*/)?"
        } else {
          expression += ".*"
        }
      } else {
        expression += "[^/]*"
      }
    } else if (ch === "?") {
      expression += "[^/]"
    } else if ("^$+?.()|{}[]".includes(ch)) {
      expression += ESCAPE + ch
    } else {
      expression += ch
    }
  }
  return new RegExp(expression + "$").test(target)
}

/** Changed files that no allowed path covers, in first-seen order. */
export function scopeViolations(changed: string[], allowed: string[]): string[] {
  const out: string[] = []
  for (const path of changed.map(normalizePath)) {
    if (out.includes(path)) continue
    if (!allowed.some((pattern) => matchesPath(pattern, path))) out.push(path)
  }
  return out
}

function literalPrefix(pattern: string): string {
  const normalized = normalizePath(pattern)
  const wildcard = normalized.search(/[*?]/)
  return wildcard < 0 ? normalized : normalized.slice(0, wildcard)
}

function prefixOverlap(a: string, b: string): boolean {
  if (!a || !b) return false
  if (a === b) return true
  return a.startsWith(`${b}/`) || b.startsWith(`${a}/`)
}

/**
 * Conservative overlap: exact files, a directory containing a file, and globs
 * with a shared literal prefix all count. False positives are safer than two
 * agents silently editing the same file.
 */
export function patternsOverlap(a: string, b: string): boolean {
  if (matchesPath(a, b) || matchesPath(b, a)) return true
  return prefixOverlap(literalPrefix(a), literalPrefix(b))
}

export function contractConflicts(tasks: Contract[]): Conflict[] {
  const conflicts: Conflict[] = []
  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      const a = tasks[i]
      const b = tasks[j]
      const paths: string[] = []
      for (const left of a.allowed) {
        for (const right of b.allowed) {
          if (!patternsOverlap(left, right)) continue
          const label = left === right ? left : `${left} <-> ${right}`
          if (!paths.includes(label)) paths.push(label)
        }
      }
      if (paths.length) conflicts.push({ a: a.id, b: b.id, paths })
    }
  }
  return conflicts
}

function taskConflicts(task: Contract, others: Contract[]): { task: Contract; paths: string[] }[] {
  return others
    .map((other) => {
      const paths: string[] = []
      for (const left of task.allowed) {
        for (const right of other.allowed) {
          if (!patternsOverlap(left, right)) continue
          const label = left === right ? left : `${left} <-> ${right}`
          if (!paths.includes(label)) paths.push(label)
        }
      }
      return { task: other, paths }
    })
    .filter((entry) => entry.paths.length > 0)
}

/** Greedy, deterministic slate: ready, not active, no overlapping ownership. */
export function planBatch(tasks: Contract[], active: Contract[], max: number): Plan {
  const activeIds = new Set(active.map((task) => task.id))
  const free = Math.max(0, max - active.length)
  const selected: Contract[] = []
  const skipped: { id: string; reason: string }[] = []
  const candidates = tasks
    .filter((task) => task.status === 'ready' && !activeIds.has(task.id))
    .sort((a, b) => a.id.localeCompare(b.id))
  for (const candidate of candidates) {
    if (selected.length >= free) {
      skipped.push({ id: candidate.id, reason: `agent slots full (${max} max)` })
      continue
    }
    const clash = taskConflicts(candidate, [...active, ...selected])[0]
    if (clash) {
      skipped.push({
        id: candidate.id,
        reason: `overlaps ${clash.task.id} on ${clash.paths.join(', ')}`,
      })
      continue
    }
    selected.push(candidate)
  }
  return { selected, skipped }
}


/**
 * Build a read-only external-review prompt from the contract and workspace
 * metadata. This is intentionally pure so it can be tested without spawning
 * OpenCode or touching a workspace.
 */
export interface ReviewFile {
  path: string
  text: string
}

export function externalReviewPrompt(
  task: Contract,
  agent: string,
  files: string[],
  workspace: string,
  contents: ReviewFile[] = [],
): string {
  const nl = String.fromCharCode(10)
  const changed = files.length ? files.map((path) => `- ${path}`).join(nl) : '- (no files detected)'
  const inline = contents.length
    ? [
        '',
        'The changed files are included below. Review these contents; do not call tools',
        'to read them again.',
        '',
        ...contents.flatMap((file) => [
          `### ${file.path}`,
          '```',
          file.text,
          '```',
          '',
        ]),
      ].join(nl)
    : ''
  return `You are a read-only code reviewer for Clache. Do not edit, create, delete, commit, deploy or restart anything. Do not call tools. Use only the information in this message.

Task: ${task.id} — ${task.title}
Worker: ${agent}
Contract: ${task.source}
Workspace: ${workspace}

Review only the changed files:
${changed}

Allowed paths in the contract:
${task.allowed.map((path) => `- ${path}`).join(nl)}
${inline}
Check for:
- correctness bugs and broken edge cases;
- tests that were weakened, deleted or do not exercise the change;
- scope violations or changes outside the allowed paths;
- unsafe behaviour, hidden information, or violations of the engine/game boundary;
- integration risks with the current main checkout.

Do not rewrite the implementation. Return concise findings with severity,
file/line references where possible, and an explicit PASS or CHANGES REQUIRED
verdict. A finding is not a reason to edit.`
}

const GENERATED =
  /^(?:dist|release|node_modules|\.agents|\.wrangler|\.tools)\/|(?:^|\/)\.env|\.log$|^package-lock\.json$|^bun\.lockb$/

/** Mechanical review: scope, deletions, generated files and touched areas. */
export function reviewChanges(task: Contract, changes: ChangeSet): Review {
  const blocking: string[] = []
  const notes: string[] = []
  const changed = [...changes.added, ...changes.modified, ...changes.removed].map(normalizePath)
  const outside = scopeViolations(changed, task.allowed)
  if (!task.allowed.length) blocking.push('contract lists no allowed paths')
  if (!changed.length) blocking.push('no changes in the workspace')
  for (const path of changes.removed.map(normalizePath)) {
    blocking.push(`would delete ${path}; apply refuses deletions`)
  }
  for (const path of outside) blocking.push(`outside the contract: ${path}`)
  for (const path of changed) {
    if (GENERATED.test(path)) blocking.push(`generated or local-only file: ${path}`)
  }
  const touchedTests = changed.filter((path) => /(?:^|\/)tests\/|\.test\.[^.]+$/.test(path))
  const touchedDocs = changed.filter((path) => /(?:^|\/)docs\/|\.md$/.test(path))
  if (touchedTests.length) notes.push(`tests changed: ${touchedTests.join(', ')}`)
  if (touchedDocs.length) notes.push(`docs changed: ${touchedDocs.join(', ')}`)
  if (changed.length && !touchedTests.length && !/docs\//.test(changed.join(' '))) {
    notes.push('no test file changed; confirm this is docs/data-only work')
  }
  return { blocking: unique(blocking), notes: unique(notes), outside }
}
