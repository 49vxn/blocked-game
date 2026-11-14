# Agent notes: src/server

The Node HTTP/WebSocket host used for LAN and local play.

- Serves the built client from `dist/node-client`.
- Mounts the game host at `/game`.
- Exposes `/healthz`, `/api/rooms`, `/api/player` and static assets.
- Accepts `--port`, `--host` and `--workers`.

Run:

```bash
bun run build:node
bun dist/server/main.js --port 3000 --host 0.0.0.0 --workers 1
```

Rules:

- Rebuild before restarting; the server serves the built client, not `src/`.
- Check `/healthz` and `/api/rooms` after a restart.
- `bun run smoke` covers routes, isolation and binary movement.
- Do not bind to a public interface without the human asking.
