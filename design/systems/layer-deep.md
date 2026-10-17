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

## Layer -1: inside the screen (CRT) · built (environment rework)
**Environment:** we stand on the phosphor inside the tube: one RGB phosphor triad per tile of the machine's
picture (three stripes behind the shadow mask), on black, with rounded tube corners (`cornerRadius`). No walls or
maze drawn: the picture only exists as light. **The beam paints one pixel at a time** like a raster CRT: a single
spot runs left to right along a row and row after row (`beamPeriod` for the whole picture, the real one takes
16.5 ms), then flies back switched off (`vblank`). The three converging beams from the gun and the spot's next
`lookAhead` cells are drawn as a warning. A triad lights in the picture's color for that spot (`rgb`: walls blue,
dots peach, Pac-Man yellow, ghosts red) and fades (`decay`, down to `darkFloor`). **Enemies:** the spot fires only
where the picture is lit, so it's a hit if it passes over you on a lit triad (dark phosphor is safe); the ghost
sprites hit too. **Objectives:** the 4 power pellets (where the maze layout has them, whether or not the machine's
Pac-Man ate them), eaten while lit; the other dots are counted.

## Layer -2: the video board · built (environment rework)
**Environment:** a circuit board (`DEEP.signals.layout`) with the chips that turn video RAM into a signal: VRAM, the
tile fetcher (TILES), the sprite line buffer (SPRITES), the palette PROM, the DAC and the sound chip, joined by
traces. Chips are solid, each with a live readout (the VRAM bytes being fetched, the fetch position, sprite codes,
the index going into the palette, the DAC's RGB, the last sound). **Verb: carry and deliver.** Every `sparkEvery` s
the fetcher reads a real dot tile and puts its color index (from color RAM) out on one of its pins (it waits
`sparkLife`); grab one and it follows one tile behind you. Take it to the palette's input pins (it becomes a color),
then to the DAC's input pins: one objective. **Enemies:** the 8 hardware sprites move over the board at their real
register positions (touching a ghost sprite is a hit and drops what you carry), and the sound chip's area is deadly
for `pulseTime` after every sound command but the chomp. **Objectives:** 4 colors delivered.

## Layer -3: video RAM · built (gameplay pass)
**Verb: dodge the blade trap.** VRAM as it sits in memory, 32 bytes per row in hex. **Area:** all of VRAM, including
the 13 unused bytes at the end of each row. **Enemy:** the CPU's write head, a Zelda blade trap: it replays the
program's real VRAM writes from the bus log (at most `queue` waiting, older ones skipped). For each write it waits
`waitTime` at the start of that row (the row glows red: telegraph), then dashes along the row at `dashSpeed` to the
address and writes; anything in its way is hit. No read sweep any more. Every byte that changed since the layer last
looked is dirty and can be eaten as a dot (in practice, the dots the bot's Pac-Man eats). **Objectives:** the 4
power pellet bytes (where the maze layout has its `o`s).

## Layer -4: the system bus · built (gameplay pass, spatial)
**Verb: rooms behind decoder doors.** A spatial bus (`DEEP.bus.layout`): the Z80 on the left, bus lanes from its
port to four chip rooms (ROM, RAM, VRAM, I/O), each behind a door. Every `cycleTime` s a bus cycle is picked from a
real frame's bus log (first a chip at random among those the frame touched, then one of its cycles; video and color
RAM count as VRAM, sprite registers as RAM / I/O). The **address decoder** opens only that chip's door (Zelda
keys and locked doors, keyed by the address); a door that closes on you is a hit, and inside a room you wait for
its chip to be addressed again. **Enemy:** each cycle sends a packet along the lanes (`packetSpeed`): a write
from the CPU into the chip, a read from the chip back to the CPU; touching one is a hit. A read drops up to 3 of
its 1 bits on its lane as dots. **Objectives:** the data byte in each of the 4 chip rooms.

## Layer -5: the CPU · built (gameplay pass)
**Verb: warps and switch blocks.** The program's own source listing (`game.asm` as the browser assembled it), one
page at a time; walk off the top or bottom edge to turn the page. Every `CALL` / `JP` / `JR` / `DJNZ` line has a
warp pad at its left edge that takes you to the line it jumps to (Pokémon warp panels); `CALL` also pushes the way
back, and `RET` pads take you back (STACK n). **Switch blocks:** the real Z and C flags raise and lower two columns
of blocks (`zColumn`, `cColumn`, every third line) like Zelda's crystal switches; standing in one when it rises
is a hit. **Enemy:** the program counter replays a real trace of a frame (`requestTrace`, from the vblank on, at
`rate` per second); the line it lands on fires, a hit if you're on it. It lives in the interrupt handler and the
routines that run every frame; the status line says which page it's on (`PC HERE!` when it's on yours). Z and C flags
it sets drop on their lines as dots. **Objectives:** reach 4 different routines through their `CALL` pads (an
unvisited routine's pad shows the special).

## Layer -6: the game logic · built (gameplay pass)
**Verb: line of sight.** No pixels: the maze as the rules see it, grid lines and faint wall outlines from VRAM,
Pac-Man and the ghosts as points at their RAM positions. Each hunting ghost shows its target vector, the line to the
tile it aims for, computed from RAM with the same rules (`ghostTarget`). **Area:** the rules' whole tile grid.
**Enemy:** like a Pokémon trainer, a ghost sees along its vector: crossing it (`vectorWidth`) gets you spotted
("!"), and a seeker comes out of that ghost and hunts you on the grid (`seekSpeed`, shortest path) for `seekTime`
s; touching it is a hit. Frightened ghosts have no vector and see nothing. **Objectives:** stand once on each of
the 4 ghosts' target tiles (they move with the mode and with Pac-Man; scatter corners are clamped into the grid).
The pellets are dots.

## Layer -7: the input wires · built (gameplay pass)
**Verb: pressure plates and a push block.** The joystick's switches as pads on the board, wired to IN0's bits
(START to IN1). Standing on a pad closes that switch: the bit goes low, the program polls it, and the machine's
Pac-Man turns. You steer the real game, watching it on a small picture at the top, with IN0 and IN1 shown live.
A switch chatters for `bounce` s when it closes. **Push block** (Zelda, Sokoban): walk into it to push it one tile;
on a pad it holds that switch while you walk elsewhere (your own pad wins while you stand on one). The bot is off
here (and so is the demo switch: deaths cost lives); the START pad starts a new game. **Enemies:** a noise spark
that crawls after you (`sparkSpeed`, after `sparkDelay` s, and again after it got you), and Pac-Man dying counts as
a hit. **Objectives:** steer Pac-Man into each of the maze's 4 corners (within `corner` tiles; the picture marks
the ones left). Every dot Pac-Man eats is a dot.

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
- 2026-10-17: Screen and signals looked too much like the maze: the screen becomes phosphor triads painted by a
  one-pixel raster beam (deadly only at its spot, on lit triads), signals becomes a circuit board of video chips. (Quirin)
