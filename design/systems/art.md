# Art (pixel art and visual design)

**Status:** decided, except loading Max's art (proposed)
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
- This runs automatically in Claude Code sessions: a `PostToolUse` hook (`.claude/settings.json`) calls
  `tools/export_assets.py --hook` after every edit or shell command, and it re-exports whenever `BootScene.js`,
  `tiles.js` or `config.js` changed since the last export.
- Max takes the files from `assets/`, edits them, and passes them back in a separate folder,
  `assets/from-max/` (same file names and sizes), or into a conversation, where Claude puts them in that folder.
- The export never overwrites Max's files.

## Base resolution · decided
Sprites: 32x32 base resolution for Max's art. Today's code-drawn sprites are 16x16 (a 14x14 figure with a
1 px margin). The game shows every sprite in the same box of 2x2 tiles (`PIXEL.sprite`), whatever its native
size, so a 32x32 file replaces a 16x16 one with no code change. Max draws the 32x32 sprites fresh, using the
16x16 export as reference. Tiles are 16x16 (`PIXEL.tile`); the game world
is 16 px per tile, scaled up 2x (`PIXEL.zoom`).

Max works on the core data: every file in `assets/` is the texture at its native resolution, never an upscaled
copy.

## Maze from a tileset · decided
Tiles are separate files, one per tile, grouped in tilesets: a tileset is a folder for one environment, and
the maze environment is `assets/maze/` (texture keys `maze/<tile>`). Other environments (e.g. deeper layers)
get their own folder. The game builds the maze from these tiles (`src/systems/tiles.js`, baked in `BootScene`),
so changing `MAZE.layout` needs no new art. Every tile is 16x16:

- **`wall-1` .. `wall-15`**: a wall piece doesn't sit on a cell; it sits where four cells meet, and its number
  says which of those four cells are wall: top-left 1, top-right 2, bottom-right 4, bottom-left 8 (add them up).
  So `wall-1` is an outer corner with wall only in the top-left, `wall-3` a straight wall along the top,
  `wall-7` an inner corner, `wall-15` the inside of a solid wall block. These 15 pieces cover every straight,
  outer and inner corner.
- **`door`** and **`floor`** sit on the normal cell grid, under the walls. The floor is empty in the placeholder.
- Outside the maze counts as wall, except where a tunnel leaves it. One wall set, no double outer wall.
- Pellets stay separate sprites on top. When the maze is cleared, the game tints it white (`COLORS.mazeFlash`).

## What exists (one file per row) · decided
Sizes are in image pixels at native resolution. Transparent background.

| Texture key | Size | Frames | Notes |
|---|---|---|---|
| `pac-0` .. `pac-3` | 16x16 | 4 | Chomper facing right, mouth closed to wide open. The game rotates it for other directions. |
| `pac-die-0` .. `pac-die-9` | 16x16 | 10 | Death animation, played facing up. |
| `ghost-0`, `ghost-1` | 16x16 | 2 | Ghost body in **white**; the game tints it per ghost (red, pink, cyan, orange). Two skirt frames. |
| `eyes-left/right/up/down` | 16x16 | 4 | Eyes only, drawn on top of the body; also shown alone when a ghost was eaten. |
| `ghost-fright-0/1` | 16x16 | 2 | Frightened ghost (blue with face), not tinted. |
| `ghost-flash-0/1` | 16x16 | 2 | Frightened ghost flashing white near the end. |
| `dot` | 4x4 | 1 | Pellet, at tile resolution, centered in its tile. |
| `power` | 16x16 | 1 | Power pellet, one tile (the game blinks it). |
| `maze/wall-1` .. `maze/wall-15`, `maze/door`, `maze/floor` | 16x16 | 17 files | Maze tileset, one file per tile in `assets/maze/`, see above. |
| `cabinet` | 360x640 | 1 | [Cabinet layer](layer-cabinet.md): the whole arcade machine and its floor shadow on transparent, oblique view (front flat, depth up-right at 45°). Shown at 2x. Keep the screen opening (black, at x 98, y 67, 168x264 inside the bezel), the coin door (x 140, y 460, 56x76) and the control panel where they are, or tell Claude the new positions (`CABINET` in config). The marquee text and the game picture are drawn on top by the game. |
| `stick-n`, `stick-up/down/left/right` | 24x32 | 5 | The cabinet's joystick, neutral and pushed four ways; the base sits at y 27. |

Sprites (pac, ghosts, eyes) can be 32x32; tiles and pellets stay at tile resolution. Text uses the Press Start
2P pixel font. The life icons and the menu reuse `pac-2`.

## Loading Max's art · proposed
- `BootScene` loads a PNG from `assets/from-max/` when it exists and falls back to the code-drawn placeholder
  otherwise, so art can land one sprite at a time. Not built yet; wired in when the first file arrives.
- Keep the arcade palette in `COLORS` as the starting point; Max can change it.

## Open questions
- Does Max redraw the tileset too, or only the characters? *Default: characters first.*
- What does Max draw for the deeper layers (cabinet, hardware, code)? Waits for the [layers](layers.md) design.

## Decision log
- 2026-10-17: Max (artist) joins the team and works on the visual design, e.g. the pixel art. (Quirin)
- 2026-10-17: `assets/` always holds an export of all textures; Max edits them and passes them back in a separate
  folder (`assets/from-max/`) or into a conversation. (Quirin)
- 2026-10-17: Base resolution for the pixel art becomes 32x32 per sprite. (Quirin)
- 2026-10-17: The maze is built from a tileset. (Quirin)
- 2026-10-17: 16x16 tiles are supported next to 32x32 sprites. Max works on the core data at native resolution,
  never an upscaled version, so placeholders are not pixel-doubled. (Quirin)
- 2026-10-17: Today's art moves to 16x16 and into the new system: 16x16 sprites shown in a 2x2-tile box, 16x16 tiles,
  the maze built from a 16-piece tileset (Claude picked a dual grid, pieces where four cells meet, so the default
  16 pieces also get inner corners right), floor and door tiles, tint flash, one wall set. Max draws 32x32 sprites
  fresh. Other tileset answers: defaults. (Quirin)
- 2026-10-17: One file per tile; a tileset is a folder of tiles per environment, starting with `assets/maze/`.
  (Quirin)
- 2026-10-17: The cabinet layer's art is exported too (`cabinet`, `stick-*`), and the export re-runs automatically after art changes in Claude Code sessions. (Quirin)
