# 0032 — Campus survival integration

Goal: bring the Spawn school and its natural-disaster survival round into Clache, keeping BedWars and the engine intact.

Initial slice: reproduce the generated 64×32×64 school grid in Clache's block palette; add an eight-seat survival room with the Spawn 150-second clock, shuffled meteor/flood/earthquake slots (20, 55, 90 seconds), advance warnings, destructible terrain, eliminations and round reset. Make the mode available from the existing menu and room URLs. Tests must exercise the real room, map, disaster timing, damage and reset. Clache's map blocks replace the Spawn artwork; any not-yet-ported Spawn behavior must be reported honestly.

Boundaries: preserve existing modes and the engine/game separation. Do not alter `bots.ts`, existing project history, or unrelated work. Local checks only; no deployment or publication. The user's request authorizes use of their Spawn and Clache source, not falsifying timestamps.
