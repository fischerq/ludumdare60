// The deep layers in order, from the maze picture down into the machine. Each one is a pure module (no
// Phaser) with the same shape: { id, title, subtitle, cols, rows, start, goal, init, open, update, draw }.
// goal is the number of objectives (3 to 5) that win the layer; update returns 'dot', 'objective', 'hit' or null.
// Every layer has its own verb and its own enemy (see design/systems/layer-deep.md). Optional: info(st, env) a
// status line under the counter, onHit / onRespawn hooks, drive(st, env) the joystick direction to hold (the
// input layer steers the machine).
import crt from './crt.js';
import signals from './signals.js';
import ram from './ram.js';
import bus from './bus.js';
import cpu from './cpu.js';
import logic from './logic.js';
import input from './input.js';

export const DEEP_LAYERS = [crt, signals, ram, bus, cpu, logic, input];
