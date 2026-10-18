// Board lobby rules with no Phaser (walking and facing come from hall.js): which tile of the auto-joined wires goes
// where, what a map character is, and where Pac-Man stands to talk to a part. Positions are in tiles.

import { LOBBY } from '../config.js';
import { cellAt } from './hall.js';

// Wire tiles join their neighbours: mask bits up 1, right 2, down 4, left 8 (tile `<kind>-<mask>`).
const SIDES = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]];
// What each kind of wire plugs into besides itself: the harness runs to the cabinet's parts and the edge
// connector, the copper traces run between the chips on the board.
const JOINS = { '=': '=mKJDWE', '-': '-VRBCLE' };

export function wireMask(h, x, y) {
  const c = cellAt(h, x, y), joins = JOINS[c];
  if (!joins) return 0;
  let m = 0;
  for (const [dx, dy, bit] of SIDES) {
    if (joins.includes(cellAt(h, x + dx, y + dy))) m |= bit;
  }
  return m;
}

// A ghost's wire to the brain (~): { ghost, dir: 'h' | 'v' } from the brain and the ghost on either side.
export function ghostWire(h, x, y) {
  for (const [dx, dy] of SIDES) {
    const g = LOBBY.ghosts[cellAt(h, x + dx, y + dy)];
    if (g && cellAt(h, x - dx, y - dy) === 'L') return { ghost: g, dir: dx ? 'h' : 'v' };
  }
  return { ghost: 'blinky', dir: 'v' };
}

// The deep layer id of a subsystem's map character, or null.
export const subsystemOf = (c) => LOBBY.subsystems[c] ?? null;

// Every subsystem's tiles: { id: [{ x, y, c }] }.
export function subsystemTiles(h) {
  const out = {};
  h.rows.forEach((row, y) => [...row].forEach((c, x) => {
    const id = subsystemOf(c);
    if (id) (out[id] ??= []).push({ x, y, c });
  }));
  return out;
}

// Where Pac-Man stands to face a subsystem (coming back out of its layer): a free tile next to it, below first.
export function standFor(h, id) {
  const tiles = subsystemTiles(h)[id] ?? [];
  for (const [dx, dy, dir] of [[0, 1, 'up'], [-1, 0, 'right'], [1, 0, 'left'], [0, -1, 'down']]) {
    for (const t of tiles) {
      const x = t.x + dx, y = t.y + dy;
      if (!h.solid.includes(cellAt(h, x, y))) return { x, y, dir };
    }
  }
  return null;
}

// The ghosts beside the brain look at it.
export function ghostFacing(h, x, y) {
  for (const [dx, dy, , dir] of [[0, -2, 0, 'up'], [2, 0, 0, 'right'], [0, 2, 0, 'down'], [-2, 0, 0, 'left']]) {
    if (cellAt(h, x + dx, y + dy) === 'L') return dir;
  }
  return 'down';
}
