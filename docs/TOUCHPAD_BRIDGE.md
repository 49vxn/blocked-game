# Bridge assist — Bedrock and opt-in Forward

Status: implemented in source and `dist`; needs a server restart and a real
touchpad playtest. The public site is still the previous deploy.

## Why

A laptop touchpad makes precise look-down + right-click bridging painful. The
assist has two explicit styles instead of one ambiguous “EasyBridge” toggle:

- **Bedrock** (default): hold use/right-click + sneak + walk backwards. It
  places the cell behind the block under the player, Bedrock-style.
- **Forward** (opt-in): hold use/right-click and walk forward at an edge. It
  extends the floor one cell ahead, but only over a gap, never on flat ground
  or into a wall.

Normal placement is unchanged. A player who leaves the assist Off sees no
difference.

## Detection

`Game.detectTouchpad` listens for wheel events:

- `deltaMode === 0` (pixel mode).
- `0 < abs(deltaY) < 40` increments a score; `>= 40` reduces it.
- Four small samples mark the session as touchpad use.
- It shows a one-time toast when Auto is active.
- This is a heuristic, not hardware detection. Manual On/Off is authoritative.

## Settings

`Settings > Game`:

- **Bridge assist**: Auto / On / Off. Default **Auto**.
- **Bridge style**: Bedrock / Forward. Default **Bedrock**.

Both are saved in localStorage; settings version 4. Old saves without a style
migrate to Bedrock.

## Placement algorithm

Common gates: the player is alive, a block is selected, use/right-click is held,
no modal or chat is open, and the 4-tick assist cooldown has elapsed. The
support cell is the solid block under the feet. For two ticks after stepping off
a lip, the last grounded support cell is still used.

**Bedrock** requires sneak + back and no forward input. The target is the cell
behind the support cell. It must be air; the normal place rules still apply.

**Forward** requires forward and no back input; sneak is optional. The target is
the cell ahead of the support cell. It must be air, and the cell directly below
it must be air/void, so it only builds over a gap. It never places on flat
ground or into a wall.

Both styles call the normal client `place` with `support + face`. The server
`onPlace` still validates reach, protection, bodies and build rules. The assist
cannot place into map or protected cells.

## Limitations

- It never places both directions on one tick.
- It does not aim, pillar above the player, or place while airborne beyond the
  two-tick window.
- The touchpad heuristic can be wrong; use On/Off.
- Full-screen/pointer-lock gate still applies to normal play.
- There is no phone touch-control layer. This is a laptop touchpad feature, not
  an on-screen joystick; a phone still needs a separate mobile-controls project.
- Not covered by an automated browser test; verify in real Chrome/Edge.

## Manual test

1. Set Bridge assist to On and Bridge style to Bedrock.
2. Take 64 wool; stand at a one-block ledge over void.
3. Hold use/right-click + Shift + S. Confirm a block appears behind you each
   0.2 s and the last block still lands after you step off.
4. Change Bridge style to Forward.
5. Hold use/right-click + W at the edge. Confirm one block ahead each 0.2 s,
   and no blocks on flat ground or when facing a wall.
6. Confirm normal right-click placement still works.
7. Turn Bridge assist Off and confirm no automatic blocks.
