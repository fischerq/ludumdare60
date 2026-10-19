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
- **Zoom out: the cabinet.** A pixel-art arcade machine with simulated depth; you see the machine and put a coin
  in, which zooms back into a fresh maze game (built). See [layer-cabinet](layer-cabinet.md).
- **Zoom in: the screen.** Inside the CRT: the game above plays itself and lights up the pixels; we eat dots
  only while they glow and dodge the refresh beam. See [layer-crt](layer-crt.md).

## Outer game loop · decided
The game starts at the maze layer, so it's instantly recognisable as Pac-Man. Every layer always has its
LAYER UP and LAYER DOWN buttons (no unlocking, no cheat buttons), the same size and in the same spot everywhere:
bottom corners, UP left, DOWN right; the sound button sits top-right. Since 2026-10-18 the deep layers below the maze are entered from the
[board lobby](#inside-the-cabinet-board-lobby-and-subsystems--decided-built-quirin-defaults-accepted-2026-10-18), unlock one at a time and only have LAYER UP. Layer buttons: `src/layerButton.js`, callouts:
`src/callout.js`.
- **Coins run the machine** (`src/wallet.js`, `COINS` in config). Every fresh game costs a coin, on the maze or
  through the cabinet's coin door; the first game from the menu uses the coin you start with.
- **Game over halts the machine**: it runs no frames (no attract mode, no bot) until a coin goes in, in every layer
  (`world.halted` in `src/systems/arcade/world.js`). On the maze the callout says "TAP TO INSERT COIN" while you
  have coins, otherwise "OUT OF COINS, GO LAYER UP" (cabinet, then the hall where the coins are).
- **Maze clear:** callout "MAZE CLEAR! WANT TO GO DEEPER?"; tap plays on for free.
- **The cabinet** says "NEED COINS? GO LAYER UP" whenever it waits for a coin and the player has none.
- **Deep layers run the machine slower** than the maze, by `DEEP.machineSlowdown` (4x): down there we play with
  the signals that make each frame. Cabinet and hall run at normal speed.

## Inside the cabinet: board lobby and subsystems · decided, built (Quirin, defaults accepted 2026-10-18)
LAYER DOWN from the maze goes to a **lobby inside the arcade machine** (`src/scenes/LobbyScene.js`, `?scene=Lobby`,
numbers and texts in `LOBBY` in config), built like the [hall](layer-arcade.md) with the same engine
(`src/systems/hall.js`: drag to walk the grid, tap to talk to what Pac-Man faces, the RPG text box with
portraits, one screen at 4x). Wire auto-joining and lookups in `src/systems/lobby.js` (no Phaser).
- **The floor is the PCB**, laid out like the real Pac-Man upright: the board stack sits low in the cabinet, the
  wiring harness runs up the floor from the edge connector to the monitor at the top front (far from the board),
  with branches to the joystick (control panel), the coin door, the speaker and the power supply. On the board,
  copper traces join the chips. Speaker, coin door, power supply and edge connector have one line each.
- **Subsystems are things to talk to**, one per deep layer, each a part with a face and a 48x48 portrait: the
  monitor (screen), video board, work RAM, bus, CPU, the logic brain and the joystick (input wires). Talking gives
  one line about what it does; an unlocked one then offers ENTER / NOT NOW, and ENTER zooms into it and starts
  its deep layer.
- **The logic is a small pixel brain** with the four ghosts (their own colors, the maze ghost sprites) on wires
  in their colors to it; each ghost says its targeting rule.
- **Locks** (`src/progress.js`, session only, no localStorage): order outside in = `DEEP_LAYERS` order, screen →
  video board → work RAM → bus → CPU → logic → input wires. All locked except the first; a layer's LAYER CLEAR
  unlocks the next. A locked subsystem sleeps (separate art state `-off`, eyes shut) and says it's asleep and
  which one to wake first. API: `isWon(id)`, `isUnlocked(id)`, `allWon()`, `markWon(id)` (returns the id it
  unlocked), `ORDER`; `?won=n` marks the first n won for testing.
- **Mecha-Pac, the bot** (`X`, next to the joystick): a steel Pac-Man with a red visor who plays the machine's game
  while you're away from the maze. Talking to him: he's busy playing (every life he loses is yours), or after a
  game over that he lost your last life. His antenna blinks while he plays. (Quirin, 2026-10-19)
- **Navigation:** Maze LAYER DOWN → lobby (zooming out of the monitor). Lobby: only LAYER UP → maze (the
  machine's game continues). Deep layers: only LAYER UP, back to the lobby in front of their subsystem (no
  deep → deep). Winning a layer: the LAYER CLEAR callout (naming the subsystem that woke up), then back to the
  lobby after `LOBBY.clearDelay`, where the newly unlocked subsystem blinks lit (`-lit` art) and says it woke up.
- **The bonus layer (built, wired 2026-10-18):** the adder (`A`) and its 256 switch (`Z`) stand at
  `LOBBY.reserved` (8, 16) and (9, 16), plain floor until every subsystem is won. Once every subsystem is won (`allWon()`), a **bonus layer** appears: the physical
  8-bit add of the round counter, played like Crossy Road. Winning it overflows the counter
  ([map 256 glitch](https://pacman.fandom.com/wiki/Map_256_Glitch)), flips the switch next to it in the lobby and
  makes the switch usable; while it's on, the maze shows level 256. The adder glows while unplayed; talking to it
  offers ENTER into the [Adder scene](layer-adder.md), which returns to the lobby. Winning flips the switch on
  (`markAdderWon` in `src/progress.js`) and calls `setLevel256(true)` (`src/systems/arcade/world.js`): the machine's
  round restarts on level 256 and the garbage is the program's own 8-bit overflow (see [arcade-maze](arcade-maze.md)).
  Before that the switch is stuck; after, tapping it offers FLIP ON / FLIP OFF (level 256 / level 1). While it's
  on, every fresh game also starts on level 256.
- **The cheat lever** (`H`, at the right edge of the board, above the 256 switch; walkable, since it's the only way to reach the switch): a service lever with a TEST ONLY tag. Pulling it (PULL IT /
  NOT NOW) wakes every subsystem at once, as if each was won, so the adder and the 256 switch appear: the final level
  without the wins. One-way for the session (a reload resets it). *(Quirin, defaults accepted 2026-10-19)*
- **Video RAM is replaced by work RAM** (see [layer-deep](layer-deep.md)): there were already many video layers.
- Not in this slice: saving progress, lobby sound effects beyond its own bed, animated subsystems beyond the blink.

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
Plain JS core chosen for the prep; details and open questions in [emulator](emulator.md).
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
- 2026-10-17: The emulator is a plain JS Z80 core from a pinned CDN URL; see [emulator](emulator.md). (Claude)
- 2026-10-17: Outer game loop: start on the maze; first win unlocks LAYER DOWN ("want to go deeper?"), first loss
  LAYER UP ("insert coin"), first loss on the cabinet unlocks the hall ("need coins?"). Cheat buttons instead of
  unlocking everything. (Quirin)
- 2026-10-17: Fix: being out of coins at the cabinet always opens the hall ("NEED COINS? GO LAYER UP"), not only
  the first game over. (Quirin reported the hall not unlocking with 0 coins)
- 2026-10-17: Layer up/down always available everywhere; cheat buttons and unlocking removed. A game over halts
  the machine until a coin goes in, and every new game costs a coin. The deep layers run the machine
  `DEEP.machineSlowdown` (4x) slower than the maze. (Quirin; slowdown factor and coin rules: Claude's defaults)
- 2026-10-17: The cabinet no longer plays: nobody at the controls means the machine stands still there, and a coin zooms into the maze layer. (Quirin)
- 2026-10-17: Cabinet follow-up: the bot plays on a running game there, and the coin door only takes a coin while the machine asks for one. (Quirin)
- 2026-10-18: The maze game gets levels and Pac-Man's level 256 kill screen from a real 8-bit overflow on the machine,
  so every deep layer shows the same garbage; see [arcade-maze](arcade-maze.md). (Quirin)
- 2026-10-18: Outer loop idea: a board lobby inside the cabinet with locked subsystems that unlock one at a time, video
  RAM swapped for another memory, the logic as a brain with the ghosts, and a Crossy Road bonus layer for the round
  counter's 8-bit add that triggers the level 256 glitch. Questions open. (Quirin)
- 2026-10-18: Board lobby built: LAYER DOWN from the maze goes inside the cabinet, a hall-style room on the PCB with
  the harness to the monitor and the cabinet's parts; every deep layer is a subsystem with a face, locked outside in
  (session only) and unlocked by winning the one before; deep layers only go LAYER UP back to the lobby; work RAM
  replaces video RAM; the logic is a brain with the ghosts on wires. (Quirin, defaults accepted)
- 2026-10-18: Bonus layer built as its own scene: the round counter's +1 as a ripple-carry adder, Crossy Road style;
  it reports the win to whoever started it. See [layer-adder](layer-adder.md). (Quirin, defaults accepted)
- 2026-10-18: The adder bonus layer is wired into the lobby: it appears with its 256 switch once every subsystem is won;
  winning it flips the switch on and puts the machine on level 256 (the real overflow); after that the switch toggles
  level 256 / level 1, and fresh games follow it. (Quirin, defaults accepted)
- 2026-10-18: Layer buttons standardized like the deep layers: bottom corners (UP left, DOWN right), deep-layer size on
  every layer; sound button moved to the top-right, maze HIGH SCORE to top center. (Quirin)
- 2026-10-18: The lobby uses the standard layer button (LAYER UP bottom left); the room moved to the top of the view with
  the title in the strip under it. The adder's LAYER UP moved to the same corner. (Claude, after the button standardization)
- 2026-10-18: Lobby art calmer: muted, plain PCB floor; all lines (traces, harness, ghost wires) in one copper; each
  subsystem (and the adder/switch) sits on its own island in its layer's colors (grey while locked), portraits use the
  layer's background. (Quirin)
- 2026-10-19: Mecha-Pac (the bot) stands by the joystick in the board lobby; he says he's busy playing. (Quirin)
- 2026-10-19: A cheat lever in the board lobby, next to the edge connector, unlocks the final level (the adder) by waking every subsystem; one-way until a reload. Defaults accepted. (Quirin)
- 2026-10-19: The cheat lever moves to the right edge of the board, above the 256 switch. (Quirin)
