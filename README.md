# Blocked

Two games in one voxel engine, built in the browser with three.js.

- **School Survival** — Wellington College rebuilt in blocks, 64 × 32 × 64. Eight
  seats, a 150-second round, and three disasters in a shuffled order at 20, 55 and
  90 seconds: a meteor takes the library roof, the field floods, the science
  corridors split. Red rings mark every impact before it lands; a meteor shower
  hunts anyone standing in the open. A gold beacon calls in a supply drop that
  heals the first survivor to reach it. Last one standing wins.
- **Bed Wars** — four teams on floating islands, beds to defend, forges,
  generators, a shop and bots that play the whole round.

## Run it

```sh
bun install
bun run build:node   # client -> dist/node-client, server -> dist/server
bun run start        # http://localhost:3000
```

For development, `bun run dev:node` serves the client with live reload and the
game server on one port.

Checks:

```sh
bun run typecheck
bun test --max-concurrency 1 --timeout 10000
```

## Controls (Survival)

| Action | Key |
| --- | --- |
| Move | W A S D |
| Jump, swim up | Space |
| Sneak | Shift |
| Sprint | R |
| Break block | Hold left click |
| Place block | Right click or E |
| **Shove** | **F** |
| Chat | T |
| Pause | Esc |

Survival gives every player wool to wall themselves in. Water slows you to 45%
speed and lets you swim up with Space; holding a jump clears the surface.

## Layout

- `src/engine/` — game-agnostic voxel engine: world, physics, meshing, shaders,
  networking. It must not import a game.
- `src/games/bedwars/` — the game layer: room rules, Bed Wars arenas, the campus
  map (`maps/campus.ts`), survival disasters (`sim/survival.ts`), bots, protocol
  and the browser client.
- `src/server/` — the Node HTTP/WebSocket host.
- `src/games/bedwars/bots/survival.ts` — survivor bots that dodge marked impacts
  and climb out of the water.
- `tests/` — headless coverage for physics, combat, rooms, maps, bots and the
  survival round.

## Credits

This standalone game incorporates the existing Clache engine and school-survival
work from the Blocked Spawn world. Textures are painted in code from 16 × 16
recipes; sounds are synthesised with Web Audio. Portions of the engine are
adapted from Voxelize; see `THIRD_PARTY_NOTICES.md` for its MIT licence.
