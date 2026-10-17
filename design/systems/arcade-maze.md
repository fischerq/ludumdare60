# Arcade maze game

**Status:** open (questions asked 2026-10-17)
**Parent:** [master](../master.md)
**Lab bench:** none yet
**Code:** none yet

## Purpose
The front door of the game: an arcade-styled maze-chomper in the spirit of Pac-Man. Everything else (the
[layers](layers.md)) starts from here and reuses its characters and mechanics.

## Rules · open
Classic loop, to be confirmed: move through a maze, eat all dots, avoid ghosts, power pellets turn ghosts
edible for a while, clear the maze to finish. Numbers will live in `src/config.js`.

## Feel · open
Should read as a real arcade machine on a phone held upright. Turning has to feel responsive with a thumb.

## Slice scope · open
To be written once the questions below are answered.

## Open questions
1. **Name and look:** our own homage (own name, own sprites, own maze) or as close to Pac-Man as possible?
   *Default: own homage, recognisably Pac-Man-like, to stay clear of trademark and copyright.*
2. **Controls on the phone:** swipe anywhere to queue the next turn, an on-screen D-pad, or drag-to-steer
   (the current prototype)? *Default: swipe anywhere, with the turn buffered until it fits; arrow keys on laptops.*
3. **Screen layout:** maze in the upper part with a cabinet bezel / control panel below (room for a D-pad and
   later "open the machine" hooks), or maze fills the screen? *Default: maze plus cabinet frame, since the
   cabinet is the first layer we peel away.*
4. **Maze size:** classic 28x31 tiles (small on a phone) or a smaller maze? *Default: about 19x21 tiles, so
   tiles are ~36 px wide and readable.*
5. **Ghosts:** how many, and how smart for the first slice? *Default: 4 ghosts with the classic
   chase/scatter idea but simplified targeting; frightened mode on power pellets.*
6. **Run length:** the master says 1 to 3 minutes. One maze clear, or lives + score until game over?
   *Default: 3 lives, one maze; clearing it is the hook into the first layer.*
7. **Sound:** in the first slice or later? *Default: later; a few WebAudio bleeps once it plays well.*
8. **Code shape:** pure maze/ghost logic in `src/systems/` (so a bench and later the "show the code" layer can
   reuse it), Phaser scene only draws? *Default: yes.*

## Decision log
- 2026-10-17: Start the game with an arcade-styled maze-chomper (Pac-Man style). (Quirin)
