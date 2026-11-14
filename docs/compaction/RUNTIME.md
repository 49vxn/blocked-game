# Runtime snapshot

Snapshot: 2026-11-03 13:49. Re-check before relying on it.

| Surface | State |
| --- | --- |
| LAN host `:3000` | **Running** PID 2032, current ore build at `http://10.47.1.88:3000` |
| Build served | Both hosts run the current `dist`, including 0030, 0031 and the client fixes |
| Local server `:3002` | **Running** PID 5016, `127.0.0.1:3002`, health 200, current ore build |
| Old local `:3001` | Stopped |
| Public Freebuff Site | **Published at https://clache.freebuff.page** on 1.6.7; anonymous guest online play. Predates today’s bridge-assist, Bloxd-preset, FFA and client-fix changes. |
| Cloudflare tunnel | Down |
| Brand | Source/UI currently **Clache**; school/LAN target **KevCraft** is a pending code change |
| OpenCode review server | Stopped after the Freebuff restart; restart it before the next external review |
| Project VCS | **No git repository**; use workspace copies/backups |

## Verification

```text
bun run typecheck
exit 0

bun test --max-concurrency 1 --timeout 10000
469 pass, 0 fail, 22,507 expect() calls, 44 files, 37.49s

bun run build:node
pass; dist/server/main.js 343.42 kB

bun test (default parallel)
can hit two 5s timeouts in existing bot simulation tests; no assertion failed
```

The standard parallel runner is CPU-contention sensitive on this machine. Use
`--max-concurrency 1 --timeout 10000` when an exact all-green transcript is
needed; do not change test assertions to hide it.

## Local server command

```bash
node dist/server/main.js --port 3002 --host 127.0.0.1 --workers 1
```

Current log:

```text
Clache 1.6.7: http://localhost:3002 (1 game process)
```

Do not restart while friends are playing. A rebuild refreshes `dist` but does
not change the already-running server process.

## Source/build

- `dist` was rebuilt from current source: `dist/server/main.js` 343.42 kB.
- Both hosts were restarted on the ore build: LAN PID 2032, local PID 5016.
  The live room reconnected into its waiting phase.
- `src/games/bedwars/bots.ts` is **read-only** (444).
- `_attic/` is local archive; `bunfig.toml` excludes it from tests.
- No public deploy or git command was performed.

## Headless reviewer

```bash
PASS=$(sed -n 's/^server password //p' .agents/logs/opencode-serve.log | tail -1)
OPENCODE_SERVER_PASSWORD="$PASS" \
OPENCODE_MODEL='opencode/glm-5.3-flash-free#max' \
OPENCODE_AGENT='plan' \
bun run workflow review-external <agent> <task-id>
```

The v2 API is under `/api`; the one-shot `opencode run` path is not reliable
here. The report lands in the workspace's `external-review.md`. The server
password is generated per start and stays in `.agents/logs/opencode-serve.log`.

## Known test caveat

The two standard-parallel failures seen during this work were:

- `easy bots play a full round to a winner` (5s harness timeout)
- `expert bots shoot arrows and throw fireballs at enemies out on bridges` (5s
  harness timeout)

Both pass isolated and in the sequential full suite. This is a wall-clock
timeout under parallel simulation load, not a failing assertion.
