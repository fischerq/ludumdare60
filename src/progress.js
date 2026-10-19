// Which subsystems inside the cabinet are won, for this session only (no localStorage: a reload starts over).
// The deep layers unlock one at a time, outside in, in DEEP_LAYERS order: the first is always open, winning one
// (its LAYER CLEAR) opens the next. Ids are the layer ids (crt, signals, ram, bus, cpu, logic, input).

import { DEEP_LAYERS } from './systems/layers/index.js';

export const ORDER = DEEP_LAYERS.map((L) => L.id);
const won = new Set();

export const isWon = (id) => won.has(id);

// The first opens once the maze was won (lamp 1), every other once the one before it is won.
export function isUnlocked(id) {
  const i = ORDER.indexOf(id);
  return i === 0 ? mazeWon : i > 0 && won.has(ORDER[i - 1]);
}

export const allWon = () => ORDER.every((id) => won.has(id));

// Mark a layer won. Returns the id it newly unlocked (null if none: the last one, or won before).
export function markWon(id) {
  if (!ORDER.includes(id) || won.has(id)) return null;
  won.add(id);
  const next = ORDER[ORDER.indexOf(id) + 1];
  return next && isUnlocked(next) && !won.has(next) ? next : null;
}

// For testing (?won=n): the first n layers won.
export function setWonCount(n) {
  won.clear();
  mazeWon = true;
  ORDER.slice(0, n).forEach((id) => won.add(id));
}

// The bonus layer (the round counter's adder) shows once every subsystem is won. Winning it flips the 256 switch
// next to it on, and from then on the switch can be flipped by hand: on, the maze plays level 256.
let mazeWon = false, adderWon = false, switchOn = false;
export const isAdderWon = () => adderWon;
export const isSwitchOn = () => switchOn;
export function markAdderWon() { adderWon = true; switchOn = true; }
export function setSwitch(on) { if (adderWon) switchOn = !!on; }

// ---- The four status lamps in the lobby (each has a cheat lever under it that flips its achievement) ----
// 1 maze won once (wakes the first subsystem, the screen), 2 every subsystem won, 3 the 256 switch unlocked (the
// adder won), 4 every subsystem won again in hard mode, which makes level 256 winnable. Listeners hear every change
// (the machine applies the level 256 repairs from here, so a lever and a real win act the same).
const listeners = new Set();
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const changed = () => listeners.forEach((fn) => fn());

export const isMazeWon = () => mazeWon;
export function markMazeWon() { if (!mazeWon) { mazeWon = true; changed(); } }

// Hard mode: while the 256 switch is on, the deep layers play their hard variant. Winning one repairs a share of
// level 256; all of them make it winnable.
const hardWon = new Set();
export const isHard = () => switchOn;
export const isHardWon = (id) => hardWon.has(id);
export const hardWonCount = () => ORDER.filter((id) => hardWon.has(id)).length;
export const allHardWon = () => ORDER.every((id) => hardWon.has(id));
export function markHardWon(id) {
  if (!ORDER.includes(id) || hardWon.has(id)) return false;
  hardWon.add(id); changed(); return true;
}

// The lamp states and their levers. Setting a lamp on also sets what it needs (lamp 3 on means lamp 2 and 1 too);
// setting it off clears what needs it.
export const lamps = () => [mazeWon, allWon(), adderWon, allHardWon()];
export function setLamp(i, on) {
  if (on) {
    if (i >= 0) mazeWon = true;
    if (i >= 1) ORDER.forEach((id) => won.add(id));
    if (i >= 2) { adderWon = true; switchOn = true; }
    if (i >= 3) ORDER.forEach((id) => hardWon.add(id));
  } else {
    if (i <= 3) hardWon.clear();
    if (i <= 2) { adderWon = false; switchOn = false; }
    if (i <= 1) won.clear();
    if (i <= 0) mazeWon = false;
  }
  changed();
}
