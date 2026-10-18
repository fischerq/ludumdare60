# The service manual

**Status:** decided, built 2026-10-18
**Parent:** [layer-arcade](layer-arcade.md) · [master](../master.md)
**Lab bench:** none (the live page is its own debugging view: `?manual`)
**Code:** `src/manual/` (`index.js` the overlay, `pages.js` the pages and figures, `live.js` the live page),
numbers and colors in `MANUAL` in `src/config.js`.

## Purpose
The Pac-Man booklet on the hall's table opens the full service manual of our machine: one page per layer,
explaining the real technical system behind each layer at the level we emulate it. The last page is a magic,
Marauder's-Map-style live view of the machine's state, detailed enough to debug the emulator.

## Rules · decided
- **An HTML overlay** over the game (not drawn in Phaser), so long text and diagrams stay sharp on a phone. Old
  yellowed paper with stains and smudges, a worn typewriter face (Special Elite) for headings, Courier Prime for
  the text, both from pinned jsdelivr URLs in `index.html`.
- **Pages:** cover, contents, then one page per machine layer top to bottom: cabinet, maze game, inside the CRT,
  video board, video RAM, system bus, CPU (Z80), game logic, input wires; the live page last. The hall gets no
  page (it isn't part of the machine). Every page explains all concepts the layer uses, with one or two static
  figures drawn as inline SVG.
- **Reading:** swipe sideways or the big arrow buttons to turn pages, vertical scroll within a page, a big X to
  close. Arrows and Esc on a laptop. The hall is paused underneath; the machine keeps running.
- **The live page:** the machine's real state, about 10 updates a second (`MANUAL.liveHz`): Z80 registers and
  flags, the code around the PC, a memory map lighting up on reads and writes, tile and sprite VRAM drawn out,
  the latest bus accesses, input port bits, and the game logic state from RAM. Read-only, with a freeze-view
  toggle that holds the picture without pausing the machine. As built: a map of the maze from VRAM with
  every actor at its RAM position, a few short footprints and each ghost's target as the program last wrote it
  (TGT_X/TGT_Y, caught with a bus hook in `ghost_target`), the game variables (one row each: symbol, address, raw
  hex, decoded value), the actors (one cell per field), the registers (main and shadow set, PC/SP/IX/IY/I/R, each
  flag, IM/IFF) from a sample taken at a random cycle inside the frame's work (`machine.sampleAt`; between frames the
  CPU always sits on the same HALT) with the routine and the source lines around PC, a once-a-second profile of one frame's instructions by routine
  (`requestTrace`), a 16x16 heat map of the address space in 256-byte pages for the last frame, the latest bus
  cycles, the 8 sprite slots, IN0/IN1/DSW bit by bit and the latest sound commands, all as tables with one cell per
  value. Plain wording, few ink metaphors.
- **Paper wear:** different on every page, seeded by the page number (`MANUAL.wear`): sometimes a coffee ring, a
  smudge or two, foxing specks; the live page only has yellowed edges.
- `?manual` opens it straight away (with `?scene=...` for the machine state of any layer).

## Slice scope
- Build: step 1 the overlay and the booklet (done); step 2 the static pages (done); step 3 the live page (done).
- Not now: stepping the machine instruction by instruction from the live page, editing memory.

## Decision log
- 2026-10-18: The Pac-Man booklet on the hall's table opens a fullscreen service manual: old paper, a page per
  layer explaining its technical system with static figures, and a live Marauder's-Map page of the machine state
  at the end. Defaults accepted (HTML overlay, page list, live page contents, read-only). (Quirin)
- 2026-10-18: Live page tidied for debugging: fewer ink references and footprints, one table cell per value, the Z80
  sampled mid-frame (it looked static because it was read on the HALT between frames), ghost targets read from
  the emulated program instead of recomputed in JS. Paper wear varies per page instead of the same coffee ring on
  every page. (Quirin)
