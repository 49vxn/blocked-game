# Decisions that must survive

## Brand

- Public / outside-localhost: **Clache**.
- School / LAN: **KevCraft**.
- Source currently has one `BRAND` value (`Clache`). A host-aware helper is the
  only approved path; do not scatter alternative names through the code.
- Package IDs, repo paths and published Site IDs stay unchanged.

## Bots

- Keep human constraints at every tier; no aimbot/perfect aim.
- 0013 perception/motor is wired.
- 0014 planner/economy remains unwired; do not re-apply archived full-wiring
  attempts. Advisory defense/retreat and a dedicated endgame controller come
  first.
- 0015 tactics: duel/bed modules and the four GLM fixes are **integrated**;
  the worker3 workspace is cleaned. They are not wired into `bots.ts` yet;
  wiring is a separate reviewed contract.
- 0022 target commitment/lapses are **top-tier only** (Expert/Technoblade),
  close-range (3.5 blocks), with one bounded lapse per engagement. Broad
  application caused Easy/Hard timeouts, Dunes stalls and zero Expert ranged
  shots.
- Ground A* is wired. Bridge legs and disconnected targets still use the legacy
  bridge path.
- Technoblade is sandbox-only until the visible tier/protocol/UI work is done.
- Close-range stop and teammate-only yield stay; do not turn them into hard
  player collision.
- Home forge: standing teammates split the pile one item each per tick; a
  teammate away from the pad is not paid. Diamond/emerald piles keep one taker
  and are never copied.
- Invisibility hides a player from bots completely unless the bot hit them or
  was hit by them in the last two seconds. Do not restore the old three-block
  arm's-length sighting.
- Expert bed defence: guard radius 14; direct intruders within 8 blocks are met
  between bed and intruder, farther bridge fights keep pursuit. Far from home
  only an enemy at the bed recalls the bot.

## Touchpad bridge

- Forward autobridge is removed after play feedback.
- Bedrock bridge requires holding use/right-click + sneak + back; it places the
  cell behind the player and never places while walking forward.
- No phone touch-control layer; this remains a laptop touchpad feature.

## Workflow

- Two Freebuff writer sessions plus one **headless** reviewer. This thread is the
  integrator. The third Freebuff slot stays free.
- OpenCode/GLM does not take a Freebuff workspace slot. It is the reviewer, not a
  third writer.
- One writer per file. `bots.ts`, `room.ts`, `protocol.ts`, `client/game.ts` and
  `client/hud.ts` are high-risk.
- `review-external` is advisory. The integrator still reads the diff and
  integrates serially.
- No auto-merge, auto-deploy or auto-restart.
- Worker check must be fresh and pass; stale checks cannot be integrated.
- Worker3/0015 is integrated with the four GLM fixes and its workspace is
  cleaned; the tactics are still unwired in `bots.ts`.

## OpenCode / GLM

- No official Freebuff outbound headless/ACP bridge. Community wrappers are
  private-orchestrator guests with 403/version fragility; do not depend on them.
- The supported bridge is `workflow review-external` calling the loopback v2
  API. The old root-route bridge is obsolete.
- `opencode/glm-5.3-flash-free#max` with the read-only `plan` agent is verified
  live on this machine and is the primary reviewer. The changed files are
  inlined and tools are disabled; otherwise the free model loops on tool calls.
- DeepSeek/current Freebuff remains the coding fallback and a second opinion if
  GLM is quota-rejected or returns an empty report. Never auto-apply a review.

## Cleanup

- `_attic/` is archived local material and never shipped.
- Do not restore `crosscut-hack.user.js` or the old `buff-bundle` into the game.
- `_attic/**` is excluded from `bun test`.
- No source refactor of `bots.ts`, `room.ts`, `client/game.ts` or `hud.ts` in the
  cleanup pass; extract one module per contract later.

## Parkour

- Local `:3002` opens **Spiral Tower**: a solid cylindrical tower with 10
  ordered checkpoints, three rounds, timer/personal best, chase camera and
  keyboard-only look. `?map=classic` keeps the older five-checkpoint tutorial.
- Aquarium and Archway are in the arena rotation, built from the block palette.
- Do not import/copy Minecraft or Bloxd maps. Use layouts only as references.
- No combat/shop/beds/bots in parkour v1.
- Hub extraction and course variants are later.

## Upgrade Rush

- **Implemented in 1.6.7**: 2–8 FFA, 25 kills or 10 minutes, 10-tier package,
  kill heals 6 HP, death resets tier and removes only the dead player's placed
  blocks. Menu, HUD, late join and summary are wired.
- Original geometry only; no copied map/assets. 0030 expands the arena to
  eight one-player islands: four base islands plus four diamond spawn islands.
- Bots are in via 0027. 0030 adds a five-second performance director: easier
  after repeated human deaths, harder for a dominant human, with a ten-second
  cooldown and Easy/Expert clamps.

## Online play

- There is **no Freebuff auth** in the game or the Sites Worker. Do not re-add
  `/auth/freebuff`, `@freebuff/auth`, or a client-supplied user id.
- The Worker sets an HttpOnly `clache_guest` cookie, derives the realtime user
  id server-side, and mints same-origin tickets.
- The client room id includes `:t1`–`:t4`; the Worker validator must accept that
  suffix. Returning to a four-segment regex breaks every hosted Host/Join.
- The public Site is `https://clache.freebuff.page`; testers sign in to nothing.

## Runtime/deploy

- Local `:3002` is the feedback server. LAN `:3000` runs the same 1.6.7 build
  (PID 3572) at `http://10.47.1.88:3000`; do not restart it while a room is
  active. A rebuild refreshes `dist` but does not change a running process.
- No git initialization or commit.
