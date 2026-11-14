type Fetcher = { fetch(request: Request): Promise<Response> }
export type Env = {
  ASSETS: Fetcher
  REALTIME?: { idFromName(name: string): unknown; get(id: unknown): Fetcher }
  APP_ORIGIN?: string
}
const PATH = '/.well-known/freebuff/realtime'
const GUEST_COOKIE = 'clache_guest'
const loopback = (request: Request) => ['localhost', '127.0.0.1', '[::1]'].includes(new URL(request.url).hostname)
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store', ...headers } })
const roomName = /^bedwars:(arena|survival):[a-zA-Z0-9-]{1,32}:(fast|normal)(?::t[1-4])?$/

function sameOrigin(request: Request, origin: string): boolean {
  const source = request.headers.get('origin') ?? request.headers.get('referer')
  if (!source) return false
  try { return new URL(source).origin === origin } catch { return false }
}

/** A stable anonymous identity for this browser; no account or external service. */
function guestId(request: Request): { id: string; setCookie: boolean } {
  const cookie = request.headers.get('cookie') ?? ''
  const match = cookie.match(/(?:^|;\s*)clache_guest=([a-zA-Z0-9-]{8,64})/)
  if (match) return { id: match[1], setCookie: false }
  return { id: crypto.randomUUID(), setCookie: true }
}

function guestHeaders(guest: { id: string; setCookie: boolean }, secure: boolean): Record<string, string> {
  if (!guest.setCookie) return {}
  return { 'Set-Cookie': `${GUEST_COOKIE}=${guest.id}; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}` }
}

/** Named rooms are open to same-origin visitors who know the code. */
export async function ticket(request: Request, env: Env, userId: string): Promise<Response> {
  const origin = env.APP_ORIGIN ?? new URL(request.url).origin
  if (!sameOrigin(request, origin)) return json({ error: 'Cross-origin request refused.' }, 403)
  if (!env.REALTIME) return json({ error: 'Realtime is unavailable. Try again shortly.' }, 503)
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return json({ error: 'Expected JSON.' }, 415)
  const reader = request.body?.getReader()
  if (!reader) return json({ error: 'Expected a room.' }, 400)
  let size = 0, text = ''
  const decoder = new TextDecoder()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 512) { await reader.cancel(); return json({ error: 'Request too large.' }, 413) }
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
    const body = JSON.parse(text)
    if (typeof body?.room !== 'string' || !roomName.test(body.room)) return json({ error: 'Invalid room code.' }, 400)
    const response = await env.REALTIME.get(env.REALTIME.idFromName('hub')).fetch(new Request('https://realtime/ticket', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room: body.room, userId, origin, publish: true, presence: true }),
    }))
    if (!response.ok) return json({ error: 'Realtime is unavailable. Try again shortly.' }, response.status === 429 ? 429 : 503)
    const result = await response.json() as { websocketUrl: string }
    if (loopback(request)) {
      const socket = new URL(result.websocketUrl)
      const app = new URL(origin)
      socket.protocol = app.protocol === 'https:' ? 'wss:' : 'ws:'
      socket.host = app.host
      result.websocketUrl = socket.href
    }
    return json(result)
  } catch { return json({ error: 'Could not create a realtime ticket.' }, 400) }
  finally { reader.releaseLock() }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname
    const origin = env.APP_ORIGIN ?? url.origin
    const secure = origin.startsWith('https:')
    const handle = async (req: Request) => {
      const guest = guestId(req)
      const cookies = guestHeaders(guest, secure)
      if (path === '/api/player' && req.method === 'GET') return json({
        configured: !!env.REALTIME,
        signedIn: true,
        guest: true,
      }, 200, cookies)
      if (path === '/api/realtime/ticket') {
        if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405)
        return ticket(req, env, guest.id).then((response) => {
          if (!Object.keys(cookies).length) return response
          const copy = new Headers(response.headers)
          for (const [key, value] of Object.entries(cookies)) copy.set(key, value)
          return new Response(response.body, { status: response.status, headers: copy })
        })
      }
      if (path === PATH && loopback(req) && env.REALTIME && req.method === 'GET' && req.headers.get('Upgrade')?.toLowerCase() === 'websocket')
        return env.REALTIME.get(env.REALTIME.idFromName('hub')).fetch(req)
      if (path === '/healthz') return json({ ok: true, multiplayer: 'browser-hosted' })
      if (path.startsWith('/api/') || path === PATH) return json({ error: 'Not found.' }, 404)
      return env.ASSETS.fetch(req)
    }
    return handle(request)
  },
}
