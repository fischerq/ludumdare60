# Layer: the cabinet (zoom out)

**Status:** decided, first slice built 2026-10-17
**Parent:** [layers](layers.md) · [master](../master.md)
**Lab bench:** none yet
**Code:** `src/scenes/CabinetScene.js`, cabinet and joystick art in `src/scenes/BootScene.js` (`makeCabinet`,
`makeSticks`, `makeCoinMech`), coin minigame logic `src/systems/coinmech.js`, game picture `src/systems/screenImage.js`, numbers in `CABINET` in `src/config.js`.
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
- **The player doesn't play here.** Going up mid-game, the bot takes over and plays on while we watch the
  cabinet; no prompt, and the coin door takes no coin. A halted machine (game over, or never started) asks for a
  coin: the picture stands still with INSERT COIN (or GAME OVER) and CREDIT 0 on top, and the TAP THE COIN DOOR
  prompt shows. Coins only go in while the machine asks for one. A big magenta box with an arrow under the coin door
  says TAP THE COIN DOOR, and a frame blinks around the door. Tap it (or Space/Enter) to open the coin minigame.
- **Coins are global** (`src/wallet.js`, numbers in `COINS`): a counter at the top shows the coins held, shared
  with the arcade hall. A game costs one: the coin has to get through the coin minigame (below); once the coin
  switch takes it the counter drops by one and the screen shows CREDIT 1, then the camera zooms back into the screen and the maze layer starts a fresh game with 3 lives (already paid). With no coins the box says NO COINS / LAYER UP (find more
  in the hall). You start with 1 coin. Game over goes back to INSERT COIN. *(start count and no-coin hint: proposed)*
- **Coin minigame** *(decided 2026-10-18)*: real coin mechs tested coins mechanically, so every coin goes through
  ours, no skip. Tapping the door zooms into it (0.4 s) and cuts to the coin mechanism behind it (art
  `assets/cabinet/coinmech-*`, shown at 4x). Flick the coin into the slot (a swipe; a tap works too). It rolls
  down the track and rests on two ledges; tap to roll it on. After the first ledge a **reject arm** swings across
  the track, after the second the **slug magnet** pulses on and off (both turn amber just before and after they're
  active). If the coin touches the arm while it's out, or passes the magnet while it's on, it drops into the
  **coin return**: not lost, back in hand to try again. At the end it presses the **coin switch**, which sends a
  pulse down the wire to the board: the real COIN bit in IN0 (as the input wires layer shows), and the program
  starts the fresh game itself (`new_game` in `game.asm`), without a power cycle, so whatever the deep layers
  changed in the machine stays. COIN OK, the coin is spent, we zoom back out to CREDIT 1 and into the maze. About 3 to 5 s with good timing. Space or
  Enter does the flick and the taps. Only the hint line at the bottom explains it (FLICK THE COIN INTO THE SLOT /
  TAP TO ROLL ON / REJECT ARM! / SLUG MAGNET! / COIN OK!). Numbers in `CABINET.coinMech`. Nothing new while the
  bot plays (the door takes no coin then). A BACK box at the top leaves without spending the coin *(proposed,
  Claude: otherwise there's no way out, the layer buttons are off screen)*.
- LAYER DOWN without a coin zooms back in and goes on with the machine's game where it stood.
- The joystick on the panel is only art now (the directional stick textures stay in `assets/cabinet/` for later).
- Reaching it: clearing the maze level zooms out into this layer. **Every coin goes through the minigame:** after a
  game over on the maze, TAP TO INSERT COIN zooms out to the cabinet and opens the coin mechanism directly.

## Slice scope
- Build (done): pixel cabinet, zoom-out intro, bot plays a running game, coin into the slot when halted, zoom back in to a fresh game.
- Build (coin minigame, 2026-10-18): zoom into the door, flick into the slot, two ledges with tap-to-roll, reject
  arm and slug magnet with a warning state, coin return and retry, coin switch with a pulse down the wire, coin
  spent only on success, BACK; placeholder art in code, one file per state for Max.
- Not now (coin minigame): fake coins or slugs to sort, different coins, difficulty that changes with progress,
  a coin jam or banging the door, a lab bench.
- Not now: glare/view changes beyond a faint glass glare, stick lag or worn switches, banging the machine,
  more than one credit at a time, the zoom into the screen (next layer), mini-gurke in the coin return.

## Open questions
- Should the cabinet hint at anything while the bot plays (no prompt at all now)?

## Decision log
- 2026-10-17: Zoom-out layer idea: a 3D arcade machine with screen and mechanical controls, the same game on the
  screen, but controls and view are different. (Quirin)
- 2026-10-17: Defaults accepted (fixed camera with a zoom-out intro, joystick at the bottom of the touch area,
  coins as the start, order maze → cabinet → screen). (Quirin)
- 2026-10-17: Real 3D was asked for, then corrected: no real 3D, pixel art throughout, simulate the 3D. (Quirin)
- 2026-10-17: The coin door prompt was hard to see: now big, magenta, under the door with a blinking frame. Coins held are shown and kept globally; one coin starts a game, with the coin animated into the slot. (Quirin)
- 2026-10-17: The cabinet's screen shows the emulated machine: the bot's demo game until a coin goes in, then the player's game through the stick; see [emulator](emulator.md). (Claude)
- 2026-10-17: Rework: the cabinet is only about inserting the coin and seeing the machine. No play and no bot here: the machine stands still while the cabinet shows; the coin animates into the slot, then the camera zooms into the maze layer for a fresh game. (Quirin; frozen picture for a running game and dropping PUSH START: Claude)
- 2026-10-17: A coin goes in only when the machine asks for one (halted). Going up mid-game, the bot takes over and plays on; no freezing. (Quirin)
- 2026-10-18: Coin minigame: tapping the coin door zooms into the coin mechanism; flick the coin into the slot, tap to roll it past the reject arm and the slug magnet; pass presses the coin switch (pulse down the wire, COIN bit in IN0) for CREDIT 1, fail drops it into the coin return to retry, no coin lost. Every coin, no skip, about 5 s. (Quirin, defaults accepted)
- 2026-10-18: Coin minigame wired up: the coin switch pulses the machine's real COIN bit and the program starts the game (no power cycle); the maze's game over sends the next coin through the cabinet's coin mechanism. (Quirin)
