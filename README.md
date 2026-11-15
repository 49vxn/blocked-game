# Blocked

**A survival game set in our school, where the building is the enemy.** Three times
a round a disaster tears part of it apart, bots fill the empty seats, and the last
student standing wins.

Our school blocks every game site. Exam week, everything blocked at lunch, nothing
to do on the network. So this runs from one laptop on the school network: friends
open a URL and play in the browser — no internet, no installs, no accounts.

**Play it: https://49vxn.github.io/blocked-game/** — the public build runs solo
against bots; the LAN server is how a class plays together.

- **School Survival** — Wellington College rebuilt in blocks, 64 × 32 × 64. Eight
  seats, a 115-second round, and three disasters in a shuffled order: a meteor
  takes the library roof, the quake bounces you and brings the science corridors
down, and the field floods layer by layer. Every impact is marked before it lands; a meteor shower hunts anyone
  standing in the open. A gold beacon calls in a supply drop that heals the first
  survivor to reach it. Standing in flood water costs health from the first layer:
  ankle deep is 1 HP a second, waist deep is 2. Last one standing wins.
- **Bed Wars** — four teams on floating islands, beds to defend, forges,
  generators, a shop and bots that play the whole round.

## Run it

The static build on GitHub Pages runs solo only. To play with friends on one
network, run the game server too:

```sh
bun install
bun run build:node   # client -> dist/node-client, server -> dist/server
bun run start        # http://localhost:3000
```

For development, `bun run dev:node` serves the client with live reload and the
game server on one port. `bun run build:pages` makes the static build.

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

Clicking Play enters full screen and captures the mouse; Escape gives the cursor
back. Survival gives every player wool to wall themselves in. Water slows you to
45% speed and lets you swim up with Space.

## Layout

- `src/engine/` — game-agnostic voxel engine: world, physics, meshing, shaders,
  networking. It must not import a game.
- `src/games/bedwars/` — the game layer: room rules, Bed Wars arenas, the campus
  map (`maps/campus.ts`), survival disasters (`sim/survival.ts`), bots, protocol
  and the browser client.
- `src/server/` — the Node HTTP/WebSocket host used for LAN play.
- `tests/` — headless coverage for physics, combat, rooms, maps, bots and the
  survival round.

## Credits

Textures are painted in code from 16 × 16 recipes and sounds are synthesised with
Web Audio, so the game ships with no art or audio files. Portions of the engine
are adapted from Voxelize; see `THIRD_PARTY_NOTICES.md` for its MIT licence.
