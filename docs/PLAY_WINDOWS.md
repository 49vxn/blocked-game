# Play windows and the player clock

## Rule

- **School hours are Monday–Friday, 08:00–15:59 local time.**
- During school hours, the **LAN host** (`http://<this machine>:3000`) is the
  intended server.
- Outside school hours, players should use the **Freebuff site**:
  <https://clache.freebuff.page>.
- This is a player-facing rule, not an authentication gate. The LAN host is
  still technically reachable; the UI tells people where to go.

## Always-visible clock

Every menu/HUD revision must keep a local-time clock visible:

- the start screen shows `Local 7:42 PM · School hours · LAN` on the school
  host or `Local 7:42 PM · School closed · Freebuff` outside it; the public site
  says `online` instead of `LAN`/`Freebuff`;
- outside school hours on a local build, the line links to the Freebuff site;
- the in-game sidebar shows the same local time and window;
- the clock uses the **browser's local timezone**, not UTC or a server clock.

The pure helpers are in `src/games/bedwars/client/play-window.ts`; tests are
`tests/play-window.test.ts`. Do not replace the clock with a round timer — both
are required: round time in the game HUD, real time in the menu/sidebar.

## Why

Players need to know whether they are inside the school-hours window without
checking a phone. Testers outside school hours should not be given a stale LAN
link; they should be sent to the Freebuff site.
