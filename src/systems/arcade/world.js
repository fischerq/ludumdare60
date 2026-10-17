// The one emulated machine every layer looks at (no Phaser). It keeps running at the board's frame rate
// whichever scene is showing; scenes only read it and press its inputs. main.js ticks it from the game loop.

import { ARCADE } from '../../config.js';
import { loadZ80 } from './z80.js';
import { createMachine } from './machine.js';

export const world = {
  machine: null,
  program: null,     // { rom, symbols, listing } once assembled
  ready: null,       // promise, set by startWorld()
  paused: false,
  acc: 0,            // ms not yet run
  listeners: new Set(),
};

// Creates the machine once. loadProgram() returns { rom, symbols, listing } (or null for an empty ROM).
export function startWorld(loadProgram = async () => null) {
  world.ready ??= (async () => {
    const [Z80, program] = await Promise.all([loadZ80(), loadProgram()]);
    world.program = program;
    world.machine = createMachine(Z80, { rom: program?.rom });
    return world;
  })();
  return world.ready;
}

// Advance by ms of real time in whole frames. Each frame's sound latch writes go to the listeners.
export function tickWorld(ms) {
  const m = world.machine;
  if (!m || world.paused) return;
  const frameMs = 1000 / ARCADE.frameHz;
  world.acc = Math.min(world.acc + ms, frameMs * ARCADE.maxFramesPerTick);
  while (world.acc >= frameMs) {
    world.acc -= frameMs;
    m.runFrame();
    const sounds = m.takeSounds();
    for (const fn of world.listeners) fn(m, sounds);
  }
}

// fn(machine, sounds) after every frame; returns an unsubscribe function.
export function onFrame(fn) {
  world.listeners.add(fn);
  return () => world.listeners.delete(fn);
}

export function pauseWorld(paused) {
  world.paused = paused;
  world.acc = 0;
}
