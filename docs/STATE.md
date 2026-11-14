# Clache state snapshot

Snapshot: 2026-11-03 13:49 NZDT. This is the single runtime source of truth.
Re-check ports and PIDs before trusting an old value; do not copy this table
into other docs.

## Runtime

| Surface | State |
|---|---|
| Public site | **Published at https://clache.freebuff.page** on 1.6.7; online play uses anonymous guest tickets, no account. Today’s bridge-assist and Bloxd-preset changes are LAN/local only. |
| Site ID | `ba2afec3-9f7b-411a-8b93-a1751ac4b0d1` (preview + production) |
| Public/LAN `:3000` | **Running** PID 2032 on `0.0.0.0:3000`; LAN `http://10.47.1.88:3000`; current ore build, one player reconnected in the waiting room. |
| Local server `:3002` | **Running** PID 5016 on `127.0.0.1:3002`; current ore build. |
| Battle room | Starts when a spectator opens a `battle=1` URL; empty when nobody is connected |
| Old test server `:3001` | Stopped |
| Health | `GET /healthz` -> `{"ok":true,"version":"1.6.7"}` on both `:3000` and `:3002`; `/health` is the SPA fallback |
| Brand | Main UI is **Clache** only. Host-aware Clache/KevCraft (0021) is blocked on workspace drift; see `URGENT.md` |
| Source build | `dist` built 1.6.7: 0016–0024, Upgrade Rush, Aquarium/Archway/Citadel, Spiral Tower, mouse-look clamp, the always-on clock, FFA bridges/bots, eight one-player FFA islands + difficulty director, bridge assist styles, Bloxd sandbox preset, tab-return resume, grass replacement, pole texture, diamond cap 10 and mineable iron/gold/diamond ores. Source and `dist` match |
| Working tree | Not git; `bots.ts` is read-only |

Open the battle:

```text
http://127.0.0.1:3002/?play=1&world=arena&battle=1&room=bot-battle&name=Watcher
```

The room creates 16 bots, four teams of four, with one Easy/Normal/Hard/Expert
per team. The human is a spectator.

## Verification

- `bun run typecheck` — exit 0.
- `bun test --max-concurrency 1 --timeout 10000` — **469 pass, 0 fail**, 44
  files, 37.49s (ore gate). Spiral Tower's full flight audit is green after
  the course fix.
- `bun run build:node` — pass; `dist/server/main.js` 343.42 kB, version 1.6.7.
- Sites build + preview/production deploy — 1.6.7; `https://clache.freebuff.page`.
  Two anonymous browser tabs hosted/joined the same room; Citadel was in the
  map vote; `/api/player` -> `{"configured":true,"signedIn":true,"guest":true}`.
- Browser on `:3002` — menu v1.6.7, Upgrade Rush starts, tier HUD, 3-player
  late join and countdown/timer render without console errors.
- Focused bot suite — all pass; includes the opening and aim-wiring tests
- Battle room test — 16 bots, mixed tiers, spectator join
- Tactics tests — telly bridge, wall, clutch, pillar, roof helpers
- Path test — one-cell detour, no detour into a gap
- `scripts/bot-observer.ts` — runs headless and reports attacks/passes by tier

## What is in the current build

- Bed Wars arena (Solo/Duos/Trios/Squads), team beds, generators, shop,
  upgrades, timeline and bots.
- Trios/team-size rooms.
- Parkour Rush: Spiral Tower (10 checkpoints) is the default course;
  `?map=classic` keeps the five-checkpoint tutorial. The server supports the
  param, but the browser play-URL path drops it — known client follow-up.
- Arena rotation includes the GLM-ported Aquarium and Archway layouts plus the
  original Citadel keep (`maps/arena.ts`), not separate map files.
- **Upgrade Rush** (1.6.7): 2–8-player free-for-all, 10 gear tiers, +1 tier and
  +6 HP per kill, death resets to tier 0 and removes only your placed blocks,
  25 kills or 10 minutes. Menu, HUD tier/next preview, late join and summary.
  Eight one-player spawn islands: four base islands plus four diamond islands,
  each with its own protected pad and a three-wide route to the middle. Bots
  fill empty seats; a five-second performance director eases them for a human
  who is dying and hardens them for a human who is dominating.
- Mouse look clamps each event to ±180 px and ignores one event after pointer
  lock; no 180° snap from a Logitech driver spike.
- Sandbox with `/bot`, `/bot technoblade`, cheats and movement presets.
- 4v4v4v4 all-bot battle with a spectator human.
- Bed destruction is chat/feed only.
- TNT: 2.5 s fuse, power 3.5, 1.5x damage, 1.25x knockback.
- Healing items: golden apple (8 HP, 5 gold), healing potion (6 HP),
  regeneration potion (10 s, 1 HP per 1.5 s), enchanted golden apple (8 HP +
  6 s regen). Upgrade Rush tiers 2/5/7/8/9 also grant these consumables.
- Home forge: one ground pile; on-ground teammates within 2 blocks split it one
  item each per tick. Diamond/emerald piles keep one taker and are never copied.
- Browser full-screen/pointer-lock gate; leaving full screen pauses.
- Bridge assist: Auto/On/Off plus Bedrock/Forward style. Bedrock: hold
  use/right-click + sneak + back, with a two-tick edge grace. Forward is
  opt-in: hold use/right-click + forward at a gap; never on flat ground or into
  a wall. Settings version 4; old saves default to Bedrock.
