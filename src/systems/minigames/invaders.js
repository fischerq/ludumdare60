// Space Invaders, one wave, no Phaser. Positions in art px of the 180x320 view. The cannon follows the finger and
// fires by itself, one shot on screen at a time; the march speeds up as invaders die. The mini-Gurke crosses the
// top once (like the mystery ship) when only a few are left.

import { MINI } from '../../config.js';

const I = MINI.invaders;

export function createInvaders(rand = Math.random) {
  const g = {
    rand, score: 0, lives: I.lives, over: null, gurke: false,
    cannon: { x: MINI.w / 2, dead: 0 }, shot: null, bombs: [], booms: [], aliens: [],
    dir: 1, stepT: I.stepSlow, frame: 0, bombT: I.bombEvery, ufo: null, ufoDone: false,
  };
  for (let r = 0; r < I.rows; r++) {
    for (let c = 0; c < I.cols; c++) g.aliens.push({ x: I.left + c * I.dx, y: I.top + r * I.dy, kind: I.kinds[r], alive: true });
  }
  return g;
}

// input: { x } the finger's x (or null), { move } -1/0/1 from the keyboard. Returns sound events.
export function stepInvaders(g, dt, input) {
  const ev = [], alive = g.aliens.filter((a) => a.alive);
  g.booms = g.booms.filter((b) => (b.t -= dt) > 0);

  // The cannon: back after a hit, then under the finger.
  const c = g.cannon;
  if (c.dead > 0) c.dead -= dt;
  else {
    const want = input.x ?? c.x + input.move * I.cannonSpeed;
    c.x += Math.max(-I.cannonSpeed * dt, Math.min(I.cannonSpeed * dt, want - c.x));
    c.x = Math.max(8, Math.min(MINI.w - 8, c.x));
    if (!g.shot) { g.shot = { x: Math.round(c.x), y: I.cannonY - 6 }; ev.push('shoot'); }
  }

  // March: one step sideways, or down and turn around at the edge.
  g.stepT -= dt;
  if (g.stepT <= 0) {
    g.stepT = I.stepFast + (I.stepSlow - I.stepFast) * (alive.length - 1) / (g.aliens.length - 1);
    const xs = alive.map((a) => a.x + g.dir * I.stepX);
    if (Math.min(...xs) < I.margin || Math.max(...xs) + I.alienW > MINI.w - I.margin) {
      alive.forEach((a) => { a.y += I.drop; });
      g.dir = -g.dir;
    } else alive.forEach((a) => { a.x += g.dir * I.stepX; });
    g.frame ^= 1;
  }

  // The lowest invader of a random column drops a bomb.
  g.bombT -= dt;
  if (g.bombT <= 0 && alive.length) {
    g.bombT = I.bombEvery * (0.6 + 0.8 * g.rand());
    const pick = alive[Math.floor(g.rand() * alive.length)];
    const low = alive.filter((a) => a.x === pick.x).reduce((a, b) => (b.y > a.y ? b : a));
    g.bombs.push({ x: low.x + I.alienW / 2, y: low.y + I.alienH });
  }

  if (g.shot) {
    const s = g.shot;
    s.y -= I.shotSpeed * dt;
    const hit = alive.find((a) => s.x >= a.x && s.x < a.x + I.alienW && s.y >= a.y && s.y < a.y + I.alienH + 4);
    if (hit) {
      hit.alive = false; g.score += I.points[hit.kind]; g.shot = null;
      g.booms.push({ x: hit.x, y: hit.y, t: 0.25 }); ev.push('hit');
    } else if (g.ufo && Math.abs(s.x - g.ufo.x) < 8 && Math.abs(s.y - g.ufo.y) < 6) {
      g.score += I.gurkePoints; g.gurke = true; g.shot = null; g.booms.push({ x: g.ufo.x - 6, y: g.ufo.y - 4, t: 0.4 }); g.ufo = null;
      ev.push('gurke');
    } else if (s.y < MINI.top) g.shot = null;
  }

  // The mini-Gurke flies over once.
  if (!g.ufoDone && alive.length <= I.gurkeAt) { g.ufo = { x: -10, y: I.gurkeY }; g.ufoDone = true; }
  if (g.ufo) { g.ufo.x += I.gurkeSpeed * dt; if (g.ufo.x > MINI.w + 10) g.ufo = null; }

  for (const b of g.bombs) b.y += I.bombSpeed * dt;
  if (c.dead <= 0 && g.bombs.some((b) => Math.abs(b.x - c.x) < 7 && b.y > I.cannonY - 4 && b.y < I.cannonY + 6)) {
    g.lives -= 1; g.bombs = []; c.dead = I.respawn; ev.push('death');
    if (g.lives <= 0) g.over = 'lose';
  }
  g.bombs = g.bombs.filter((b) => b.y < MINI.bottom);

  if (!g.aliens.some((a) => a.alive)) g.over = 'win';
  else if (alive.some((a) => a.y + I.alienH >= I.cannonY - 4)) { g.over = 'lose'; ev.push('death'); }
  return ev;
}
