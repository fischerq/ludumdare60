# Touch-follow movement

**Status:** proposed (prototype behaviour, not confirmed for the real game)
**Parent:** [master](../master.md)
**Lab bench:** `/lab/bench.html?b=movement` on the site
**Code:** `src/systems/movement.js`, used by `src/scenes/GameScene.js`

## Purpose
Move the player with one thumb, without a virtual joystick.

## Rules
- While a finger is down, the player steers toward it. When the finger lifts, the player coasts to a stop.
- Desired speed is `distance * PLAYER.slowdownGain`, capped at `PLAYER.maxSpeed`. Inside
  `PLAYER.arriveRadius` the desired speed is 0, so the player doesn't jitter under the finger.
- Each frame the velocity moves `PLAYER.followLerp` of the way toward the desired velocity.
- Keyboard: arrows/WASD set the desired velocity to `KEYBOARD.speed` in that direction.

## Feel
The player should feel attached to the thumb but have a little weight. Wrong: lagging so far behind that the
thumb covers the danger, or snapping so hard it looks like teleporting.

## Slice scope
- Build: nothing yet; this is the prototype's movement.
- Not now: dash, inertia upgrades, offset-from-finger control.

## Open questions
- Should the player sit above the finger (offset) so the thumb doesn't cover it? *Default: no, decide after
  the theme.*
- `followLerp` is applied per frame, so on a 120 Hz phone the player catches up faster than on 60 Hz. Make it
  frame-rate independent? *Default: yes, when movement is confirmed for the real game.* The bench simulates 60 Hz.

## Decision log
- 2026-10-10: Movement logic moved into `src/systems/movement.js` so the lab bench runs the game's own code;
  the inline `6` became `PLAYER.slowdownGain`. No behaviour change. (Claude)
