# Clache Games Hub - direction notes

Goal: a LAN-first games site that feels much more polished than a typical unblocked-games page. Clache stays the flagship; more small games surround it, sharing one link, lobby and control language.

## Product shape
- One server, one port, one link: http://<host>:3000.
- Hub page with game cards, live counts, room codes and quick join.
- Shared party room: one group rotates through short games with a running score.
- Clache is one card, not the whole product.

## Constraints
- School Wi-Fi/LAN first. No VPN, account or install for players.
- Rounds 60 seconds to 5 minutes; easy joins and rematches.
- Keyboard-first: new games must work without mouse look or right-click.
- Consistent blocky look, but games may be 2D or 3D.
- School-safe themes; no realistic weapons or gore.
- No persistent economy or accounts in v1.

## Planned games (after Clache polish)
1. Parkour Rush - generated course, checkpoints, best times.
2. Red Light, Green Light - large-group freeze game.
3. Bomber Arena - top-down grid, bombs, last standing.
4. Hide & Seek - one seeker; caught hiders join the hunt.
5. Spleef - break the floor under rivals.
6. King of the Hill / Sumo - hold the zone or bump rivals off.
7. Trivia Rush - number keys only.
8. Secret Monster - school-safe social deduction.
9. Idle simulator - blocky progression, single-player.
10. Natural Disaster - dodge hazards and collapsing platforms.

First release: hub shell + Parkour Rush + Red Light + Bomber Arena.

## Current decision

- **Parkour Rush** stage 1 is implemented: an original modular spiral inside
the existing game, playable solo and in online rooms. Hub extraction is later.
See `docs/PARKOUR.md` and `tasks/0006-parkour.md`.
- **Spleef** is designed as fixed-camera Spleef Rush, with a 2D-grid fallback.
See `docs/SPLEEF.md`.
- **Gun Game** is a future mouse-required mode, not part of the keyboard-first
rotation. See `docs/GUN_GAME.md`.

## No-mouse fit

| Mode | No-mouse? | Notes |
|---|---|---|
| Parkour Rush | Yes | WASD + Space + arrow look; chase camera |
| Spleef Rush | Yes, prototype | Fixed high camera and tile marker |
| Red Light / Simon Says | Yes | movement only |
| Bomber Arena | Yes | top-down keyboard |
| Trivia Rush | Yes | number keys |
| Idle simulator | Yes | keyboard/DOM |
| Gun Game | No | mouse look/aim; label clearly |
| Classic Spleef | No | free-look mouse aiming |

## Hosting
Phase 1: local Node server on the school LAN; players open http://<LAN-IP>:3000.
Phase 2: one-click launcher that starts the server, finds the LAN IP, opens the hub and prints a QR code/link. A browser page cannot start a server by itself.
Phase 3: optional public container hosting. Cloudflare Workers would need a Durable Object adapter; the existing Sites relay is Freebuff-specific.

## Technical shape
- src/games/<name>/ per game plus shared src/party/ for rooms, chat, rotation and scores.
- One WebSocket route per game, or one party channel with a game state machine.
- 2D games use canvas/DOM; reuse voxel rendering only where it earns it.
- Shared inputs: WASD/arrows, Space, E use, Tab inventory, G players, 1-9 hotbar.
- Rooms live in memory; no database for v1.

## Open questions
- Party rotation vs standalone games? Polish Clache, then hub + rotation.
- How many players per room? Start 2-8 for new games; Clache stays 4.
- How much persistence? Best times and local leaderboard for v1.
