# Arcade maze game

**Status:** decided (first version built 2026-10-17)
**Parent:** [master](../master.md)
**Lab bench:** none yet
**Code:** rules `src/systems/maze.js` (no Phaser), scene `src/scenes/GameScene.js`, sound `src/sound.js`,
art `src/scenes/BootScene.js`, numbers and maze layout in `src/config.js` (`MAZE`, `SPEED`, `GHOSTS`, `RULES`)

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
Swipe anywhere on the screen to turn; the turn is buffered until it fits, reversing is instant. Each swipe
re-arms from where the finger is, so you can steer without lifting. Arrow keys / WASD on a laptop.

## Look and sound · decided
Full screen, no cabinet frame (a pure arcade screen; clearing the first level changes it). Black screen,
blue outlined walls with a glow, pixel font (Press Start 2P, pinned on jsdelivr). WebAudio bleeps in
`src/sound.js`: start jingle, waka on dots, power pellet, frightened siren, ghost eaten, death, clear.

## Slice scope
- Build (done): menu, one maze, chomper, 4 ghosts, pellets, lives, score + high score, ready/death/clear
  sequences, swipe and keyboard, sound, game over / maze clear screen.
- Not now: fruit, levels getting faster, intermissions, the first tech layer, mini-gurke egg, mute button,
  sound settings.

## Open questions
- Does swiping feel right on the phone, or is the 30 px threshold (`INPUT.swipeMin`) too twitchy/sluggish?
- Speeds (`SPEED`) and how hard the ghosts are: tune after playtests.

## Decision log
- 2026-10-17: Start the game with an arcade-styled maze-chomper (Pac-Man style). (Quirin)
- 2026-10-17: Defaults accepted (own homage, swipe controls, ~19 wide maze, 4 simplified ghosts, 3 lives and
  one maze, pure logic in `src/systems/`), except: full screen instead of a cabinet frame, and a bit of sound
  right away. (Quirin)
