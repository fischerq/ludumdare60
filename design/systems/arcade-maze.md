# Arcade maze game

**Status:** decided (first version built 2026-10-17)
**Parent:** [master](../master.md)
**Lab bench:** `/lab/bench.html?b=maze-controls` (swipe controls)
**Code:** rules in Z80 code `src/systems/arcade/game.asm` (reference: `src/systems/maze.js`, no Phaser), scene `src/scenes/GameScene.js`, sound `src/sound.js`,
swipes `src/systems/swipe.js`, art `src/scenes/BootScene.js`, numbers and maze layout in `src/config.js`
(`MAZE`, `PIXEL`, `SPEED`, `GHOSTS`, `RULES`, `INPUT`, `CONTROL`)

## Purpose
The front door of the game: an arcade-styled maze-chomper in the spirit of Pac-Man. Everything else (the
[layers](layers.md)) starts from here and reuses its characters and mechanics.

## Rules · decided
- Our own homage, recognisably Pac-Man-like: own maze, sprites drawn in code, no "Pac-Man" name.
- Maze 19x25 tiles (37 px each), left-right symmetric, side tunnel that wraps; no dead ends.
- Eat every dot to clear the maze. Dot 10, power pellet 50, ghosts 200/400/800/1600 per pellet.
- 3 lives, one maze. Clearing it is the hook into the first tech layer (placeholder screen for now).
- 4 ghosts with the original's ideas, simplified: scatter/chase phases (7/20/7/20/5 s, then chase), never
  reverse except on phase change, pick the turn closest to a target. Blinky targets the chomper, Pinky 4 tiles
  ahead, Inky mirrors Blinky around 2 tiles ahead, Clyde chases until close, then goes to his corner.
  Release from the house at 0/1/5/9 s. Frightened for 6 s (flashing for the last 2), random turns, slower; eaten
  ghosts return to the house as eyes. Ghosts slow down in the tunnel.

## Controls · decided
Swipe anywhere on the screen to turn; reversing is instant. Each swipe re-arms from where the finger is, so you
can steer without lifting. Arrow keys / WASD on a laptop.
Tuning (2026-10-17, after the first phone test said turning felt unresponsive):
- Forgiving turns: a sideways swipe up to `CONTROL.turnWindow` (0.4) tiles before or after a junction snaps
  onto it and turns, instead of only exactly at the tile center.
- A swipe waits `CONTROL.bufferTime` (0.8 s) for a junction it fits, then is dropped, so old swipes don't
  cause surprise turns.
- Shorter swipe (`INPUT.swipeMin` 20 px) and a bit slower (chomper 6.5, ghosts 6 tiles/s).
- Tune all four in the lab bench `maze-controls`, against the first build's numbers.

## Look and sound · decided
Full screen, no cabinet frame (a pure arcade screen; clearing the first level changes it). Imitates the
original's look: the maze is built from a 16x16 tileset (304x400 px for 19x25 tiles), scaled up 2x with hard
pixel edges (`PIXEL`); sprites show in a 2x2-tile box (16x16 placeholders, Max's art 32x32), blue wall lines
with rounded corners, pixel font (Press Start 2P, pinned on jsdelivr) at 16 px. Art details:
[art](art.md). This is a cheap imitation; emulating the real tile/sprite hardware
rendering could come later as a layer. WebAudio bleeps in
`src/sound.js`: start jingle, waka on dots, power pellet, frightened siren, ghost eaten, death, clear.

## Slice scope
- Build (done): menu, one maze, chomper, 4 ghosts, pellets, lives, score + high score, ready/death/clear
  sequences, swipe and keyboard, sound, game over / maze clear screen.
- Not now: fruit, levels getting faster, intermissions, the first tech layer, mini-gurke egg, mute button,
  sound settings.

## Open questions
- Do the new turn window and swipe numbers feel right on the phone? Tune in the bench.
- Speeds (`SPEED`) and how hard the ghosts are: tune after playtests.

## Decision log
- 2026-10-17: Start the game with an arcade-styled maze-chomper (Pac-Man style). (Quirin)
- 2026-10-17: Defaults accepted (own homage, swipe controls, ~19 wide maze, 4 simplified ghosts, 3 lives and
  one maze, pure logic in `src/systems/`), except: full screen instead of a cabinet frame, and a bit of sound
  right away. (Quirin)
- 2026-10-17: Turning felt unresponsive on the phone: add forgiving turns, swipe expiry, shorter swipes, slower
  speed, and a lab bench to tune them. (Quirin)
- 2026-10-17: Look like the original: arcade resolution (8 px tiles) scaled up with hard pixel edges, pixel
  sprites; real rendering emulation maybe later. (Quirin)
- 2026-10-17: Art moves to 16x16 tiles and sprites in a 2x2-tile box; the maze is built from a tileset, without the
  double outer wall. See [art](art.md). (Quirin)
- 2026-10-17: The maze game now runs as a Z80 program on the emulated arcade machine (`src/systems/arcade/game.asm`), same rules as `maze.js`; see [emulator](emulator.md). (Claude)
