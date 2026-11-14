# Spleef - design options

Status: backlog; design note only. Implement after Parkour Rush is playable.

## Core loop

Break the floor under rivals; the last player standing wins. Rounds 90-150
seconds, readable arena, fast failure.

## Variant decision

Classic first-person Spleef is familiar but needs mouse aim. The keyboard-first
version should be **Spleef Rush**:

- Fixed high camera over a 3D blocky arena, not free-look first person.
- WASD moves; a marker two blocks ahead selects a tile.
- Space or E breaks the selected tile; no right-click and no free aim.
- The marker can snap to the nearest opponent's tile when close.
- Arrow keys adjust the camera; mouse optional.

If that camera/cursor feels bad in a prototype, fall back to a **2D grid
Spleef** in canvas. It is the cleanest no-mouse version and fits the blocky
style, but does not reuse the voxel renderer.

## Rules for v1

- 4-8 players, free-for-all or two teams; decide after the camera prototype.
- One life; falling eliminates. Spectators watch.
- 24x24 three-layer snow/wool platform over the void.
- Floor starts decaying in the centre after 30 seconds to prevent stalemates.
- Bump knockback only; no swords, bows or potions.
- One centre pickup: speed for 5 seconds or a three-block snowball push.
- Two-minute cap; most tiles broken wins if several remain, otherwise draw.
- No bots in v1.

## Map

Original snow/white wool/quartz arena with four spawn corners and a raised
centre. Later variants add holes, a raised ring or ice.

## Architecture

Reuse the party-room framework from Parkour Rush after it exists. Spleef needs
its own break rules, tile marker, floor decay and winner state. Do not bolt it
onto bedwars combat.

## Open questions

- Fixed high camera vs 2D canvas.
- Free-for-all vs two teams.
- One life or three.
- Does auto-target feel fair, or remove the skill?
