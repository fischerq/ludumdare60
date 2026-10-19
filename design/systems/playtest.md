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
  cabinet), `hall-chase` (read the ghost poster, get out the door), the seven deep layers, the bonus `adder` layer (bot in `tools/playtest/adder.mjs`), and `playthrough`.
- **Hard mode** (`--hard`, decided 2026-10-19): the seven deep layers at `DEEP.hardLevel` (levels, below), as
  DeepScene starts them with the 256 switch on, results in `lab/playtest/results-hard.json` (the lab page shows
  both files). Tune with `--set DEEP.<id>.levels.cap.<key>=v`. `runDeep(s, i, { hard, over })` also takes an override
  object merged over `DEEP.<id>` for one run, so per-layer difficulty levels can be swept the same way later.
- **Levels** (`--levels [n]`, decided 2026-10-19): the deep layers and the adder at every game level 1..n (default
  `DEEP.capLevel`), each level a fresh run with that level's numbers (`src/systems/layers/levels.js`, run i uses
  seed + i at every level), at the noise levels `PLAYTEST.levelNoise` (0.25, 0.5; `--noise` overrides). Reports win
  rate, median time and hits per level, and per run the levels won in a row from level 1 (`reached`). Results in
  `lab/playtest/levels.json`, shown on the lab page. `--from k` starts at level k (`--levels 8 --from 8` tunes the
  cap). The noise list moved from `--levels` to `--noise`. `--set` takes JSON arrays (`...sparkEvery=[1,2]`).
- **Win / loss:** maze and cabinet: clear the maze before game over. Deep layers: all objectives within
  `PLAYTEST.timeCap.deep` (180 s; hits only cost time, as in the game).
  Hall: coins and tap within 90 s; chase: out the door or outlasted, caught loses.
- **Full playthrough** (`playthrough`, extended 2026-10-19 to the whole game): the outer loop from the menu's first
  coin to the credits. Play the maze until cleared (game over costs a coin; out of coins, go up through the cabinet
  to the hall, collect what's left, play on in the cabinet); lamp 1. The seven deep layers in lobby order; the adder
  (its win turns the 256 switch on); the seven deep layers again in hard mode, each win repairing its strip of
  level 256 (`progress.js` and the repair mask wired as in `main.js`); up to the maze, now on level 256, played
  with the same coin and hall loop until it's cleared: the end (credits). Transitions, text boxes, coin drops and
  tap reading time all count. Loses on running out of coins, a stuck layer or 60 minutes. Segments are named after
  what's played (`maze`, `cabinet`, `hall`, layer ids, `adder`, `<id>-hard`, `maze-256`, `cabinet-256`); the
  results also say where each run ended (`reached`).
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
  found, games played, hall visits, median time per segment and where runs ended).

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
- 2026-10-19 (rerun after the RAM/CPU/input rework, coin minigame and bot deaths): win rate at noise 0 / 0.25 /
  0.5 / 0.75 / 1. Maze 100/80/0/0/0, cabinet 100/70/0/0/0 (unchanged: still the hardest part for slow reactions).
  Hall 100/100/100/100/35, chase 100/95/90/35/15. Deep: crt 100/100/100/90/75, ram 100/100/100/75/10,
  bus 100/100/95/20/0, cpu 100/100/95/80/75, logic 100/100/100/70/75, input 100/100/100/100/60 (was 60% even at
  0). Adder 100/100/80/0/0. Every deep layer is cleared at 0.25 in under 30 s median. **Not measured:** the video
  board (signals) bot is out of date since that layer's rework (it calls `inPulse`, and the layer needs a DOM canvas
  for its tile snapshot), and the full playthrough crashes on it, so there is no end-to-end number this round.

- 2026-10-19 (levels, `--levels`, 10 runs per level at noise 0.25 / 0.5): win rate at the cap (level 8): screen
  80/10, video board 100/10, RAM 100/100, bus 80/30, CPU 100/90, logic 100/100, input 100/100, adder 90/0. Level 1
  as before (video board's timer loosened 12 → 16 s: 80% at 0.5, was 35%). RAM, CPU, logic and input can't be pushed
  under 50% at 0.25 with their numbers alone (hits only cost time), so their caps follow time and hits. Details in
  [layer-deep.md](layer-deep.md#levels--decided-built-quirin-2026-10-19-all-defaults-accepted-the-ceiling-should-be-harder).

## Slice scope
- Build: the CLI, the bots, the noise model, the playthrough, the results page.
- Not now: bots in the browser (watching a bot play a layer), CI runs, automatic tuning.

## Decision log
- 2026-10-17: Bots play every layer and the whole game with structured noise; win rate and time to solve per noise
  level; a rerunnable framework checked in. Machine (cabinet) and arcade hall included, and a full playthrough
  with the outer loop. (Quirin; details Claude's defaults)
- 2026-10-19: The video board bot follows the reworked layer (marks, palette, DAC); its tile snapshot renders into a
  small software canvas in `tools/playtest/canvas.mjs` (with the real art from `assets/`), so game and bot share the
  layer code. The playthrough runs the whole game to the credits; `--hard` sweeps the hard blocks (measured, not
  retuned: hard mode is being replaced by per-layer levels). The sim takes a per-run override object
  (`runDeep`/`runLayer`/`runPlaythrough` `over`) for those levels to plug into. (Quirin)
- 2026-10-19: `--levels` sweeps the game levels per layer and noise; `--noise` for the noise list. Levels in every layer,
  endless with a capped ramp; hard mode starts at level 4 (Quirin).
