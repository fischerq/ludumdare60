// The player in the deep layers (no Phaser): walks a grid one tile at a time like Pac-Man, takes the wanted
// direction at the next tile center where it's open, stops at walls. Positions in tiles, centers at integers.

export const STEP = { up: [0, -1], left: [-1, 0], down: [0, 1], right: [1, 0] };
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

export const createWalker = (x, y) => ({ x, y, dir: null, next: null });

export function steerWalker(w, dir) {
  w.next = dir;
  if (w.dir && dir === OPPOSITE[w.dir]) w.dir = dir; // reversing works at once
}

// Moves the walker dist tiles; open(x, y) says whether a tile can be entered.
export function stepWalker(w, dist, open) {
  for (let guard = 0; dist > 1e-6 && guard < 20; guard++) {
    const atCenter = Math.abs(w.x - Math.round(w.x)) < 1e-6 && Math.abs(w.y - Math.round(w.y)) < 1e-6;
    if (atCenter) {
      w.x = Math.round(w.x); w.y = Math.round(w.y);
      if (w.next && open(w.x + STEP[w.next][0], w.y + STEP[w.next][1])) w.dir = w.next;
      if (!w.dir || !open(w.x + STEP[w.dir][0], w.y + STEP[w.dir][1])) return;
    }
    const [dx, dy] = STEP[w.dir];
    const pos = dx ? w.x : w.y, frac = pos - Math.floor(pos);
    const toCenter = frac < 1e-6 ? 1 : (dx + dy > 0 ? 1 - frac : frac);
    const s = Math.min(dist, toCenter);
    w.x += dx * s; w.y += dy * s; dist -= s;
    if (s >= toCenter - 1e-6) { w.x = Math.round(w.x); w.y = Math.round(w.y); }
  }
}
