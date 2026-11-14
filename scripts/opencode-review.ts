/**
 * Local-only OpenCode reviewer bridge.
 *
 * A Freebuff worker invokes this in its terminal; it talks to an OpenCode v2
 * server bound to loopback, waits for a review, and writes the result to the
 * project mailbox. It never edits the checkout, approves permissions or merges.
 *
 * The v2 server exposes its HTTP API under `/api`. The read-only `plan` agent
 * is used by default so the reviewer cannot edit the workspace even if the
 * prompt is ignored.
 *
 * Usage:
 *   OPENCODE_SERVER_PASSWORD=... bun scripts/opencode-review.ts "Review <files> ..."
 *   bun scripts/opencode-review.ts --stdout "Review the staged diff..."
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export interface ReviewOptions {
  baseUrl: string
  prompt: string
  password?: string
  model?: string
  agent?: string
  timeoutMs?: number
}

export interface ReviewResult {
  sessionId: string
  text: string
  model?: string
}

export interface ReportContent {
  prompt: string
  result: ReviewResult
  model?: string
}

export interface ReportOptions extends ReportContent {
  root: string
}

export interface ModelRef {
  id: string
  providerID: string
  variant?: string
}

const DEFAULT_BASE = 'http://127.0.0.1:4096'
const DEFAULT_MODEL = 'opencode/glm-5.3-flash-free#max'
const DEFAULT_AGENT = 'plan'
const DEFAULT_TIMEOUT_MS = 600_000
const POLL_MS = 1_000
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])

/** Refuse anything that could send the prompt or password off the machine. */
export function assertLoopback(baseUrl: string): URL {
  let url: URL
  try { url = new URL(baseUrl) } catch { throw new Error('OpenCode base URL is invalid') }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('OpenCode base URL must be HTTP(S)')
  if (!LOOPBACK.has(url.hostname.toLowerCase())) throw new Error('OpenCode reviewer must use a loopback base URL')
  if (url.username || url.password) throw new Error('Put OpenCode credentials in OPENCODE_SERVER_PASSWORD, not the URL')
  return url
}

/** Parse `provider/model` with an optional `#variant`, e.g. `opencode/glm-5.3-flash-free#max`. */
export function parseModelRef(value: string): ModelRef {
  const trimmed = value.trim()
  if (!trimmed) throw new Error('OpenCode model id is empty')
  const [model, variant, ...rest] = trimmed.split('#')
  if (rest.length) throw new Error('OpenCode model id has more than one #variant')
  const slash = model.indexOf('/')
  if (slash <= 0 || slash === model.length - 1) {
    throw new Error('OpenCode model must be provider/model#variant, e.g. opencode/glm-5.3-flash-free#max')
  }
  return {
    providerID: model.slice(0, slash),
    id: model.slice(slash + 1),
    ...(variant ? { variant } : {}),
  }
}

function authHeader(password?: string): string | undefined {
  if (!password) return undefined
  return `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}`
}

async function jsonRequest(
  url: string,
  init: RequestInit,
  password: string | undefined,
  signal: AbortSignal,
): Promise<unknown> {
  const auth = authHeader(password)
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      signal,
      headers: {
        ...(init.headers ?? {}),
        ...(auth ? { authorization: auth } : {}),
        'content-type': 'application/json',
      },
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('OpenCode review timed out')
    throw error
  }
  const body = await response.text()
  if (!response.ok) throw new Error(`OpenCode ${init.method ?? 'GET'} ${url} returned HTTP ${response.status}: ${body.slice(0, 200)}`)
  if (!body.trim()) return {}
  try { return JSON.parse(body) } catch { throw new Error(`OpenCode returned non-JSON from ${url}`) }
}

function textFrom(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const record = value as Record<string, unknown>
  const parts = Array.isArray(record.content)
    ? record.content
    : Array.isArray(record.parts)
      ? record.parts
      : []
  const text = parts
    .map((part) => {
      if (!part || typeof part !== 'object') return ''
      const p = part as Record<string, unknown>
      return p.type === 'text' && typeof p.text === 'string' ? p.text : ''
    })
    .filter(Boolean)
    .join('\n')
    .trim()
  if (text) return text
  return typeof record.text === 'string' ? record.text.trim() : ''
}

function messagesFrom(value: unknown): Record<string, unknown>[] {
  if (!value || typeof value !== 'object') return []
  const record = value as Record<string, unknown>
  const data = Array.isArray(record.data)
    ? record.data
    : Array.isArray(record.messages)
      ? record.messages
      : []
  return data.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
}

function assistantText(value: unknown): string {
  const messages = messagesFrom(value)
  const assistants = messages.filter((message) => {
    if (message.type !== undefined) return message.type === 'assistant'
    return (message.info as Record<string, unknown> | undefined)?.role === 'assistant'
  })
  const last = assistants.at(-1)
  if (!last) return ''
  if (last.error) throw new Error(`OpenCode assistant error: ${JSON.stringify(last.error).slice(0, 300)}`)
  if (last.type === 'assistant') {
    const finish = typeof last.finish === 'string' ? last.finish : ''
    // A tool-calls or unfinished assistant message is not a review. Waiting for
    // the final turn prevents returning an intermediate sentence as findings.
    if (!finish || finish === 'tool-calls') return ''
    if (finish === 'error') throw new Error('OpenCode assistant finished with an error')
  }
  return textFrom(last)
}

async function sleep(ms: number, signal: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    const abort = () => { clearTimeout(timer); reject(new Error('OpenCode review timed out')) }
    if (signal.aborted) return abort()
    signal.addEventListener('abort', abort, { once: true })
  })
}

