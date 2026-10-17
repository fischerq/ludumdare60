# Layer: the cabinet (zoom out)

**Status:** decided, first slice built 2026-10-17
**Parent:** [layers](layers.md) · [master](../master.md)
**Lab bench:** none yet
**Code:** `src/scenes/CabinetScene.js`, cabinet and joystick art in `src/scenes/BootScene.js` (`makeCabinet`,
`makeSticks`), game picture `src/systems/screenImage.js`, numbers in `CABINET` in `src/config.js`.
Playtest directly: `?scene=Cabinet`.

## Purpose
One layer up from the [maze game](arcade-maze.md): we step back and see the whole arcade machine. Same game on
its screen, but now played through the machine's physical controls. Theme: Old Tech, the cabinet.

## Rules · decided
- **No real 3D: pixel art throughout, 3D simulated.** The cabinet is pixel art in an oblique view: the front is
  drawn flat, depth goes up and to the right at 45°, so the right side panel and the top show (yellow like the
  Pac-Man upright, marquee with the title, black bezel, control panel, coin door with lit slots).
- Drawn at 2 screen px per art px (the maze level uses 4). The cabinet's screen shows the same game picture
  1:1, so the maze level's pixels are exactly half as big: the camera starts at the maze level's zoom with the
  screen lined up, then pulls back over 2.5 s (tap to skip).
- The screen runs in attract mode: INSERT COIN, CREDIT 0. Tap the coin door (or Space/Enter) to insert a coin:
  coin sound, start jingle, a fresh game with 3 lives. Game over goes back to INSERT COIN.
- **Joystick:** put a finger down anywhere and push; past 24 px it clicks into one of four directions (no
  diagonals), with a microswitch click. Held, not swiped: the chomper keeps steering while the stick is pushed.
  The pixel stick on the panel leans the same way; a faint ring shows where the finger is. Arrow keys on a laptop.
- Clearing the maze here shows MAZE CLEAR, then back to the menu (the screen layer comes next).
- Reaching it: clearing the maze level zooms out into this layer.

## Slice scope
- Build (done): pixel cabinet, zoom-out intro, attract screen, coin to start, 4-way stick, game on the screen.
- Not now: glare/view changes beyond a faint glass glare, stick lag or worn switches, banging the machine,
  credits counter beyond one coin, the zoom into the screen (next layer), mini-gurke in the coin return.

## Open questions
- Is the game on the cabinet screen big enough to play on a phone (tiles are 16 screen px)?
- Does the held joystick feel better or worse than swiping? Tune `CABINET.stickDeadzone`.

## Decision log
- 2026-10-17: Zoom-out layer idea: a 3D arcade machine with screen and mechanical controls, the same game on the
  screen, but controls and view are different. (Quirin)
- 2026-10-17: Defaults accepted (fixed camera with a zoom-out intro, joystick at the bottom of the touch area,
  coins as the start, order maze → cabinet → screen). (Quirin)
- 2026-10-17: Real 3D was asked for, then corrected: no real 3D, pixel art throughout, simulate the 3D. (Quirin)
