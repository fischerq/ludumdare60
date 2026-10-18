# Bonus layer: the adder (the round counter's +1)

**Status:** decided, first slice built (2026-10-18)
**Parent:** [layers](layers.md) (inside the cabinet: the bonus layer) · [master](../master.md)
**Lab bench:** none yet (the playtest bot covers it: `node tools/playtest.mjs --layers adder`)
**Code:** scene `src/scenes/AdderScene.js` (`?scene=Adder`), rules `src/systems/layers/adder.js` (no Phaser),
numbers in `ADDER` in `src/config.js`, art `assets/deep/adder/` (drawn in `makeAdder` in `BootScene`), bot
`tools/playtest/adder.mjs`

## Purpose
The level 256 glitch comes from one tiny piece of hardware: the round counter is one byte, and adding 1 to 255
(11111111) overflows it to 0. This layer is that add, done physically by an 8-bit ripple-carry adder, and you are
the carry. Winning it is what triggers level 256 (the lobby's "256" switch, see [layers](layers.md)).

## Rules · decided (Quirin, defaults accepted)
- **The board:** 8 full-adder stages stacked, bit 0 at the bottom, bit 7 at the top, `ADDER.cols` (11) tiles
  across. Each stage, from the bottom: its **CIN row** (safe, labelled `BIT n  A=1 B=0 CIN=...` and its sum bit
  `S=1`), its **wire lanes** (`ADDER.lanes[bit]`, 2 at bit 0 up to 4 at bit 7, named after the stage's signals:
  A, P, G, CIN), and its **gate row**: the full adder's five gates in a chip.
- **The add:** the counter holds 255, so every stage adds A=1 and B=0; the +1 comes in as bit 0's carry.
  Gates: P = A XOR B, G = A AND B, S = P XOR CIN, P AND CIN, COUT = G OR (P AND CIN). Each gate tile shows its
  output: **a gate at 1 lets the carry through, a gate at 0 and the chip between the gates block.** Once the carry
  is in a stage, its XOR (P), the AND (P AND CIN) and the OR (COUT) are at 1: three ways through. Stages the carry
  hasn't reached show their state before it: the sum XOR at 1, the carry path at 0.
- **Lanes:** pulses (deadly, `DEEP.hazard` red) run along each wire like cars, wrapping around; every lane has its
  own direction (alternating), speed (`ADDER.speed` from bit 0 to bit 7, each lane off by up to
  `speedJitter`), pulse lengths (`pulse`, 1 to 3 tiles) and gaps (`gap`, narrower higher up). Seeded per run.
- **Controls:** tap hops up, a swipe hops that way (left, right, back down), arrows / WASD / space on a keyboard.
  One hop per tile (`hopTime`), one more hop can be queued. Hops into the chip, a gate at 0 or off the board bump.
- **The camera** follows the carry up and down (`camLead`, `camEase`), like Crossy Road.
- **Hits:** a pulse touching the carry (`hitbox` tiles wide; mid-hop it counts on the new row after half the hop)
  flashes it (`hitPause`) and puts it back on the CIN row of the stage it's in (the checkpoint). No game over; hits
  are counted.
- **Ripple:** reaching the next stage's CIN row flips the stage's sum bit to 0 and moves the checkpoint up. The
  fixed readout at the top shows the byte live, bit 7 first, and its value: 255, then 254, 252, 248, ... as the
  carry ripples up (what the register holds mid-add).
- **Win:** past bit 7's gate row is the OVERFLOW row: the carry has nowhere to go and falls out of the register;
  the byte wraps to 00000000, callout "OVERFLOW! 11111111 + 1 = 00000000 LEVEL 256", then after
  `overflowTime` the layer ends.
- **Ending (the API for the lobby):** `scene.start('Adder', { returnTo, returnData, onWin, seed })`. On the win it
  calls `onWin({ hits, time })`, emits `'win'` on the scene's events and `'adder-win'` on `game.events` with the
  same result, then starts `returnTo` (default `'Game'` with `{ continue: true }`). LAYER UP goes to the same
  place without the win.

## Look · decided
The deep layers' Tron pixel style with its own colors (`ADDER.style`: neon yellow on near-black, the flipped bits
cyan). Art in `assets/deep/adder/`, one file per state, colors drawn in: `carry-0`, `carry-1` (idle glow),
`carry-hop`, `carry-hit`; pulse tiles `pulse-single`, `pulse-body`, `pulse-head-left/right` (its front),
`pulse-tail-left/right` (its back); `gate-<xor|and|or>-<0|1>`; `chip`. Wires, floor grid and labels are drawn in
code.

## Feel
Short and readable: about 1 to 2 minutes for someone who knows the game, a hit costs a few seconds, never the run.
The lanes should read as wires with signals on them, the gates as the add going on. Wrong: lanes too fast to read
on a phone, or a gate row that looks like it should be passable when it isn't.

## Slice scope
- Build: the board with 8 stages, lanes, gate rows with real gate outputs, tap/swipe hops, the camera, hits back
  to the stage's checkpoint, the live byte readout, the overflow moment, the win callback/event and return,
  LAYER UP, the art, a playtest bot.
- Not now: wiring into the lobby (the other slice: it starts the scene with `returnTo` and listens for the
  win), reading the real round counter from the machine, a background sound bed (`setBed('adder')` has none yet),
  a lab bench.

## Playtest
`node tools/playtest.mjs --layers adder` (bot in `tools/playtest/adder.mjs`: it plans hops a few seconds ahead in a
time-expanded search, every hop costs its mean reaction time). 2026-10-18, 10 runs per level, after easing the top
lanes (`speed` 1.4 to 3.0, `gap` at bit 7 from 2.2): noise 0 wins 100% in 19 s; 0.25 wins 100% in 52 s (6 hits);
0.5 wins 80% in 100 s (23 hits); 0.75 never within the 180 s cap. Read 0.25 to 0.5 as a player who knows the game:
1 to 2 minutes, as asked. Most hits come from late or sideways swipes in a lane.

## Open questions
- Should the board show the gates' wiring (P into the XOR and the AND, the AND into the OR)? *Default: no, the
  labels and outputs carry it.*

## Decision log
- 2026-10-18: Bonus layer for the round counter's 8-bit +1, played like Crossy Road: you are the carry, 8 full-adder
  stages bottom to top, pulses on the wires as traffic, gates at 1 let you through, a hit sends you back to the
  stage's start (no game over), the overflow ends it with a callback for the lobby. (Quirin, defaults accepted)
- 2026-10-18: Tuned with the bot: top lanes a bit slower and wider (speed 1.4 to 3.0 tiles/s, gap at bit 7 2.2 to 4.5). (Claude)
