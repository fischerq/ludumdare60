# Playtest bots

**Status:** first version built (Claude, Quirin's defaults), numbers to calibrate against real playtests
**Parent:** [master](../master.md)
**Lab bench:** results page `/lab/playtest.html` (charts `lab/playtest/results.json`)
**Code:** `tools/playtest.mjs` (CLI), `tools/playtest/` (`sim.mjs` runners, `bots.mjs` bots, `noise.mjs` noise
model, `plan.mjs` grid search), numbers in `PLAYTEST` in `src/config.js`

## Purpose
Measure how hard each layer is without waiting for a human: a bot solves the layer, then the same bot plays it
with structured human noise at rising amounts. Win rate and time to solve per noise level show the difficulty
curve, and a rerun after a balance change shows what the change did.

## Rules · decided (defaults accepted, 2026-10-17)
- **Runs headless in Node** on the real game code: the emulated machine (`world.js`), the layer modules, the hall
  rules and the wallet; a fixed 60 Hz step. Nothing is reimplemented except the scenes' glue (hits, respawn,
  objectives, as in `DeepScene.update`).
- **What's tested** (`--layers`): `maze` (swipes), `cabinet` (held stick), `hall` (collect every coin, tap our
  cabinet), `hall-chase` (talk to the angry ghost, get out the door), the seven deep layers, and `playthrough`.
- **Win / loss:** maze and cabinet: clear the maze before game over. Deep layers: all objectives within
  `PLAYTEST.timeCap.deep` (180 s; hits only cost time, as in the game; the input layer also loses on game over).
  Hall: coins and tap within 90 s; chase: out the door or outlasted, caught loses.
- **Full playthrough** (`playthrough`): the outer loop from the menu's first coin. Play the maze until cleared; game
  over costs a coin; out of coins, go up through the cabinet to the hall, collect what's left, play on in the
  cabinet. Then go down and clear all seven deep layers in order. A game over in the input layer goes back up for
  a coin. Transitions, text boxes, coin drops and tap reading time all count. Loses on running out of coins, a
  stuck layer or 40 minutes.
- **Bots** see what the player sees (positions, the beam, packets, lit cells, door states), never the machine's
  future. Each deep bot is a target list plus a "blocked at time eta" test; a breadth-first search finds the
  nearest safe target, else the plain path while its next tile is safe, else the safest neighbor. The maze bot
  races the ghosts: a tile is safe if Pac-Man (after his reaction time, planning from where he'll be when the
  swipe lands) gets there 0.25 s before any hunting ghost could.
- **Noise model** (`PLAYTEST.noise`, values at level 1, linear in the level): reaction delay 0.45 s (jittered
  ±50%), 20% of swipes dropped, 12% go 90° off, 0.15 attention lapses per second of 0.7 s. One swipe at a time; a
  dropped or wrong swipe is noticed and repeated after another reaction time. `--knob reaction|slip|lapse`
  sweeps one knob alone. Text boxes take `PLAYTEST.readTime` (0.6 s) plus a reaction to tap away.
- **Seeds:** run i uses seed + i at every level (same machine warm-up, same layer randomness), so levels compare
  like for like. Deep runs start after a seeded 0 to 20 s of the machine playing itself.
- **Output:** a table on the console and `lab/playtest/results.json` (per layer and level: win rate, time to
  solve p25/median/p75 over wins, hits or deaths, swipes per second, outcome counts; playthrough also coins
  found, games played, hall visits and median time per segment).

## How to use it
`node tools/playtest.mjs --quick` for a look (5 runs), `node tools/playtest.mjs` for the full sweep (20 runs,
a few minutes), `--layers bus,input --verbose` while tuning one layer. Commit the results file when the balance
changes so the lab page shows the current state.

## Calibration · open
The noise levels are not yet tied to real players. Next playtest: note which layers Quirin and Max clear and how
long they take, and find the noise level that matches. *Default: until then, read level 0.25 to 0.5 as "a
player who knows the game".*

## Findings
- 2026-10-17 (first runs): the maze is very sensitive to reaction time: the bot clears it every time with no
  delay, but loses almost every game once its reaction passes about 0.2 s. The bus layer's VRAM room is
  nearly locked: its door only opens on VRAM cycles, a read cycle sends its packet out through the one-tile
  approach (head-on, can't be passed), and VRAM write cycles are about 1% of all cycles (ROM is never written,
  so the ROM room needs a lucky read). No bot run finishes the bus layer in 180 s, so the full playthrough never
  reaches the bottom: with no noise it always stops at the bus; at 0.25 it runs out of coins or gets stuck in the
  screen layer (which it clears on its own every time, so the machine state after a maze clear makes it harder);
  from 0.5 up it never clears the maze with the 1 + 5 coins there are. Easiest: the CPU (100% at every level),
  logic and video RAM. Full numbers on the lab page.
- 2026-10-17 (after the balance round: maze ghosts 5.05, turn window 0.7, 4 lives; bus reads wait 1.3 s): maze
  at noise 0.25 cleared 80% (was 20%), cabinet 70% (was 30%); bus 100% / 100% / 75% at noise 0 / 0.25 / 0.5 (was 0%
  everywhere). The full playthrough now reaches the bottom: 85% with no noise, about 6 minutes (the input layer is
  the rest). At 0.25 it still fails on time caps (logic, bus) and coins; from 0.5 up the maze bot can't clear the
  maze with the coins there are, which is the bot's limit as much as the maze's.

## Slice scope
- Build: the CLI, the bots, the noise model, the playthrough, the results page.
- Not now: bots in the browser (watching a bot play a layer), CI runs, automatic tuning.

## Decision log
- 2026-10-17: Bots play every layer and the whole game with structured noise; win rate and time to solve per noise
  level; a rerunnable framework checked in. Machine (cabinet) and arcade hall included, and a full playthrough
  with the outer loop. (Quirin; details Claude's defaults)
