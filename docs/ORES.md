# Mineable ores

Status: implemented; browser playtest pending. Both LAN `:3000` and local
`:3002` run the ore build. The first insertion shifted block ids; ores are now
appended after every existing block so wool, beds and map tiles stay stable.

## What they are

Three map-only blocks appended to the block registry:

| Ore | Pickaxe needed | Drop |
|---|---|---|
| Iron ore | Wood | 1 iron |
| Gold ore | Iron | 1 gold |
| Diamond ore | Diamond | 1 diamond |

They are the **only map blocks a player can break**. `checkBreakable` refuses
ordinary map blocks; the ore metadata opts them in.

## Breaking and drops

- `breakTicks` returns `Infinity` when the held tool is not a pickaxe or its
  tier is below the ore's `oreTier`.
- `Room.breakBlock` checks `canFit` before removing the ore. A full inventory
  leaves the ore in place and sends “Your inventory is full.”
- A successful break removes the block and adds exactly one matching resource
  to the breaker. Ores do not respawn during a round; the next round rebuilds
  the arena.

## Placement

`maps/arena.ts` scatters exposed surface ores after the structures are built:

- 2 iron per base rim.
- 1 gold per diamond island.
- 1 diamond on the middle island.

Placement is deterministic from the arena seed. It skips reserved walkways,
lanes, spawn protection cells and bed cells, and requires air above the ore so
it is visible and reachable.

## Tests

`bun test tests/ores.test.ts` covers metadata, pickaxe gates, the map-only break
rule, at least one ore in every arena, and the room drop.

Not verified: a browser playtest of mining each ore with the correct pickaxe,
and the full-inventory refusal toast.
