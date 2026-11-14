# Operations: build, test, host and deploy

## Current processes

| Surface | State |
|---|---|
| Public site | Published, but the final check saw a document-load 502 / “Site unavailable”: https://site-b14a623b242947829ada4c6e48ac609e.freebuff.page |
| Local battle server `:3002` | **Running** on `127.0.0.1:3002`; re-check the PID |
| Public/LAN `:3000` | **Running** PID 15144 on `0.0.0.0:3000`; LAN `http://10.47.1.88:3000` |
| Old local `:3001` | Stopped |
| Cloudflare tunnel | Down; old URL is dead |

The battle server serves `dist/node-client`, not `src/`. A source edit does
nothing until rebuild.

## Build and test

From the project root:

```bash
bun install
bun run typecheck
bun test
bun run build:node
```

Focused bot checks:

```bash
bun test tests/bots.test.ts
bun test tests/bot-battle.test.ts tests/bot-tactics.test.ts \
  tests/bot-path.test.ts tests/bot-wiring.test.ts \
  tests/bot-technoblade.test.ts
bun scripts/bot-observer.ts 2400
```

The observer writes `.agents/bot-observer.jsonl` and samples.

## Local battle host

```bash
node dist/server/main.js --port 3002 --host 127.0.0.1 --workers 1
```

Open:

```text
http://127.0.0.1:3002/?play=1&world=arena&battle=1&room=bot-battle&name=Watcher
```

The battle room is local-only. It empties when the spectator disconnects.

## Published Sites host

The public Clache site is a Freebuff Sites Worker plus assets, built with
`bun run build` from `deploy.json` (`realtime: true`). Production has the
`REALTIME` binding attached; online tickets use an anonymous `clache_guest`
cookie and require no Freebuff auth. The build is published at:

```text
https://clache.freebuff.page
```

Solo, sandbox and anonymous online all work without an account. After a deploy,
verify `/`, `/healthz`, `/api/player` and a host/join ticket on the actual
origin before telling players to refresh.

## Public/LAN host

Only when the human approves:

```bash
node dist/server/main.js --port 3000 --host 0.0.0.0 --workers 1
```

Read the startup log for the current LAN IP. Do not rely on an old IP; Wi-Fi/VPN
changes it. `/healthz` and `/api/rooms` verify the listener.

A Cloudflare Quick Tunnel worked earlier:

```bash
.tools/cloudflared.exe tunnel --url http://127.0.0.1:3000 --no-autoupdate
```

It is ephemeral, unauthenticated and currently down. Do not assume the old URL
works.

## Safe deploy sequence

1. Read `docs/STATE.md`, `HANDOFF.md` and `QUEUE.md`.
2. Check `/api/rooms`; do not restart while friends are playing without warning.
3. `bun run typecheck && bun test`.
4. `bun run build:node`.
5. Stop only the PID listening on 3000; never kill by process-name pattern.
6. Start the server and verify `/`, `/healthz` and `/api/rooms`.
7. Update `HANDOFF.md`/`STATE.md` with the current IP/PID.
8. Tell players to hard-refresh if JS or the binary protocol changed.

## Rollback

There is no git history. `agent-task apply` backs up overwritten files under the
agent workspace. Keep a known build copy only if a rollback is genuinely
needed; do not leave stale build directories around.

## Troubleshooting

- **Port in use:** find the exact listener PID and stop only that process.
- **LAN unreachable:** check same Wi-Fi, firewall profile and client isolation.
- **Old tabs decode wrong:** hard-refresh; binary snapshots changed for team
  size and battle support.
- **Full screen denied:** use normal Chrome; allow full screen. Preview webviews
  refuse it.
- **Bots pass each other:** this is known; see `BOT_AI_REWRITE.md` and use the
  observer before changing pathfinding.
