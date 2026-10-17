# Tech layers (minigames)

**Status:** open
**Parent:** [master](../master.md)
**Lab bench:** none yet
**Code:** none yet

## Purpose
Theme: Old Tech. Behind the [arcade maze game](arcade-maze.md), short minigames go down through the layers of
the arcade machine, using the maze characters or mechanics to show how the old tech worked.

## Layer ideas · open (brainstorm, nothing decided)
Rough order from outside to inside; we pick a few, not all.
- **Cabinet:** coins, the CRT, joystick wiring.
- **Video hardware:** tiles and sprites, palettes, sprite limits, raster beam / vblank timing. The maze level
  currently only imitates the look (`PIXEL` in config); emulating the real tile/sprite rendering could be this layer.
- **Game logic:** ghost targeting rules, the famous bugs (level 256 kill screen, ghosts passing through
  each other).
- **Code:** the program itself in its original style (Z80 assembly for the original Pac-Man), visible and
  maybe editable in a level.
- **CPU / memory:** registers, RAM, ROM chips, a byte-level view.
- **Electronics:** logic gates, clock signal.

## Emulation sidecar · decided to plan for it (design open)
The Z80 assembly layer will probably be one we want, so we plan for an emulator.
Idea: simulate the old tech for real, running code in the original language (e.g. Z80 assembly) in a wasm
sidecar, and use that code's visibility for a level.
Things to settle before building:
- The no-build rule: a `.wasm` file would have to be committed prebuilt or loaded from a pinned CDN; or the CPU
  core is written in plain JS instead (a small Z80 subset is a few hundred lines).
- The original Pac-Man ROM is copyrighted, so the program we show and run would be our own, written in the
  original style.
- Token cost: an emulator is the most expensive idea on the list; ask before starting it.

## Mini-gurke easter egg · proposed
The game's working title becomes a hidden collectible: a small pickle hidden in some or all minigames.
Open: in every minigame or only a few, and whether finding them all unlocks anything. *Default: one per
minigame, a counter on the layer map, no unlock.*

## Slice scope
- Build: nothing yet; the [arcade maze game](arcade-maze.md) comes first.
- Not now: everything on this page.

## Decision log
- 2026-10-17: Minigames explore the layers of tech behind the arcade machine; possible wasm sidecar that runs
  the original language; mini-gurke is an easter egg collectible. All ideas to iterate on. (Quirin)
- 2026-10-17: The Z80 assembly layer is likely, so plan for the emulator; how (wasm vs. plain JS) is still
  open. (Quirin)
