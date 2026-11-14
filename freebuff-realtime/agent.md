# Agent notes: freebuff-realtime

Local helpers for the Freebuff Sites realtime path.

- `README.md` — setup, local multi-worker test, ticket model and limits.
- `server.js`, `browser.js`, `worker.js` — helper runtime.
- `browser.d.ts` — browser typings.
- `wrangler.jsonc` — local helper worker configuration.

Read `README.md` before changing anything here. These helpers support the hosted
Sites path, not the Node LAN server.

Rules:

- Never upload the development helper as tenant code.
- Never expose platform Cloudflare credentials.
- Authenticate and authorize tickets on the server; derive the user id from the
  verified session, not from the browser.
- Test with local Wrangler and two clients before deploying.
- Do not deploy without the human's explicit permission.
