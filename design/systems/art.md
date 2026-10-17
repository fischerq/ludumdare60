# Art (pixel art and visual design)

**Status:** proposed (handoff list is a fact sheet of the current code; the pipeline is a proposal)
**Parent:** [master](../master.md)
**Lab bench:** none
**Code:** placeholder art `src/scenes/BootScene.js`, colors `COLORS` and scale `PIXEL` in `src/config.js`,
real art goes in `assets/`

## Who · decided
Max (artist) works on the visual design, e.g. the pixel art. Quirin makes the other creative calls. Claude wires
the art into the game.

## Where the art is now · decided
There are no image files yet: `assets/` is empty. Every sprite is drawn pixel by pixel in code in `BootScene`
at arcade resolution and scaled up 4x (`PIXEL.zoom`) with hard pixel edges. Real art replaces a placeholder by
using the same texture key, so the game code doesn't change.

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

## Pipeline · proposed
- Max exports PNGs at 1x (no upscaling), one file per texture key, named after the key (`assets/pac-0.png`), or
  one sprite sheet per character if that's easier for them.
- `BootScene` loads a PNG when it exists and falls back to the code-drawn placeholder otherwise, so art can land
  one sprite at a time.
- Keep the arcade palette in `COLORS` as the starting point; Max can change it.

## Open questions
- How does Max hand over files: commits to the repo, or sends them to Quirin? *Default: sends them, Claude adds
  them to `assets/`.*
- Single PNGs or sprite sheets? *Default: single PNGs named after the texture key.*
- Keep the 14x14 sprite size and 8 px tiles (the original's look), or does Max want more pixels? *Default: keep
  them for the maze level.*
- Does Max redesign the maze walls too, or only the characters? *Default: characters first.*
- What does Max draw for the deeper layers (cabinet, hardware, code)? Waits for the [layers](layers.md) design.

## Decision log
- 2026-10-17: Max (artist) joins the team and works on the visual design, e.g. the pixel art. (Quirin)
