# Layer: the arcade hall (zoom out further)

**Status:** proposed (questions open)
**Parent:** [layers](layers.md) · [master](../master.md)
**Lab bench:** none yet
**Code:** none yet

## Purpose
One layer above the [cabinet](layer-cabinet.md): we pull back from the machine and see the arcade shop it
stands in. Pac-Man himself walks around the hall, seen from above like a classic Pokémon game (top-down,
slightly tilted, tile-based). Theme: Old Tech, the arcade as a place.

## Rules · proposed (from Quirin's first idea, to iterate)
- Top-down "RPG" view at pixel-art resolution: a tile map of the arcade hall (floor, walls, rows of cabinets,
  a counter, a change machine, maybe a door to the street). Built from a tileset in its own folder
  (`assets/arcade/`), like the maze.
- Pac-Man walks around on the grid, one tile per step with a walk animation in four directions.
- Our cabinet is one of the machines in the hall; walking up to it and interacting zooms back into the cabinet
  layer (and LAYER DOWN does the same).

## Open questions
1. **What is there to do?** Explore and talk to people, find things (coins, the mini-gurke), or a real
   objective? *Default: a small goal, collect coins scattered in the hall to play our cabinet, plus a few
   characters with one line of text each.*
2. **Who else is in the hall?** *Default: the four ghosts as arcade visitors (in a human-ish disguise), each
   standing at another machine with one line of dialogue.*
3. **Controls:** swipe to step (like the maze), or hold-to-walk with a virtual d-pad? *Default: hold a finger
   down and drag in a direction to keep walking, tap to talk/interact.*
4. **Grid movement:** strict tile steps (Pokémon) or smooth? *Default: strict tile steps, 4 directions.*
5. **Size of the hall:** one screen or a scrolling map? *Default: about 1.5 screens tall, camera follows Pac-Man.*
6. **Scale:** sprites and tiles at 16 px shown at 2x (like the other layers), and the cabinets in the hall are
   small tile versions of our cabinet? *Default: yes, 16 px tiles at 2x; cabinets are 1x2 tiles.*
7. **Transition from the cabinet:** zoom out again (cabinet shrinks into the hall), as between maze and cabinet?
   *Default: yes, pixel-size zoom from the cabinet to its spot in the hall.*
8. **Text boxes:** classic RPG text box at the bottom for dialogue and hints? *Default: yes, pixel font, tap to
   continue.*

## Decision log
- 2026-10-17: Another layer up: a Pokémon-like top-down view of Pac-Man walking around the arcade shop. (Quirin)
