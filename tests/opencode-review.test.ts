import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assertLoopback, parseModelRef, requestReview, writeReviewAt, writeReviewReport } from '../scripts/opencode-review'

let server: ReturnType<typeof Bun.serve> | null = null
afterEach(() => { server?.stop(true); server = null })

function fake(handler: (req: Request, url: URL) => Response | Promise<Response>) {
  server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: (req) => handler(req, new URL(req.url)) })
  return `http://127.0.0.1:${server.port}`
}

const auth = (password = 'secret') => `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}`

function assistant(text: string, extra: Record<string, unknown> = {}) {
  return Response.json({
    data: [
      { type: 'user', id: 'u1', text: 'review' },
      { type: 'assistant', id: 'a1', finish: 'stop', content: [{ type: 'text', text }], ...extra },
    ],
    cursor: { previous: null, next: null },
  })
}

describe('OpenCode reviewer bridge', () => {
  test('parses provider, model and reasoning variant', () => {
    expect(parseModelRef('opencode/glm-5.3-flash-free#max')).toEqual({
      providerID: 'opencode',
      id: 'glm-5.3-flash-free',
      variant: 'max',
    })
    expect(parseModelRef('opencode/glm-5.3-flash-free')).toEqual({
      providerID: 'opencode',
      id: 'glm-5.3-flash-free',
    })
    expect(() => parseModelRef('glm-5.3-flash-free')).toThrow('provider/model')
    expect(() => parseModelRef('opencode/glm#max#extra')).toThrow('#variant')
  })

  test('refuses non-loopback URLs', () => {
    expect(() => assertLoopback('http://example.com:4096')).toThrow('loopback')
    expect(() => assertLoopback('http://192.168.1.4:4096')).toThrow('loopback')
    expect(() => assertLoopback('http://127.0.0.1:4096')).not.toThrow()
    expect(() => assertLoopback('http://[::1]:4096')).not.toThrow()
  })

  test('uses the v2 session, prompt and message routes with max and the plan agent', async () => {
    const seen: string[] = []
    let sessionBody: Record<string, unknown> = {}
    let promptBody: Record<string, unknown> = {}
    const base = fake(async (req, url) => {
      seen.push(`${req.method} ${url.pathname} ${req.headers.get('authorization') ?? ''}`)
      if (url.pathname === '/api/session' && req.method === 'POST') {
        sessionBody = await req.json() as Record<string, unknown>
        return Response.json({ data: { id: 's1', model: { id: 'glm-5.3-flash-free', providerID: 'opencode', variant: 'max' } } })
      }
      if (url.pathname === '/api/session/s1/prompt' && req.method === 'POST') {
        promptBody = await req.json() as Record<string, unknown>
        return Response.json({ data: { id: 'u1' } })
      }
      if (url.pathname === '/api/session/s1/message' && req.method === 'GET') return assistant('looks good')
      return new Response('not found', { status: 404 })
    })
    const result = await requestReview({
      baseUrl: base,
      password: 'secret',
      prompt: 'review this',
      model: 'opencode/glm-5.3-flash-free#max',
      timeoutMs: 2000,
    })
    expect(result.text).toBe('looks good')
    expect(result.sessionId).toBe('s1')
    expect(sessionBody).toMatchObject({
      agent: 'plan',
      model: { providerID: 'opencode', id: 'glm-5.3-flash-free', variant: 'max' },
    })
    expect(promptBody).toEqual({ text: 'review this' })
    expect(seen).toContain(`POST /api/session ${auth()}`)
    expect(seen).toContain(`POST /api/session/s1/prompt ${auth()}`)
    expect(seen).toContain(`GET /api/session/s1/message ${auth()}`)
  })

  test('waits past an intermediate tool-calls message for the final review', async () => {
    let polls = 0
    const base = fake(async (_req, url) => {
      if (url.pathname === '/api/session') return Response.json({ data: { id: 's2b' } })
      if (url.pathname === '/api/session/s2b/prompt') return Response.json({ data: {} })
      if (url.pathname === '/api/session/s2b/message') {
        polls++
        if (polls === 1) {
          return Response.json({
            data: [
              { type: 'user', id: 'u1', text: 'review' },
              { type: 'assistant', id: 'a1', finish: 'tool-calls', content: [{ type: 'text', text: 'Checking the files...' }] },
            ],
          })
        }
        return Response.json({
          data: [
            { type: 'user', id: 'u1', text: 'review' },
            { type: 'assistant', id: 'a1', finish: 'tool-calls', content: [{ type: 'text', text: 'Checking the files...' }] },
            { type: 'assistant', id: 'a2', finish: 'stop', content: [{ type: 'text', text: 'CHANGES REQUIRED: off-by-one' }] },
          ],
        })
      }
      return new Response('not found', { status: 404 })
    })
    const result = await requestReview({ baseUrl: base, prompt: 'review', timeoutMs: 3000 })
    expect(result.text).toBe('CHANGES REQUIRED: off-by-one')
    expect(polls).toBeGreaterThan(1)
  })

  test('polls when the first message page has no assistant text and never leaks the password', async () => {
    let polls = 0
    const base = fake(async (_req, url) => {
      if (url.pathname === '/api/session') return Response.json({ data: { id: 's2' } })
      if (url.pathname === '/api/session/s2/prompt') return Response.json({ data: {} })
      if (url.pathname === '/api/session/s2/message') {
        polls++
        if (polls === 1) return Response.json({ data: [{ type: 'user', id: 'u1', text: 'review' }] })
        return assistant('polled review')
      }
      return new Response('not found', { status: 404 })
    })
    const result = await requestReview({ baseUrl: base, password: 'secret', prompt: 'review', timeoutMs: 3000 })
    expect(result.text).toBe('polled review')
    expect(polls).toBeGreaterThan(1)
    expect(JSON.stringify(result)).not.toContain('secret')
  })

  test('surfaces an assistant error instead of returning empty text', async () => {
    const base = fake(async (_req, url) => {
      if (url.pathname === '/api/session') return Response.json({ data: { id: 's3' } })
      if (url.pathname === '/api/session/s3/prompt') return Response.json({ data: {} })
      if (url.pathname === '/api/session/s3/message') {
        return Response.json({ data: [{ type: 'assistant', id: 'a1', error: { message: 'quota denied' }, content: [] }] })
      }
      return new Response('not found', { status: 404 })
    })
    await expect(requestReview({ baseUrl: base, prompt: 'review', timeoutMs: 1000 })).rejects.toThrow('quota denied')
  })

  test('surfaces HTTP failures', async () => {
    const base = fake(() => new Response('nope', { status: 500 }))
    await expect(requestReview({ baseUrl: base, prompt: 'review', timeoutMs: 1000 })).rejects.toThrow('500')
  })

  test('times out without a review', async () => {
    const base = fake(async () => new Promise<Response>(() => {}))
    await expect(requestReview({ baseUrl: base, prompt: 'review', timeoutMs: 120 })).rejects.toThrow('timed out')
  })

  test('writes a report to an explicit nested path', () => {
    const root = mkdtempSync(join(tmpdir(), 'opencode-review-out-'))
    try {
      const path = join(root, 'nested', 'external-review.md')
      expect(writeReviewAt(path, { prompt: 'review this', model: 'opencode/glm-5.3-flash-free#max', result: { sessionId: 's5', text: 'findings' } })).toBe(path)
      expect(readFileSync(path, 'utf8')).toContain('findings')
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('writes a report without the password', () => {
    const root = mkdtempSync(join(tmpdir(), 'opencode-review-'))
    try {
      const path = writeReviewReport({ root, prompt: 'review this', model: 'opencode/glm-5.3-flash-free#max', result: { sessionId: 's4', text: 'findings' } })
      const text = readFileSync(path, 'utf8')
      expect(text).toContain('review this')
      expect(text).toContain('findings')
      expect(text).toContain('opencode/glm-5.3-flash-free#max')
      expect(text).not.toContain('secret')
    } finally { rmSync(root, { recursive: true, force: true }) }
  })
})
