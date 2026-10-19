// Levels for the deep layers and the adder (no Phaser). Level 1 plays a layer's own numbers (DEEP.<id>, ADDER);
// each level after that moves every number named in the layer's `levels.cap` block a step towards its cap value,
// reaching it at `levels.capLevel` (default DEEP.capLevel) and staying there for every level past it, so the
// endless run never becomes unwinnable. Nothing changes inside a level. Hard mode starts at DEEP.hardLevel.
// The game and the playtest bots use the same helper; see design/systems/layer-deep.md#levels.

import { DEEP, ADDER } from '../../config.js';

const lerp = (a, b, k) => (Array.isArray(a) ? a.map((v, i) => lerp(v, b[i], k)) : a + (b - a) * k);
const round = (v) => (Array.isArray(v) ? v.map(round) : +v.toFixed(3));

// The ramp's share at level n: 0 at level 1, 1 at capLevel and past it.
export function rampAt(levels, n) {
  const cap = levels?.capLevel ?? DEEP.capLevel;
  return cap > 1 ? Math.min(1, Math.max(0, (n - 1) / (cap - 1))) : 1;
}

// The numbers a block plays at level n: { key: value } for every key of block.levels.cap. base: the level-1
// numbers (default the block itself).
export function levelNumbers(block, n, base = block) {
  const L = block?.levels;
  if (!L?.cap) return {};
  const k = rampAt(L, n);
  return Object.fromEntries(Object.entries(L.cap).map(([key, cap]) => [key, round(lerp(base[key], cap, k))]));
}

// Play deep layer id at level n: its ramped numbers are swapped into DEEP.<id> in place (the layer modules read
// them live), and setLevel(id, 1) puts the normal numbers back. DeepScene calls it on every start.
const normal = {}; // per layer: its level-1 values of the keys its ramp changes
export function setLevel(id, n) {
  const C = DEEP[id];
  if (!C?.levels?.cap) return;
  normal[id] ??= structuredClone(Object.fromEntries(Object.keys(C.levels.cap).map((k) => [k, C[k]])));
  Object.assign(C, n <= 1 ? structuredClone(normal[id]) : levelNumbers(C, n, normal[id]));
}

// The adder's config at level n (a copy of ADDER with its ramped numbers; createAdder takes it).
export const adderConfig = (n) => ({ ...ADDER, ...levelNumbers(ADDER, n) });

// The level a deep layer starts at: 1, or DEEP.hardLevel in hard mode.
export const startLevel = (hard) => (hard ? DEEP.hardLevel : 1);
