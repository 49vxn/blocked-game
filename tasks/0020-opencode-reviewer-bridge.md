# Task 0020 — OpenCode reviewer bridge

Status: done - integrated; 330-test suite pass
Owner: Buffy (integrator)
Created: 2026-11-01
Depends on: `docs/OPENCODE_SWARM_RESEARCH.md`

## Goal

Provide a local, read-only reviewer bridge that a Freebuff worker can invoke
from its terminal. It calls an OpenCode v2 API on loopback, waits for a review,
and writes the result into `.agents/mailbox/`. It never edits the checkout.

This is a tooling task. No game, room, protocol, map, client or bot behavior is
in scope.

## Required behaviour

1. `scripts/opencode-review.ts` exports a testable `requestReview` function and
   a CLI entry point.
2. Base URL must be loopback (`127.0.0.1`, `localhost` or `[::1]`); any other
   host is refused before a request is sent.
3. Optional Basic auth uses `OPENCODE_SERVER_PASSWORD` or `--password`; the
   password is never written to the report or logs.
4. A review creates a session, sends a text prompt, and extracts assistant text
   from the blocking response. If the response is empty, it polls
   `GET /session/:id/message` until the timeout.
5. HTTP errors, empty responses and timeouts produce a clear error and non-zero
   CLI exit.
6. Results are written to `.agents/mailbox/opencode-review-<timestamp>.md` by
   default; `--stdout` prints instead.
7. No file edits, commits, deployments or live-server actions.
8. No new dependency.

## Allowed paths

- `scripts/opencode-review.ts` (new)
- `tests/opencode-review.test.ts` (new)
- `docs/OPENCODE_SWARM_RESEARCH.md`, `docs/README.md`, `HANDOFF.md`,
  `docs/STATE.md`, `docs/CHANGELOG.md`, `tasks/README.md`
- `tasks/0020-opencode-reviewer-bridge.md`

No game source, protocol, room, map, client or bot file.

## Test-first steps

1. Add `tests/opencode-review.test.ts` with an in-process fake OpenCode server.
2. Cover: loopback refusal, Basic auth, normal reply, empty reply then polled
   reply, HTTP failure, timeout and mailbox output.
3. Confirm the tests fail because the module does not exist.
4. Implement the bridge and rerun focused tests.
5. Run `bun run typecheck`, full `bun test` and `bun run build:node`.

## Acceptance checks

- [ ] Non-loopback URLs are refused.
- [ ] Password is sent as Basic auth but absent from results/errors.
- [ ] Blocking response and empty-response polling both return review text.
- [ ] Timeout and HTTP errors fail clearly.
- [ ] Report file contains prompt, model/session metadata and response.
- [ ] No game files changed.
- [ ] Full suite, typecheck and build pass.

## Out of scope

- Starting an OpenCode server automatically.
- Free-model entitlement workarounds or tool-permission hacks.
- Direct Freebuff product integration; Freebuff has no supported outbound
  bridge.
- Auto-merging reviews or letting a reviewer edit code.

## Completion report

- Task: `0020-opencode-reviewer-bridge`
- Status: done, integrated in the shared checkout.
- Files changed: `scripts/opencode-review.ts` (new),
  `tests/opencode-review.test.ts` (new), plus workflow docs.
- Behaviour: loopback-only URL validation, optional Basic auth, session create,
  blocking reply, empty-reply polling, clear timeout/HTTP errors and mailbox
  report output. The password is never included in the result or report.
- Test-first evidence: the module-import test failed before implementation; the
  final tests cover loopback refusal, auth, normal reply, polled empty reply,
  HTTP 500, timeout and report redaction.
- Commands: focused tests 6 pass; full suite **330 pass, 0 fail** across 36
  files; `bun run typecheck` and `bun run build:node` pass; `--help` works.
- Not verified: a live OpenCode free-model review. The installed
  `opencode/glm-5.3-flash-free` smoke timed out earlier, and no v2 API server is
  running on 4096. The bridge was tested against an in-process fake server.
- Risks: free-model/tool-permission gates remain provider-dependent; this tool
  does not start OpenCode and does not auto-approve anything.
