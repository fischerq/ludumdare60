// Arcade hall rules with no Phaser: grid walking one tile per step, coins, who or what Pac-Man is facing.
// Positions are in tiles.

import { HALL } from '../config.js';

export const DIRS = {
  up: { x: 0, y: -1 }, left: { x: -1, y: 0 }, down: { x: 0, y: 1 }, right: { x: 1, y: 0 },
};
const SOLID = '#RBGVYrbgvy=MmD';

export function createHall(layout = HALL.layout) {
  const h = { rows: layout, w: layout[0].length, h: layout.length, coins: new Set(), npcs: [], got: 0, pac: null };
  layout.forEach((row, y) => [...row].forEach((c, x) => {
    if (c === 'o') h.coins.add(`${x},${y}`);
    if (HALL.ghosts[c]) h.npcs.push({ name: HALL.ghosts[c], x, y });
    if (c === 'S') h.pac = { x, y, dir: 'up', moving: false, from: null, t: 0, steps: 0 };
  }));
  return h;
}

export function cellAt(h, x, y) {
  return h.rows[y]?.[x] ?? '#';
}

export function npcAt(h, x, y) {
  return h.npcs.find((n) => n.x === x && n.y === y) ?? null;
}

export function blocked(h, x, y) {
  return SOLID.includes(cellAt(h, x, y)) || !!npcAt(h, x, y);
}

// What Pac-Man faces: { x, y, cell, npc } for the tile in front of him.
export function facing(h) {
  const d = DIRS[h.pac.dir];
  const x = h.pac.x + d.x, y = h.pac.y + d.y;
  return { x, y, cell: cellAt(h, x, y), npc: npcAt(h, x, y) };
}

// Advance by dt seconds while `held` (a direction or null) is pushed. Returns events: { type: 'coin' }.
export function stepHall(h, dt, held) {
  const p = h.pac;
  const events = [];
  let left = dt * HALL.walkSpeed; // tiles of movement available this frame
  while (left > 0) {
    if (!p.moving) {
      if (!held) break;
      p.dir = held;
      const d = DIRS[held];
      if (blocked(h, p.x + d.x, p.y + d.y)) break;
      p.from = { x: p.x, y: p.y };
      p.x += d.x; p.y += d.y;
      p.moving = true;
      p.t = 0;
    }
    const step = Math.min(left, 1 - p.t);
    p.t += step;
    left -= step;
    if (p.t >= 1) {
      p.moving = false;
      p.steps += 1;
      const k = `${p.x},${p.y}`;
      if (h.coins.delete(k)) { h.got += 1; events.push({ type: 'coin', x: p.x, y: p.y }); }
    }
  }
  return events;
}

// Where Pac-Man is drawn, in tiles (between tiles while stepping).
export function pacPos(h) {
  const p = h.pac;
  if (!p.moving) return { x: p.x, y: p.y };
  return { x: p.from.x + (p.x - p.from.x) * p.t, y: p.from.y + (p.y - p.from.y) * p.t };
}
