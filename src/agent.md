# Agent notes: src

This is all runtime source. Read `../AGENT.md` and `../AGENTS.md` first.

- `engine/` — reusable simulation and rendering. It must never import a game
  module; `tests/architecture.test.ts` enforces that.
- `games/bedwars/` — the BedWars rules, room, bots, maps, protocol and browser
  client. This is the only game in the tree right now.
- `server/` — Node HTTP/WebSocket host used for LAN play.
- `sites/` — Cloudflare Sites worker and relay path.

Before changing a shared interface, write or update the task contract and freeze
the interface. Do not put DOM code in `engine/`, and do not import BedWars from
`engine/`.

Verify from the project root:

```bash
bun run typecheck
bun test
```
