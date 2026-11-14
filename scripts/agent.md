# Agent notes: scripts

Developer tooling. These are not game runtime code.

- `agent-task.mjs` — creates `.agents/<agent>/<task>/workspace`, records a hash
  baseline, prints a diff, applies after review and cleans up. It never edits
  the shared checkout during `new`/`diff`. Also supports `list --json` and
  `status --json`.
- `workflow.ts` — three-agent orchestration: plan, start/brief, check, review
  and serial integrate. It never deploys or restarts the server.
- `before-compaction.ts` — read-only fact collector for handoffs (typecheck,
  suite, listeners, recent files, tasks, workspaces) plus a handoff validator;
  `--build` is opt-in because it rewrites `dist/`.
- `workflow-lib.ts` — pure contract parsing, path ownership, planning and review
  rules; covered by `tests/workflow.test.ts`.
- `smoke-server.mjs` — built Node server routes, room isolation and movement.
- `smoke-sites.mjs` — Sites worker smoke test.
- `netprobe.ts` — lag/jitter probe.
- `loadtest.ts` — CPU and bandwidth per player.
- `make-icon.mjs`, `postbuild.mjs`, `dev-sites.mjs` — build helpers.

Rules:

- Keep `agent-task.mjs` and `workflow.ts` dependency-free and safe on Windows
  and POSIX. They are run with Bun, not bundled into the game.
- Never make `apply` delete files; overwrites need a backup.
- `workflow integrate` must stay serial and must not build, restart or deploy.
- Do not put game logic here.
- Test script changes with a real workspace, not by reading only.
