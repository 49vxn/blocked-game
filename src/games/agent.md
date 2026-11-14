# Agent notes: src/games

Game modules built on `src/engine/`.

Current game:

- `bedwars/` — the BedWars rules, room, bots, maps, protocol and client.

Adding a game:

1. Create `src/games/<name>/` with its blocks, items, room and `RoomFactory`
   modelled on `src/games/bedwars/server.ts`.
2. Register block and item definitions.
3. Point `vite.config.ts` and `src/server/main.ts` at the new factory, or select
   by URL.
4. Reuse `engine/render` and write the game's own HUD.

The engine must stay game-agnostic. Do not import a game from `src/engine/`.
Read `docs/GAMES_HUB.md` for the planned multi-game hub before building a new
minigame.
