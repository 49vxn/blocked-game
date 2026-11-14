# Movement: final controller and sandbox presets

Status: **decided for normal play.** Classic is the normal controller, tuned
from 5.2 / 7.0 to **4.9 walk / 6.5 sprint blocks per second**. The sandbox also
has a fifth, opt-in **Bloxd** preset with Bloxd’s published 4 / 7 / 2 speeds and
input-driven air steering. Normal play and bots remain Classic until a browser
playtest.

## What was wrong

The three experimental presets used an explicit accelerate/brake controller:

```ts
vx = approach(vx, targetVx, accel)
```

with `accel` 0.1-0.18 blocks/tick². Classic replaces part of the old velocity
every tick instead:

```ts
vx = vx * GROUND_FRICTION + targetVx * speed * (1 - GROUND_FRICTION)
```

With `GROUND_FRICTION = 0.546`, Classic changes direction and speed almost
immediately. The capped controller took several ticks to reverse, so the old
direction survived a turn and read as "moving left and right without pressing
any keys". It was a controller bug, not a camera or input bug.

Fix: the accelerate/brake model is retired. The Classic-family presets use the
Classic ground and air blend. The opt-in Bloxd preset keeps the same ground
blend but uses input-driven air steering.

## Final values

Measured at 20 TPS by `tests/movement.test.ts`. Speeds are blocks per second.

| Preset | Walk / sprint / sneak | Stop after sprint | Reversal drift | Jump peak | Sprint-jump arc |
| --- | --- | --- | --- | --- | --- |
| Classic | 4.9 / 6.5 / 1.6 | 0.39 blocks | 0.07 blocks | 1.59 | 4.44 blocks |
| Surefoot | 4.5 / 5.8 / 1.6 | 0.35 | 0.06 | 1.59 | 4.32 |
| Snapline | 4.8 / 6.2 / 1.6 | 0.37 | 0.06 | 1.59 | 4.39 |
| Flowline | 5.1 / 7.0 / 1.6 | 0.42 | 0.08 | 1.59 | 4.53 |
| Bloxd | 4.0 / 7.0 / 2.0 | 0.42 | 0.10 | 1.59 | 4.41 |

- **Reversal drift** is how far the body still travels toward the old direction
  after the player fully reverses. Under 0.11 block is effectively a planted
  turn.
- **Sprint-jump arc** is takeoff to landing while holding forward. It was 5.51
  blocks at the old 7.0 sprint. The lower top speed alone barely changed it
  (5.42) because air acceleration refilled the lost speed, so the sprint-jump
  launch is now 0.20 instead of 0.28 and sprint air acceleration is 0.030
  instead of 0.036. The result is 4.44 blocks: about 19% shorter, while ground
  movement keeps the Classic feel.
- Jump height is unchanged at about 1.6 blocks. Every preset clears a one-block
  step and none reaches two.

## Air control (Bloxd preset)

Bloxd’s published client defaults are `airMomentumConservation: false`,
`airAccScale: 1` and `airFrictionScale: 1`; only Rocket Obby opts into air
momentum. Bloxd is therefore **not** momentum-based by default. Its movement
table gives walk **4**, run **7**, crouch **2** blocks/s and a normal jump
around **1.47** blocks.

The Bloxd sandbox preset copies the air model, not the whole game:

- Ground steering is still the Classic blend, so stops and turns are planted.
- In the air with input, the old direction is replaced 30% per tick toward the
  input at a steady **0.333 blocks/tick** air speed. A reversal is planted
  within four ticks.
- In the air with no input, **99.5%** of horizontal velocity is kept, so a
  normal jump still arcs instead of braking.
- Knockback keeps its momentum until its grace ends; the air controller does
  not erase a hit.
- Jump velocity and sprint-jump boost are unchanged.

Measured by `tests/movement.test.ts`: air reversal within 4 ticks; old forward
speed under 0.08 after 6 ticks of strafe; no-input jump retention above 0.95;
Bloxd sprint-jump arc 4.41 blocks. Classic and the Spiral Tower course are
untouched.

## Why keep the sandbox presets

They are useful for comparing pace without changing the controller: Surefoot
is the calm end, Classic is the normal default, Flowline is the old sprint
speed, and Bloxd is the opt-in non-momentum air model. They are sandbox-only;
normal matches and bots use Classic.

Press **M** in Practice sandbox to cycle them. The corner card shows the
current speed. The choice is saved and survives a reload.

## How to check a movement change

Run the focused tests:

```bash
bun test tests/movement.test.ts tests/physics.test.ts
```

Then start the game in the sandbox and run the five checks:

1. Sprint across a flat strip, release, and measure the stop. Target: under
   0.5 block.
2. Sprint forward, then reverse. The body should not keep sliding the old way
   by more than about 0.11 block.
3. Sneak-bridge ten blocks on a one-wide ledge. Count falls and overshoots.
4. Jump the one-, two- and three-block gaps on the sandbox course. A held
   sprint-jump should stay under 4.6 blocks.
5. Get hit near an edge and counter-steer back. Knockback must still matter,
   but the player must have a fair chance to recover.

## Research that still applies

Bloxd's published client defaults are walk **4 blocks/s**, run **7 blocks/s**
and crouch **2 blocks/s**; its normal jump is about **1.47 blocks**. Its
`airMomentumConservation` default is **false**, which is the useful structural
difference. The exact friction/acceleration constants are not published, so
the Bloxd preset copies the published speeds and the no-carry air rule, not
invented internals. Classic stays between Bloxd's walk and run speeds, with a
slightly higher jump.

Sources:

- Bloxd client options: https://bloxd.io/docs/client-options.md
- Bloxd movement table: https://bloxd-io.fandom.com/wiki/Movement
- Minecraft Parkour Wiki, horizontal movement:
  https://www.mcpk.wiki/wiki/Horizontal_Movement_Formulas
- Game Developer, game-feel tips:
  https://www.gamedeveloper.com/design/game-feel-tips-ii-speed-gravity-friction

## Decision record

- Classic with a little less speed: **accepted**.
- Experimental accelerate/brake presets: **retired**. They caused the
  direction drift; they are not coming back without a measured reversal test.
- Normal play and bots: **Classic**.
- Bloxd preset: **sandbox only for now.** Its air model is tested, but it needs
  a browser/touchpad playtest before it can become the default.
- The public interface is still `stepMovement(world, mover, input, preset)` in
  `src/engine/physics.ts`. Do not fork the controller in the client.
