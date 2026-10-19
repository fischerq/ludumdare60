// Arcade hall rules with no Phaser: grid walking one tile per step, coins, who or what Pac-Man is facing, and the
// ghost visitors chasing Pac-Man with their maze rules once they recognize him.
// Positions are in tiles.

import { HALL } from '../config.js';

export const DIRS = {
  up: { x: 0, y: -1 }, left: { x: -1, y: 0 }, down: { x: 0, y: 1 }, right: { x: 1, y: 0 },
};
const SOLID = '#RBGVYrbgvy=MmD1234%!CcQq|^*+@Okjsunpwhea';

// The same rules walk other rooms too (the board lobby): opts.solid are its blocking map characters, opts.speed
// its walk speed in tiles per second, opts.ghosts its visitor characters.
export function createHall(layout = HALL.layout, { solid = SOLID, speed = HALL.walkSpeed, ghosts = HALL.ghosts } = {}) {
  const h = { rows: layout, w: layout[0].length, h: layout.length, coins: new Set(), npcs: [], got: 0, pac: null, chase: null, solid, speed };
  layout.forEach((row, y) => [...row].forEach((c, x) => {
    if (c === 'o') h.coins.add(`${x},${y}`);
    if (ghosts[c]) h.npcs.push({ name: ghosts[c], x, y, home: { x, y }, dir: 'down', moving: false, from: null, t: 0 });
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

// Walls and furniture; standing visitors block too, but not while they chase (touching one then means caught).
export function blocked(h, x, y) {
  return h.solid.includes(cellAt(h, x, y)) || (!h.chase && !!npcAt(h, x, y));
}

// What Pac-Man faces: { x, y, cell, npc } for the tile in front of him.
export function facing(h) {
  const d = DIRS[h.pac.dir];
  const x = h.pac.x + d.x, y = h.pac.y + d.y;
  return { x, y, cell: cellAt(h, x, y), npc: npcAt(h, x, y) };
}

// Advance by dt seconds while `held` (a direction or null) is pushed. Returns events: { type: 'coin' }, and
// { type: 'door' } when Pac-Man walks into the door during a chase (his way out).
export function stepHall(h, dt, held) {
  const p = h.pac;
  const events = [];
  let left = dt * h.speed; // tiles of movement available this frame
  while (left > 0) {
    if (!p.moving) {
      if (!held) break;
      p.dir = held;
      const d = DIRS[held];
      if (h.chase && cellAt(h, p.x + d.x, p.y + d.y) === 'D') { events.push({ type: 'door' }); break; }
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

// Where an actor (Pac-Man or a visitor) is drawn, in tiles (between tiles while stepping).
export function actorPos(a) {
  if (!a.moving) return { x: a.x, y: a.y };
  return { x: a.from.x + (a.x - a.from.x) * a.t, y: a.from.y + (a.y - a.from.y) * a.t };
}
export const pacPos = (h) => actorPos(h.pac);

// The visitors recognize Pac-Man: each turns to look at him.
export function noticePac(h) {
  const p = h.pac;
  for (const n of h.npcs) {
    const dx = p.x - n.x, dy = p.y - n.y;
    n.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  }
}

export function startChase(h) {
  h.chase = { time: HALL.chase.time, wait: HALL.chase.headStart };
  for (const n of h.npcs) n.dir = 'down';
}

// Everyone back to their machine, calm again.
export function endChase(h) {
  h.chase = null;
  for (const n of h.npcs) Object.assign(n, { x: n.home.x, y: n.home.y, dir: 'down', moving: false, t: 0 });
}

// Where each ghost heads, like in the maze (numbers scaled down for a small room).
function chaseTarget(h, n) {
  const C = HALL.chase, p = h.pac, d = DIRS[p.dir];
  switch (n.name) {
    case 'pinky': return { x: p.x + d.x * C.pinkyAhead, y: p.y + d.y * C.pinkyAhead };
    case 'inky': {
      const b = h.npcs.find((o) => o.name === 'blinky') ?? n;
      const a = { x: p.x + d.x * C.inkyAhead, y: p.y + d.y * C.inkyAhead };
      return { x: 2 * a.x - b.x, y: 2 * a.y - b.y };
    }
    case 'clyde': return Math.hypot(n.x - p.x, n.y - p.y) > C.clydeShy ? p : C.clydeCorner;
    default: return p;
  }
}

// Move the chasing ghosts. Returns events: { type: 'caught' } or { type: 'calm' } when they give up.
export function stepGhosts(h, dt) {
  if (!h.chase) return [];
  h.chase.time -= dt;
  if (h.chase.time <= 0) { endChase(h); return [{ type: 'calm' }]; }
  if (h.chase.wait > 0) { h.chase.wait -= dt; return []; }
  const free = (x, y) => !SOLID.includes(cellAt(h, x, y));
  const back = { up: 'down', down: 'up', left: 'right', right: 'left' };
  for (const n of h.npcs) {
    let left = dt * HALL.chase.speed;
    while (left > 0) {
      if (!n.moving) {
        // At a tile: never turn back unless it's a dead end; take the step closest to the target.
        let options = Object.keys(DIRS).filter((k) => k !== back[n.dir] && free(n.x + DIRS[k].x, n.y + DIRS[k].y));
        if (!options.length) options = Object.keys(DIRS).filter((k) => free(n.x + DIRS[k].x, n.y + DIRS[k].y));
        if (!options.length) break;
        const t = chaseTarget(h, n);
        const dist = (k) => (n.x + DIRS[k].x - t.x) ** 2 + (n.y + DIRS[k].y - t.y) ** 2;
        n.dir = options.reduce((a, b) => (dist(b) < dist(a) ? b : a));
        n.from = { x: n.x, y: n.y };
        n.x += DIRS[n.dir].x; n.y += DIRS[n.dir].y;
        n.moving = true;
        n.t = 0;
      }
      const step = Math.min(left, 1 - n.t);
      n.t += step;
      left -= step;
      if (n.t >= 1) n.moving = false;
    }
  }
  const pp = pacPos(h);
  for (const n of h.npcs) {
    const np = actorPos(n);
    if (Math.abs(np.x - pp.x) + Math.abs(np.y - pp.y) < HALL.chase.catchDistance) return [{ type: 'caught', name: n.name }];
  }
  return [];
}
