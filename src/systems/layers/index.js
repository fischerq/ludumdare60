// The deep layers in order, from the maze picture down into the machine. Each one is a pure module (no
// Phaser) with the same shape: { id, title, subtitle, cols, rows, start, goal, init, open, update, draw };
// optional: drive(st, env) returns the joystick direction to hold (the input layer steers the machine).
import crt from './crt.js';
import signals from './signals.js';
import vram from './vram.js';

export const DEEP_LAYERS = [crt, signals, vram];
