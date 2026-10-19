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
- 4 lives, one maze. Clearing it is the hook into the first tech layer (placeholder screen for now).
- 4 ghosts with the original's ideas, simplified: scatter/chase phases (7/20/7/20/5 s, then chase), never
  reverse except on phase change, pick the turn closest to a target. Blinky targets the chomper, Pinky 4 tiles
  ahead, Inky mirrors Blinky around 2 tiles ahead, Clyde chases until close, then goes to his corner.
  Release from the house at 0/1/5/9 s. Frightened for 6 s (flashing for the last 2), random turns, slower; eaten
  ghosts return to the house as eyes. Ghosts slow down in the tunnel.

## Controls · decided
Swipe anywhere on the screen to turn; reversing is instant. Each swipe re-arms from where the finger is, so you
can steer without lifting. Arrow keys / WASD on a laptop.
Tuning (2026-10-17, after the first phone test said turning felt unresponsive):
- Forgiving turns: a sideways swipe up to `CONTROL.turnWindow` (0.7) tiles before or after a junction snaps
  onto it and turns, instead of only exactly at the tile center.
- A swipe waits `CONTROL.bufferTime` (0.8 s) for a junction it fits, then is dropped, so old swipes don't
  cause surprise turns.
- Shorter swipe (`INPUT.swipeMin` 20 px) and a bit slower (chomper 6.5, ghosts 5.05 tiles/s).
- Tune all four in the lab bench `maze-controls`, against the first build's numbers.

## Look and sound · decided
Full screen, no cabinet frame (a pure arcade screen; clearing the first level changes it). Imitates the
original's look: the maze is built from a 16x16 tileset (304x400 px for 19x25 tiles), scaled up 2x with hard
pixel edges (`PIXEL`); sprites show in a 2x2-tile box (16x16 placeholders, Max's art 32x32), blue wall lines
with rounded corners, pixel font (Press Start 2P, pinned on jsdelivr) at 16 px. Art details:
[art](art.md). This is a cheap imitation; emulating the real tile/sprite hardware
rendering could come later as a layer. WebAudio bleeps in
`src/sound.js`: start jingle, waka on dots, power pellet, frightened siren, ghost eaten, death, clear.

## Levels and the kill screen · decided (built 2026-10-18)
Pac-Man's famous [Map 256 glitch](https://pacman.fandom.com/wiki/Map_256_Glitch), from a real 8-bit overflow in
our own Z80 program (`game.asm`), not drawn by the host.
- **Round counter:** one byte `LEVEL` in work RAM, 0 = level 1. Clearing the maze and tapping (START on the
  cleared maze) runs `next_round`: counter + 1, maze refilled, everyone back to the start, score and lives kept.
  A new game sets it to 0. After level 256 the byte wraps back to level 1 (reached only once 256 is repaired).
- **Level shelf:** the tile row under the maze (VRAM row 25), right half (cols 10..18, `LEVELS.shelfCols`), shows a
  fruit per level, right to left, at most the last 7, like the original's bottom row: cherry, strawberry, orange x2,
  apple x2, melon x2, ship x2, bell x2, then keys (`FRUIT_TABLE` in ROM, art `assets/maze/fruit-*.png`). A full
  shelf row would carry on in the row above (with 7 fruits it never does). No bonus fruit appears in the maze.
- **The overflow:** `draw_fruit` takes the level number as counter + 1 in 8 bits. On level 256 (counter 255) that
  wraps to 0, which passes the "fewer than 8" check, and DJNZ with 0 runs 256 times. The table pointer walks past
  `FRUIT_TABLE` into the program code after it, and the screen pointer climbs the shelf rows up the right half of
  the maze: about 220 cells get garbage codes and colors. The left half stays clean.
- **Garbage:** codes the graphics ROM doesn't know show as a noise tile made from the byte, colored from the
  palette byte. Like the original's tile check, every code from the wall code up blocks actors (the program's
  `can_enter`, the bot and the deep layers use the same rule); garbage that happens to be 1 or 2 is a dot or pellet.
- **Kill screen:** overwritten dots are gone but still counted in `PELLETS`, so it never reaches 0 (117 dots on
  screen, 199 to go).
