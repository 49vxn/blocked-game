# OpenCode + GLM workflow research

Status: decision note, not an approved implementation contract.
Written: 2026-11-01. Re-check model/provider facts before acting; this field moves fast.

## What is on this machine

- **OpenCode Desktop 2.1.4** is installed at
  `C:\Users\Kevin\AppData\Local\Programs\@opencodedesktop\OpenCode.exe`.
- The desktop background service writes
  `~/.local/state/opencode/service.json` with a loopback URL and password. The
  service was on `127.0.0.1:28894` during this check; it serves the desktop web
  UI, so `/global/health` returned HTML rather than the v2 API. Do not treat that
  port as the API.
- The CLI is at
  `%APPDATA%\ai.opencode.desktop\cli\2.1.4-x64\opencode-cli.exe`.
  It reports `opencode v2.1.4`, supports `serve`, `run`, `acp`, `api`, `mcp`,
  `models`, `session`, `service` and `--prompt`.
- `opencode models` lists:
  `opencode/glm-5.3-flash-free`, `opencode/deepseek-v4.1-flash-free`,
  `opencode/beam-free`, `opencode/flint-40b-free`, and other free models.
- **Verified live on this machine:** `opencode/glm-5.3-flash-free#max`
  (the `max` reasoning variant) returns non-empty text through the v2
  `/api/session` + `/api/session/{id}/prompt` + `/api/session/{id}/message`
  flow. The `plan` agent is read-only. A 33 KB review of worker3/0015 completed
  with a PASS verdict.
- **`opencode run` one-shot output is unreliable here** (exited 0 with empty
  stdout). Use the loopback server API, not the one-shot CLI, for headless work.
- The v2 API is under `/api`, not the old root routes. The first bridge version
  targeted `/session` and was fixed in this pass.
- **No third-party Freebuff↔OpenCode bridge is installed.** The project uses
  its own local bridge, `scripts/opencode-review.ts`, invoked by
  `workflow review-external`.

## What the research says

### OpenCode is a good external worker/reviewer

- `opencode serve` is a headless HTTP server with an OpenAPI/JSON API, SSE
  events and a TypeScript SDK.
- It supports sessions, blocking prompts, async prompts, permission replies,
  diffs, forks and runtime MCP registration.
- It can run read-only reviewer agents with `permission.edit: deny` and
  restricted tools.
- Security boundary: bind loopback (`127.0.0.1`), set
  `OPENCODE_SERVER_PASSWORD`, do not enable CORS for arbitrary origins, and use
  a VM/container if stronger isolation is needed. OpenCode has no built-in
  container sandbox.

### Freebuff has no supported outbound bridge

- Freebuff is an MCP **client**, not an MCP server, and has no headless/ACP
  outbound interface. There is no official “Freebuff sends a prompt to
  OpenCode” feature.
- Community wrappers can drive Freebuff Desktop through its private
  orchestrator, but mutation routes have returned 403 and the wrappers pin
  Desktop versions. They are not a stable foundation for the project.
- The practical bridge is therefore a local script run by a Freebuff worker
  through the terminal: it calls OpenCode’s loopback API/CLI, waits for a
  response, and writes the result into the project mailbox. This is a bridge we
  control, not a Freebuff product integration.

### GLM-5.3-Flash free is real, with a catch

- `opencode/glm-5.3-flash-free` is an OpenCode Console free model, not a Z.ai
  free API tier. It is free for a limited time, with unpublished daily limits.
- Free models are restricted to OpenCode clients. Reports show the free-tier
  gate can reject tool-restricted requests such as a reviewer with
  `bash: deny`/`read: false`; `bash: ask` or keeping the normal tool list may
  work, but this is version-sensitive.
- The paid alternatives are OpenCode Go (`opencode-go/glm-5.3-flash`) or Z.ai
  pay-as-you-go. Z.ai’s free API models are older 4.x Flash models, not 5.3.
- A real session now passes on this machine with `#max` and the `plan` agent.
  The remaining limits are the unpublished daily quota and long/dense diffs;
  keep the human/integrator gate and fall back to DeepSeek if a review is
  rejected or empty.

### Model economics and quality

- Freebuff bills **wall-clock hours**, not tokens. Token-billed OpenCode is a
  different budget shape.
- The current free DeepSeek V4.1 Flash 10/17 model is stronger on the available
  coding/review comparisons than GLM-5.3-Flash; GLM’s case is price, context and
  a genuinely independent second opinion, not coding superiority.
