# Emulated arcade machine (the source of truth for the lower layers)

**Status:** proposed (prep built 2026-10-17, no layer uses it yet)
**Parent:** [layers](layers.md) · [master](../master.md)
**Lab bench:** none yet
**Code:** `src/systems/arcade/` (no Phaser): `memmap.js` (Pac-Man board memory map, VRAM tile layout),
`machine.js` (memory, I/O, vblank IRQ, bus log, dirty bits, `snapshot()`), `z80.js` (loads the CPU core).
Numbers in `ARCADE` in `src/config.js`. Smoke test: `node tools/arcade_smoke.mjs`.

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

## Slice scope
- Build (done): memory map, machine with bus log / dirty bits / snapshot, pinned CPU core, smoke test.
- Not now: our Z80 program, a renderer, any layer using the machine, sound, a lab bench.

## Open questions
1. What runs on the machine? (a) our own small maze game in Z80 assembly, (b) a JS "shadow" that writes the
   existing JS maze game's state into the memory map (layers 3/6/7 work, the CPU layer shows fake code), or
   (c) the player loads their own Pac-Man ROM file (never shipped). *Default: (a), kept small, written so its RAM
   layout mirrors the original's.*
2. If (a): assemble how? A tiny Z80 assembler in JS under `tools/` that outputs a committed `.bin`, or
   hand-written bytes, or a pinned CDN assembler. *Default: a small JS assembler in `tools/`, output committed.*
3. Does the emulated machine drive the visible maze game (the top layers show the emulator's output), or does it
   run alongside it? *Default: alongside for now; switching later is a big change.*
4. Which layers do we actually build, and in what order? *Default: 1 CRT (already designed), 5 CPU, 7 input.*
5. Real time or slowed down in the deep layers? A frame is ~16 000 instructions. *Default: real time in layers
   1-3, the CPU/bus layers run at a slowed speed or show a short window per frame.*
6. Does input in a lower layer feed back into the machine (e.g. grounding an input track presses the joystick)?
   *Default: yes for layer 7, read-only elsewhere.*
7. Is a non-cycle-exact core fine (scanline timing is estimated from instruction cycles)? *Default: yes.*
8. Sound from the WSG registers, or keep `src/sound.js`? *Default: keep `sound.js`, show WSG only visually.*

## Decision log
- 2026-10-17: Lower layers read the state of one emulated Z80 machine instead of scripted behavior; seven
  layers sketched (CRT, signals, VRAM, bus, CPU, game logic, input). (Quirin)
- 2026-10-17: Prep built: memory map, machine, pinned MIT Z80.js core from jsdelivr, smoke test. Program and
  layers still open. (Claude)
