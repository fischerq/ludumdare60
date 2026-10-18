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

## Layer -1: inside the screen (CRT) · built (polish pass 2026-10-18)
**Environment:** we stand on the phosphor inside the tube: one RGB phosphor triad per tile of the machine's
picture (three stripes behind the shadow mask), on black, with rounded tube corners (`cornerRadius`). No walls or
maze drawn: the picture only exists as light. **The beam paints one pixel at a time** like a raster CRT: a single
spot runs left to right along a row and row after row (`beamPeriod` for the whole picture, the real one takes
16.5 ms), then flies back switched off (`vblank`). The three converging beams from the gun and the spot's next
`lookAhead` cells are drawn as a warning. A triad lights in the color the beam painted there (`rgb`: walls blue,
dots peach, Pac-Man yellow) and fades (`decay`, down to `darkFloor`). Pac-Man walks faster here (`walkSpeed`).
**Enemy:** only the beam spot. It's a hit if it paints light where you stand (dark phosphor is safe). No ghosts:
they aren't painted and don't hit.
**Objectives: fix the picture.** The monitor is out of adjustment, so the beam paints a broken frame. Four pads on
the tube's edge (`goals`) are its adjustments; walking onto one sets it, and from then on the beam paints that part
right, so each goal visibly does what that part of a real monitor does:
- **V-HOLD** (left edge): without it the picture rolls (`rollSpeed`), the vertical sync isn't locked.
- **H-HOLD** (bottom): without it the rows tear sideways (`tear`), the horizontal sync isn't locked.
- **CONVERGE** (top, under the gun): without it the red and blue beams miss green (`misconverge`): color fringes.
- **DEGAUSS** (right edge): without it the magnetised shadow mask gives blotches of wrong colors.
Since the lit cells are the dangerous ones, every fix also moves where the beam can hit you. The status line names
the adjustments still to set and says what each one fixed.
**Repairs slip (decided 2026-10-18):** a repair only holds for the rest of the picture it was made in and
`repairFrames` (2) more, then the beam paints that fault again (the pad shows the pictures left, blinking on its last;
the status line says when one slipped). Stepping onto a set pad again refreshes it. **The layer is won by one clean
picture** (`goal: 1`): the beam paints a whole picture, start to flyback, with all four holding. So all four have to
be set within about two pictures, one after the other; a bonus dot starts a new picture and can spoil a clean one.
The counter shows `REPAIRS n/4   CLEAN PICTURE 0/1` (an exception to the 3-5 objectives rule: the four repairs are
the steps). Playtest bot (quick runs): wins 100% in 24 s without noise, 80% in about 85 s at full noise.
**Bonus dots:** the 4 power pellets, eaten while lit (no other dots to collect). Each one makes the beam start a new
picture in another scan order for `bonusTime` s: column by column left to right, then bottom to top (`bonusModes`,
taken in turn). **Feedback:** Pac-Man glows on every pickup (`DEEP.glowTime`, art `assets/deep/crt/pac-glow-0..3`,
and pops bigger by `glowPop`).
Not in this pass: pellets respawning, pads moving, sound per adjustment.

## Layer -2: the video board · built (race against time)
**Environment:** a circuit board (`DEEP.signals.layout`) with boxes for the chips that turn video RAM into a signal:
VRAM and the FRAME timer (solid), and three big boxes you walk into through doorways: TILES, PALETTE and the DAC.
**Verb: carry and deliver, against the clock. No enemies.** Every frame the tile fetcher shows one real tile of the
current picture (a tile with as many colors as possible), magnified in its box at 2x2 pixels per cell, each pixel
already mapped to the palette. 3 of its pixels are marked (different palette entries where the tile has them); walk
onto each to take it. The PALETTE box shows the palette itself (`paletteSize` entries: the picture's most common
colors, as 2x2-cell swatches) and lights the entries of the pixels you carry; step on a lit entry and that pixel
becomes its color. With all 3 colored, walk into the DAC: one objective, and a new frame starts. The pixels drop from you into
the DAC's three slots, their R/G/B levels rise over them, then they leave one after the other along the video-out
wire off the board (`dropTime`, `convertTime`, `sendTime`, `sendGap`). **The frame timer** counts down `frameTime` s; at zero the pixels you carry are dropped and the
fetcher moves on to a new tile. **Objectives:** 4 deliveries.

