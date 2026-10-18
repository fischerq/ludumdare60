// Which subsystems inside the cabinet are won, for this session only (no localStorage: a reload starts over).
// The deep layers unlock one at a time, outside in, in DEEP_LAYERS order: the first is always open, winning one
// (its LAYER CLEAR) opens the next. Ids are the layer ids (crt, signals, ram, bus, cpu, logic, input).

import { DEEP_LAYERS } from './systems/layers/index.js';

export const ORDER = DEEP_LAYERS.map((L) => L.id);
const won = new Set();

export const isWon = (id) => won.has(id);

// Open when it's the first one or the one before it is won.
export function isUnlocked(id) {
  const i = ORDER.indexOf(id);
  return i === 0 || (i > 0 && won.has(ORDER[i - 1]));
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
  ORDER.slice(0, n).forEach((id) => won.add(id));
}

// The bonus layer (the round counter's adder) shows once every subsystem is won. Winning it flips the 256 switch
// next to it on, and from then on the switch can be flipped by hand: on, the maze plays level 256.
let adderWon = false, switchOn = false;
export const isAdderWon = () => adderWon;
export const isSwitchOn = () => switchOn;
export function markAdderWon() { adderWon = true; switchOn = true; }
export function setSwitch(on) { if (adderWon) switchOn = !!on; }
