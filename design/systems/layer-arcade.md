# Layer: the arcade hall (zoom out further)

**Status:** decided, first slice built 2026-10-17
**Parent:** [layers](layers.md) · [master](../master.md)
**Lab bench:** none yet
**Code:** rules `src/systems/hall.js` (no Phaser), scene `src/scenes/HallScene.js`, art `makeHall` in
`src/scenes/BootScene.js` (tileset `assets/arcade/`, `coin`, `visitor-cap`), map and numbers in `HALL` in
`src/config.js`. Playtest directly: `?scene=Hall`.

## Purpose
One layer above the [cabinet](layer-cabinet.md): we pull back from the machine and see the arcade shop it
stands in. Pac-Man himself walks around the hall, seen from above like a classic Pokémon game. Theme: Old Tech,
the arcade as a place.

## Rules · decided
- Top-down tile map of the hall, 22x52 tiles (about 1.5 screens tall), 16 px tiles at 2x; the camera follows
  Pac-Man up and down. Rows of 1x2-tile cabinets in four colors, our yellow one in the middle, a counter, a
  change machine, the door at the bottom. Arcade carpet floor.
- Pac-Man walks in strict one-tile steps, four directions (`HALL.walkSpeed` 5 tiles/s), chomping as he walks.
- **Controls:** hold a finger down and drag in a direction to keep walking (24 px deadzone); a short tap talks to
  or uses whatever Pac-Man faces. Arrow keys + Space/Enter on a laptop. Text appears in an RPG text box at the
  bottom; tap (or start walking) to close it.
- **Goal:** 5 coins lie on the floor; with 3 (`HALL.coinsNeeded`) you can play our cabinet: facing it and tapping
  zooms down into the cabinet layer. Without enough coins it tells you how many you have.
- **Visitors:** the four ghosts in caps stand at other machines, one line each, hinting at how they hunt in the
  maze (Blinky chases, Pinky gets ahead, Inky depends on Blinky, Clyde backs off). Other cabinets have one line
  of flavour text each.
- **Transitions:** from the cabinet (LAYER UP) the hall starts zoomed in on our small cabinet (12x) and zooms out
  to the normal view; going down zooms back into it, then the cabinet layer starts at its full view.
- Sprites are shown at one tile (16 px) here.

## Slice scope
- Build (done): map, grid walking, coins, visitors and flavour text, text box, layer transitions both ways.
- Not now: Pokémon-style turn-in-place taps, more dialogue per visitor, the mini-gurke, the coins actually
  becoming credits in the cabinet, sounds for footsteps, a street outside.

## Open questions
- Is Pac-Man big enough to see on a phone at one tile? Does the drag-to-walk feel right?
- Should the coins carry over as credits into the cabinet layer?

## Decision log
- 2026-10-17: Another layer up: a Pokémon-like top-down view of Pac-Man walking around the arcade shop. (Quirin)
- 2026-10-17: Defaults accepted for all eight questions; built the first slice. (Quirin)
