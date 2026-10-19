// The snow globe's glitter with no Phaser: specks in the water inside the glass sphere. Turning the globe spins the
// water, which throws the glitter around; then it slowly sinks back to the bottom. Positions are in art px relative
// to the sphere's center, in the globe's own frame (they turn with it).

import { HALL } from '../config.js';

export function createGlobe(cfg = HALL.globe, rand = Math.random) {
  const g = { cfg, angle: 0, spin: 0, stir: 0, specks: [], rand };
  for (let i = 0; i < cfg.count; i++) {
    // Start settled: lying in the bottom of the sphere.
    const a = Math.PI * (0.25 + 0.5 * rand()), r = cfg.radius * (0.75 + 0.25 * rand());
    g.specks.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, vx: 0, vy: 0, color: cfg.colors[i % cfg.colors.length] });
  }
  return g;
}

// Turn the globe to `angle` (rad, clamped to maxTilt): the water spins with the turn, and every turn, either way,
// stirs it up (so shaking it back and forth makes the glitter fly).
export function turnGlobe(g, angle) {
  const a = Math.max(-g.cfg.maxTilt, Math.min(g.cfg.maxTilt, angle));
  g.spin += (a - g.angle) * g.cfg.swirl;
  g.stir += Math.abs(a - g.angle) * g.cfg.stir;
  g.angle = a;
}

// A shake: a burst of swirl.
export function shakeGlobe(g, amount = g.cfg.tapShake) {
  g.spin += amount * (g.rand() < 0.5 ? -1 : 1);
  g.stir += amount;
}

// Advance by dt seconds. `held`: the globe is being turned by hand (else it rights itself).
export function stepGlobe(g, dt, held = false) {
  const c = g.cfg, R = c.radius;
  if (!held) g.angle -= g.angle * Math.min(1, c.springBack * dt);
  // Gravity points down on screen, so in the turned globe's frame it leans the other way.
  const gx = Math.sin(g.angle) * c.gravity, gy = Math.cos(g.angle) * c.gravity;
  const w = g.spin, chaos = c.jitter * (Math.abs(w) + g.stir);
  for (const s of g.specks) {
    const r = Math.hypot(s.x, s.y) || 1;
    // The spinning water pushes each speck around the center, faster near the glass, plus a little chaos.
    const swirl = w * r;
    s.vx += (-s.y / r * swirl + (g.rand() - 0.5) * chaos) * dt;
    s.vy += (s.x / r * swirl + (g.rand() - 0.5) * chaos) * dt;
    s.vx += (gx - s.vx * c.drag) * dt;
    s.vy += (gy - s.vy * c.drag) * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    // Stay inside the glass: slide along it.
    const d = Math.hypot(s.x, s.y);
    if (d > R) {
      const nx = s.x / d, ny = s.y / d, vn = s.vx * nx + s.vy * ny;
      s.x = nx * R; s.y = ny * R;
      if (vn > 0) { s.vx -= vn * nx; s.vy -= vn * ny; }
    }
  }
  g.spin -= g.spin * Math.min(1, c.drag * 0.6 * dt);
  g.stir -= g.stir * Math.min(1, c.drag * dt);
}

// How much glitter is still moving (0 settled), for a sound or a hint.
export const globeStir = (g) => Math.abs(g.spin) + g.stir;
