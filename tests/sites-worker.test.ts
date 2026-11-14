import { expect, test } from 'bun:test'
import worker, { ticket, type Env } from '../src/sites/worker'

const origin = 'https://game.example'
function request(body: unknown = { room: 'bedwars:arena:test:normal' }, from = origin) {
  return new Request(origin + '/api/realtime/ticket', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: from }, body: JSON.stringify(body) })
}
function setup() {
  const calls: unknown[] = []
  const env: Env = {
    APP_ORIGIN: origin,
    ASSETS: { fetch: async () => new Response('assets') },
    REALTIME: { idFromName: (name) => name, get: () => ({ fetch: async (req) => {
      calls.push(await req.json())
      return Response.json({ websocketUrl: 'wss://game.example/.well-known/freebuff/realtime?ticket=ephemeral' })
    } }) },
  }
  return { env, calls }
}

test('ticket derives identity, origin and permissions on the server', async () => {
  const { env, calls } = setup()
  const response = await ticket(request({ room: 'bedwars:arena:test:normal:t1', userId: 'forged', origin: 'https://elsewhere.example', publish: false }), env, 'guest-id')
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(calls).toEqual([{ room: 'bedwars:arena:test:normal:t1', userId: 'guest-id', origin, publish: true, presence: true }])
})

test('cross-origin, oversized and invalid room requests do not mint tickets', async () => {
  const { env, calls } = setup()
  expect((await ticket(request({}, 'https://elsewhere.example'), env, 'guest-id')).status).toBe(403)
  expect((await ticket(request({ room: '../another-room' }), env, 'guest-id')).status).toBe(400)
  expect((await ticket(request({ room: 'x'.repeat(1000) }), env, 'guest-id')).status).toBe(413)
  expect(calls).toEqual([])
})

test('only Bed Wars and survival rooms can receive realtime tickets', async () => {
  const { env, calls } = setup()
  for (const world of ['arena', 'survival'])
    expect((await ticket(request({ room: `bedwars:${world}:test:normal:t1` }), env, 'guest-id')).status).toBe(200)
  for (const world of ['sandbox', 'parkour', 'upgrade', 'unknown'])
    expect((await ticket(request({ room: `bedwars:${world}:test:normal:t1` }), env, 'guest-id')).status).toBe(400)
  expect(calls).toHaveLength(2)
})

test('the deployed worker mints an anonymous guest ticket and keeps the local socket proxy off', async () => {
  const { env, calls } = setup()
  const response = await worker.fetch(request(), env)
  expect(response.status).toBe(200)
  const cookie = response.headers.get('set-cookie') ?? ''
  expect(cookie).toContain('clache_guest=')
  expect(calls).toHaveLength(1)
  const guest = cookie.match(/clache_guest=([a-zA-Z0-9-]{8,64})/)?.[1]
  expect(guest).toBeTruthy()
  expect((calls[0] as { userId: string }).userId).toBe(guest!)
  expect((await worker.fetch(new Request(origin + '/.well-known/freebuff/realtime', { headers: { Upgrade: 'websocket' } }), env)).status).toBe(404)
  expect(await (await worker.fetch(new Request(origin), env)).text()).toBe('assets')
})

test('missing realtime is actionable, while missing APP_ORIGIN falls back to the request origin', async () => {
  const { env } = setup()
  expect((await ticket(request(), { ...env, APP_ORIGIN: undefined }, 'guest-id')).status).toBe(200)
  expect((await ticket(request(), { ...env, REALTIME: undefined }, 'guest-id')).status).toBe(503)
})
