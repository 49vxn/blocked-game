# Clache documentation

After a context reset, start at [`compaction/README.md`](compaction/README.md).
It contains runtime, chronology, worker paths, decisions and next prompts.

This is the durable memory of the project. Start with the root
[`HANDOFF.md`](../HANDOFF.md), then read in this order after a context reset:

1. `STATE.md` — exact runtime, build, tests, live vs source, known gaps.
2. `BOT_AI_REWRITE.md` — bot design, what is wired, pathfinding, tactics,
   battle room, observer and next bot work.
3. `ARCHITECTURE.md` — engine/game/server/client boundaries and data flow.
4. `GAMEMODES.md` — Bed Wars, sandbox, parkour, 4v4v4v4 battle, planned modes.
5. `CONTROLS.md` — keyboard/mouse defaults, full screen, Bedrock bridge, spectator.
6. `TOUCHPAD_BRIDGE.md` — Bedrock bridge algorithm and limitations.
7. `PLAY_WINDOWS.md` — always-visible local clock and school-hours rule.
8. `ENDER_CHESTS.md` — personal/team storage.
9. `UPGRADE_RUSH.md` — implemented +1 upgrade mode (1.6.7).
10. `OPERATIONS.md` — build, test, LAN/battle host, deploy, rollback.
11. `MULTI_AGENT_WORKFLOW.md` — three-agent automation and review gate.
12. `CHANGELOG.md` — chronological changes and evidence.
13. `AGENT_WORKSPACE.md` — writer/reviewer folder map and cleanup rules.

Supporting design/research: `OPENCODE_SWARM_RESEARCH.md` (OpenCode,
GLM and the multi-agent bridge), `BOT_HUMANIZATION.md`, `BEDWARS_RESEARCH.md`,
`MOVEMENT_PRESETS.md`, `PARKOUR.md`, `SPLEEF.md`, `GUN_GAME.md`,
`GAMES_HUB.md`.

The public product is **Clache**; school/LAN builds are planned as **KevCraft**.
The code still has one `BRAND` value, so this needs a small host-aware change
before the two names diverge in the UI. Public site:
https://clache.freebuff.page. Online rooms use anonymous same-origin guests;
no account or sign-in is needed. Internal package/repo names remain `buffcraft`;
online IDs and historical file paths should not be renamed casually.
