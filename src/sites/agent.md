# Agent notes: src/sites

The Cloudflare Sites / Freebuff hosted path. It is separate from the Node LAN
server.

- `worker.ts` — the deployed Worker, anonymous guest tickets and routing.
- `relay.ts` — browser-hosted room transport.
- `client.ts` — the client connection.
- `wire.ts` — hosted wire helpers.

Read `freebuff-realtime/README.md` and the Sites guidance before changing
realtime tickets or bindings. The Node server must keep working independently.
There is no Freebuff auth: the Worker sets a local anonymous guest cookie.

Rules:

- Never put platform credentials or session tokens in project files or logs.
- Derive the guest id server-side; never trust a client-supplied user id.
- Test the hosted path separately; a Node test pass is not proof of Workers
  compatibility.
- Do not deploy or publish without the human's explicit authorization.
