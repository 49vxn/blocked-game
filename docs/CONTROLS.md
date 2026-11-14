# Clache controls and input

## Defaults

| Action | Default |
|---|---|
| Move | W A S D or arrows |
| Jump | Space (hold to bounce) |
| Sneak | Left/Right Shift |
| Sprint | R on the web; Left Ctrl + R in Electron; double-tap W optional |
| Use / place | E or right-click; hold E to place, release to fire a bow |
| Attack / break | Left click |
| Hotbar | 1-9, mouse wheel |
| Drop | Q; Ctrl+Q or Shift+Q drops the whole stack |
| Inventory | Tab |
| Nearest shop | B |
| Chat | T or Enter; `!` for global team chat; `/` for commands |
| Player list | **G toggles** |
| Debug | F3 |
| Perspective | F5 or V |
| Pause / menus | Esc |

## Browser full screen

- Browser play is **full-screen only**, like Bloxd. Starting a match requests
  full screen from the click; if refused, the pause card asks.
- Pointer lock is requested only in full screen.
- Leaving full screen clears held keys/buttons and shows the pause card.
- Chromium Keyboard Lock keeps Ctrl+W and Ctrl+1..9 in the game while full screen.
- The Electron desktop app does not require full screen.
- The preview webview refuses full screen/pointer lock; test in real Chrome.

## Bridge assist (touchpad)

- `Settings > Game > Bridge assist` is **Auto / On / Off**; `Bridge style` is
  **Bedrock / Forward**. Defaults are Auto and Bedrock.
- Auto detects small, frequent wheel deltas (four samples) typical of a laptop
  touchpad; set Off if a smooth mouse false-positives.
- **Bedrock**: hold **use/right-click + sneak + back** with a block; places the
  cell behind you. A two-tick grace still places the last block after you step
  off the lip.
- **Forward** (opt-in): hold **use/right-click + forward** with a block at an
  edge; places the cell ahead. It only extends over a gap, never on flat ground
  or into a wall, and never places while backing up.
- It does not replace normal placement and does not work with an inventory or
  chat panel open.
- There is no phone touch-control layer; this is a laptop touchpad assist.
- See `TOUCHPAD_BRIDGE.md`.

## Bot battle spectator

- Open `?play=1&world=arena&battle=1&room=bot-battle&name=Watcher` or use
  **Watch 4v4v4v4 bots**.
- The human never takes a bot seat.
- WASD fly, Space/Shift up/down, arrow keys look, G toggles players.
- A battle room starts immediately; closing the page ends the room.

## Parkour

- WASD moves; Space jumps; R sprints; arrow keys look without pointer lock.
- Third-person chase camera; mouse look optional.
- No right-click or aim required.

## Spectator

- WASD fly, Space/Shift up/down, arrow keys look; G toggles players.
- Chat/shop windows close on death.

## Sandbox commands

- `/bot` spawns sparring bots; `/bot 2 hard` sets count and tier.
- `/bot technoblade` spawns the sandbox-only telly-profile bot.
- `/nobots`, `/killaura`, `/give`, `/tp`, `/heal`, `/kit`, `/kill`.
- `M` cycles Classic/Surefoot/Snapline/Flowline movement.

## Rebinding and migration

- Settings > Controls lists every keyboard action with two slots.
- Saved settings validate every field; old E-inventory/Tab-players defaults
  migrate to E-use/Tab-inventory/G-players.
- Browser Ctrl sprint defaults migrate to R to avoid Ctrl+W.
