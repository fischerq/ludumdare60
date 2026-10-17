# Layers of Pac: master design

*(working title, was mini-gurke)* · Ludum Dare 60 · jam starts Sat 17 Oct 2026, 00:00 CEST

This is the top of the design hierarchy (see [README](README.md) for how the docs work). Anything not written
here is not decided yet: ask before adding it.

## Team · decided
Quirin (design, creative calls), Max (artist: visual design, e.g. the pixel art), Claude Code (code, design help).

## Fixed constraints · decided
- Browser game, phone first: portrait 720x1280 logical resolution, touch is the primary control, keyboard is a
  bonus and never required.
- Phaser 3 from a CDN, no build step, deployed to Netlify on every push.
- Placeholder art drawn in code until Max's art lands in `assets/` under the same texture keys (see
  [art](systems/art.md)).
- Portrait orientation, whatever the theme: phone in one hand.
- A run lasts 1 to 3 minutes, so a round (and a playtest) is quick.
- The game has to fit the jam's theme, which is announced at the start. Everything below waits for it.

## Theme · decided
**Old Tech** (announced 17 Oct 2026).

Interpretation · proposed: an arcade maze-chomper (Pac-Man style) is the front door. From it, minigames peel
back the layers of old tech behind the arcade machine: the cabinet, the hardware, the software and how it was
programmed. See [arcade-maze](systems/arcade-maze.md) and [layers](systems/layers.md).

## Pitch · proposed
Play a classic arcade maze game, then dive through the machine behind it: each layer down is a short minigame
that reuses the maze characters or mechanics to show how old tech worked.

## Pillars · open
Three at most. Every feature has to serve at least one, otherwise it's cut.

## Core loop · open
What the player does every few seconds, what they get for it, and what makes the next round different.

## Controls · proposed
Touch and drag, the player moves toward the finger (what the prototype does now). Keyboard arrows/WASD as a
bonus. See [movement](systems/movement.md).

## Systems
| System | Status | Doc | Lab bench |
|---|---|---|---|
| Touch-follow movement | proposed (prototype only; the maze game probably uses swipes) | [movement](systems/movement.md) | `/lab/bench.html?b=movement` |
| Arcade maze game (starting point) | decided, first version built | [arcade-maze](systems/arcade-maze.md) | `/lab/bench.html?b=maze-controls` |
| Tech layers / minigames | open | [layers](systems/layers.md) | none yet |
| Art (pixel art, visual design) | proposed (Max) | [art](systems/art.md) | none |
| Layer: the arcade hall (zoom out further) | decided, first slice built | [layer-arcade](systems/layer-arcade.md) | none yet |
| Layer: the cabinet (zoom out) | decided, first slice built | [layer-cabinet](systems/layer-cabinet.md) | none yet |
| Layer: inside the screen (zoom in) | proposed, questions open | [layer-crt](systems/layer-crt.md) | none yet |
| Mini-gurke easter egg | proposed | [layers](systems/layers.md#mini-gurke-easter-egg--proposed) | none |

## Vertical slice · decided
The smallest playable version that tests the core assumption.
- Build: one arcade-styled maze-chomper screen, full screen, with sound, playable on a phone (see
  [arcade-maze](systems/arcade-maze.md)). Built 2026-10-17.
- Not now: minigames, the emulator sidecar, the mini-gurke egg, menus beyond start/game over.

## Art and audio direction · proposed
Arcade look: black background, neon maze lines, chunky pixel sprites, pixel font, CRT-ish touches (scanlines)
if cheap. Max makes the pixel art; the list of sprites and how they get into the game is in
[art](systems/art.md). The maze game runs full screen with no cabinet frame; clearing the first level changes that.
**Pixel art throughout, no real 3D:** depth is simulated in pixel art (oblique views). Zooming between layers
changes the pixel size by whole factors so every layer stays crisp. Deeper layers can change look to match the tech they show (schematics, hex dumps, assembly listings).

## Current prototype
The arcade maze game: menu, one maze, 4 ghosts, swipe to turn, sound. Clearing the maze shows a placeholder
"something is behind the glass" screen where the first tech layer will go. The old touch-follow pipeline test
survives only as the movement lab bench.

## How we work during the jam · decided
- Many separate Claude sessions; each one reads this doc and the relevant system doc first.
- Plan usage is tight (it refills only after the event): check the current limit state regularly, especially
  before token-heavy work, and ask before doing something expensive when in doubt.
- Build and test on a phone (primary) and a laptop.

## Open questions
- Which jam do we enter: the 48-hour Compo (solo, everything made during the jam) or the 72-hour Jam?
  To be decided on Saturday 17 Oct. Teaming up with Max rules out the Compo, which is solo only.
- Pac-Man is a Bandai Namco trademark and its ROM/sprites are copyrighted. Do we make our own
  homage (own name, own sprites, own maze) rather than "Pac-Man" itself? *Default: yes, an homage.*

## Decision log
- 2026-10-07: Phaser 3 from a CDN, no build, Netlify, phone first, portrait 720x1280. (Quirin)
- 2026-10-10: Design docs are the source of truth; features start with questions, then a slice scope; mechanics
  get lab benches for side-by-side comparisons. (Quirin)
- 2026-10-10: Portrait for any theme; a run lasts 1 to 3 minutes. Compo or Jam is decided on Saturday. (Quirin)
- 2026-10-17: Theme is Old Tech. First idea: an arcade maze game (Pac-Man style) as the starting point, with
  minigames that explore the layers of tech behind the arcade machine; maybe emulate the original language in a
  wasm sidecar and use the visible code in a level; mini-gurke becomes a collectible easter egg. All ideas to
  iterate on. Plan usage is tight, so sessions check limits regularly and ask before expensive work. (Quirin)
- 2026-10-17: Maze game runs full screen (no cabinet frame); clearing the first level changes it. Sound from the
  start. Plan for the Z80 emulator layer. (Quirin)
- 2026-10-17: The game is called "Layers of Pac". The maze level imitates the original's pixel look at a similar
  resolution. (Quirin)
- 2026-10-17: Menu footer: Making-Of, Lab and Impressum links in one row. Next layers to design: zoom out to the
  cabinet and zoom in to the screen. (Quirin)
- 2026-10-17: Layer order maze → cabinet (zoom out) → screen (zoom in). No real 3D anywhere: pixel art
  throughout, 3D simulated. (Quirin)
- 2026-10-17: Max (artist) joins the team and works on the visual design, e.g. the pixel art. (Quirin)
- 2026-10-17: Pixel art at 32x32 per sprite; the maze is built from a tileset. Details in [art](systems/art.md). (Quirin)
- 2026-10-17: Layer up/down button in every layer, unlocked by default for now. (Quirin)
- 2026-10-17: Layer above the cabinet: Pac-Man walks around the arcade shop, Pokémon-like top-down view. (Quirin)
- 2026-10-17: Outer game loop: the game starts on the maze; winning and losing unlock the layers below and above;
  cheat buttons for testing. See [layers](systems/layers.md). (Quirin)