/**
 * Create an OpenCode v2 session, submit a review prompt, and poll for the
 * assistant text. An empty assistant response is never treated as success.
 */
export async function requestReview(options: ReviewOptions): Promise<ReviewResult> {
  const base = assertLoopback(options.baseUrl)
  const prompt = options.prompt.trim()
  if (!prompt) throw new Error('Review prompt is empty')
  const timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  const model = options.model ?? DEFAULT_MODEL
  const agent = options.agent ?? DEFAULT_AGENT
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const signal = controller.signal
  try {
    const root = `${base.href.replace(/\/$/, '')}/api`
    const session = await jsonRequest(`${root}/session`, {
      method: 'POST',
      body: JSON.stringify({
        title: 'Clache reviewer',
        ...(agent ? { agent } : {}),
        model: parseModelRef(model),
      }),
    }, options.password, signal)
    const sessionRecord = session && typeof session === 'object'
      ? ((session as Record<string, unknown>).data ?? session) as Record<string, unknown>
      : {}
    const sessionId = String(sessionRecord.id ?? sessionRecord.sessionId ?? '')
    if (!sessionId) throw new Error('OpenCode did not return a session id')

    await jsonRequest(`${root}/session/${encodeURIComponent(sessionId)}/prompt`, {
      method: 'POST',
      body: JSON.stringify({ text: prompt }),
    }, options.password, signal)

    let text = ''
    while (!signal.aborted) {
      const messages = await jsonRequest(`${root}/session/${encodeURIComponent(sessionId)}/message?limit=50`, {
        method: 'GET',
      }, options.password, signal)
      text = assistantText(messages)
      if (text) break
      await sleep(POLL_MS, signal)
    }
    if (!text) throw new Error('OpenCode returned no review text')
    return { sessionId, text, model }
  } finally {
    clearTimeout(timer)
  }
}

/** Render a human-readable review report. The password is never an input here. */
export function reviewReportText(options: ReportContent): string {
  const model = options.model ?? options.result.model ?? 'unknown'
  return [
    '# OpenCode review',
    '',
    `- Session: \`${options.result.sessionId}\``,
    `- Model: \`${model}\``,
    `- Created: ${new Date().toISOString()}`,
    '',
    '## Prompt',
    '',
    '```text',
    options.prompt.trim(),
    '```',
    '',
    '## Findings',
    '',
    options.result.text.trim(),
    '',
  ].join('\n')
}

/** Write a report to an explicit path, creating its parent directory. */
export function writeReviewAt(path: string, options: ReportContent): string {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, reviewReportText(options), 'utf8')
  return path
}

/** Write a timestamped review report in the default mailbox. */
export function writeReviewReport(options: ReportOptions): string {
  const dir = join(options.root, '.agents', 'mailbox')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  return writeReviewAt(join(dir, `opencode-review-${stamp}.md`), options)
}

function usage(): string {
  return [
    'Usage: bun scripts/opencode-review.ts [options] <prompt...>',
    '',
    'Options:',
    '  --base-url <url>    OpenCode v2 server (default http://127.0.0.1:4096)',
    '  --model <id>        Provider/model[#variant] (default opencode/glm-5.3-flash-free#max)',
    '  --agent <name>      OpenCode agent (default plan, read-only)',
    '  --timeout-ms <n>    Total timeout (default 600000)',
    '  --stdout            Print the review instead of writing a report',
    '  --out <path>        Report path outside the default mailbox name',
    '  --password <value>  Prefer OPENCODE_SERVER_PASSWORD instead',
  ].join('\n')
}

async function main(argv: string[]): Promise<number> {
  let baseUrl = process.env.OPENCODE_BASE_URL ?? DEFAULT_BASE
  let model = process.env.OPENCODE_MODEL ?? DEFAULT_MODEL
  let agent = process.env.OPENCODE_AGENT ?? DEFAULT_AGENT
  let password = process.env.OPENCODE_SERVER_PASSWORD
  let timeoutMs = Number(process.env.OPENCODE_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS)
  let stdout = false
  let out: string | null = null
  const promptParts: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') { console.log(usage()); return 0 }
    if (arg === '--stdout') { stdout = true; continue }
    if (arg === '--base-url' || arg === '--model' || arg === '--agent' || arg === '--timeout-ms' || arg === '--out' || arg === '--password') {
      const value = argv[++i]
      if (value === undefined) throw new Error(`${arg} needs a value`)
      if (arg === '--base-url') baseUrl = value
      else if (arg === '--model') model = value
      else if (arg === '--agent') agent = value
      else if (arg === '--timeout-ms') timeoutMs = Number(value)
      else if (arg === '--out') out = value
      else password = value
      continue
    }
    promptParts.push(arg)
  }
  let prompt = promptParts.join(' ').trim()
  if (!prompt) prompt = (await new Response(Bun.stdin.stream()).text()).trim()
  if (!prompt) throw new Error('Review prompt is empty')
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('Timeout must be a positive number')
  const result = await requestReview({ baseUrl, prompt, password, model, agent, timeoutMs })
  if (stdout) {
    console.log(result.text)
  } else {
    const options = { prompt, model, result }
    const path = out ? writeReviewAt(out, options) : writeReviewReport({ root: process.cwd(), ...options })
    console.log(path)
  }
  return 0
}

if (import.meta.main) {
  main(process.argv.slice(2))
    .then((code) => { if (code !== 0) process.exitCode = code })
    .catch((error) => {
      console.error(`opencode-review: ${error instanceof Error ? error.message : String(error)}`)
      process.exitCode = 1
    })
}
