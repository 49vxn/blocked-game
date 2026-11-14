# Agent notes: src/games/bedwars/maps

Procedurally built arenas and the practice sandbox.

- `arena.ts` — arena layouts and `yawToward`.
- `base.ts`, `builder.ts`, `parts.ts`, `plan.ts`, `themes.ts` — the layout
  builders and shared map pieces.
- `sandbox.ts` — the practice platform, stations, labels, dummies and shops.
- `types.ts` — `MapDef`, generators, NPCs, labels and build limits.

Rules:

- Maps are code, not asset files. Keep them deterministic for a seed.
- The sandbox has a “Movement test: M switches presets” label near spawn; keep
  the station signs and labels in sync with controls.
- Changes to layouts need `bun test tests/maps.test.ts` (beds, headroom,
  protected zones, clear lanes, bot routes).
- Do not place blocks in a protected zone or wall a bot into its base.
