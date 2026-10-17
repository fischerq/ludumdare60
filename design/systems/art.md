# Art (pixel art and visual design)

**Status:** decided
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
- Max edits the files in `assets/` in place (same file names; sizes as in the table below), or passes them into
  a conversation, where Claude puts them in place.
- The export never overwrites or deletes a file Max edited: `assets/export.json` keeps the hash of what the export
  last wrote, and a file that differs from it is his. To go back to the code-drawn version of one file, delete it and
  run the export again.

## Base resolution · decided
Sprites: 32x32, code-drawn placeholders included. The game shows every sprite in the same box of 2x2 tiles
(`PIXEL.sprite`), whatever its native size. Tiles are 16x16 (`PIXEL.tile`); the game world
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

## Made for easy customizing · decided
The art is organized so Max can change any picture on its own, cleanly:
- **One folder per layer** (`assets/maze/`, `assets/cabinet/`, `assets/arcade/`, later the CRT layer), holding
  that layer's tiles and characters. A layer may reuse another's art (the cabinet's screen draws the maze level's
  sprites) instead of keeping a copy.
- **One file per state:** every ghost, direction, frame and mood is its own picture with its colors drawn in. No
  tinting, no overlays stacked by the game (eyes, caps). The only transforms are mirroring Pac-Man for left and
  turning the maze Pac-Man for up and down.
- Characters are 32x32; the game shows them in a fixed box (`PIXEL.sprite`), whatever the file's size.

## What exists (one file per row) · decided
Sizes are in image pixels at native resolution. Transparent background.

