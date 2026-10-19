// Hard mode for the deep layers (no Phaser). While the lobby's 256 switch is on, a layer plays with its
// DEEP.<id>.hard block merged over its numbers: the layer modules read DEEP.<id> live, so the numbers are swapped
// in place when a layer starts and put back when it starts in normal mode. Bots and benches never call this.

import { DEEP } from '../../config.js';

const normal = {}; // per layer: its normal values of the keys its hard block overrides

export function setHard(id, on) {
  const C = DEEP[id], H = C?.hard;
  if (!H) return;
  normal[id] ??= Object.fromEntries(Object.keys(H).map((k) => [k, C[k]]));
  Object.assign(C, on ? H : normal[id]);
}
