# The deep layers (below the maze)

**Status:** first slices of all seven built 2026-10-17, mechanics and feel to be tuned
**Parent:** [layers](layers.md) · [emulator](emulator.md) · [master](../master.md)
**Lab bench:** none yet
**Code:** scene `src/scenes/DeepScene.js` (one scene for all of them, `?scene=Deep`), rules per layer in
`src/systems/layers/<id>.js` (no Phaser), the walking player in `src/systems/layers/walker.js`, numbers in
`DEEP` in `src/config.js`.

**Research:** [top-down mechanics survey](topdown-mechanics.md) (proposals for a gameplay pass per layer)

## Purpose
Going down from the maze game, each layer is a view of the one emulated machine that runs it (see
[emulator](emulator.md)), from the picture tube down to the input wires. Gameplay in a layer may stylize,
slow down or aggregate, but everything comes from the machine's real raw data.

## Shared rules · decided (Claude, defaults accepted by Quirin)
- Same controls as the maze: swipe to walk a grid one tile at a time (`DEEP.walkSpeed`).
- **Each layer has its own verb and its own enemy, and 3 to 5 objectives** (`goal`); doing them all wins the
  layer (LAYER CLEAR). Dots are still everywhere to eat, but they're only counted. The counter shows
  `GOALS n/goal   DOTS n`, a line under it says what to do next. LAYER UP and LAYER DOWN always work.
- Only the screen layer has a sweeping beam; every other layer's danger moves differently. Mechanics come from
  the [top-down mechanics survey](topdown-mechanics.md). Enemies that hunt you use `src/systems/layers/chaser.js`
  (shortest path on the grid).
- The machine runs `DEEP.machineSlowdown` times slower down here than on the maze.
- A hit flashes the player and puts it back at the start (`DEEP.hitPause`); hits are only counted.
- While the player is down here, the bot plays the maze game on the machine, so the data keeps moving.
- Moving between layers zooms and fades (`DEEP.transition`).

## Look: Tron · decided (Quirin, 2026-10-17)
- Inspired by Tron, still pixel art throughout (whole-factor zoom, no blur shaders): a dark background with a faint
  floor grid, the layer's structures as thin neon lines or blocks with a 1 px halo, a neon edge around the arena.
- **Every layer has its own colors** (`DEEP.style` in config): a dark background (also behind the whole screen),
  one neon accent for its structures, and up to two dot accents. Going down: -1 screen magenta, -2 signals cyan,
  -3 video RAM blue, -4 bus amber, -5 CPU green, -6 logic violet, -7 wires orange. White and one red for
  everything deadly (`DEEP.hazard`) are shared.
- **Collectibles are dots** in the layer's dot accents (`dot`, `dot2`); only special collectibles get more
  detail (`special`, e.g. the power pellets). Pac-Man is a neon outline in the layer's colors.
- **Light trail:** Pac-Man leaves a light-cycle trail that fades over `DEEP.trail` s. Visual only, never deadly.
- Art: one folder per layer, `assets/deep/<layer>/` (`pac-0..3`, `dot`, `dot2`, `special`), drawn in
  `makeDeep` in `BootScene`. The layers' structures (grids, walls, lanes) are still drawn in code each frame.

## Areas · decided (Quirin, 2026-10-17)
- Movement stays as it is: swipe, one tile at a time on the layer's grid.
- No maze walls to restrict movement: each layer's area follows that layer's own layout (see each layer below).
  The top-down view and collecting dots are what stays the same across layers.

## Slice scope (style revision)
- Build: per-layer colors, neon look, dots as sprites, neon Pac-Man, light trail; then the areas without maze
  walls (screen, signals, video RAM, logic; bus, CPU and wires already had their own layouts).
- Not now: Tron mechanics (a deadly trail, light cycles), free movement, new hazards, art for the structures
  as asset files.

## Layer -1: inside the screen (CRT) · built
The maze picture magnified to its phosphor: walls and dots from VRAM, ghosts from the sprite registers. A
beam sweeps the picture row by row, slowed from 16.5 ms to `DEEP.crt.beamPeriod`. Rows glow after it passes
and fade (`decay`); a dot can be eaten only while it glows (`litAbove`). The beam only fires where the
picture is lit, so standing on an uneaten dot when it arrives is a hit; black floor is safe, and so is the
vertical blank (`vblank`), when the beam flies back switched off. Ghost sprites are always a hit.
**Area:** the whole face of the tube except its rounded corners (`cornerRadius`); the maze's walls are just
lit phosphor, walkable, and deadly under the beam like an uneaten dot. Dots the
machine's Pac-Man eats vanish here too. Goal: 25 dots.