## Layer -3: video RAM · built (gameplay pass)
**Verb: dodge the blade trap.** VRAM as it sits in memory, 32 bytes per row in hex. **Area:** all of VRAM, including
the 13 unused bytes at the end of each row. **Enemy:** the CPU's write head, a Zelda blade trap: it replays the
program's real VRAM writes from the bus log (at most `queue` waiting, older ones skipped). For each write it waits
`waitTime` at the start of that row (the row glows red: telegraph), then dashes along the row at `dashSpeed` to the
address and writes; anything in its way is hit. No read sweep any more. Every byte that changed since the layer last
looked is dirty and can be eaten as a dot (in practice, the dots the bot's Pac-Man eats). **Objectives:** the 4
power pellet bytes (where the maze layout has its `o`s).

## Layer -4: the system bus · built (gameplay pass, spatial; polish 2026-10-18)
**Verb: rooms behind decoder doors.** A spatial bus (`DEEP.bus.layout`): the Z80 on the left, bus lanes from its
port to four chip rooms (ROM, RAM, VRAM, I/O), each behind a door. Every `cycleTime` s a bus cycle is picked from a
real frame's bus log (first a chip at random among those the frame touched, then one of its cycles; video and color
RAM count as VRAM, sprite registers as RAM / I/O). The **address decoder** opens only that chip's door (Zelda
keys and locked doors, keyed by the address). A door stays open `doorHold` s after its chip's cycle (so two
doors can be open at once) and flickers for `doorWarn` s before it closes; a door that closes on you is a hit, and
inside a room you wait for its chip to be addressed again. **Enemy:** each cycle sends a packet along the lanes (`packetSpeed`): a write
from the CPU into the chip, a read from the chip back to the CPU, leaving the chip only after `readDelay` (its access
time, so the door can be slipped through before the read comes out; a waiting read pulses by the door); touching
one on the lanes or in a doorway is a hit, inside a chip room packets are harmless. A read drops up to 3 of
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

## Goals vs. what the part does · open (review 2026-10-18)
Quirin asked that a layer's goals connect to what its component achieves (the screen's adjustments now fix the
picture). How the other layers do on that, to decide later:
- **-2 video board:** connected. Carrying an index through the palette to the DAC is what the board does.
- **-3 video RAM:** disconnected. Eating the 4 power pellet bytes doesn't show what VRAM does (hold the picture the
  screen shows). Idea: write the right bytes into blanked parts of the picture.
- **-4 bus:** half. Picking up a byte in a chip room is a read, but it never reaches the CPU. Idea: carry it back.
- **-5 CPU:** half. Reaching a routine through its CALL pad does nothing in the game. Idea: a routine you reach runs
  and you see its effect (e.g. the sound routine plays).
- **-6 game logic:** half. Standing on a ghost's target tile has no effect. Idea: standing there pulls that ghost
  in the maze (the target is what it chases).
- **-7 input wires:** connected. Steering the real Pac-Man into the corners through the switches.
- **Dots** in -3 to -7 are only counted and say nothing about the part.

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
- 2026-10-17: Bus easier: a read's packet waits `DEEP.bus.readDelay` (1.3 s) in the chip before heading out. Before,
  it came out through the one-tile approach the moment the door opened, so ROM (never written) and VRAM (about 1%
  writes) were nearly impossible to enter; playtest bots won 0% at every noise level. (Quirin asked to make the bus
  easier; Claude picked the fix from the [playtest](playtest.md) runs)
- 2026-10-18: Screen polish: beam slower (13 s), Pac-Man faster there (6.5 tiles/s), no ghosts (the beam is the only
  enemy), no dots to collect; the objectives are four monitor adjustments (V-HOLD, H-HOLD, CONVERGE, DEGAUSS), each
  making the beam paint its part of the frame right; power pellets are bonus dots that switch the beam's scan order
  for a while; Pac-Man glows on pickups. Other layers' goals reviewed for the same link (open). (Quirin asked; Claude
  picked the four adjustments)
- 2026-10-18: Screen harder: repairs hold only the rest of their picture and 2 more; the layer is won by one whole
  picture painted with all four holding. (Quirin)
- 2026-10-18: Video board polish: enemies removed (sprites, sound chip), it is a race against the frame timer (`frameTime`, drops what you carry at zero). Pickup and dropoff moved into big walk-in TILES / PALETTE / DAC boxes; the tile box shows the real fetched tile, you take 3 of its pixels, the palette box shows the palette and lights their entries.
- 2026-10-18: Delivering in the DAC is animated: the pixels drop into its slots, show their R/G/B levels, then are sent out one by one along the video-out wire.
- 2026-10-18: Bus polish: doors stay open `doorHold` (1.6 s) after their chip's cycle and flicker for `doorWarn`
  (0.6 s) before closing; safer exits: packets can't hit inside a chip room (a read used to spawn on the tile you
  wait on by the door) and a waiting read pulses there. (Quirin asked for longer doors and safer exits; Claude
  picked how)
