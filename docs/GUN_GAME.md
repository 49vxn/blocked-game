# Gun Game - future mode note

Status: backlog. Not part of the keyboard-first hub and not started.

## Why separate

A gun game is a first-person shooter loop: mouse look, aiming, hit validation
and a weapon ladder. That conflicts with the hub's no-mouse promise. If added,
label it **Mouse recommended** and keep it outside the keyboard-first rotation.

## Core rules

- 4-8 players, free-for-all, 2-3 minute rounds.
- Everyone starts with the same weapon; a kill advances one step up a 6-8
  weapon ladder.
- The final step is melee or a short-range launcher; first to finish wins.
- Respawn after 2-3 seconds; no long elimination.
- Small symmetric map with clear sightlines and one centre power position.
- Optional: melee kills demote a player if playtests want more tension.

## School-safe reskin

Blocky foam-dart launchers, snowball cannons and a toy hammer, not realistic
firearms. No blood; use sparks, block chips and a "tagged" effect.

## Technical requirements

- New weapon definitions, projectile/hitscan handling and server hit validation.
  Bedwars bow/projectile code is a starting point, not a general gun system.
- Mouse look and pointer lock; no viable keyboard-only alternative.
- Small map, respawns, team-free scoring and a dedicated HUD.
- Server-authoritative hit checks, rate limits, line of sight, lag compensation.
- A hub route and room type; this needs the hub shell to exist.

## Crosscut / zombie apocalypse

Crosscut is an external userscript (ESP/aimbot), not a game mode. Do not integrate
it into the hub. A future zombie PvE mode is separate: reuse bot movement,
projectiles, waves, barricades and a co-op objective. Treat it as a later PvE
task, not a gun-game reskin.

## Prerequisite order

1. Parkour Rush is playable and settled.
2. Spleef is playable with fixed-camera or 2D rules.
3. Hub shell exists with a game router and shared lobby.
4. Gun game gets its own map, weapon system and mouse-required label.
