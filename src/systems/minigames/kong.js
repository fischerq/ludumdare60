// Donkey Kong, one girder screen, no Phaser. Positions in art px; y is the feet (a girder's top). Walk left and
// right, climb the ladders, jump the barrels Kong rolls down; reach the top girder. The mini-Gurke lies at the
// right end of the second girder from the top, right where the barrels fall.

import { MINI } from '../../config.js';

const K = MINI.kong;
const TOP = K.floors.length - 1;

export function createKong() {
  return {
    score: 0, lives: K.lives, over: null, gurke: false, barrels: [], throwT: K.firstThrow, throwing: 0,
    man: start(),
  };
}

function start() {
  return { x: K.left + 12, y: K.floors[0], floor: 0, vy: 0, air: false, climb: null, dir: 1, walk: 0, dead: 0 };
}

const ladderAt = (x, from) => K.ladders.find((l) => l.from === from && Math.abs(l.x - x) <= K.ladderGrab);

// input: { dir } 'left' | 'right' | 'up' | 'down' | null held, { jump } a tap this frame. Returns sound events.
export function stepKong(g, dt, input) {
  const ev = [], m = g.man;
  if (m.dead > 0) {
    m.dead -= dt;
    if (m.dead <= 0) { if (g.lives <= 0) g.over = 'lose'; else { g.man = start(); g.barrels = []; } }
    return ev;
  }

  if (m.climb) {
    // On a ladder: up and down only; at either end, step off onto that girder.
    const l = m.climb, lo = K.floors[l.from], hi = K.floors[l.from + 1];
    const v = input.dir === 'up' ? -1 : input.dir === 'down' ? 1 : 0;
    m.y += v * K.climbSpeed * dt;
    if (v) m.walk += dt;
    if (m.y <= hi) { m.y = hi; m.floor = l.from + 1; m.climb = null; }
    else if (m.y >= lo) { m.y = lo; m.floor = l.from; m.climb = null; }
  } else {
    if (!m.air && input.dir === 'up' && ladderAt(m.x, m.floor)) { m.climb = ladderAt(m.x, m.floor); m.x = m.climb.x; }
    else if (!m.air && input.dir === 'down' && m.floor > 0 && ladderAt(m.x, m.floor - 1)) {
      m.climb = ladderAt(m.x, m.floor - 1); m.x = m.climb.x; m.y += 1;
    } else {
      const v = input.dir === 'left' ? -1 : input.dir === 'right' ? 1 : 0;
      if (v) { m.dir = v; m.walk += dt; }
      m.x = Math.max(K.left + 4, Math.min(K.right - 4, m.x + v * K.walkSpeed * dt));
      if (input.jump && !m.air) { m.air = true; m.vy = -K.jumpSpeed; ev.push('jump'); }
      if (m.air) {
        m.vy += K.gravity * dt; m.y += m.vy * dt;
        if (m.y >= K.floors[m.floor]) { m.y = K.floors[m.floor]; m.air = false; }
      }
    }
  }
  if (m.floor === TOP && !m.climb) { g.over = 'win'; return ev; }

  // Kong throws a barrel now and then; it rolls to the girder's end, drops to the next one and rolls back.
  g.throwing = Math.max(0, g.throwing - dt);
  g.throwT -= dt;
  if (g.throwT <= 0) {
    g.throwT = K.throwEvery;
    g.throwing = 0.4;
    g.barrels.push({ x: K.kongX + 14, y: K.floors[TOP], floor: TOP, vx: K.barrelSpeed, vy: 0, fall: false, spin: 0, jumped: false });
  }
  for (const b of g.barrels) {
    b.spin += dt * 8;
    if (b.fall) {
      b.vy += K.barrelFall * dt; b.y += b.vy * dt;
      if (b.floor >= 0 && b.y >= K.floors[b.floor]) { b.y = K.floors[b.floor]; b.fall = false; b.vx = -b.vx; b.x += Math.sign(b.vx) * 6; }
    } else {
      b.x += b.vx * dt;
      if (b.x > K.right || b.x < K.left) { b.fall = true; b.vy = 0; b.floor -= 1; }
    }
  }
  g.barrels = g.barrels.filter((b) => b.y < MINI.h);

  // A barrel touching Jumpman; one passing under him in a jump scores.
  for (const b of g.barrels) {
    const dx = Math.abs(b.x - m.x), dy = (b.y - 5) - (m.y - 7);
    if (dx < 7 && Math.abs(dy) < 10) { g.lives -= 1; m.dead = K.respawn; ev.push('death'); return ev; }
    if (m.air && !b.jumped && !b.fall && dx < 4 && b.y > m.y && b.floor === m.floor) { b.jumped = true; g.score += K.jumpPoints; ev.push('hit'); }
  }
  if (!g.gurke && m.floor === K.gurkeFloor && !m.climb && Math.abs(m.x - K.gurkeX) < 8) {
    g.gurke = true; g.score += K.gurkePoints; ev.push('gurke');
  }
  return ev;
}
