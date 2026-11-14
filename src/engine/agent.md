# Agent notes: src/engine

Pure, reusable simulation and rendering helpers. **No DOM, no BedWars imports.**

- `physics.ts` — the shared player controller used by the client, server and
  bots. `stepMovement(world, mover, input, preset)` is the single movement path.
- `movement.ts` — Classic, Surefoot, Snapline and Flowline presets. Values are
  per tick at 20 TPS. All presets share the Classic blend controller and differ
  only in walk, sprint and sneak speed. Classic is the normal default at 4.9 /
  6.5 blocks/s. Do not restore the retired accelerate/brake model: its low
  acceleration let the old direction survive a turn.
- `world.ts`, `blocks.ts`, `items.ts`, `inventory.ts`, `building.ts`,
  `raycast.ts`, `melee.ts` — world and interaction primitives.
- `net/` — room host, codec, clocks and lag compensation.
- `render/` — chunks, meshes, textures, sky, shaders and the worker mesher.

Rules:

- Movement changes need `tests/movement.test.ts` and `tests/physics.test.ts`.
- Do not add a game import. `tests/architecture.test.ts` will fail.
- Do not fork the controller in the client; bots and prediction use the same
  `stepMovement`.
- Run `bun test tests/physics.test.ts tests/movement.test.ts` while iterating,
  then `bun test` for shared changes.
