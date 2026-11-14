# Agent notes: src/games/bedwars/sim

Pure game rules. These modules must not import `room.ts`, `client/` or `maps/`
and must not touch the DOM.

- `combat.ts` — damage, armour, crits, knockback, reach, shields.
- `beds.ts` — bed partner lookup and break permission.
- `look.ts` — validated skin/hair/outfit/cape/trail/kill-effect codes.
- `parkour.ts` — checkpoint/timer/finish progress and round timing.
- `generators.ts` — generator/drop types and pickup eligibility.

Rules:

- Keep these functions deterministic and testable without a Room.
- Generator pickup: home forges use a two-block, on-ground rule; diamond and
  emerald piles use the normal radius. One taker per pile per tick.
- Changing combat or beds requires `tests/combat.test.ts` or
  `tests/building.test.ts`; generator behavior uses `tests/game.test.ts`.
- Do not add a room or client import to satisfy a convenience helper.
