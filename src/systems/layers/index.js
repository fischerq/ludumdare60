// The deep layers in order, from the maze picture down into the machine. Each one is a pure module (no
// Phaser) with the same shape: { id, title, subtitle, cols, rows, start, goal, init, open, update, draw }.
// goal is the number of objectives (3 to 5) that win the layer; update returns 'dot', 'objective', 'bonus', 'hit' or
// null.
// Every layer has its own verb and its own enemy (see design/systems/layer-deep.md). Optional: info(st, env) a
// status line under the counter, onHit / onRespawn hooks, drive(st, env) the joystick direction to hold (the
// input layer steers the machine), walkSpeed (tiles/s, else DEEP.walkSpeed), dots: false (no dot counter).
import crt from './crt.js';
import signals from './signals.js';
import vram from './vram.js';
import bus from './bus.js';
import cpu from './cpu.js';
import logic from './logic.js';
import input from './input.js';

export const DEEP_LAYERS = [crt, signals, vram, bus, cpu, logic, input];
