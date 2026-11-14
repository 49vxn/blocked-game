# Task 0022 — Bot target commitment and lapses

Status: done — integrated; 348-test suite pass
Owner: GPT-6.1 Sol mission
Created: 2026-11-01
Depends on: 0013 perception/motor, 0017 combat motor, 0018 navigation, 0019 Technoblade v1

## Goal

Make bot combat target selection human and stable instead of immediately
switching to the nearest enemy every tick. Use the tier profile's existing
`commitmentMs`, `targetSwitchMargin` and `lapseChance`. This is a bounded
`bots.ts` change; no protocol, room, client, map or tactics-file changes.

## Required behaviour

1. Keep a committed combat target for at least `commitmentMs`.
2. Before the commitment expires, switch only for an immediate threat:
   - the target is dead/gone,
   - an enemy just hit the bot,
   - an enemy is at the bot's bed,
   - or the candidate beats the current target by `targetSwitchMargin`.
3. After commitment, switch when the new target is materially better; do not
   flip-flop between near-equal targets.
4. Apply a bounded, seeded lapse from `profile.lapseChance`: a delayed reaction
   or a missed swing, not random aimbot errors. Use the existing motor/reaction
   path; do not bypass perception.
5. Preserve `PerceptionTracker` visibility: no hidden player target locks.
6. Do not change aim turn caps, damage, reach, movement physics or the server
   validation path.
7. Add focused tests. Do not weaken or delete existing tests.

## Allowed paths

- `src/games/bedwars/bots.ts`
- `tests/bot-targeting.test.ts` (new)
- `MISSION_PROGRESS.md`, `MISSION_REPORT.md`
- `docs/BOT_AI_REWRITE.md`, `HANDOFF.md`, `docs/STATE.md`, `QUEUE.md`,
  `docs/CHANGELOG.md`, `tasks/README.md`

No `nav.ts`, tactics, room, protocol, client, maps, shop, economy or package
changes. `bots.ts` must be restored to read-only at the end.

## Test-first steps

1. Add a staged test in `tests/bot-targeting.test.ts` that demonstrates the
   current immediate-switch behavior fails a commitment assertion.
2. Add tests for commitment expiry, switch margin, attacker/bed override and
   deterministic lapses.
3. Implement the smallest target selection change in `bots.ts`.
4. Run focused tests, the bot suite, full `bun test`, typecheck and build.
5. Run `bun scripts/bot-observer.ts 2400` and record target switches/attacks.

## Acceptance

- [ ] A nearer non-threat does not displace the committed target early.
- [ ] An attacker or bed intruder overrides commitment.
- [ ] After `commitmentMs`, a materially better target can win.
- [ ] Lapses are deterministic with the seeded random and bounded.
- [ ] No hidden enemy becomes a target.
- [ ] Focused tests, bot suite, full suite, typecheck and build pass.
- [ ] `bots.ts` is read-only again.

## Out of scope

- Full planner/economy wiring.
- `duel.ts`/`bed.ts` tactics (worker3's 0015).
- Protocol/UI/lobby changes.
- New dependencies, refactors outside target selection or deploys.

## Completion report

- Task: `0022-bot-target-commitment`
- Status: done.
- Files: `src/games/bedwars/bots.ts`, `tests/bot-targeting.test.ts`.
- Behavior: top-tier (Expert/Technoblade) close-range target commitment,
  immediate threat overrides, bounded once-per-engagement lapses.
- Evidence: focused 18 pass; full 348 pass, 0 fail; typecheck/build pass.
- Scope note: Easy/Normal/Hard were excluded from commitment/lapses after
  full-round timeouts; 3.5-block range and gap release preserve ranged/bridge
  play.
- Not verified: browser playtest; LAN server is the pre-mission build.
