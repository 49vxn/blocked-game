# Agent notes: src/engine/net

Transport and room hosting for the shared engine.

- `host.ts` — Node WebSocket host, room keys and worker pinning.
- `room.ts` — the `RoomLike` / `RoomFactory` interface.
- `client.ts` — browser and local connections.
- `codec.ts` — byte writer/reader and the message codec interface.
- `clock.ts` — fixed-tick timing.
- `lag-comp.ts` — rewind history for melee.

Rules:

- Binary message shapes are shared with the client, server and bots. A change
  needs `tests/snapshots.test.ts` and `tests/netcode.test.ts`.
- Never trust a client's position, speed or hit claim.
- Keep the room interface game-agnostic; BedWars lives in `src/games/bedwars/`.
- Read `docs/AGENT_WORKFLOW.md` before changing a shared message shape.
