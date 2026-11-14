# Agent notes: src/engine/render

Three.js rendering and the voxel meshing pipeline.

- `chunks.ts` — chunk renderer, worker lifecycle and the main-thread fallback.
- `mesh-worker.ts` / `mesher.ts` / `chunk-mesher.ts` — geometry generation.
- `textures.ts` — procedural 16×16 textures and the atlas.
- `shaders.ts` — chunk material, fog and light.
- `sky.ts`, `entities.ts`, `atlas-layout.ts` — sky dome, block cursor and atlas
  coordinates.

Rules:

- The renderer must not import BedWars game rules.
- F3 diagnostics report chunks, mesher mode, draw calls, triangles and fog.
- Changes to meshing or lighting need `bun test tests/render.test.ts`.
- A browser/WebGL check is required for visible rendering changes.
