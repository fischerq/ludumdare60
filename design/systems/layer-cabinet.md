# Layer: the cabinet (zoom out)

**Status:** proposed (ideas, not built)
**Parent:** [layers](layers.md) · [master](../master.md)
**Lab bench:** none yet
**Code:** none yet

## Purpose
One layer up from the [maze game](arcade-maze.md): we step back and see the whole arcade machine. Same game on
its screen, but now played through the machine's physical controls. Theme: Old Tech, the cabinet.

## Rules · proposed (from Quirin's first ideas, to iterate)
- A 3D-looking view of an arcade cabinet: screen, control panel, joystick, coin slot.
- The maze game runs on the cabinet's screen, the same code and picture as the first level.
- Controls are different: instead of swiping anywhere, you move the cabinet's **joystick** (drag the ball top).
  The real Pac-Man stick is a 4-way joystick with microswitches and a restrictor gate: it clicks into four
  directions, and diagonals don't exist.
- Ideas to pick from: insert a coin to get credits (= lives); the view changes (camera angle, glare on the glass,
  you can't see the whole screen); the stick has throw and lag, or a worn-out microswitch; the machine shakes or
  the picture rolls if you bang it.

## Feel · open
Should it feel like standing at the machine (first person, low angle) or like looking at it on a table?

## Slice scope · open
To be written once the questions are answered.

## Open questions
1. **How 3D:** a pre-drawn 2.5D cabinet with the game drawn flat into the screen, a fake perspective (Phaser's
   Plane/Mesh), or real 3D (three.js from a pinned CDN, with the game as a texture)? *Default: fake perspective
   in Phaser, no new library; it's the cheapest in tokens.*
2. **Joystick on the phone:** drag the ball top in the 3D view, or a big on-screen stick at the bottom drawn
   like the real one? *Default: big stick at the bottom, styled like the cabinet's, with click feedback.*
3. **Camera:** fixed angle, or does it move (e.g. you start far away and walk up)? *Default: fixed, with a short
   zoom-out transition from the first level.*
4. **What makes it harder or different:** coins, glare, stick lag, worn switch, view angle? *Default: coins +
   4-way stick only for the first slice.*
5. **Order:** is this the layer after the first level, with the CRT layer after it, or are both reachable from
   the maze? *Default: maze → zoom out (cabinet) → zoom in (screen); one path.*
6. **Mini-gurke:** stuck under the joystick or in the coin return? *Default: in the coin return.*

## Decision log
- 2026-10-17: Zoom-out layer idea: a 3D arcade machine with screen and mechanical controls, the same game on the
  screen, but controls and view are different. (Quirin)