## Layer -2: the signal chips · built (gameplay pass)
**Verb: carry and deliver.** The playfield as the video chip sees it: each tile's code from VRAM in hex, the 8
hardware sprites as boxes labelled with slot and sprite code. **Area:** the whole tile grid (to the chip the walls
are just tile codes). The tile fetcher hands out a color index at a random dot tile every `sparkEvery` s (it waits
`sparkLife`); grab one and it follows you one tile behind. Take it to the **PAL** chip (palette: the index
becomes a color), then to the **DAC**, which puts it on the screen: one objective. You carry one at a time.
**Enemies:** the ghost sprites (touching one is a hit and drops what you carry) and the **SND** chip: every sound
command except the dot chomp makes the area around it deadly for `pulseTime` (a timed trap, not a sweep).
**Objectives:** 4 colors delivered.

## Layer -3: video RAM · built
VRAM as it sits in memory, 32 bytes per row in hex. Bytes holding the wall code are walls, the 13 unused
bytes at the end of each row are open floor. **Area:** all of VRAM; wall bytes are walkable like any other byte. The CPU's write head replays the program's real VRAM writes from
the bus log: it hovers `DEEP.vram.writeTime` over the next address, then writes (a hit if you're on it); at
most `queue` writes wait, older ones are skipped. Every byte that changed since the layer last looked is dirty
and can be collected; in practice those are the dots the bot's Pac-Man eats. The video chip's read sweep is
shown but harmless. Goal: 20 dirty bytes.

## Layer -4: the system bus · built
16 address lanes, 8 data lanes and a control column (R/W, I/O in/out); each row is one bus cycle of a real
frame, scrolling down at `DEEP.bus.rate` per second, its background colored by the memory region it targets.
Instruction fetches from ROM are filtered out (most of the traffic). A 1 on an address lane is live: a hit.
On a read the data lanes carry the payload in: grab the 1s. On a write the CPU drives them: they're live too.
Start in the gap between data and control lanes, which is never live. Goal: 40 data bits.

## Layer -5: the CPU · built
The program's own source listing (`game.asm` as the browser assembled it), with the program counter
replaying a real trace: `requestTrace` records the first `DEEP.cpu.trace` instructions of a frame (from the
vblank interrupt on), replayed at `rate` per second. The line the PC jumps to is a hit if you're on it. Every
instruction that leaves Zero or Carry set drops a Z or C on its line (right edge) to collect. The registers
and flags after the current instruction are shown below. Goal: 25 flags.

## Layer -6: the game logic · built
No pixels: the maze as the rules see it, grid lines and wall outlines from VRAM, Pac-Man and the ghosts as
points at their RAM positions. Each ghost that hunts shows its target vector, the line to the tile it aims
for, computed from RAM with the same rules (`ghostTarget`): the scatter corner, or its chase rule. **Area:** the rules' whole
tile grid; walls are only faint outlines. Vectors
are deadly (`DEEP.logic.vectorWidth`); they swing as Pac-Man moves and flip with the mode. Frightened ghosts
have none. The pellets are nodes to collect. Goal: 30.

## Layer -7: the input wires · built
The joystick's switches as pads on the board, wired to IN0's bits (START to IN1). Standing on a pad closes
that switch: the bit goes low, the program polls it, and the machine's Pac-Man turns. You steer the real game,
watching it on a small picture at the top, with IN0 and IN1 shown live. A switch chatters for
`DEEP.input.bounce` s when it closes. The bot is off here (and so is the demo switch: deaths cost lives);
the START pad starts a new game. Every dot Pac-Man eats counts, Pac-Man dying is a hit. Goal: 30 dots.

## Decision log
- 2026-10-17: One scene for all deep layers with a pure module per layer; first slices of all seven layers
  from the Gemini chat's mapping, adapted so each is playable on a phone. (Claude)
- 2026-10-17: CRT: the beam is only deadly where the picture is lit, otherwise no spot would be safe. (Claude)
- 2026-10-17: Signals: sound waves stay at the bottom and swell (a wave rolling over the whole screen could
  not be dodged). (Claude)
- 2026-10-17: Style revision: Tron-inspired neon look in pixel art, a background color and accents per layer,
  collectibles as dots (details only for special ones), a visual-only light trail; grid walking stays. (Quirin)
- 2026-10-17: Areas without maze walls: screen, signals, video RAM and logic open their whole grid (the tube
  keeps rounded corners; lit walls on the screen are deadly under the beam). Bus, CPU and wires keep their layouts. (Quirin asked; Claude)
- 2026-10-17: LAYER DOWN always open (no goal gate, no cheats); the machine runs DEEP.machineSlowdown (4x) slower
  down here. (Quirin)
- 2026-10-17: Gameplay pass: every deep layer gets its own verb and enemy and 3-5 objectives to win; the beam
  sweep stays only on the screen. Signals: carry a color index via PAL to the DAC; sprites and the sound chip are
  the enemies. Bus becomes spatial (chip rooms behind decoder doors). (Quirin, from the survey defaults)