- GLM-5.3-Flash is cheap per review (roughly cents for a scoped diff), but its
  free OpenCode route is quota/gate-limited. Use it as a second reviewer, not
  the only reviewer.

### Multi-agent architecture

- Centralized orchestration contains errors much better than independent
  parallel writers. Keep one integrator and one merge gate.
- Parallelism pays for file-disjoint work; it hurts sequential work and
  same-file edits.
- File-based JSONL mailboxes, task DAGs, read-only reviewers and file leases are
  the durable patterns. Worktrees isolate files, not ports or shared test state.
- Do not run three writers in `bots.ts`, `room.ts`, `protocol.ts`,
  `client/game.ts` or `client/hud.ts`.

## Decision for this project

- **Freebuff slots:** this integrator + two implementation workers = the three
  Freebuff sessions. Currently `worker3/0015` is active and two slots are free.
- **OpenCode:** one optional read-only reviewer (possibly two, one per worker).
  OpenCode does not hold a Freebuff workspace slot.
- **No third writer per core file.** OpenCode reviewers never edit the checkout.
- **Bridge shape (implemented in 0020):** `scripts/opencode-review.ts`:
  1. Reads `OPENCODE_BASE_URL` and `OPENCODE_SERVER_PASSWORD` from the
     environment, never from committed files.
  2. Sends a scoped review prompt plus a diff/file list.
  3. Verifies a non-empty response (the API has reported HTTP 200 with an empty
     body).
  4. Writes a Markdown/JSON result into `.agents/mailbox/`.
  5. Times out and never auto-approves a merge.
- **No direct Freebuff↔OpenCode product dependency.** A Freebuff worker can
  invoke the script in its terminal; that is the supported bridge today.
- **Free model fallback:** try `opencode/glm-5.3-flash-free` with `bash: ask` and
  `read` enabled. If the free-tier gate rejects it, use the paid Go/DeepSeek
  path or keep GLM as a non-blocking second opinion.

## Branding decision

- **Clache** for public/outside-localhost.
- **KevCraft** for school/LAN.
- The source currently has one `BRAND` value (`Clache`). A dual brand needs a
  small host-aware helper and a task contract; do not scatter names further
  until that exists.

## Cleanup decision

- `_attic/` holds the old `buff-bundle`, integrated worker2 workspace, failed
  bot-wiring attempts and the renderer review brief.
- `_attic/` is ignored by git/build and is not shipped.
- No core source refactor in this pass. Split `bots.ts`, `room.ts` and the
  client files one contract at a time after 0015.

## Implemented local bridge

- `bun run workflow review-external <agent> <task-id> --print` builds a
  read-only prompt from the contract and workspace, after a fresh passing
  check and mechanical review. Without `--print`, it calls the loopback bridge
  and stores `external-review.md` plus a JSON receipt.


- `scripts/opencode-review.ts` creates a v2 session with
  `model: {providerID, id, variant}` and the `plan` agent, sends the prompt,
  waits for the final assistant turn (not an intermediate `tool-calls` turn),
  enforces a timeout, refuses non-loopback URLs, and writes the report to the
  requested path or the mailbox.
- Tested against an in-process fake server and a live GLM `#max` session. The
  first review exposed three real defects, now fixed: old root routes, returning
  an intermediate assistant sentence, and `--out` not writing a file.
- The review prompt inlines the changed files and forbids tools; this avoids the
  free model's tool loop and makes the review a single bounded turn.

## Open experiments

1. Measure GLM `#max` review latency and daily quota on larger diffs.
2. If the free gate rejects a file, record the exact error and fall back to
   DeepSeek rather than weakening the review.
3. Add a mailbox copy of `external-review.md` for the integrator summary.
4. Keep the human/integrator merge gate; do not auto-apply a review.

## Sources

- https://opencode.ai/docs/server/
- https://opencode.ai/docs/permissions/
- https://opencode.ai/docs/mcp-servers/
- https://opencode.ai/v2/docs/console/models/
- https://opencode.ai/go
- https://docs.z.ai/guides/llm/glm-5.3
- https://github.com/CodebuffAI/freebuff/issues/947
- https://github.com/CodebuffAI/freebuff/issues/319
- https://github.com/toyro396133/freebuff-bridge
- https://github.com/Praket7/freebuff-mcp
- https://research.google/blog/towards-a-science-of-scaling-agent-systems-when-and-why-agent-systems-work/
- https://www.anthropic.com/research/multi-agent-research-system
