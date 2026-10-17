# Layer: the cabinet (zoom out)

**Status:** decided, first slice built 2026-10-17
**Parent:** [layers](layers.md) · [master](../master.md)
**Lab bench:** none yet
**Code:** `src/scenes/CabinetScene.js`, cabinet and joystick art in `src/scenes/BootScene.js` (`makeCabinet`,
`makeSticks`), game picture `src/systems/screenImage.js`, numbers in `CABINET` in `src/config.js`.
Playtest directly: `?scene=Cabinet`.

## Purpose
One layer up from the [maze game](arcade-maze.md): we step back and see the whole arcade machine. This layer is
only about seeing the machine and putting a coin in; the game is played on the maze layer. Theme: Old Tech, the
cabinet.

## Rules · decided
- **No real 3D: pixel art throughout, 3D simulated.** The cabinet is pixel art in an oblique view: the front is
  drawn flat, depth goes up and to the right at 45°, so the right side panel and the top show (yellow like the
  Pac-Man upright, marquee with the title, black bezel, control panel, coin door with lit slots).
- Drawn at 2 screen px per art px (the maze level uses 4). The cabinet's screen shows the same game picture
  1:1, so the maze level's pixels are exactly half as big: the camera starts at the maze level's zoom with the
  screen lined up, then pulls back over 2.5 s (tap to skip).
- **Nobody plays here.** While the cabinet shows, the machine stands still (`setFrozen` in
  `src/systems/arcade/world.js`): no bot, no demo, the screen keeps the last picture with INSERT COIN (or
  GAME OVER) and CREDIT 0 on top. A big magenta box with an arrow under the coin door
  says TAP THE COIN DOOR, and a frame blinks around the door. Tap it (or Space/Enter) to insert a coin.
- **Coins are global** (`src/wallet.js`, numbers in `COINS`): a counter at the top shows the coins held, shared
  with the arcade hall. A game costs one: the coin flies from the counter into the slot (coin sound, CREDIT 1),
  then the camera zooms back into the screen and the maze layer starts a fresh game with 3 lives (already paid). With no coins the box says NO COINS / LAYER UP (find more
  in the hall). You start with 1 coin. Game over goes back to INSERT COIN. *(start count and no-coin hint: proposed)*
- LAYER DOWN without a coin zooms back in and goes on with the machine's game where it stood.
- The joystick on the panel is only art now (the directional stick textures stay in `assets/cabinet/` for later).
- Reaching it: clearing the maze level zooms out into this layer.

## Slice scope
- Build (done): pixel cabinet, zoom-out intro, frozen screen, coin into the slot, zoom back in to a fresh game.
- Not now: glare/view changes beyond a faint glass glare, stick lag or worn switches, banging the machine,
  more than one credit at a time, the zoom into the screen (next layer), mini-gurke in the coin return.

## Open questions
- Inserting a coin while a game is still running starts a fresh one (the old one is lost). OK, or only allow the
  coin after GAME OVER? *Default: allowed.*

## Decision log
- 2026-10-17: Zoom-out layer idea: a 3D arcade machine with screen and mechanical controls, the same game on the
  screen, but controls and view are different. (Quirin)
- 2026-10-17: Defaults accepted (fixed camera with a zoom-out intro, joystick at the bottom of the touch area,
  coins as the start, order maze → cabinet → screen). (Quirin)
- 2026-10-17: Real 3D was asked for, then corrected: no real 3D, pixel art throughout, simulate the 3D. (Quirin)
- 2026-10-17: The coin door prompt was hard to see: now big, magenta, under the door with a blinking frame. Coins held are shown and kept globally; one coin starts a game, with the coin animated into the slot. (Quirin)
- 2026-10-17: The cabinet's screen shows the emulated machine: the bot's demo game until a coin goes in, then the player's game through the stick; see [emulator](emulator.md). (Claude)
- 2026-10-17: Rework: the cabinet is only about inserting the coin and seeing the machine. No play and no bot here: the machine stands still while the cabinet shows; the coin animates into the slot, then the camera zooms into the maze layer for a fresh game. (Quirin; frozen picture for a running game and dropping PUSH START: Claude)
