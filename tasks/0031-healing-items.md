# Task 0031 — More healing items

Status: review — tests/build pass; live on :3000/:3002 (PIDs 10104/18068)
Owner: integrator (Buffy)
Created: 2026-11-03
Depends on: current BedWars shop and potion path

## Goal

Give BedWars players more ways to recover health than the single golden apple:
an instant healing potion, a regeneration potion, and an enchanted golden apple.
All are server-authoritative, stack sanely, and appear in the existing shop.

## Ownership

- Files allowed to change:
  - `src/games/bedwars/items.ts`
  - `src/games/bedwars/shop.ts`
  - `src/games/bedwars/arsenal.ts`
  - `src/games/bedwars/room.ts`
  - `src/games/bedwars/client/hud.ts`
  - `src/games/bedwars/upgrade.ts`
  - `tests/upgrade.test.ts`
  - `tests/items.test.ts`, `tests/arsenal.test.ts`
  - `docs/CHANGELOG.md`, `FEATURES.md`, `tasks/README.md`
- Off-limits: protocol wire format, maps, bots, client input, dependencies.
- Shared interface owner: integrator.

## Contract

- Add `Effect` member `regen`.
- `healing_potion`: potion, stack 2, instant heal 6, shop cost 1 emerald.
- `regen_potion`: potion, stack 2, Regeneration for 10 s, 1 HP per 1.5 s,
  shop cost 2 emeralds.
- `enchanted_apple`: food, stack 1, instant heal 8 plus Regeneration 6 s,
  shop cost 6 gold.
- Golden apple keeps its existing 8 HP heal and 2-stack limit.
- `onUse` handles any food item's `heal` metadata, not only golden apples.
- Regen ticks in the room, works after damage, and is cleared on death/respawn.
- The HUD lists Regen alongside Speed/Jump/Invisible.
- Golden apple cost rises from 3 to 5 gold.
- FFA tier packages at 2, 5, 7, 8 and 9 grant extra healing consumables.
- No protocol change: `SelfView.effects` is already JSON and is keyed by
  `Effect`.

## Acceptance

- [ ] Focused item/potion tests pass.
- [ ] A healing potion heals exactly 6 and is consumed.
- [ ] A regen potion ticks health up after damage and expires.
- [ ] An enchanted apple heals 8 and applies regen.
- [ ] Shop offers show the three new entries with the stated costs.
- [ ] Typecheck, full suite and `build:node` pass.
