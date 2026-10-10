# mini-gurke: master design

*(working title)* · Ludum Dare 60 · jam starts Sat 17 Oct 2026, 00:00 CEST

This is the top of the design hierarchy (see [README](README.md) for how the docs work). Anything not written
here is not decided yet: ask before adding it.

## Fixed constraints · decided
- Browser game, phone first: portrait 720x1280 logical resolution, touch is the primary control, keyboard is a
  bonus and never required.
- Phaser 3 from a CDN, no build step, deployed to Netlify on every push.
- Placeholder art drawn in code until real art exists. Test the fun before spending time on art.
- The game has to fit the jam's theme, which is announced at the start. Everything below waits for it.

## Theme · open
Announced 17 Oct. Record the theme and the interpretation we pick here.

## Pitch · open
One or two sentences: what the player does and why it's fun.

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
| Touch-follow movement | proposed | [movement](systems/movement.md) | `/lab/bench.html?b=movement` |

## Vertical slice · open
The smallest playable version that tests the core assumption.
- Build: ...
- Not now: ...

## Art and audio direction · open

## Current prototype
The repo currently holds a pipeline test, not the game: drag to move, collect yellow coins, dodge red hazards
falling from the top. It exists to check deploys, touch handling and the phone setup. Nothing in it is decided
for the real game.

## Open questions
- Which jam do we enter: the 48-hour Compo (solo, everything made during the jam) or the 72-hour Jam?
  *Default: the 72-hour Jam.*
- Keep the portrait orientation for any theme? *Default: yes, phone in one hand.*
- Session length per run? *Default: 1 to 3 minutes, so a playtest is quick.*

## Decision log
- 2026-10-07: Phaser 3 from a CDN, no build, Netlify, phone first, portrait 720x1280. (Quirin)
- 2026-10-10: Design docs are the source of truth; features start with questions, then a slice scope; mechanics
  get lab benches for side-by-side comparisons. (Quirin)
