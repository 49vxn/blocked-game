# Agent notes: tests

Headless Bun tests for simulation, netcode, bots, maps, rendering and the
client-side settings parser.

- Use `bun test` for the full suite.
- Use `bun test tests/<file>.test.ts` while iterating.
- `helpers.ts` has `flatWorld`, `mover`, `run` and `settle`.
- `room-helpers.ts` has `TestClient`, `arena`, `duel` and `sandbox`.

Rules:

- Never weaken an assertion to get green. If behavior changed on purpose, update
  the contract and the test together.
- Movement tests should assert observable outcomes (speed, stop distance, jump
  peak, sprint-jump distance), not implementation details.
- A UI or control change still needs a live browser check.
- The full suite was last seen green at **224 passing, 0 failing**.