- **Host API** (`src/systems/arcade/world.js`): `setRound(n)` puts the machine's game on level n (1..256) and
  restarts the round there for free (pokes the counter to the level before, n - 2, and the phase to cleared, then presses START,
  so the program's own `next_round` runs); `setLevel256(on)` is level 256 or level 1; `currentRound()` reads it.
  `?level=256` starts every fresh maze game on that level, for testing. A lobby switch will use the API.
- No level number on screen (the original has none either).
- **Repairs** (Quirin, 2026-10-19): each deep layer won in hard mode (the 256 switch on, see
  [layer-deep.md](layer-deep.md#hard-mode--decided-quirin-2026-10-19-numbers-claudes)) repairs one strip of the
  garbage half. The half is split into `LEVELS.repairs` (7) row bands, top to bottom in layer order (screen at the
  top, input at the bottom; 3-4 rows each). In the machine's real data: the host latches the hard wins as a bit mask
  into the program's `REPAIRS` byte in work RAM before every frame (`setRepairs`, wired in main.js through
  `progress.onChange`, so a lobby lever and a real win act the same). On level 256 only, the program's `repair`
  (game.asm, called at round start after `draw_fruit` and every frame) makes each newly set strip
  (`REPAIR_TABLE`, generated from config) playable, not clean, and notes it in `REPAIRED`. A repair tweaks the
  corruption instead of reverting it (Quirin, 2026-10-19): cells that are walls in `MAZE_ROM` keep their garbage
  when it blocks (the maze keeps its shape, drawn in noise and fruit junk), and only become a clean wall where the
  garbage byte would let actors through; every other cell gets `MAZE_ROM`'s code with palette 1 (paths, dots,
  door, house). Mid-round an empty cell stays empty (its dot may have been eaten). Dots under garbage were never
  eaten and are still counted in `PELLETS`; once all seven strips are repaired the program recounts `PELLETS`
  from the dots on screen (a dot hidden under a zero byte can't be told from an eaten one mid-round), so the
  level can always be cleared, also mid-round. The level shelf row keeps its garbage.
- **Beating it:** clearing level 256 on the maze shows LEVEL 256 CLEAR! and rolls the credits
  (`Credits` scene, back to the menu) when that scene exists, else the normal maze clear. The counter then wraps to
  level 1 on the next START, the program's own byte; a fresh game with the switch on starts on 256 again.

## Slice scope
- Build (done): menu, one maze, chomper, 4 ghosts, pellets, lives, score + high score, ready/death/clear
  sequences, swipe and keyboard, sound, game over / maze clear screen. Levels with the fruit shelf and the
  level 256 kill screen (2026-10-18).
- Not now: bonus fruit in the maze, levels getting faster, intermissions, the first tech layer, mini-gurke egg,
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
- 2026-10-17: Maze easier: ghosts 6 → 5.05 tiles/s (Pac-Man 6.5), turn window 0.4 → 0.7 tiles (late swipes still take
  the turn), 4 lives instead of 3. Playtest bots at light noise (0.25) went from 20% to about 88% cleared. (Quirin asked
  to make the maze easier; numbers Claude's from the [playtest](playtest.md) runs)
- 2026-10-18: Add Pac-Man's level 256 glitch, from a real 8-bit overflow in the Z80 program: a round counter byte,
  clears go to the next level with score and lives kept, a fruit shelf under the maze whose loop overruns on level
  256 and garbles the right half (kill screen); `setRound`/`setLevel256` for a lobby switch, `?level=256`. (Quirin)
  Shelf layout (right half, a full row carries on upward), garbage tiles and "codes from the wall up block" (Claude)
- 2026-10-19: Level 256 repairs: each hard-mode deep layer win restores one of 7 row strips of the garbage half,
  in the program (REPAIRS byte latched by the host, `repair` copies MAZE_ROM back); clearing the repaired 256 rolls
  the credits, then the counter wraps to level 1. (Quirin; strips and mechanism Claude's)
- 2026-10-19: Repairs no longer revert a strip to the clean maze (after all switches it looked normal again):
  walls keep their garbage, only the paths come back, and the dot count is recounted once all strips are
  repaired so it stays winnable. (Quirin; which cells keep garbage and the recount Claude's)
