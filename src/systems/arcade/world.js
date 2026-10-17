// The one emulated machine every layer looks at (no Phaser). It keeps running at the board's frame rate
// whichever scene is showing; scenes only read it and press its inputs. main.js ticks it from the game loop.

import { ARCADE } from '../../config.js';
import { loadZ80 } from './z80.js';
import { createMachine } from './machine.js';
import { IN0, IN1, DSW } from './memmap.js';
import { botDirection } from './bot.js';
import { PHASES } from './state.js';

export const world = {
  machine: null,
  program: null,     // { rom, symbols, listing } once assembled
  ready: null,       // promise, set by startWorld()
  paused: false,
  // Game over: the board waits for a coin and runs no frames (no attract mode) until one goes in.
  halted: false,
  // Nobody at the controls (the cabinet layer shows the machine from outside): no frames, the picture stands
  // still until someone goes back in. Unlike halted, the game in progress is kept.
  frozen: false,
  speed: 1,          // machine time per real time; the deep layers slow it down (DEEP.machineSlowdown)
  acc: 0,            // ms not yet run
  listeners: new Set(),
  // What the player (or the bot) does with the controls: a swipe pulses a direction for a few frames, a held
  // stick holds one, START is pressed for a few frames.
  input: { held: null, pulse: null, pulseFrames: 0, start: 0, coin: 0 },
  // Who steers Pac-Man: 'player' while the maze layer (or the cabinet) is showing, otherwise the 'bot'.
  driver: 'bot',
};

// The bot plays with the demo dip switch on, so its deaths don't cost the player's lives.
export function setDriver(driver) {
  world.driver = driver;
  world.input.held = null;
  world.machine?.setDip(DSW.demo, driver === 'bot');
}

// Power-cycles the machine and starts a fresh game (the program needs a few frames to boot).
export function newGame() {
  const m = world.machine;
  m.cpu.reset();
  m.irqOn = false;
  world.halted = false;
  world.input.start = 12;
}

const PULSE_FRAMES = 2;
export const pressDir = (dir) => { world.input.pulse = dir; world.input.pulseFrames = PULSE_FRAMES; };
export const holdDir = (dir) => { world.input.held = dir; };
export const pressStart = () => { world.input.start = PULSE_FRAMES; };
export const insertCoin = () => { world.halted = false; world.input.coin = PULSE_FRAMES; };
export const setSpeed = (speed) => { world.speed = speed; };
export const setFrozen = (frozen) => { world.frozen = frozen; world.acc = 0; };

// Sets the joystick and start bits for the next frame.
function applyInput(m) {
  const inp = world.input;
  const dir = inp.pulseFrames > 0 ? inp.pulse : inp.held;
  if (inp.pulseFrames > 0) inp.pulseFrames--;
  for (const d of ['up', 'left', 'down', 'right']) m.setInput(0, IN0[d], d === dir);
  m.setInput(1, IN1.start, inp.start > 0);
  if (inp.start > 0) inp.start--;
  m.setInput(0, IN0.coin, inp.coin > 0);
  if (inp.coin > 0) inp.coin--;
}

// Creates the machine once. loadProgram() returns { rom, symbols, listing } (or null for an empty ROM).
export function startWorld(loadProgram = async () => null) {
  world.ready ??= (async () => {
    const [Z80, program] = await Promise.all([loadZ80(), loadProgram()]);
    world.program = program;
    world.machine = createMachine(Z80, { rom: program?.rom });
    setDriver(world.driver);
    return world;
  })();
  return world.ready;
}

// Advance by ms of real time in whole frames. Each frame's sound latch writes go to the listeners.
export function tickWorld(ms) {
  const m = world.machine;
  if (!m || world.paused || world.halted || world.frozen) return;
  const frameMs = 1000 / ARCADE.frameHz;
  world.acc = Math.min(world.acc + ms * world.speed, frameMs * ARCADE.maxFramesPerTick);
  while (world.acc >= frameMs && !world.halted) {
    world.acc -= frameMs;
    if (world.driver === 'bot') botStep(m);
    applyInput(m);
    m.runFrame(world.trace ? traceStep : undefined);
    if (world.trace?.steps.length) { world.trace.done(world.trace.steps); world.trace = null; }
    const sounds = m.takeSounds();
    for (const fn of world.listeners) fn(m, sounds);
    const S = world.program?.symbols;
    if (S && PHASES[m.read(S.PHASE)] === 'over') { world.halted = true; world.acc = 0; }
  }
}

// The bot holds the joystick toward its goal, and presses START after a clear (a game over halts the board).
function botStep(m) {
  const S = world.program.symbols;
  const phase = PHASES[m.read(S.PHASE)];
  if ((phase === 'attract' || phase === 'cleared') && !world.input.start) pressStart();
  world.input.held = botDirection(m, S);
}

// Records the first n instructions of the next frame (PC, registers, flags) and hands them to done(steps).
// Only for the CPU layer: reading the registers after every instruction is too slow to do all the time.
export function requestTrace(n, done) {
  world.trace = { n, steps: [], done };
}
function traceStep(m) {
  const tr = world.trace;
  if (!tr || tr.steps.length >= tr.n) return;
  const c = m.cpu.getState();
  tr.steps.push({ pc: c.pc, sp: c.sp, a: c.a, f: c.flags, b: c.b, c: c.c, d: c.d, e: c.e, h: c.h, l: c.l });
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