| Texture key | Size | Frames | Notes |
|---|---|---|---|
| **Maze level** (`assets/maze/`, also the cabinet's screen picture and the menu) | | | |
| `maze/pac-0` .. `maze/pac-3` | 32x32 | 4 | Pac-Man facing right, mouth closed to wide open. The game mirrors it for left and turns it for up and down. |
| `maze/pac-die-0` .. `maze/pac-die-9` | 32x32 | 10 | Death animation, drawn facing up (shown as is). |
| `maze/life` | 32x32 | 1 | Spare-life icon under the maze (facing left). |
| `maze/ghost-<name>-<dir>-<f>` | 32x32 | 32 files | One per ghost (blinky, pinky, inky, clyde), direction (left, right, up, down) and skirt frame (0, 1): body and eyes in one picture, colors drawn in. |
| `maze/ghost-fright-0/1`, `maze/ghost-flash-0/1` | 32x32 | 4 | Frightened ghost (blue with face) and its white flash near the end, the same for all four. |
| `maze/eyes-<dir>` | 32x32 | 4 | An eaten ghost: only the eyes, on their way home. |
| `maze/dot` | 4x4 | 1 | Pellet, at tile resolution, centered in its tile. |
| `maze/power` | 16x16 | 1 | Power pellet, one tile (the game blinks it). |
| `maze/wall-1` .. `maze/wall-15`, `maze/door`, `maze/floor` | 16x16 | 17 files | Maze tileset, see above. |
| **Cabinet** (`assets/cabinet/`) | | | |
| `cabinet/machine` | 360x640 | 1 | [Cabinet layer](layer-cabinet.md): the whole arcade machine and its floor shadow on transparent, oblique view (front flat, depth up-right at 45°). Shown at 2x. Keep the screen opening (black, at x 98, y 67, 168x264 inside the bezel), the coin door (x 140, y 460, 56x76) and the control panel where they are, or tell Claude the new positions (`CABINET` in config). The marquee text and the game picture are drawn on top by the game; the picture uses the maze level's sprites. |
| `cabinet/stick-n`, `cabinet/stick-up/down/left/right` | 24x32 | 5 | The cabinet's joystick, neutral and pushed four ways; the base sits at y 27. |
| **Arcade hall** (`assets/arcade/`) | | | |
| `arcade/pac-<right/up/down>-<f>` | 32x32 | 6 | Pac-Man walking, top-down, two frames each; left is `right` mirrored. Feet at the bottom of the picture: the game stands him on his tile and shows him 2x2 tiles big. |
| `arcade/ghost-<name>-<dir>-<f>` | 32x32 | 32 files | The ghost visitors with their cap on, per ghost, direction and frame; `up` is seen from behind. |
| `arcade/coin` | 10x10 | 1 | Coin on the hall floor. |
| `arcade/floor`, `arcade/rug-tl/tc/tr/ml/mc/mr/bl/bc/br`, `arcade/wall-top`, `arcade/wall-face`, `arcade/window`, `arcade/poster-pac`, `arcade/poster-ghost`, `arcade/clock`, `arcade/counter`, `arcade/plant`, `arcade/bin`, `arcade/door` | 16x16 | 20 files | [Arcade hall](layer-arcade.md) tileset, top-down, cozy. The rug is a 9-slice (t/m/b row, l/c/r column). `wall-face` is the wallpaper on the back wall; window, posters and clock sit on that row. Objects (plant, bin, counter) are drawn over the floor tile with a contact shadow. |
| `arcade/change-top/bottom`, `arcade/claw-top/bottom`, `arcade/soda-top/bottom` | 16x16 | 6 files | 1x2 machines in the hall. |
| `arcade/cab-top-<c>`, `arcade/cab-bottom-<c>` | 16x16 | 10 files | Hall cabinets, 1x2 tiles, for c = r, b, g, v, y (y is ours, yellow, with the maze on its screen). The hall is shown at 4x. |

Characters are 32x32; tiles and pellets stay at tile resolution. Text uses the Press Start 2P pixel font.

## Loading the art · decided
- The game loads its art from the files: `BootScene` loads `assets/<key>.png` for every key in
  `assets/export.json` and draws the code placeholder only when a file is missing. So whatever is in `assets/`
  is what the game shows; Max saves a file, reloads the page and sees it in the game.
- Over plain `http` (a local server like `python3 -m http.server` or Live Server) the files are fetched fresh on
  every load, so a browser cache never hides an edit.
- `?codeart` in the URL shows only the code-drawn art (the export uses this to get the placeholders).
- Keep the arcade palette in `COLORS` as the starting point; Max can change it.

## Animation speed · decided
- Per character (`pac`, `blinky`, `pinky`, `inky`, `clyde`): how many game frames (60 per second) each animation
  frame is held. Lives in `src/settings/animation.json`, not `config.js`, so the lab can export it.
- Tune it in the lab bench ([`/lab/bench.html?b=animation`](../../lab/bench.html?b=animation)), press
  **Download settings**, save the file over `src/settings/animation.json` and commit it. The game fetches the file
  at start and again whenever the tab comes back; on a local server (plain http) it also checks every second, so a
  saved file shows within a second (hot reload). A file that isn't valid JSON is ignored with a warning in the console.
- Pac only animates while moving (his clock is distance moved / his speed), ghosts animate all the time. The
  same numbers apply in the maze, the cabinet picture and the hall. Shared code: `src/systems/anim.js`.
- Effects are tuned the same way (`effects` in the file): `pacDeath` (one-shot, 10 frames), `powerPellet`,
  `frightFlash`, `mazeClear` (blinks: on one tick, off one), `coinBob` (hall coins), `insertCoin` (cabinet text
  blinks) and `tapPrompt` (menu/game-over fade, one tick each way; read when the scene starts).
- Not yet: per-scene speeds, frame lists in the JSON.

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
- 2026-10-17: Max edits the files in `assets/` in place (no `from-max/` folder); the game loads the art from
  `assets/`, and the export keeps every file he edited. (Quirin)
- 2026-10-17: Per-layer character art: a folder per layer (`maze/`, `cabinet/`, `arcade/`), reuse allowed (the
  cabinet screen uses the maze level's sprites). Every ghost state is its own sprite (per ghost, direction and
  frame, colors drawn in; frightened, flashing and eaten too), no tinting or overlays; dedicated spare-life icon.
  All characters redrawn at 32x32. Pac-Man is mirrored for left instead of turned upside down; the maze Pac-Man is
  still turned for up and down. Hall characters get their own top-down sprites (right/up/down, two walk frames,
  ghosts with the cap drawn in), shown 2x2 tiles big and standing on their tile. Principle: optimize the art
  layout so Max can customize the graphics easily and cleanly. (Quirin)
- 2026-10-17: Animation speed is set per character in game frames per animation frame, in `src/settings/animation.json`, tuned and exported from the lab. (Quirin)
- 2026-10-17: All animations are tunable like this: blinks, flashes, the death animation and the prompt fade under `effects` in the same file. (Quirin)
