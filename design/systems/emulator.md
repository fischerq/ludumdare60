# Emulated arcade machine (the source of truth for the lower layers)

**Status:** goal decided, plan proposed (step 1 built 2026-10-17)
**Parent:** [layers](layers.md) · [master](../master.md)
**Lab bench:** none yet
**Code:** `src/systems/arcade/` (no Phaser): `memmap.js` (our board's memory map), `machine.js` (memory, I/O,
vblank IRQ, bus log, dirty bits, sound latch, `snapshot()`), `world.js` (the one running machine), `video.js` (video chip),
`asm.js` (Z80 assembler), `program.js` (assembles `game.asm` with constants from config), `z80.js` (loads the
CPU core).
Numbers in `ARCADE` in `src/config.js`. Tests: `node tools/arcade_test.mjs`.

## Purpose
The deeper layers (screen, video hardware, VRAM, bus, CPU, game logic, input) aren't scripted: they all read the
state of one emulated machine running a real Z80 program on Pac-Man-style hardware. Every layer is a different
view of the same running machine, so what happens in one layer is visible in all the others.

## Architecture · proposed
- **CPU core:** Molly Howell's MIT-licensed `Z80.js` (instruction-level, not cycle-exact), loaded from jsdelivr
  pinned to a commit (`ARCADE.z80Url`). It's a classic script, so `z80.js` fetches and wraps it. No build step.
- **Board:** `createMachine(Z80, { rom })` maps ROM `0x0000-0x3FFF`, VRAM `0x4000`, color RAM `0x4400`, work RAM
  `0x4C00-0x4FEF`, sprite attributes `0x4FF0`, I/O at `0x5000-0x50FF` (IN0/IN1 active low, IRQ enable, WSG sound
  `0x5040-0x505F`, sprite positions `0x5060`). `runFrame()` runs 3.072 MHz / 60.606 Hz ≈ 50 688 cycles, then
  raises the vblank interrupt.
- **Hooks for layers:** every bus access goes into a ring buffer (`recentBus()`) and to `hooks`; VRAM/CRAM writes
  set `dirty` bits; `runFrame(onStep)` can watch every instruction; `snapshot()` returns CPU registers, VRAM,
  CRAM, RAM, sprites, sound voices and inputs in one object. `setInput()` presses joystick bits.
- **The program:** the Namco ROM is copyrighted, so we can't ship it. The machine runs whatever ROM it's given.

## How each layer could read the machine · proposed (from Quirin's layer notes)
| Layer | Reads |
|---|---|
| 1 CRT | rendered frame from VRAM/CRAM + sprites, scanline position from the cycle counter within the frame |
| 2 Video/audio signals | tile grid (`vram`), 8 sprites (`snapshot().sprites`), WSG voices (`sound`) |
| 3 VRAM | `vram`/`cram` bytes, `dirty`, CPU writes from the bus log (the "write head") |
| 4 Bus | `recentBus()`: address, data, read/write, memory vs I/O, region |
| 5 CPU | `cpu.getState()` per instruction via `runFrame(onStep)`: registers, flags, PC, SP, interrupt entry |
| 6 Game logic | work RAM variables (positions, targets, timers) at addresses our program defines |
| 7 Input | `in0`/`in1` bits, and bus reads of `0x5000`/`0x5040` (the polling moment) |

## Corrections to the layer notes (hardware facts)
- The vblank interrupt is the maskable INT in IM 2 (vector byte written with `OUT (0),A`), not the NMI. It
  vectors through a table, not to `0x0066`.
- IN0 bits: 0 up, 1 left, 2 right, 3 down, 4 rack test, 5 coin 1, 6 coin 2, 7 credit. Left is bit 1, not 5.
  IN1 (`0x5040`) has joystick 2, service, start 1/2, cabinet type.
- `0x4800-0x4BFF` isn't mapped on the Pac-Man board, so no ghost lives at `0x4920`; ghost state is in work RAM
  (`0x4C00-0x4FEF`). With our own program we choose the addresses.
- Pinky's "4 ahead, and 4 left when facing up" bug is real in the original; it only exists in our program if we
  write it in.

## Goal · decided
The maze layer's core loop (input polling, movement, dot eating, ghosts, modes, deaths) and its rendering run
**on the emulated machine** as a Z80 program. The maze level the player sees is the machine's video output.
Every other layer is a view of that same running machine, so all layers stay in sync with one global state.
The player can switch layers smoothly mid-game. While the player is in another layer, a bot steers Pac-Man on
the machine.

## Layer gameplay rule · decided
A layer's gameplay may stylize, retime (slow down, stretch, loop a window), filter or aggregate what happens in
other layers. Everything it shows must come from the real raw data of the machine running the main game:
memory, registers, bus accesses, inputs. Nothing is invented or scripted on top. Example: the bus layer can show
one frame's traffic slowed down, or a per-region heat map, but only of accesses that actually happened.

## Build plan · proposed
Each step is a playable push. The game never breaks: the JS maze game (`src/systems/maze.js`) stays the
reference until the Z80 version matches it.
1. **Done: prep.** Memory map, machine, pinned CPU core, smoke test.
2. **Done: global machine runtime.** `src/systems/arcade/world.js` owns the one machine and steps it at a fixed
   60.606 Hz, independent of which scene is showing (ticked from the Phaser game loop, paused while the tab is
   hidden). The bus log moves to typed arrays: a frame has about 25 000 bus accesses, and one object per access
   is too much garbage on a phone. A frame recorder keeps the raw data of the last few frames (bus
   accesses, register snapshots, input), so slowed-down layers replay real frames instead of inventing them.
