# The deep layers (below the maze)

**Status:** first slices built 2026-10-17, mechanics and feel to be tuned
**Parent:** [layers](layers.md) · [emulator](emulator.md) · [master](../master.md)
**Lab bench:** none yet
**Code:** scene `src/scenes/DeepScene.js` (one scene for all of them, `?scene=Deep`), rules per layer in
`src/systems/layers/<id>.js` (no Phaser), the walking player in `src/systems/layers/walker.js`, numbers in
`DEEP` in `src/config.js`.

## Purpose
Going down from the maze game, each layer is a view of the one emulated machine that runs it (see
[emulator](emulator.md)), from the picture tube down to the input wires. Gameplay in a layer may stylize,
slow down or aggregate, but everything comes from the machine's real raw data.

## Shared rules · decided (Claude, defaults accepted by Quirin)
- Same controls as the maze: swipe to walk a grid one tile at a time (`DEEP.walkSpeed`).
- Each layer has a goal (eat N things). Reaching it opens LAYER DOWN; LAYER UP always works. With
  `CHEATS.enabled` every layer is open.
- A hit flashes the player and puts it back at the start (`DEEP.hitPause`); hits are only counted.
- While the player is down here, the bot plays the maze game on the machine, so the data keeps moving.
- Moving between layers zooms and fades (`DEEP.transition`).

## Layer -1: inside the screen (CRT) · built
The maze picture magnified to its phosphor: walls and dots from VRAM, ghosts from the sprite registers. A
beam sweeps the picture row by row, slowed from 16.5 ms to `DEEP.crt.beamPeriod`. Rows glow after it passes
and fade (`decay`); a dot can be eaten only while it glows (`litAbove`). The beam only fires where the
picture is lit, so standing on an uneaten dot when it arrives is a hit; black floor is safe, and so is the
vertical blank (`vblank`), when the beam flies back switched off. Ghost sprites are always a hit. Dots the
machine's Pac-Man eats vanish here too. Goal: 25 dots.

## Decision log
- 2026-10-17: One scene for all deep layers with a pure module per layer; first slices of all seven layers
  from the Gemini chat's mapping, adapted so each is playable on a phone. (Claude)
- 2026-10-17: CRT: the beam is only deadly where the picture is lit, otherwise no spot would be safe. (Claude)
