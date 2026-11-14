# BedWars research: what to take from Bloxd.io and Roblox

Research date: 2026-10-29. This is a design note, not a promise to copy another
game's balance. Prices and timers in community wikis are frequently stale or
conflicting, so every number below is a starting point to playtest, not a spec.

## Sources and confidence

- [Bloxd.io official BedWars page](https://bloxd.io/game/bedwars) — basic mode
  description only (four-player teams, sky islands, defend your bed).
- [Bloxd BedWars wiki](https://bloxd-io.fandom.com/wiki/Bedwars) and
  [tutorial](https://bloxd-io.fandom.com/wiki/Bedwars/Tutorial) — community
  maintained. The tutorial says its data is accurate as of 2026-06-09. The
  wiki contains cross-page price conflicts (for example Fireball 30 vs 60 coal),
  so treat exact costs as unverified.
- [Bloxd Player Controls](https://bloxd-io.fandom.com/wiki/Player_Controls) —
  community wiki. Documents E / right click to place or interact, Tab for
  inventory, B for the shop, and custom key bindings added 2024-06-21.
- [Roblox BedWars official page](https://www.roblox.com/games/6872265039/BedWars)
  — objective, basic PC controls, 10+ modes. Undated.
- [Roblox BedWars wiki](https://robloxbedwars.fandom.com/wiki/BedWars) — community
  maintained. Pages for Team Upgrades, Emerald Generator and others explicitly
  say they are outdated. Use the mechanic types, not their numbers.
- [Roblox 2026-01-09 update](https://robloxbedwars.fandom.com/wiki/January_9,_2026)
  — weather and map modifiers.

The important lesson from the sources themselves: both games are balanced
around a small set of clear decisions, not a huge catalogue. Copy the decisions,
not the catalogue.

## What each game actually does

### Bloxd.io

- Four teams on floating islands. Solo is 8 teams of 1; duos 8 teams of 2;
  trios 4 teams of 3; squads 4 teams of 4. Ranked 4v4 and 1v1 also exist.
- A bed is reinforced for the first **2:30**. Pickaxes mine reinforced beds
  faster; after the window, axes mine regular beds faster. The **Fortified Bed**
  team upgrade (8 Moonstones) keeps the bed reinforced for the rest of the match.
- Four resources: Coal (common), Iron Bars, Diamonds (personal power), and
  Moonstones (team upgrades). There is no gold or emerald economy in the
  documented BedWars shop.
- Team upgrades: Damage I–III, Protection I–III, Generator I–III, Alarm,
  Recall Alarm, Fortified Bed. Generator III also produces diamonds.
- Several breach tools with different jobs: Moonstone Explosive (clears defense,
  cannot break beds), Fireball (damage, knockback, self-launch), Iceball (freeze),
  Moonstone Orb (teleport), Nets (slow), ladders and popup towers.
- A **team chest** and a **personal Moonstone Chest** at each base. The personal
  chest persists across your deaths and stores resources and shop blocks, but not
  weapons or utility. A final kill lets the killer loot the personal chest.
- Death drops swords and axes by one tier, keeps armour and shears, and gives the
  killer your carried resources and wool.
- Maps are designed around **route shape**, not just theme: small rush maps,
  long economic maps with a centre route, vertical maps, hazards, hiding spots,
  and maps with several diamond generators.
- The spectator flow is not clearly documented in the sources fetched. Do not
  assume Bloxd's spectator behaviour.

### Roblox BedWars

- Core loop: base iron → bridge and gear → contested diamonds for team upgrades
  → mid emeralds for high-end personal items → break beds and eliminate teams.
- **Kits** are the identity layer. Good examples of different *kinds* of kit:
  - Barbarian: dealing damage fills rage and upgrades your sword.
  - Yuzi: a short dash that damages and refunds charge on hit.
  - Melody: automatically heals the lowest-health nearby ally.
  - Grim Reaper: a kill leaves a soul orb; consuming it heals and speeds you up
    but you cannot attack while consuming it.
  - Farmer Cletus: an alternate economy grown from seeds.
  - Builder: fortifies blocks and prints bridges.
- **Bed plating**: beds have an early protective layer that expires or is broken;
  once the bed is gone, the next death is final. The wiki's exact duration
  conflicts (four minutes on one page, six in some modes, different again on the
  Classic page), so the mechanic is trustworthy but the timer is not.
- **Spectating**: eliminated players move to spectator mode and can watch
  surviving teammates, then choose Play Again or Lobby. Direct spectating
  replaced the old spectator box on 2021-06-28.
- Team upgrades: generator speed, armour protection, damage, diamond-generator
  speed, block destruction, equipment unlocks. The page is marked outdated.
- Generators: team iron generator (stub page lists 1 iron/s, 100 capacity);
  diamond generators usually 4 per map, base interval 40 s, cap 5; emerald
  generators 2–6 per map with an outdated timing table.
- Maps have **one readable modifier** rather than a pile of systems. The
  2026-01-09 update added rain (healing clouds, warned lightning), winter
  (throwable snowballs, slippery snowstorm), forest mushrooms with distinct
  effects, and desert pots plus a vision-blocking sandstorm.
- Modes: Solo, Doubles, Squads, 5v5, Duels, ranked. Ranked uses a pick/ban draft
  and seasonal ladder; 30v30 was removed on 2025-08-22. A small game does not
  need this layer until matchmaking and balance exist.

## Where this game already matches them

Clache already has the right skeleton:

- Four teams, team-size rules, bots, a lobby, map vote, invite links.
- Iron/gold/diamond/emerald economy with a shop and four diamond team upgrades:
  Sharpness, Protection, Forge, Heal Pool.
- Beds, respawns, final kills, elimination, a 35-minute timeline, a kill feed,
  scoreboard, spectator camera, and five themed arenas.
- Bridging, pillaring, block clutching, knockback and the void.
- Keyboard Use on E, Inventory on Tab, Player list on G — the same layout
  Bloxd documents. This is a proven browser-voxel layout, not a guess.

So the useful work is not "add more stuff". It is adding the few decisions that
make the existing loop deeper or shorter.

## The shortlist, ranked by value for a school LAN

| # | Idea | Source | Fit here | Effort |
|---|------|--------|----------|--------|
| 1 | Spectator follow + requeue | Roblox | Directly fixes the current complaint; dead players can watch a teammate instead of flying to find the fight, then leave without waiting for the round | S |
| 2 | Quick match preset | Both (pacing) | Current 35-minute end and 25-minute bed removal are long for a classroom; a 10–15 minute preset with the same rules keeps the game usable in one lesson | S |
| 3 | Bed reinforcement window | Bloxd + Roblox | Stops the first 90 seconds from being a rush coin-flip; gives new players time to learn the shop without making beds invulnerable | M |
| 4 | Alarm and trap upgrades | Bloxd | Adds defensive decisions to the existing diamond upgrades; uses positions and effects the server already tracks | S/M |
| 5 | Four simple kits | Roblox | Gives each player an identity and a reason to replay; keep one active key and auto-targeting so it stays mouse-free | M |
| 6 | One map modifier per arena | Roblox 2026 | Reuses the five arenas and atmosphere system; a sandstorm, snow, or lantern event makes an old map feel new | M |
| 7 | Personal resource vault | Bloxd | Softens repeated deaths without removing the killer-loot payoff; only worth it if playtests show death is too punishing | M |
| 8 | One mid-map lucky drop | Bloxd rotating items | A single contested random item at centre creates a fight; keep it out of the base economy and never make it decide the match | S |

### 1. Spectator follow and requeue

Roblox's confirmed pattern is "watch surviving teammates, then Play Again or
Lobby". The current fix already gives a free-fly overview, independent look,
arrow-key look, and closes chat/shop on death. The next step is:

- `Z` / `X` cycles living players (or teammates first), `C` returns to the free
  camera.
- The chase camera sits behind and above the target, pulls in when a wall is
  behind it, and shows "Spectating <name>".
- `L` (or a button on the summary) leaves the round and returns to the lobby, so
  a final-killed player is not stuck for 30 minutes.
- If the target dies, advance to the next living player, or fall back to the
  overview with a short notice.

This is the highest-value follow-up because the complaint is fresh and the
server already sends every player's position, yaw, health and alive state.

### 2. Quick match

Keep the current 35-minute ruleset as "Standard" and add a "Quick" lobby option:

- Beds removed at 10 minutes, game end at 15.
- Diamond II at 2, Emerald II at 4, Diamond III at 6, Emerald III at 8.
- Same shop, same upgrades, same arena; only the timeline changes.
- The existing `?fast=1` (10× timeline) is a test tool, not a player preset;
  reuse `scaleTimeline` for the real one.

This is a rules/UI change, not a new game mode. It is the difference between
"fun after school" and "we have to leave before the game ends".

### 3. Bed reinforcement

Do not copy Bloxd's tool-specific bed rule yet; this game always gives both a
pickaxe and an axe, so the choice would be fake. Copy the *window* instead:

- For the first 2:30–3:00, a bed is **plated**: breaking it takes 2.5× as long,
  with a visible shield/armour overlay and a sidebar countdown.
- When the window ends, a title says "Beds vulnerable" and normal mining applies.
- A **Fortified Bed** upgrade (diamonds) can restore plating for the rest of the
  match, or extend the opening window. Pick one; do not stack both.
- The plating must be server-authoritative, and the client's predicted break
  timer must use the same multiplier.

This preserves early pressure (a rush can still break a plated bed) while
removing the "one player crosses at 20 seconds and the game is over" failure.

### 4. Alarm and trap upgrades

The existing upgrade keeper already sells four diamond upgrades. Add two
defensive choices instead of more stat tiers:

- **Alarm** (3 diamonds): when an enemy comes within 8 blocks of your bed, the
  team gets a title, a sound and a red marker. Once every 20 seconds per team.
- **Trap** (5 diamonds, requires Alarm): the first enemy to enter the base gets
  Slowness or blindness for 3 seconds; consumed, then rebuilds after 30 seconds.

Both are readable in the HUD and use existing enemy positions. They also give
players who are losing their bed a way to fight back without adding another
weapon.

### 5. Four kits, one key

Do not port the Roblox roster. Four kits with one active ability are enough:

- **Rusher** — passive: +10% speed for 5 s after respawn; active: a short forward
  dash (no aim required).
- **Builder** — passive: wool costs 1 less iron; active: place a 3×3 wool panel
  in front of you for 8 wool.
- **Medic** — passive: regeneration near teammates; active: heal the nearest
  teammate 6 HP, 30 s cooldown, auto-target.
- **Duelist** — passive: a kill grants +1 sword damage for 20 s, stacking twice;
  active: a brief speed burst after a hit.

Requirements: a lobby picker, one `ability` key in Settings, server cooldown
validation, a HUD cooldown, and a server-side choice validation. This is the
biggest feature on the list; do it after the smaller changes have been played.

### 6. One map modifier per arena

Roblox's 2026 maps show the right size: one visible rule, clearly telegraphed.
For the five existing arenas:

- **Skyreach**: a short rain shower; healing clouds at the centre, warned
  lightning away from bases.
- **Lanterns**: night falls mid-round; lamp light and player nametags matter more.
- **Dunes**: a sandstorm reduces visibility and slows players caught outside
  cover for 20 seconds.
- **Frostpeak**: snowballs can be mined and thrown; ice is slippery.
- **Ruins**: falling rubble warns and then drops on the middle routes.

Implement one at a time, with a server event and a client visual. Do not stack
weather, darkness and hazards in the same round.

### 7. Personal vault (only if needed)

Bloxd's persistent personal chest is a good anti-frustration tool, but it also
weakens the "killer collects your resources" tension this game already has. A
smaller version:

- A vault block at each base stores resources and shop blocks, not gear.
- On death you keep the vault; carried resources still go to the killer.
- The UI can reuse the inventory modal.

Playtest first. If deaths feel punishing because a player loses 20 minutes of
diamonds, add it. If players are already rebuilding quickly, skip it.

### 8. One mid-map lucky drop

A single contested drop at the emerald island every few minutes, announced in
chat and visible on the map:

- One random item: a pearl, a fireball bundle, a golden apple, a bridge egg, or a
  temporary speed boost.
- Never a bed-breaking item and never a permanent stat.
- First player to touch it gets it; the drop disappears after 30 seconds.

This is a small amount of chaos that creates a fight at mid without turning the
game into a random-item mode.

## What not to copy

- **The full kit catalogue, rarity, avatars and permanent progression.** Balance
  and UI cost explode; this is a LAN party game, not a live-service meta.
- **Ranked drafts, 30v30, and seasonal ladders.** They need matchmaking and a
  population this game will not have at school.
- **Exact wiki prices and timers.** The Bloxd wiki contradicts itself on
  Fireball and Shears; the Roblox team-upgrade and emerald pages are marked
  outdated. Use them as shapes, not numbers.
- **Tool-specific bed mining.** Bloxd's pickaxe-before/axe-after rule is
  interesting, but this game gives every player both tools, so the choice would
  not exist without redesigning the kit.
- **Gold as a map-only currency.** This game already has a clean four-resource
  economy. Adding a fifth currency for one map is complexity without a decision.
- **Grindy simulators or giant economies.** The earlier hub research already
  ruled these out for a school LAN; BedWars should stay a round-based game.

## Recommended build order

1. Spectator follow and requeue (S) — finish the current complaint.
2. Quick match preset (S) — make the flagship playable in a class period.
3. Bed reinforcement (M) — fix the opening rush.
4. Alarm and trap upgrades (S/M) — add defensive depth cheaply.
5. Four kits (M) — add identity once the round shape is settled.
6. One map modifier per arena (M) — content refresh without new maps.
7. Vault and lucky drop (S/M) — only after playtests show they are needed.

The first four are all small enough to build and test one at a time. Kits are
the first feature that needs a new lobby screen, a new keybind and a new server
subsystem; do not start them in the same pass as a spectator fix.
