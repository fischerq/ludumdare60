# Art (pixel art and visual design)

**Status:** proposed (export and handoff decided; loading Max's art proposed)
**Parent:** [master](../master.md)
**Lab bench:** none
**Code:** placeholder art `src/scenes/BootScene.js`, colors `COLORS` and scale `PIXEL` in `src/config.js`,
real art goes in `assets/`

## Who · decided
Max (artist) works on the visual design, e.g. the pixel art. Quirin makes the other creative calls. Claude wires
the art into the game.

## Where the art is now · decided
Every sprite is drawn pixel by pixel in code in `BootScene` at arcade resolution and scaled up 4x
(`PIXEL.zoom`) with hard pixel edges. Real art replaces a placeholder by using the same texture key, so the game
code doesn't change.

## Export and handoff · decided
- `assets/` always holds a current export of every texture, one PNG per key at 1x: `assets/<key>.png`.
  `python3 tools/export_assets.py` writes it by running `BootScene` in headless Chrome/Chromium
  (`tools/export-assets.html` shows the same textures in a browser, with download links). Rerun it after any
  change to the code-drawn art and commit the PNGs with that change.
- Max takes the files from `assets/`, edits them, and passes them back in a separate folder,
  `assets/from-max/` (same file names and sizes), or into a conversation, where Claude puts them in that folder.
- The export never overwrites Max's files.

## Base resolution · decided
Pixel art moves to a 32x32 base resolution per sprite (the current code-drawn sprites are 14x14, like the
original). 16x16 tiles are supported next to the 32x32 sprites; each texture keeps its own native size and the
game scales it on screen.

Max works on the core data: every file in `assets/` is the texture at its native resolution, never an upscaled
copy. So the 14x14 placeholders are not pixel-doubled into 32x32 files; until real 32x32 art exists, the export
stays at the placeholder's own size.

## Maze from a tileset · decided (details open)
The maze is built from a tileset that Max draws, instead of one baked maze image. The game picks each cell's tile
from the layout in `MAZE.layout`, so changing the layout needs no new art. Not built yet; see the open questions.

## What exists (one file per row) · decided
Sizes are in art pixels (1 art px = 1 image px; the game scales it up 4x). Transparent background.

| Texture key | Size | Frames | Notes |
|---|---|---|---|
| `pac-0` .. `pac-3` | 14x14 | 4 | Chomper facing right, mouth closed to wide open. The game rotates it for other directions. |
| `pac-die-0` .. `pac-die-9` | 14x14 | 10 | Death animation, played facing up. |
| `ghost-0`, `ghost-1` | 14x14 | 2 | Ghost body in **white**; the game tints it per ghost (red, pink, cyan, orange). Two skirt frames. |
| `eyes-left/right/up/down` | 14x14 | 4 | Eyes only, drawn on top of the body; also shown alone when a ghost was eaten. |
| `ghost-fright-0/1` | 14x14 | 2 | Frightened ghost (blue with face), not tinted. |
| `ghost-flash-0/1` | 14x14 | 2 | Frightened ghost flashing white near the end. |
| `dot` | 2x2 | 1 | Pellet, centered in an 8x8 tile. |
| `power` | 8x8 | 1 | Power pellet (the game blinks it). |
| `maze` | 152x200 | 1 | The whole maze, 19x25 tiles of 8 px. Must match the layout in `MAZE.layout` (`src/config.js`). |
| `maze-white` | 152x200 | 1 | Same maze in white, flashes when the maze is cleared. |

Text uses the Press Start 2P pixel font. The life icons and the menu reuse `pac-2`.

## Loading Max's art · proposed
- `BootScene` loads a PNG from `assets/from-max/` when it exists and falls back to the code-drawn placeholder
  otherwise, so art can land one sprite at a time. Not built yet; wired in when the first file arrives.
- Keep the arcade palette in `COLORS` as the starting point; Max can change it.

## Open questions
- 32x32 sprites: does the maze tile go from 8 to 16 art px (sprite = 2x2 tiles, like the original), with the
  zoom dropping from 4x to 2x? *Default: yes; the maze becomes 304x400 art px at 2x, slightly narrower on screen.*
- Should Claude redraw the code placeholders at 32x32 first, so Max edits exports at the right size?
  *Default: yes, a quick upscale of today's sprites (each pixel doubled, 28x28 centered in 32x32).*
- Does Max redesign the maze walls too, or only the characters? *Default: characters first.*
- What does Max draw for the deeper layers (cabinet, hardware, code)? Waits for the [layers](layers.md) design.

### Tileset questions (open)
- Where do 32x32 sprites start: Max draws them fresh with the 14x14 export as reference, or Claude first draws
  native 32x32 placeholders in code? *Default: Max draws them fresh; the game shows each texture at its own size.*
- Maze tiles 16x16, so a 32x32 sprite covers 2x2 tiles like the original (the game scales 2x instead of 4x)?
  *Default: yes.*
- How many wall tiles: a 16-piece set by the 4 neighbours (straights, corners, T, cross, ends), or a 47-piece set
  that also knows diagonals (needed for clean rounded inner corners like the original)? *Default: 16-piece; the
  game picks the piece automatically.*
- The original's double outer wall: a second set for walls connected to the border? *Default: no, one set.*
- One tileset image (a grid of tiles) or one PNG per tile? *Default: one sheet, with a labelled template Claude
  exports to `assets/` as the starting point.*
- Ghost door and tunnel ends: tiles in the same sheet? *Default: door yes, tunnel uses floor.*
- Floor: transparent, or a floor tile Max can draw? *Default: a floor tile, transparent in the placeholder.*
- Pellets: stay separate sprites on top of the maze? *Default: yes.*
- Clear flash (maze blinks white): tint the tiles white, or a second white tileset? *Default: tint.*

## Decision log
- 2026-10-17: Max (artist) joins the team and works on the visual design, e.g. the pixel art. (Quirin)
- 2026-10-17: `assets/` always holds an export of all textures; Max edits them and passes them back in a separate
  folder (`assets/from-max/`) or into a conversation. (Quirin)
- 2026-10-17: Base resolution for the pixel art becomes 32x32 per sprite. (Quirin)
- 2026-10-17: The maze is built from a tileset. (Quirin)
- 2026-10-17: 16x16 tiles are supported next to 32x32 sprites. Max works on the core data at native resolution,
  never an upscaled version, so placeholders are not pixel-doubled. (Quirin)
