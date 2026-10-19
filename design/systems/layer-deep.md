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
- **Entered from the board lobby** inside the cabinet ([layers](layers.md#inside-the-cabinet-board-lobby-and-subsystems--decided-built-quirin-defaults-accepted-2026-10-18)):
  each layer is a subsystem there, unlocked one at a time in this order. A layer has only LAYER UP (back to the
  lobby); winning it shows LAYER CLEAR and goes back to the lobby, where the next subsystem wakes up
  (`markWon` in `src/progress.js`). The title shows the layer's name, no more "LAYER -n".
- Same controls as the maze: swipe to walk a grid one tile at a time (`DEEP.walkSpeed`).
- **Each layer has its own verb and its own enemy, and 3 to 5 objectives** (`goal`); doing them all wins the
  layer (LAYER CLEAR). Dots are still everywhere to eat, but they're only counted. The counter shows
  `GOALS n/goal   DOTS n`, a line under it says what to do next. LAYER UP always works.
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
  -3 work RAM sky blue (was video RAM blue), -4 bus amber, -5 CPU green, -6 logic violet, -7 wires orange. White and one red for
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

## Layer -3: work RAM · decided, built (poke the game state, 2026-10-18)
**Environment:** eight of the game's variables in the machine's real work RAM (`MAP.ram`, found by the program's own
symbols, `DEEP.ram.vars`), as big boxes in two columns: the name, the value and a row of 8 bit lamps (high bit on the
left). SCORE (the lamps are its high byte, each worth 256), LIVES, LEVEL, DOTS LEFT (`PELLETS`), PAC X, PAC Y,
BLINKY X and BLINKY SCARED (Blinky's fright byte). Positions are 16-bit pixel values; their lamps are the tile
number (px / 16), so a flip moves the actor by whole tiles. A small picture of the maze game runs live at the top
left (like the input wires), with the score, the lives, the game's phase and the objectives next to it. Lanes
between the boxes; the name rows are solid, so each lamp is reached from the lane below it. Code
`src/systems/layers/ram.js`, numbers in `DEEP.ram`.
**Verb: poke.** Stepping onto a lamp flips that bit in the emulated RAM (once per visit, like a cheat device; not a
CPU write, so it's not on the bus) and the game reacts at once: more lives, a score jump, Pac-Man or Blinky jumps
tiles, Blinky turns blue. The cheat keeps positions sane: a flip that would put an actor off the maze or into a wall,
or move it outside play (Blinky only while he's out of the house), is refused (the lamp flashes red, the status line
says why). DOTS LEFT also clears its high byte, so the count can't stay underflowed. The lamps that move an
unfinished objective on blink white.
**Enemy:** the CPU's write head, a Zelda blade trap. When the program really writes one of the variables (read from
the bus log), the variable is queued; the head takes the one that has waited longest, its bits glow red at its left
edge for `waitTime` (telegraph), then it dashes along the 8 bits at `dashSpeed`; anyone on them is hit, the name row
and the lanes are safe. The status line says which variable it writes. Positions are written every frame the actor
moves and the score and dots on every dot, so those boxes get dashed often; LIVES, LEVEL and BLINKY SCARED rarely.
Most writes are read-modify-write (`x = x + 1`, `score += 10`), so a poke survives them; real overwrites happen when
the program sets a value: a new round resets DOTS LEFT, a power pellet ending or Blinky being eaten clears his fright.
**Objectives** (`DEEP.ram.goals`, each needs a poke of yours): **5 LIVES**, **SCORE 10000+**, **MOVE BLINKY** (a
flip of BLINKY X while he's out), **SCARE BLINKY** (any bit on while he's out: he turns blue in the picture and
Pac-Man can eat him). No dots. The pokes stay in the machine's RAM after you leave.
Playtest bot (quick runs): wins 100% in about 11 s up to noise 0.25, 100% in 31 s at 0.5, 20% at full noise.
Not in this pass: more ghosts (Pinky, Inky, Clyde), the level-256 kill screen via LEVEL + DOTS LEFT, a sound per poke.

Before the rework (2026-10-18) the work RAM was a 32x32 hex dump of tiny 2-digit cells with the same blade trap
along rows, and the objectives were finding 4 named bytes, which changed nothing in the game. Before that this layer was **video RAM**: the same blade trap over VRAM with the 4 power pellet bytes
as objectives. Replaced because there were already many video layers.

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

## Layer -5: the CPU · built (Game Genie rework, 2026-10-18)
**Verb: carry a patch onto the program (Game Genie).** One routine of the real program per screen: 12 big lines of
`game.asm` as the browser assembled it (`DEEP.cpu.lines`, labels in the second accent), the machine's picture small
at the top left with the patch list and the score beside it, and the registers (PC, A, HL, DE, the Z and C flags)
as big boxes at the bottom. Code `src/systems/layers/cpu.js`, numbers in `DEEP.cpu`.
**Objectives: 4 patches** (`patches`), one per routine, in this order. A patch token (a card with the replacement
instruction on it) lies on a line; walk onto it to take it (it follows you), then onto the marked line (blinking
outline): the patch is really written into the machine's ROM and the line shows the new instruction. The picture
at the top flashes, and after `nextDelay` the next routine comes up. Each patch is 2 or 3 bytes the program has:
- `eat`: `LD DE,DOT_POINTS` becomes `LD DE,DOT_POINTS*10`: **dots worth 10x** (the score beside the picture jumps).
- `move_pac`: `LD DE,SPD_PAC` becomes `LD DE,SPD_PAC*2`: **Pac-Man 2x fast**.
- `move_ghost`: `LD DE,SPD_GHOST` becomes `LD DE,SPD_GHOST/2`: **ghosts half speed** (in the maze, not frightened).
- `check_hits`: `JR Z,.DEATH` becomes `NOP NOP`: **Pac-Man eats any ghost** he touches (it turns to eyes).
**Enemy: the program counter**, a glowing red cursor. It replays a real trace of a frame (`requestTrace`), slowed
down: `rate` lines per second while it's on a line of this screen, `awayTime` for each stretch it spends
elsewhere (a CALL out, the rest of the frame); the panel then says where (`PC IN ACCUM`). The line it lands on
next has a red outline; it's a hit if it lands on your line (`grace` after a respawn or a new routine). Wherever
it doesn't just go on to the next line, a white arrow in the left gutter shows the jump (line to line, or off the
top or bottom edge when it leaves). A frame that doesn't run this screen's lines (no dot eaten in `eat`) is skipped
and a new trace taken after `retry`. The four routines get harder: `eat`'s dot part runs only when a dot is eaten,
`move_pac` once a frame, `move_ghost` four times, `check_hits` loops over the ghosts twice a frame.
**Patches stay** in the ROM for the rest of the session (until the page reloads), also in the maze, which is the
fun: nothing in them can crash the program (the score is 16 bits and wraps as it always would). Entering the CPU
layer puts the original program back first (`revertPatches`), so it can be played again; the playtest resets it
before every fresh machine. No dots in this layer (the counter shows `PATCHES n/4`).
Playtest bot (quick runs): wins 100% at every noise level, about 19 s without noise, 30 s at 0.5, 40 to 50 s at
0.75 to full noise (2 to 4 hits).

Before (until 2026-10-18) this layer was the whole source listing in 51 pages with warp pads on CALL / JP / RET
lines and Z / C flag switch blocks; reaching a routine did nothing in the game, and the text was too small.

## Layer -6: the game logic · built (gameplay pass)
**Verb: line of sight.** No pixels: the maze as the rules see it, grid lines and faint wall outlines from VRAM,
Pac-Man and the ghosts as points at their RAM positions. Each hunting ghost shows its target vector, the line to the
tile it aims for, computed from RAM with the same rules (`ghostTarget`). **Area:** the rules' whole tile grid.
**Enemy:** like a Pokémon trainer, a ghost sees along its vector: crossing it (`vectorWidth`) gets you spotted
("!"), and a seeker comes out of that ghost and hunts you on the grid (`seekSpeed`, shortest path) for `seekTime`
s; touching it is a hit. Frightened ghosts have no vector and see nothing. **Objectives:** stand once on each of
the 4 ghosts' target tiles (they move with the mode and with Pac-Man; scatter corners are clamped into the grid).
The pellets are dots.

## Layer -7: the input wires · decided (Quirin, 2026-10-18: fix the joystick, then play)
**Environment:** the joystick's base (3x3 tiles) in the middle of the board with a microswitch on each side; big
wires run from the switches up to IN0's four pins under the machine's small live picture (`DEEP.input.wires`:
each switch, pin, route and where the cut wire lies). Beside the picture IN0 and IN1 as the CPU reads them, the score and
the game's phase; above each pin the bit it reads (1 open, 0 pulled low). Code `src/systems/layers/input.js`.
**Verb: carry and deliver (like the video board), then play.** All four wires are cut, their ends lying on the
board with a big letter plug. Walk onto a loose end to take it: the wire is laid where you walk (walking back along
it pulls it in). Bring it to its own pin: the wire snaps onto its route and that direction works. **Until a wire is
fixed its switch can't pull its bit low:** the machine's Pac-Man (the bot plays meanwhile) can't turn that way;
when he wants to, a red crossed-out arrow shows it in the picture, the switch and pin flash and the status line
says `PAC-MAN CAN'T GO LEFT: WIRE CUT`. A fixed wire lights white while its switch is closed.
**Enemy: noise sparks** that run along the wires from their switches (`sparkSpeed`, each wire one every
`sparkEvery` s; the switch blinks red `sparkWarn` s before; none on the wire you carry, `sparkDelay` s quiet at
the start and after a hit). A spark that touches you is a hit, and you drop the end you carry where you stand.
**Objectives (5):** the 4 wires, then the test game: with all four fixed the sparks stop and the stick blinks;
walk onto it to grab it. The round starts again on the same level with a full maze (score kept). The picture grows over the board (`pictureT` to `playT` px per maze tile in `playGrow` s),
the machine runs at `playSpeed`, and your swipes are the stick's direction: held on the machine through the
repaired switches into IN0. Eat `playDots` (20) dots, counted from your first swipe: LAYER CLEAR. The counter
shows `WIRES n/4`, then `DOTS n/20`.
**Bot and START (Claude's call):** the in-game bot plays while you repair, through the working switches only;
the board keeps the demo switch on in this layer the whole time (deaths never cost lives, so no game over here) and
presses START for you whenever the game waits for it (a halted machine is started again). A death while you play
is a hit (the dots eaten so far stay). Removed: the pads that steered Pac-Man, the push block, the START pad, the
corner objectives and the crawling spark. Playtest bot (quick runs): 100% up to noise 0.75 (23 s with no noise, about
100 s at 0.75), 20% at full noise.

## Hard mode · decided (Quirin, 2026-10-19; numbers Claude's)
While the lobby's 256 switch is on, every deep layer plays a hard variant; winning one in hard mode repairs its strip
of level 256 (see [arcade-maze.md](arcade-maze.md#levels-and-the-kill-screen--decided-built-2026-10-18)), all seven
make it winnable (the fourth lobby lamp).
- Data-driven: each layer's `hard` block in `DEEP.<id>` (src/config.js) is merged over its numbers while it plays
  (`src/systems/layers/hard.js`, set by DeepScene on every start, so turning the switch off restores them). A red
  HARD marker sits left of the title. LAYER CLEAR in hard mode also calls `markHardWon` and says
  `LEVEL 256 REPAIRED n/7`.
- Numbers (normal → hard): screen beam 13 → 10 s per picture, bonus scans 15 → 10 s; video board frame timer
  12 → 9 s and 5 colors instead of 4; work RAM write head waits 0.8 → 0.55 s, dashes 9 → 12 bits/s, rests
  0.25 → 0.15 s; bus cycles every 1.1 → 0.85 s, packets 7 → 9 tiles/s, reads wait 1.3 → 1 s, doors hold
  1.6 → 1.2 s; CPU 4.5 → 6 lines/s, grace 0.6 → 0.4 s; logic vectors 0.45 → 0.6 tiles wide, seekers 3.6 → 4.2
  tiles/s (you walk 5) and hunt 6 → 8 s; input sparks 3 → 4 tiles/s, every 2.5-4.5 s (was 3.5-6), warn 0.8 → 0.6 s,
  test game 20 → 30 dots.
- Not now: different objectives or layouts per layer in hard mode, a hard variant of the adder.
- `?hard=n` (testing): everything up to the 256 switch won, the switch on, the first n layers won in hard mode.

## Goals vs. what the part does · open (review 2026-10-18)
Quirin asked that a layer's goals connect to what its component achieves (the screen's adjustments now fix the
picture). How the other layers do on that, to decide later:
- **-2 video board:** connected. Carrying an index through the palette to the DAC is what the board does.
- **-3 work RAM:** connected (2026-10-18). Flipping bits of the game's variables changes the game (lives, score,
  Blinky moved or scared); the CPU's writes overwrite them, as in real RAM.
- **-4 bus:** half. Picking up a byte in a chip room is a read, but it never reaches the CPU. Idea: carry it back.
- **-5 CPU:** connected (2026-10-18). Each patch rewrites an instruction in the program and the game shows the
  effect (dots worth more, faster Pac-Man, slower ghosts, no deaths).
- **-6 game logic:** half. Standing on a ghost's target tile has no effect. Idea: standing there pulls that ghost
  in the maze (the target is what it chases).
- **-7 input wires:** connected. Each repaired wire gives the machine's Pac-Man a direction back; then you play
  the real game through the switches you fixed.
- **Dots** in -4 and -6 are only counted and say nothing about the part.

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
- 2026-10-18: Work RAM replaces video RAM (same blade trap over 0x4c00-0x4fef, objectives are game state bytes by
  symbol, own sky-blue colors, art in `assets/deep/ram/`). The deep layers are entered from the board lobby, unlock
  one at a time, have only LAYER UP and go back to the lobby when won. (Quirin, defaults accepted)
- 2026-10-18: Bus polish: doors stay open `doorHold` (1.6 s) after their chip's cycle and flicker for `doorWarn`
  (0.6 s) before closing; safer exits: packets can't hit inside a chip room (a read used to spawn on the tile you
  wait on by the door) and a waiting read pulses there. (Quirin asked for longer doors and safer exits; Claude
  picked how)
- 2026-10-18: Work RAM reworked: poke the game state. Eight variables as big boxes with 8 bit lamps each and a live
  picture of the game; stepping on a lamp flips the bit in the real RAM, the write head dashes along a variable
  when the program writes it; objectives are 5 lives, score 10000+, move Blinky, scare Blinky. (Quirin, defaults accepted)
- 2026-10-18: Input wires reworked: fix the joystick, then play. The 4 wires from the joystick's switches to IN0
  are cut; carry each loose end to its pin (a cut direction doesn't reach the machine, the bot's Pac-Man can't turn
  that way); noise sparks run along the wires; with all four fixed, grab the stick and swipe-play the real game
  until you eat 20 dots. Pads-as-steering, push block, START pad and corners removed; demo switch on and START
  pressed for you in this layer. (Quirin, defaults accepted)
- 2026-10-18: CPU reworked: Game Genie patches. One routine per screen in 12 big lines, the PC a glowing cursor
  replaying a real trace with jump arrows, registers as big boxes; carry 4 patch tokens onto their lines, each
  really written into the ROM (dots 10x, Pac-Man 2x fast, ghosts half speed, Pac-Man eats any ghost); patches stay
  for the session, entering the layer reverts them; warp pads and flag blocks removed. (Quirin, defaults accepted)
- 2026-10-18: CPU harder: the program counter steps 4.5 lines/s (was 3.2), stays away 0.5 s (was 0.7), grace 0.6 s (was 1).
  Playtest quick runs: 100% at noise 0, 60-80% at 0.5-1 with many more hits. (Quirin asked; Claude picked the numbers)
- 2026-10-19: Input: grabbing the stick restarts the round with a full maze; with the CPU's patches the bot had eaten
  nearly all dots by then, so the test game was a near-empty maze at double speed. Patches stay on. (Quirin asked; Claude's fix)
- 2026-10-19: Hard mode: with the 256 switch on every deep layer plays a `hard` block of tighter numbers (faster
  hazards, shorter windows, one more color on the video board, a longer test game on the input layer); its win
  repairs a strip of level 256. (Quirin; numbers Claude's)
