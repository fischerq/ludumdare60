// Asteroids, one field of rocks, no Phaser. Positions in art px; the field wraps around. Hold a finger down and the
// ship turns toward it, thrusts and fires; a tap fires once. One big rock hides the mini-Gurke: shoot it open, then
// fly into the Gurke to pick it up.

import { MINI } from '../../config.js';

const A = MINI.asteroids;
const H = () => MINI.bottom - MINI.top; // field height

export function createAsteroids(rand = Math.random) {
  const g = {
    rand, score: 0, lives: A.lives, over: null, gurke: false, gurkeOut: null, shots: [], rocks: [], booms: [],
    ship: { x: MINI.w / 2, y: MINI.top + H() / 2, vx: 0, vy: 0, a: 0, inv: A.invulnerable, fireT: 0, thrust: false },
  };
  // The rocks start in the corners, drifting in random directions.
  const spots = [[20, 20], [MINI.w - 20, 20], [20, H() - 20], [MINI.w - 20, H() - 20]];
  for (let i = 0; i < A.rocks; i++) {
    const [x, y] = spots[i % 4];
    g.rocks.push(rock(g, x, MINI.top + y, 0));
  }
  g.rocks[Math.floor(rand() * g.rocks.length)].gurke = true;
  return g;
}

function rock(g, x, y, size) {
  const d = g.rand() * Math.PI * 2, v = A.speed[size] * (0.7 + 0.6 * g.rand());
  return { x, y, vx: Math.cos(d) * v, vy: Math.sin(d) * v, size, gurke: false };
}

function wrap(o) {
  o.x = (o.x + MINI.w) % MINI.w;
  o.y = MINI.top + (((o.y - MINI.top) % H()) + H()) % H();
}

// Shortest offset from a to b on the wrapping field.
function off(a, b) {
  let dx = b.x - a.x, dy = b.y - a.y;
  if (dx > MINI.w / 2) dx -= MINI.w; if (dx < -MINI.w / 2) dx += MINI.w;
  if (dy > H() / 2) dy -= H(); if (dy < -H() / 2) dy += H();
  return { dx, dy };
}

// The ship sprite for its angle: games/ast-ship-<n>, clockwise from up.
export const shipFrame = (a) => ((Math.round(a / (Math.PI * 2) * A.dirs) % A.dirs) + A.dirs) % A.dirs;

// input: { aim } a finger point (or null), { fire } a tap this frame, { turn } -1/0/1 and { thrust } from the
// keyboard. Returns sound events.
export function stepAsteroids(g, dt, input) {
  const ev = [], s = g.ship;
  g.booms = g.booms.filter((b) => (b.t -= dt) > 0);
  let turn = input.turn, thrust = input.thrust, fire = input.fire;
  if (input.aim) {
    const { dx, dy } = off(s, input.aim);
    let d = Math.atan2(dx, -dy) - s.a;
    d = ((d + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    turn = Math.abs(d) < A.turnSpeed * dt ? d / (A.turnSpeed * dt) : Math.sign(d);
    thrust = Math.hypot(dx, dy) > 12;
    fire = fire || s.fireT <= 0;
  }
  s.a += turn * A.turnSpeed * dt;
  s.thrust = thrust;
  if (thrust) { s.vx += Math.sin(s.a) * A.accel * dt; s.vy -= Math.cos(s.a) * A.accel * dt; }
  const k = Math.exp(-A.drag * dt);
  s.vx *= k; s.vy *= k;
  const v = Math.hypot(s.vx, s.vy);
  if (v > A.maxSpeed) { s.vx *= A.maxSpeed / v; s.vy *= A.maxSpeed / v; }
  s.x += s.vx * dt; s.y += s.vy * dt;
  wrap(s);
  s.inv -= dt;
  s.fireT -= dt;
  if (fire && s.fireT <= 0 && g.shots.length < A.maxShots) {
    s.fireT = A.fireEvery;
    g.shots.push({ x: s.x + Math.sin(s.a) * 6, y: s.y - Math.cos(s.a) * 6, vx: Math.sin(s.a) * A.shotSpeed + s.vx, vy: -Math.cos(s.a) * A.shotSpeed + s.vy, t: A.shotLife });
    ev.push('shoot');
  }

  for (const r of g.rocks) { r.x += r.vx * dt; r.y += r.vy * dt; wrap(r); }
  if (g.gurkeOut) { const o = g.gurkeOut; o.x += o.vx * dt; o.y += o.vy * dt; wrap(o); }

  for (const sh of g.shots) {
    sh.x += sh.vx * dt; sh.y += sh.vy * dt; sh.t -= dt; wrap(sh);
    const hit = g.rocks.find((r) => { const o = off(r, sh); return Math.hypot(o.dx, o.dy) < A.radius[r.size]; });
    if (!hit) continue;
    sh.t = 0;
    g.rocks.splice(g.rocks.indexOf(hit), 1);
    g.score += A.points[hit.size];
    g.booms.push({ x: hit.x, y: hit.y, t: 0.3 });
    ev.push('boom');
    if (hit.size < 2) g.rocks.push(rock(g, hit.x, hit.y, hit.size + 1), rock(g, hit.x, hit.y, hit.size + 1));
    if (hit.gurke) {
      const d = g.rand() * Math.PI * 2;
      g.gurkeOut = { x: hit.x, y: hit.y, vx: Math.cos(d) * A.gurkeSpeed, vy: Math.sin(d) * A.gurkeSpeed };
    }
  }
  g.shots = g.shots.filter((sh) => sh.t > 0);

  if (g.gurkeOut) {
    const o = off(s, g.gurkeOut);
    if (Math.hypot(o.dx, o.dy) < A.shipRadius + 5) { g.gurke = true; g.gurkeOut = null; g.score += A.gurkePoints; ev.push('gurke'); }
  }

  if (s.inv <= 0 && g.rocks.some((r) => { const o = off(s, r); return Math.hypot(o.dx, o.dy) < A.radius[r.size] + A.shipRadius; })) {
    g.lives -= 1;
    g.booms.push({ x: s.x, y: s.y, t: 0.5 });
    ev.push('death');
    Object.assign(s, { x: MINI.w / 2, y: MINI.top + H() / 2, vx: 0, vy: 0, a: 0, inv: A.invulnerable });
    if (g.lives <= 0) g.over = 'lose';
  }
  if (!g.rocks.length) g.over = 'win';
  return ev;
}
