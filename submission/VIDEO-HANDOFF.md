# Blocked — video handoff (record on the second PC)

Everything needed to shoot and cut the demo. Deadline: **Sunday 15 Nov, 2:00 PM**.
Submission needs a link, a recording of **2:00 or less**, and three one-liners.

Live build (record from this unless you want LAN): **https://49vxn.github.io/blocked-game/**
Repo: **https://github.com/49vxn/blocked-game**

---

## 1. Facts you can say on camera

- **Two games, one voxel engine**, three.js, no installs, no accounts.
- **School Survival**: Wellington College rebuilt in blocks, 64 × 32 × 64, eight
  seats, **115-second round**, three disasters in shuffled order at **12s / 42s /
  72s** (meteor takes the library roof, the quake bounces every player for **6s**
  and caves in the science corridor bays, the field floods layer by layer from
  **78s**). Warnings **7 seconds** before each disaster.
- **Flood water damages from the first layer**: ankle deep 1 HP/s, waist deep
  2 HP/s (head under = drowning).
- **Meteor shower** from 30s: two **visible fireballs** every 8 seconds, each marked
  with a red ring, aimed at players standing in the open.
- **Supply drop**: gold beacon, first survivor to reach it heals to 25 HP.
- **Earthquake**: 6 seconds of bouncing, and **1 HP a second while you are under a
  roof** — the open is the safe place to be.
- **Shove (F)**: no damage, all knockback.
- **Bed Wars**: four teams, four beds, forges, generators, a shop, bots that play
  the whole round.
- **Every texture is painted in code** from 16 × 16 recipes; sounds are synthesised
  with Web Audio. The repo ships no art or audio files.
- Online (LAN) play needs the local server; the public link is solo vs bots.

Do not say: "online multiplayer works on this link", "9 block types" or any number
of block types, or anything about where the engine came from. Keep it to the game.

---

## 2. Machine setup (5 minutes)

1. Chrome (not Edge — also fine, but Chrome's fullscreen is cleaner).
2. Display scaling 100%, resolution **1920 × 1080**.
3. `Ctrl + Shift + B` hides the bookmarks bar; close every other tab.
4. Windows notifications off: Settings → System → Notifications → **Off**.
5. Open the live link. Click **School Survival** once as a smoke test: full screen
   and mouse capture must both engage. `Esc` returns to the pause card.

### Recording tool (pick one)

- **OBS Studio** (best): Settings → Output → Recording: **MKV**, encoder
  **NVENC H.264** (or x264 if no NVIDIA); Video → **1920 × 1080, 60 fps**.
  Source: **Display Capture** (or Game Capture on the Chrome window). Record to
  `Videos/blocked/raw-01.mkv`.
- **Windows Game Bar**: `Win + G` → Record. Simpler, slightly worse quality,
  saves `Videos/Captures/*.mp4`.
- CLI, if the second PC has ffmpeg:
  `ffmpeg -f gdigrab -framerate 60 -i desktop -c:v libx264 -crf 18 -preset veryfast raw.mkv`

Record the survival run and the Bed Wars run as **separate files**. Do not stop
and restart mid-round: the browser's own "leave a live round?" guard will fight
you if you try to reload during a round (`Esc` → pause → leave first).

---

## 3. Capture order

Follow `VIDEO-SCRIPT.md` for wording and beats. Practical order:

1. **File A — survival, one continuous take, 3 minutes.** Start at the menu
   (2 seconds of the title), click School Survival, play.
   - Walk out into the courtyard and pan so the school fills frame.
   - When the banner appears, look **up** at the target and hold the shot through
     the impact — this is the money shot.
   - Walk into the shallow flood and stand still with the HUD in frame while the
     hearts drop.
   - Hit a bot with `F`.
   - Find the gold beacon when it appears and take the drop.
   - Die or let the round end — either is a fine ending.
2. **File B — Bed Wars, 60–90 seconds.** `Esc` → menu → **Bed Wars**. Hold on the
   spawn island (bed + your team's wool), then walk to the bridge so bots and the
   generator are in frame.
3. **File C — menu still, 4 seconds.** Reload the link fresh (no round running),
   record the menu without touching anything. Used as the opening card.

Record each separately; editing is easier than one perfect take.

---

## 4. Editing

There is no ffmpeg on the PC this handoff came from, so either install it on the
second PC (`winget install Gyan.FFmpeg`) or use a GUI (DaVinci Resolve, CapCut,
Clipchamp). `edit.sh` next to this file does the whole job with ffmpeg:

```sh
bash edit.sh raw-survival.mkv raw-bedwars.mkv menu.mkv
```

It cuts the best beats, opens on the menu card, closes on the end card, and
writes `blocked-demo.mp4` (1920 × 1080, 60 fps, H.264, `+faststart`, under 2:00).
Edit the `IN`/`OUT` seconds at the top of the script to match your take — those
are the only numbers you should need to change.

If you cut by hand instead: **H.264, yuv420p, 1920 × 1080, 60 fps, AAC stereo,
`+faststart`, under 2:00**, and keep the game's own audio low under the voice.

---

## 5. End card and copy

End card (4 seconds, dark background, the game's green):

```
BLOCKED
Two games, one school.

49vxn.github.io/blocked-game
```

Three one-liners for the submission form:

- **Problem:** our school's own students have nowhere to play something that is
  actually about our school — every block game is set somewhere else.
- **What works:** Wellington College in blocks with a 115-second survival round
  (meteor, earthquake, rising flood, supply drops, survivor bots) plus Bed Wars,
  playable in a browser with no install.
- **What's next:** LAN multiplayer in the demo room, more of the campus (the
  science block and the field are stubs), and a proper texture pack.

Attach: the `.mp4`, **https://49vxn.github.io/blocked-game/**, and mention
Freebuff if you want the Best Use award.

---

## 6. Gotchas

- **Pointer lock**: the game wants full screen + mouse capture. If the browser
  refuses, a toast says "Mouse look is unavailable here" — you can still walk
  with WASD, but re-record on Chrome rather than shipping that shot.
- **Reloading mid-round** triggers Chromium's "leave site?" prompt. `Esc` → leave
  first, or open a fresh tab.
- **Autoplay audio**: game sound only starts after the first click, which is the
  click that starts the round. Fine, but don't be surprised by silence on the
  menu.
- **Do not record the URL bar** if it has anything private in it; recording the
  full display captures it.
- The HUD clock in-game shows the real local time and "School closed" after
  hours — that is intentional flavour, leave it.

---

## 7. Files in this kit

| File | What it is |
| --- | --- |
| `VIDEO-HANDOFF.md` | this file: setup, capture, edit, submission |
| `VIDEO-SCRIPT.md` | shot list, timings, voiceover lines, claims to avoid |
| `edit.sh` | ffmpeg pipeline that cuts and renders `blocked-demo.mp4` |
| `game/` | the same static build, served over the LAN so you can record without internet |
