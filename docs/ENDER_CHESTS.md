# Ender chests and team chests

Status: source complete, tested headlessly, and included in the local `:3002`
build as of 2026-11-02. LAN `:3000` serves the same current build.

## Stations

- Two chest NPCs at each arena base and in the practice sandbox:
  - **Ender chest** (purple): personal, owner-only.
  - **Team chest** (brown with team trim): shared by that team.
- Rendered as blocky chest meshes with floating labels. No solid collision.
- Open by looking at the chest and using E/right-click. The server checks the
  player is alive, on a team and within 5 blocks of a matching chest.

## Storage

- 27 slots each (three rows of nine).
- Personal storage survives death and respawns.
- Team storage is shared by every living teammate.
- Both clear when the room resets or the player returns to the lobby.
- Any item type can move through in v1; gear loss on death remains normal.
- Server-authoritative: the client sends an action and slot index, never a slot
  payload; the server validates proximity, index and item movement.

## UI

- `Hud` storage modal shows the chest grid and the full inventory.
- Click a chest slot: `{t:'storage', action:'take', kind, index}` moves the
  whole stack to inventory.
- Click an inventory slot: `{t:'storage', action:'put', kind, index}` moves the
  whole stack to the chest.
- The server replies with `{t:'storage', kind, slots}` and the modal rerenders.
- Close with the Close button, outside click, or Esc. The game then re-locks the
  pointer as usual.

## Files

- `src/engine/inventory.ts` — `STORAGE_SIZE`, `emptyStorage`.
- `src/games/bedwars/maps/types.ts` — `Npc` kinds `ender`/`team`.
- `src/games/bedwars/maps/arena.ts`, `sandbox.ts` — chest stations.
- `src/games/bedwars/client/models.ts` — chest models/labels.
- `src/games/bedwars/client/hud.ts` — storage modal.
- `src/games/bedwars/client/game.ts` — interaction/message handling.
- `src/games/bedwars/protocol.ts` — storage messages.
- `src/games/bedwars/room.ts` — player/team vaults, validation, movement.
- `tests/game.test.ts` — sandbox storage and arena ender-chest tests.

## Tests currently cover

- Personal ownership isolation.
- Team sharing.
- Persistence across death.
- Distance refusal.
- 27-slot response.
- Map chest stations remain standable/covered (map suite).

## Manual checks after deploy

1. Open the ender chest, deposit iron, die, respawn, reopen: iron is still there.
2. Open the team chest as two teammates: both see the deposit.
3. Walk away and try to open: no storage opens.
4. Reset a round: both chests are empty.
5. Render: both chest models/labels are visible at every base.

## Risks / next

- No browser interaction test yet.
- The current rules allow any item; if that is too strong for competitive
  play, limit to resources/blocks in v2.
- Base-only stations; a placeable shop chest is a later option.
