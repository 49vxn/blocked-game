# Task 0021 — Clache/KevCraft brand split

Status: in-progress
Owner: worker1
Created: 2026-11-01
Depends on: 0019, current `BRAND = 'Clache'`

## Goal

Public/outside-localhost is **Clache**. School/LAN is **KevCraft**. Add one
small host-aware brand helper and use it in the browser UI instead of scattering
two names or breaking the existing public brand.

Read `docs/OPENCODE_SWARM_RESEARCH.md` (Branding decision), `docs/STATE.md`
and `AGENTS.md` first.

## Required behaviour

- A pure helper module exports `PUBLIC_BRAND = 'Clache'`,
  `LAN_BRAND = 'KevCraft'`, `isLanHost(hostname)` and
  `brandForHost(hostname)`.
- `localhost`, loopback, RFC1918 IPv4 ranges and `.local` hostnames are LAN;
  everything else is public. Treat an empty/unknown hostname conservatively.
- The browser sets the document title, menu heading, help heading and HUD brand
  from `brandForHost(location.hostname)`. Do not rename package IDs, repo paths
  or historical URLs.
- The static `index.html` title remains Clache until the script runs; the client
  updates it immediately.
- Server/Electron startup labels may stay Clache in this task; do not touch
  `room.ts`, `protocol.ts`, `bots.ts`, maps or gameplay.
- No new dependency.

## Allowed paths

- `src/games/bedwars/brand.ts` (new)
- `src/games/bedwars/constants.ts` (only if a compatibility export is needed)
- `src/games/bedwars/client/main.ts`
- `src/games/bedwars/client/hud.ts`
- `tests/brand.test.ts` (new)
- `docs/BRANDING.md` (new), `docs/README.md`, `docs/STATE.md`, `HANDOFF.md`,
  `QUEUE.md`, `docs/CHANGELOG.md`, `tasks/README.md`

The client main and HUD files are high-risk, one writer.

## Off-limits

Do not touch `src/server/main.ts`, `electron/main.mjs`, `index.html`,
`package.json` or any other source file outside the list above.

## Test-first steps

1. Add pure tests for public hosts, LAN IP ranges, localhost/loopback, `.local`,
   empty input and the two brand names.
2. Confirm the helper tests fail before `brand.ts` exists.
3. Implement the helper.
4. Wire the browser title/menu/help/HUD to it.
5. Run typecheck, full `bun test`, and `build:node`.
6. Browser check: public-like host stays Clache; a LAN/loopback host becomes
   KevCraft. Report what was actually checked.

## Acceptance

- [ ] `brandForHost('example.com') === 'Clache'`.
- [ ] LAN IPv4, `localhost`, loopback and `.local` return `KevCraft`.
- [ ] Browser title/menu/help/HUD use the helper.
- [ ] No package/repo/protocol renames.
- [ ] Full suite, typecheck and build pass.
- [ ] No live restart or deploy.

## Out of scope

- Renaming `buffcraft` package IDs, repo paths, Site IDs or historical URLs.
- Server/Electron branding (follow-up).
- Core refactors, bots, maps, protocol, room or gameplay.
