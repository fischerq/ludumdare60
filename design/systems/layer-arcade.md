# Layer: the arcade hall (zoom out further)

**Status:** decided, first slice built 2026-10-17
**Parent:** [layers](layers.md) · [master](../master.md)
**Lab bench:** none yet
**Code:** rules `src/systems/hall.js` (no Phaser), scene `src/scenes/HallScene.js`, art `makeHall` in
`src/scenes/BootScene.js` (tileset and characters in `assets/arcade/`), map and numbers in `HALL` in
`src/config.js`. Playtest directly: `?scene=Hall`.

## Purpose
One layer above the [cabinet](layer-cabinet.md): we pull back from the machine and see the arcade shop it
stands in. Pac-Man himself walks around the hall, seen from above like a classic Pokémon game. Theme: Old Tech,
the arcade as a place.

## Rules · decided
- **A small, cozy room** (11x15 tiles with walls) that fits one screen, shown at 4x (`HALL.zoom`; the other
  layers use 2x), so characters are Pokémon-sized. Warm wooden floor, a red rug, a wallpapered back wall with
  windows, a Pac-Man poster, a ghost poster and a clock, plants, five cabinets (our yellow one in the middle), a
  claw machine, a soda machine, a bin, the counter (owner asleep), the change machine, the door at the bottom.
- **Same movement as Pac-Man, on the grid:** one tile per step, four directions (`HALL.walkSpeed` 4 tiles/s).
  Hold a finger down and drag to keep walking; a short tap talks to or uses whatever Pac-Man faces. Arrow keys +
  Space/Enter on a laptop. Text appears in an RPG text box at the bottom, sized to the text; tap to close.
- **Only bonus coins to collect** (like the fruit in the maze): 5 on the floor; with 3 (`HALL.coinsNeeded`)
  you can play our cabinet, which zooms down into the cabinet layer.
- **Talking:** the four ghosts in caps stand at the machines, one line each, hinting at how they hunt in the maze.
  Every machine and decoration has a line (`HALL.text`, `HALL.cellText`).
- **The chase:** talking to Blinky (`HALL.angry`) makes him angry: after his line, all four visitors chase
  Pac-Man with their maze rules (Blinky straight at him, Pinky 2 tiles ahead, Inky mirrored around Blinky, Clyde
  backs off when close), at 3.2 tiles/s after a 1 s head start, never turning back. Ways out: walk out the
  **door**, or enter **our cabinet** (needs the coins). Caught: thrown out, back at the start (coins kept).
  After 20 s they give up. The frightened siren plays during the chase.
- **Transitions:** from the cabinet (LAYER UP) the hall starts zoomed in on our small cabinet and zooms out; going
  down zooms back into it, then the cabinet layer starts at its full view.

## Slice scope
- Build (done): cozy room, grid walking, coins, talking, Blinky's chase with the maze rules, escapes, text box,
  layer transitions both ways.
- Not now: more dialogue, the mini-gurke, coins becoming credits in the cabinet, footstep sounds, a street outside.

## Open questions
- Should entering the machine work as an escape even without the 3 coins? *Default now: no, coins needed.*
- Does drag-to-walk feel right? Is the chase too easy or too hard (`HALL.chase`)?

## Decision log
- 2026-10-17: Another layer up: a Pokémon-like top-down view of Pac-Man walking around the arcade shop. (Quirin)
- 2026-10-17: Defaults accepted for all eight questions; built the first slice. (Quirin)
- 2026-10-17: The hall becomes smaller and more detailed, Pokémon-like cozy. (Quirin)
- 2026-10-17: Map it to Pac-Man: same movement, only bonus coins to collect, talking to people and machines; one
  ghost gets angry when talked to and all of them chase like in Pac-Man; escape into the machine or out the door.
  (Quirin) Claude picked Blinky as the angry one, a 1 s head start, giving up after 20 s, coins kept when caught.
- 2026-10-17: Hall characters get their own 32x32 sprites (`arcade/pac-*`, `arcade/ghost-*` with the cap drawn in),
  shown 2x2 tiles big standing on their tile, lower ones in front. See [art](art.md). (Quirin)