3. **Done: video chip** (`video.js`). A JS renderer (pure module) that draws a frame from VRAM, color RAM, the 8 sprites and a
   palette into a canvas. Its "graphics ROM" is built at load time from the textures in `assets/`, so Max's art
   pipeline stays unchanged.
4. **Done: assembler and the first program** (`asm.js`, `program.js`, `game.asm`). A small Z80 assembler in plain JS (`src/systems/arcade/asm.js`) that
   runs in the browser too, so the CPU layer can show the real source listing with addresses. Constants come
   from `src/config.js`, so tuning stays a one-line edit. First program: boot, vblank interrupt, draw the maze
   from a ROM table into VRAM.
5. **Done: shadow mode** (`shadow.js`). The maze layer renders from the machine. The JS game still decides what happens and
   writes positions, dots and score into machine RAM and sprite registers each frame. From here every lower
   layer can be built against real memory contents.
6. **Port the rules to Z80, slice by slice.** Each slice replaces a JS piece and must pass a side-by-side test
   against `maze.js` on the same scripted input (a lab bench: machine vs. JS):
   a. input polling, Pac-Man movement, dot eating, score;
   b. ghost movement, targeting, scatter/chase modes;
   c. fright, ghost eating, deaths, lives, level clear, READY.
   After slice c, the maze layer runs on the machine alone.
7. **Bot.** An autopilot in JS that reads machine RAM and presses the joystick through `setInput()`, the same
   input path as the player. It plays whenever the player isn't steering Pac-Man.
8. **Layer framework and smooth switching.** Each layer is a view on `world`. The machine never pauses for a
   transition, and each layer says who controls Pac-Man (player or bot). The cabinet's screen shows the
   machine's frame.
9. **Deep layers, one slice each, questions first:** CRT ([layer-crt](layer-crt.md)), then the others from the
   table above.

Token cost: steps 4 and 6 are the expensive ones; each slice of step 6 is its own push.

## Slice scope
- Build: all nine steps, one pull request per step (Quirin, 2026-10-17). Step 9 builds a first slice of each
  deep layer; their mechanics and feel get tuned afterwards.
- Not now: WSG sound emulation, cycle-exact timing, the original Namco ROM.

## Answered questions
All eight defaults accepted by Quirin on 2026-10-17.
1. **Board size:** an "in the style of" board sized to our 19x25 maze (16 px tiles, 32 px sprites, Max's art
   as graphics ROM), or the exact Namco layout (28x36 tiles of 8 px, 16 px sprites, which means redoing the maze
   and the art)? Our maze is 304 px wide, more than the original's 224, so it doesn't fit as is.
   *Default: our own board in the Namco style. Same address-space idea and I/O, sized to our game; `memmap.js`
   gets adjusted.*
2. **How faithful the port is:** same rules and numbers as `maze.js`, stepped per frame in fixed point
   (positions in 1/256 tile). *Default: yes. Small feel differences from frame stepping are OK.*
3. **Assembler:** our own in-browser JS assembler (the source listing becomes level material), or assembled
   bytes committed? *Default: our own; the browser assembles at load and a test checks the output.*
4. **When the maze layer switches to the machine:** at step 5 (shadow mode: same logic, machine rendering) or
   only after step 6? *Default: step 5.*
5. **Lives while away:** if the bot dies while the player is in another layer, what happens? *Default: the
   bot plays an endless attract-style game that doesn't cost the player's lives. Back in the maze layer, the
   player continues the machine's game as it is.*
6. **Bot skill:** *Default: simple and readable: head for the nearest dot, avoid ghosts closer than a few
   tiles, chase frightened ghosts.*
7. **Who controls Pac-Man in a deep layer:** *Default: the bot. In the input layer (7) the player's own
   movement presses the joystick bits instead.*
8. **Sound:** play the WSG registers, or keep `src/sound.js` triggered by machine events? *Default: keep
   `sound.js`.*

## Decision log
- 2026-10-17: Lower layers read the state of one emulated Z80 machine instead of scripted behavior; seven
  layers sketched (CRT, signals, VRAM, bus, CPU, game logic, input). (Quirin)
- 2026-10-17: Prep built: memory map, machine, pinned MIT Z80.js core from jsdelivr, smoke test. Program and
  layers still open. (Claude)
- 2026-10-17: Goal: the maze game's core loop and rendering run on the machine; all layers are views of one
  global machine state, switched smoothly mid-game; a bot steers Pac-Man while the player is elsewhere. Layer
  ideas come from a Gemini chat (see the making-of). (Quirin) Build plan in 9 steps proposed. (Claude)
- 2026-10-17: Layers may stylize, retime or aggregate events, but always from the real raw data driving the
  main game. (Quirin)
- 2026-10-17: All eight suggested answers accepted; build the whole plan, one PR per step; each layer's mechanics
  and feel get tuned later. (Quirin)
- 2026-10-17: Our board: Namco-style map, VRAM is 32 bytes per row with one cell code per maze tile, sprite
  positions are 16-bit world px, sound is a command latch at `0x5040`, a dip switch marks demo play. The
  machine runs whatever scene is showing; a HALTed CPU skips to the end of the frame. (Claude)
