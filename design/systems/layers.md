# Tech layers (minigames)

**Status:** open
**Parent:** [master](../master.md)
**Lab bench:** none yet
**Code:** none yet

## Purpose
Theme: Old Tech. Behind the [arcade maze game](arcade-maze.md), short minigames go down through the layers of
the arcade machine, using the maze characters or mechanics to show how the old tech worked.

## Next layers · proposed
- **Zoom out further: the arcade hall.** Top-down, Pokémon-like: Pac-Man walks around the arcade shop the
  cabinet stands in. See [layer-arcade](layer-arcade.md).

The two layers next to the maze game come first:
- **Zoom out: the cabinet.** A pixel-art arcade machine with simulated depth, the same game on its screen, played
  through a 4-way joystick (built). See [layer-cabinet](layer-cabinet.md).
- **Zoom in: the screen.** Inside the CRT: the game above plays itself and lights up the pixels; we eat dots
  only while they glow and dodge the refresh beam. See [layer-crt](layer-crt.md).

## Outer game loop · decided
The game starts at the maze layer, so it's instantly recognisable as Pac-Man. Other layers unlock through what
happens there (`src/progress.js`, in memory for the session):
- **First win on the maze:** callout "MAZE CLEAR! WANT TO GO DEEPER?", and the maze gets **LAYER DOWN** (into the
  screen; says "coming soon" until that layer exists).
- **First loss on the maze:** callout "GAME OVER, INSERT COIN", and the maze gets **LAYER UP** (to the cabinet).
- **First loss on the cabinet:** callout "NEED COINS?" on its screen, and the cabinet gets **LAYER UP** (to the
  arcade hall, where the coins are). The same happens whenever the cabinet waits for a coin and the player has none,
  so you can never be stuck at the cabinet without a way to the coins. The cabinet always has LAYER DOWN, the hall always has LAYER DOWN.
- A round on the maze ends on the maze (no more automatic jump to the cabinet): the callout says tap to play again.
- **Cheats for testing:** CHEAT WIN / CHEAT LOSE buttons at the bottom of the maze and the cabinet fire those events
  (`CHEATS.enabled` in config; turn off for the release). Layer buttons: `src/layerButton.js`, callouts:
  `src/callout.js`.

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
- 2026-10-17: The first two layers to work out are the neighbours of the maze game: zoom out to the cabinet,
  zoom in to the screen. (Quirin)
- 2026-10-17: Button to move a layer up or down; all layers unlocked by default for now. (Quirin)
- 2026-10-17: Another layer above the cabinet: the arcade hall, Pokémon-like top-down. (Quirin)
- 2026-10-17: Outer game loop: start on the maze; first win unlocks LAYER DOWN ("want to go deeper?"), first loss
  LAYER UP ("insert coin"), first loss on the cabinet unlocks the hall ("need coins?"). Cheat buttons instead of
  unlocking everything. (Quirin)
- 2026-10-17: Fix: being out of coins at the cabinet always opens the hall ("NEED COINS? GO LAYER UP"), not only
  the first game over. (Quirin reported the hall not unlocking with 0 coins)
