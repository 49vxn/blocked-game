# Task 0028 — Bloxd-style mineable ore nodes

Status: review — implemented; browser playtest pending
Owner: Buffy
Created: 2026-11-03
Depends on: current arena builder and `room.ts` break path

## Goal

Add a small, deterministic set of mineable ore blocks to BedWars arenas. They
give players a second, spatial way to earn existing resources without replacing
generators, adding a new currency, or turning BedWars into survival mining.

This is **ore nodes**, not Bloxd survival ore generation. No caves, no smelting,
no crafting, no mobs and no map-wide mining.

## Why

Bloxd's BedWars maps use ores as a route decision: a base or middle island is
worth contesting because it contains a finite resource. Clache currently has
only generators, so every resource decision is a timer rather than a place.

The smallest useful version is a handful of one-time ore blocks embedded in
island rock, with pickaxe tiers deciding what can be mined. It creates a reason
to buy the pickaxe line and a small early-game route without changing the shop.

## Non-goals

- No coal, moonstone, raw ore, furnace or smelting system.
- No fifth currency.
- No ore respawn during a round.
- No bot ore targeting in v1; bots keep their current economy.
- No changes to shop prices, generator rates, beds or protocol.
- No new textures or assets: procedural ore textures only.

## Ownership

- Files allowed to change:
  - `src/games/bedwars/blocks.ts`
  - `src/games/bedwars/room.ts`
  - `src/games/bedwars/maps/arena.ts`
  - `src/games/bedwars/maps/builder.ts` (only if a placement helper is needed)
  - `tests/ores.test.ts` (new)
  - `tests/maps.test.ts`
  - `docs/ORES.md` (new), `docs/STATE.md`
- Off-limits: `bots.ts`, `protocol.ts`, `client/game.ts`, `shop.ts`, server,
  package/lockfile, `index.html`.
- One writer per file. `room.ts` is high-risk; do not combine with another
  room change.

## Contract

### Ore blocks

Three map-only blocks, appended after existing ids:

| Block | Pickaxe tier | Drop | Placement |
|---|---|---|---|
| Iron ore | Wood (tier 0) | 1 iron | Base rim |
| Gold ore | Stone (tier 1) | 1 gold | Diamond islands |
| Diamond ore | Iron (tier 2) | 1 diamond | Middle island |

Each is `requiresTool: true`, pickaxe, with normal stone hardness. Metadata:
`meta.ore = { resource, amount, tier }`.

### Breaking

- `checkBreak` allows a map ore block only when the block has ore metadata.
  All other map blocks stay unbreakable.
- `breakTicks` returns `Infinity` when the held pickaxe tier is below the ore's
  required tier. Any pickaxe or better works at or above the tier.
- On completion, `breakBlock` adds the drop to the breaker's inventory. If
  `canFit` is false, the break is refused, the block stays, and the player gets
  "Your inventory is full." Do not silently delete the resource.
- Ore blocks are not placed blocks; they never enter `placementOwner`.
- Ores do not respawn. The next round rebuilds the arena.

### Map placement

- Deterministic from the arena seed; every arena gets the same ore count and
  positions.
- **2 iron ore per base**, embedded one block below the walkable rim, outside
  reserved lanes, spawn protection, generator pads and bot body-height routes.
- **1 gold ore per diamond island**, in exposed rock outside the generator
  protection zone.
- **1 diamond ore on the middle island**, on the outer rock, not under the
  emerald landmark or a walkway.
- No ore may replace a bed, generator, shop, chest, ladder, walkway or
  reserved cell.
- Ores are single blocks, not veins. A small cluster is acceptable only if the
  total count stays bounded.

### UI

- No new HUD. Ore blocks use procedural textures with a coloured fleck pattern.
- The existing break progress and error toasts cover the interaction.
- Document the tier table in `docs/ORES.md`.

## Test-first plan

1. **`tests/ores.test.ts`**
   - metadata: iron/gold/diamond resource, amount and tier.
   - a wood pickaxe breaks iron but not gold or diamond.
   - a stone pickaxe breaks gold but not diamond.
   - a diamond pickaxe breaks all three.
   - a successful break adds exactly the resource and removes the ore.
   - a full inventory refuses the break and leaves the ore.
   - a normal map block still refuses to break.
2. **`tests/maps.test.ts`**
   - every arena has 2 iron per base, 1 gold per diamond island and 1 diamond
     at middle.
   - no ore sits in a protected zone, reserved lane or body-height route.
   - arena generation is deterministic across repeated calls.
3. Confirm the new tests fail before implementation, then implement the smallest
   changes.
4. Focused tests, typecheck, full suite, `build:node`.
5. Browser: mine one iron, one gold and one diamond with the correct pickaxe
   tiers; confirm the HUD resource count and the full-inventory refusal.

## Acceptance checks

- [ ] Ore metadata and tier gates are covered.
- [ ] Only ore map blocks can be broken; all other map blocks remain unbreakable.
- [ ] Drops go to the breaker only; no duplication on lag or double dig.
- [ ] Full inventory refuses cleanly.
- [ ] Every arena has the expected bounded ore count.
- [ ] Bots still complete a full round; their economy is unchanged.
- [ ] `bun test tests/ores.test.ts tests/maps.test.ts`
- [ ] `bun run typecheck`
- [ ] `bun test --max-concurrency 1 --timeout 10000`
- [ ] `bun run build:node`

## Review checklist

- [ ] Only allowed files changed.
- [ ] No new dependency or asset.
- [ ] No shop/generator/bed balance change.
- [ ] No bot changes.
- [ ] Ores stay out of walkways and protected zones.
- [ ] Known gap: bots ignore ores in v1.

## Completion report

- Task: 0028
- Status:
- Files changed:
- Commands run:
- What was verified:
- What was not verified:
- Known risks:
- Next action:
