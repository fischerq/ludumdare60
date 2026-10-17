# The deep layers (below the maze)

**Status:** first slices built 2026-10-17, mechanics and feel to be tuned
**Parent:** [layers](layers.md) · [emulator](emulator.md) · [master](../master.md)
**Lab bench:** none yet
**Code:** scene `src/scenes/DeepScene.js` (one scene for all of them, `?scene=Deep`), rules per layer in
`src/systems/layers/<id>.js` (no Phaser), the walking player in `src/systems/layers/walker.js`, numbers in
`DEEP` in `src/config.js`.

## Purpose
Going down from the maze game, each layer is a view of the one emulated machine that runs it (see
[emulator](emulator.md)), from the picture tube down to the input wires. Gameplay in a layer may stylize,
slow down or aggregate, but everything comes from the machine's real raw data.

## Shared rules · decided (Claude, defaults accepted by Quirin)
- Same controls as the maze: swipe to walk a grid one tile at a time (`DEEP.walkSpeed`).
- Each layer has a goal (eat N things). Reaching it opens LAYER DOWN; LAYER UP always works. With
  `CHEATS.enabled` every layer is open.
- A hit flashes the player and puts it back at the start (`DEEP.hitPause`); hits are only counted.
- While the player is down here, the bot plays the maze game on the machine, so the data keeps moving.
- Moving between layers zooms and fades (`DEEP.transition`).

## Layer -1: inside the screen (CRT) · built
The maze picture magnified to its phosphor: walls and dots from VRAM, ghosts from the sprite registers. A
beam sweeps the picture row by row, slowed from 16.5 ms to `DEEP.crt.beamPeriod`. Rows glow after it passes
and fade (`decay`); a dot can be eaten only while it glows (`litAbove`). The beam only fires where the
picture is lit, so standing on an uneaten dot when it arrives is a hit; black floor is safe, and so is the
vertical blank (`vblank`), when the beam flies back switched off. Ghost sprites are always a hit. Dots the
machine's Pac-Man eats vanish here too. Goal: 25 dots.

## Layer -2: the signal chips · built
The playfield as the video chip sees it: each tile's code from VRAM in hex, the 8 hardware sprites as boxes
labelled with slot and sprite code. The tile fetcher reads one row every `DEEP.signals.rowTime`; each dot or
pellet tile it fetches sends out a color index that waits `sparkLife` to be picked up. Ghost sprites crush.
Every sound command the program writes to the sound latch (power, ghost, death, ...) swells a wave along the
bottom of the screen, `waveRows` high for that sound: stay above it. Goal: 30 color indices.

## Layer -3: video RAM · built
VRAM as it sits in memory, 32 bytes per row in hex. Bytes holding the wall code are walls, the 13 unused
bytes at the end of each row are open floor. The CPU's write head replays the program's real VRAM writes from
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

## Decision log
- 2026-10-17: One scene for all deep layers with a pure module per layer; first slices of all seven layers
  from the Gemini chat's mapping, adapted so each is playable on a phone. (Claude)
- 2026-10-17: CRT: the beam is only deadly where the picture is lit, otherwise no spot would be safe. (Claude)
- 2026-10-17: Signals: sound waves stay at the bottom and swell (a wave rolling over the whole screen could
  not be dodged). (Claude)