- Movement: Classic remains the normal/bot controller. Practice sandbox also
  has a Bloxd preset (4 / 7 / 2 blocks/s) with input-driven, non-momentum air
  steering; it is not the default until a browser playtest.
- Bot perception/motor wiring, ground A* navigation, soft occupancy, head-on
  yield, close-range stop and team trip cap.
- Bot opening economy: first team trip at 4 iron, wool before gear, leave after
  16 blocks, bed cover on a later trip. First shop now ticks 105/201/297/393
  for Easy/Normal/Hard/Expert instead of Expert ~2,300.
- Invisibility shimmer particles; Clache branding; no in-app Freebuff promo.
- Ender/team chests are in the local `:3002` build and covered by an arena test.
  G toggles the player list; the public Sites host is 1.6.7.

## Bot state

- 0013 perception/motor is wired: enemies come from `perception.visible`,
  attacks are gated by sampled reaction.
- 0016 opening economy is wired: first team trip at 4 iron, wool before gear,
  leave after 16 blocks, bed cover on a later trip; solo keeps the old cycle.
- 0017 combat motor is wired: `fight()` uses `MotorController.aim` with the
  tier turn cap and coherent aim error; the legacy random offset is removed.
- 0018 navigation is wired: ground A* with step-up/drop, map-block refusal,
  diggable placed blocks, soft occupancy and teammate-only head-on yield. The
  yielder backs out and retries when its side-step is blocked; disconnected
  targets fall back to the legacy bridge path.
- 0019 Technoblade v1 is wired: wall-off at low health, falling clutch, and
  telly-capable sandbox duel movement. No lobby tier or protocol/UI yet.
- 0020 OpenCode reviewer bridge is implemented and **verified live** against
  the v2 `/api` routes: GLM-5.3-Flash Free `#max`, read-only `plan` agent,
  final-turn detection, explicit report path and timeout.
- 0022 target commitment/lapses is implemented for Expert/Technoblade only:
  3.5-block close-range commitment, threat/much-closer releases and one bounded
  seeded lapse per engagement. Easy/Normal/Hard keep legacy switching.
- 0014 planner/economy is integrated but **not wired**.
- 0015 duel/bed tactics are **integrated in main** (`bots/tactics/duel.ts`,
  `bed.ts`, 2026-11-02 14:11) with the four GLM review fixes and 24 focused
  tests. They have no caller in `bots.ts` yet. Telly/build is partly wired.
- `/bot technoblade` is sandbox-only. The lobby still exposes four levels.
- Ground A* is implemented; bridge legs and disconnected-island targets still
  use the legacy axis-aligned bridge path. Worst observed nav `stuckMax` is 20
  in six fresh observer runs (was 60).
- Observer output shows all tiers attack; Hard/Expert still return to defend
  when the bed is threatened, and the pass metric still includes swing cooldown.
- Superseded full-wiring attempts live in `_attic/legacy-bot-wiring/`; none are
  applied.

## Workflow v3

- `review-external` requires a fresh check and mechanical review; `--print`
  emits the read-only prompt, otherwise it calls the loopback OpenCode v2 API
  and writes an advisory receipt. It never integrates.
- `bun run workflow status` reports **1/3 active workspaces**: worker1/0021 with
  12 changed files, scope clean. `review` rejects it on 7 drift findings, so it
  must be rebased, not applied.
- `worker2` is headless reviewer-only; no workspace and no Freebuff chat.

## Agent state

- Only `worker1` / `0021` (brand split, 12 changes) is active. Its workspace was
  created from pre-0022 main (336 tests, 37 files, no 0022/0024/0015-era files);
  it is stale and must not be applied. `URGENT.md` holds the rebase plan.
- `worker3` / `0015` is integrated; its workspace is cleared and the prior
  review/backups are under
  `.agents/worker3/0015-bot-tactics-technoblade-archive-2026-11-02/`.
- `worker2` / `0014` is integrated and its old workspace is archived under
  `_attic/worker2-0014-bot-planner-economy/`; it no longer occupies a slot.
- `.agents/buffy/0022-target-commitment/` is mission evidence (baseline logs),
  not a workspace.
- `0002` is blocked/superseded. `0011` Upgrade Rush is implemented in 1.6.7.
- The manual mailbox is `.agents/mailbox/`. An MCP mailbox design exists, but it
  is not integrated.
- No new worker should edit main until the handoff owner reopens a reviewed task.
- `_attic/` is archived material and is ignored by git/build.

## Known gaps

- Public Sites hosting is deployed at 1.6.7; the Cloudflare tunnel is down.
  LAN `:3000` is up and is the reliable local host.
- Full-screen/pointer lock and real touchpad behavior need a Chrome playtest.
- Battle server is local only.
- Bots route around walls and yield only to teammates. A closed corridor now
  backs out and retries; a truly dead-end map can still block a bot.
- Target switching is committed for Expert/Technoblade only; Easy/Normal/Hard
  keep immediate-nearest. See 0022.
- Planner/economy and the final Technoblade decision layer are unwired.
- The browser play-URL path drops `map`, so `?play=1&world=parkour&map=classic`
  still opens Spiral Tower. One-line client fix, folded into the 0021 rebase.
- Workflows/MCP/Skills are documented but not fully active.
