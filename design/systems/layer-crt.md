# Layer: inside the screen (zoom in)

**Status:** proposed (ideas, not built)
**Parent:** [layers](layers.md) · [master](../master.md)
**Lab bench:** none yet
**Code:** none yet

## Purpose
The first layer down from the [maze game](arcade-maze.md): we dive into the picture tube and see how the
image you just played is actually made. Theme: Old Tech, the CRT.

## How an arcade screen works (research notes)
From general knowledge, not checked against sources yet. Worth a quick fact check before we put any of it on
screen as text.
- **Raster CRT.** The Pac-Man cabinet uses a colour raster monitor (19-inch class) **mounted on its side**, so
  the picture is taller than wide (224x288 pixels). Because it's rotated, the scanlines run *vertically* across
  the playfield.
- **The beam.** An electron gun at the back fires three beams (red, green, blue). Magnetic coils (the yoke)
  sweep them across the screen one line at a time, about 15,700 lines per second, a full picture about
  60 times per second. Between lines the beam is switched off and jumps back (horizontal blanking); after the
  last line it jumps back to the start (vertical blanking).
- **Phosphor.** The inside of the glass has dots of red, green and blue phosphor (triads) behind a shadow mask.
  A dot only glows when the beam hits it and fades within milliseconds. At any instant only a thin band near
  the beam is really bright; we see a whole picture only because our eyes blur it (persistence of vision).
- **The signal.** The game board never draws a picture. It sends a stream of colour values (from 8x8 tiles
  and up to 8 sprites of 16x16, through a small colour palette) timed exactly to where the beam is. A sync
  pulse tells the monitor when to start a new line and a new picture.
- **Vertical blank = game tick.** The game's CPU gets an interrupt at every vertical blank (60 times per second)
  and does its work (moving Pac-Man and the ghosts) then, while the beam is off. This ties this layer to the
  [code layer](layers.md).
- **Failure modes** worth stealing as mechanics: burn-in (the maze stays faintly etched into the phosphor on old
  cabinets), lost vertical sync (the picture rolls), misconvergence (colour fringes), degaussing (the wobble
  when a magnetised screen is reset), and high voltage (around 25 kV inside the tube).

## Rules · proposed (from Quirin's first ideas, to iterate)
- We control a Pac-like character again, in a different skin (e.g. an electron or a phosphor blob), in a world
  that is a magnified patch of the screen: a grid of pixels / phosphor triads.
- The maze game from the layer above keeps running in the background, **played automatically** (an AI
  chomper). Its picture decides which of our pixels light up: walls, dots, ghosts and the chomper show up as
  lit pixel shapes, moving as the game above plays.
- **Dots only count while lit.** We eat dots, but only when their pixels are glowing, i.e. right after the beam
  has passed and before the phosphor fades. The rest of the time they are dark and can't be eaten.
- **The beam is the hazard.** The refresh sweep runs through the world line by line (slowed down a lot, since
  we're tiny). Getting hit by the beam (or by the bright spot moving along the current line) is bad. The beam
  also creates the opportunity: it lights the dots up.
- Ideas to pick from: the ghosts' lit pixels hurt; burned-in pixels are always faintly lit (safe or blocking);
  vertical blank is a short safe moment where the beam is off; a sync glitch rolls the whole world.

## Feel · open
How slow is the beam relative to us? Is it a rhythm game (move between sweeps) or a chase?

## Slice scope · open
To be written once the questions are answered.

## Open questions
1. **Skin and controls:** same swipe-in-a-maze movement as the layer above, or free movement over the pixel grid?
   *Default: same swipe controls on a grid, so the player already knows them.*
2. **How much of the picture:** a zoomed patch that scrolls with us, or the whole 28x36-tile screen at a coarse
   scale? *Default: a patch of about 6x10 tiles of the picture, following the player.*
3. **Beam shape:** a full line sweeping (easy to read) or the real moving spot tracing each line (truer, harder)?
   *Default: a lit band sweeping, with the bright spot drawn on it.*
4. **What the beam does:** instant death, lose a dot, or knock back? *Default: lose a life, like a ghost.*
5. **Dot timing:** how long dots stay edible after the beam passes? *Default: about 1 s, fading visibly.*
6. **Goal:** eat N lit dots, survive a time, or reach somewhere (the electron gun?)? *Default: eat a set number of
   dots within 1 to 3 minutes.*
7. **Link to the layer above:** does the auto-played game above react to us (e.g. its chomper dies if we eat its
   pixels)? *Default: not in the first slice.*
8. **Mini-gurke:** a pickle drawn in burned-in pixels somewhere? *Default: yes, hidden in a corner.*

## Decision log
- 2026-10-17: Zoom-in layer idea: into the screen; control a Pac again (other skin); the auto-played game
  above lights the pixels; dots only edible while lit; avoid the refresh beam. Research how arcade screens
  work first. (Quirin)
