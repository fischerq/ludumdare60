# The service manual

**Status:** decided, being built 2026-10-18
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
  toggle that holds the picture without pausing the machine.
- `?manual` opens it straight away (with `?scene=...` for the machine state of any layer).

## Slice scope
- Build: step 1 the overlay and the booklet (done); step 2 the static pages (done); step 3 the live page.
- Not now: stepping the machine instruction by instruction from the live page, editing memory.

## Decision log
- 2026-10-18: The Pac-Man booklet on the hall's table opens a fullscreen service manual: old paper, a page per
  layer explaining its technical system with static figures, and a live Marauder's-Map page of the machine state
  at the end. Defaults accepted (HTML overlay, page list, live page contents, read-only). (Quirin)
