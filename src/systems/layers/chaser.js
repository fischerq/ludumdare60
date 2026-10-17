// An enemy that hunts a target on a layer's grid (no Phaser): walks tile to tile like the player and, at every
// tile center, takes the first step of a shortest path to the target (breadth-first search over open tiles).
// Positions in tiles, centers at integers.

import { STEP } from './walker.js';

export const createChaser = (x, y) => ({ x, y, dir: null });

// First step ('up', ...) of a shortest path from (x, y) to (tx, ty), or null when it can't be reached.
export function firstStep(x, y, tx, ty, open, cols, rows) {
  if (x === tx && y === ty) return null;
  const from = new Map([[y * cols + x, null]]);
  const queue = [[x, y]];
  for (let head = 0; head < queue.length; head++) {
    const [cx, cy] = queue[head];
    for (const [name, [dx, dy]] of Object.entries(STEP)) {
      const nx = cx + dx, ny = cy + dy, k = ny * cols + nx;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || from.has(k) || !open(nx, ny)) continue;
      from.set(k, (cx === x && cy === y) ? name : from.get(cy * cols + cx));
      if (nx === tx && ny === ty) return from.get(k);
      queue.push([nx, ny]);
    }
  }
  return null;
}

// Moves the chaser dist tiles toward (tx, ty).
export function stepChaser(c, dist, open, tx, ty, cols, rows) {
  for (let guard = 0; dist > 1e-6 && guard < 20; guard++) {
    if (Math.abs(c.x - Math.round(c.x)) < 1e-6 && Math.abs(c.y - Math.round(c.y)) < 1e-6) {
      c.x = Math.round(c.x); c.y = Math.round(c.y);
      c.dir = firstStep(c.x, c.y, Math.round(tx), Math.round(ty), open, cols, rows);
      if (!c.dir) return;
    }
    const [dx, dy] = STEP[c.dir];
    const pos = dx ? c.x : c.y, frac = pos - Math.floor(pos);
    const toCenter = frac < 1e-6 ? 1 : (dx + dy > 0 ? 1 - frac : frac);
    const s = Math.min(dist, toCenter);
    c.x += dx * s; c.y += dy * s; dist -= s;
    if (s >= toCenter - 1e-6) { c.x = Math.round(c.x); c.y = Math.round(c.y); }
  }
}

export const touching = (a, b, r = 0.7) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) < r;
