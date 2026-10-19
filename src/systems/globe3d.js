// The 3D snow globe with no Phaser: a rigid globe turning about its glass center, pulled upright by its heavy base,
// with water inside that lags behind the glass, glitter flakes that ride the water and sink, and a mane and tail of
// bead chains floating in it. Units are art px; world x right, y up, z toward you. The model is
// src/settings/globe-model.json; src/systems/globeRender.js draws it.

import { HALL } from '../config.js';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// The rotation matrix (row-major) of unit quaternion q = [w, x, y, z]: local (the globe's frame) to world.
export function quatMatrix([w, x, y, z]) {
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
    2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
    2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y),
  ];
}
export const toWorld = (m, p) => [m[0] * p[0] + m[1] * p[1] + m[2] * p[2], m[3] * p[0] + m[4] * p[1] + m[5] * p[2], m[6] * p[0] + m[7] * p[1] + m[8] * p[2]];
export const toLocal = (m, p) => [m[0] * p[0] + m[3] * p[1] + m[6] * p[2], m[1] * p[0] + m[4] * p[1] + m[7] * p[2], m[2] * p[0] + m[5] * p[1] + m[8] * p[2]];

// `n` points spread evenly along a polyline.
function resample(path, n) {
  const segs = path.slice(1).map((p, i) => len([p[0] - path[i][0], p[1] - path[i][1], p[2] - path[i][2]]));
  const total = segs.reduce((a, b) => a + b, 0), out = [];
  for (let k = 0; k < n; k++) {
    let d = (total * k) / (n - 1), i = 0;
    while (i < segs.length - 1 && d > segs[i]) d -= segs[i++];
    out.push(lerp(path[i], path[i + 1], Math.min(1, d / (segs[i] || 1))));
  }
  return out;
}

// The model file as spheres (the unicorn), strands (rest shapes), the snowy mound and the base.
export function buildModel(json) {
  const off = json.offset ?? [0, 0, 0], at = (p, m = 1) => [p[0] + off[0], p[1] + off[1], p[2] * m + off[2]];
  const spheres = [];
  for (const s of json.shapes) {
    for (const m of s.mirror ? [1, -1] : [1]) {
      if (s.at) { spheres.push({ p: at(s.at, m), r: s.r, part: s.part }); continue; }
      const [r0, r1 = r0] = [].concat(s.r), a = at(s.from, m), b = at(s.to, m);
      const n = Math.max(1, Math.ceil(len([b[0] - a[0], b[1] - a[1], b[2] - a[2]]) / (Math.min(r0, r1) * 0.5)));
      for (let i = 0; i <= n; i++) spheres.push({ p: lerp(a, b, i / n), r: r0 + ((r1 - r0) * i) / n, part: s.part });
    }
  }
  const strands = json.strands.map((s) => ({ part: s.part, r: s.r ?? json.strandR, rest: resample(s.path.map((p) => at(p)), s.beads) }));
  return { glassR: json.glassR, mound: json.mound, base: json.base, spheres, strands };
}

const randUnit = (rand) => {
  const z = rand() * 2 - 1, a = rand() * Math.PI * 2, s = Math.sqrt(1 - z * z);
  return [Math.cos(a) * s, Math.sin(a) * s, z];
};

export function createGlobe3d(model, cfg = HALL.globe3d, rand = Math.random) {
  const g = {
    model, cfg, rand, q: [1, 0, 0, 0], w: [0, 0, 0], water: [0, 0, 0], stir: 0,
    jolt: { x: 0, y: 0, vx: 0, vy: 0 }, grab: null, torque: [0, 0, 0], flakes: [],
  };
  // Glitter starts settled on the snow.
  const { center: mc, r: mr } = model.mound;
  for (let i = 0; i < cfg.flakes; i++) {
    const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * (model.glassR - 12), x = Math.cos(a) * d, z = Math.sin(a) * d;
    const y = mc[1] + Math.sqrt(Math.max(0, mr * mr - (x - mc[0]) ** 2 - (z - mc[2]) ** 2)) + 0.5;
    g.flakes.push({ p: [x, y, z], v: [0, 0, 0], ph: rand() * Math.PI * 2, color: i % cfg.glitterColors, sink: 0.7 + 0.6 * rand() });
  }
  g.strands = model.strands.map((s) => ({
    ...s, p: s.rest.map((p) => p.slice()), prev: s.rest.map((p) => p.slice()),
    seg: s.rest.map((p, i) => (i ? len([p[0] - s.rest[i - 1][0], p[1] - s.rest[i - 1][1], p[2] - s.rest[i - 1][2]]) : 0)),
  }));
  return g;
}

// A finger lands on world point `pt` (on the globe's surface, see pickGlobe): hold that spot of the globe.
export function grabGlobe3d(g, pt) {
  const m = quatMatrix(g.q);
  g.grab = { local: toLocal(m, pt), r: len(pt), sign: pt[2] >= 0 ? 1 : -1, target: pt.slice() };
}

// The finger is at world x, y: the held spot is pulled toward the point under it at the same distance from the
// center (or the nearest one on the outline, when the finger is off the globe).
export function dragGlobe3d(g, x, y) {
  const gr = g.grab;
  if (!gr) return;
  const d2 = x * x + y * y, r2 = gr.r * gr.r;
  if (d2 >= r2) { const s = gr.r / Math.sqrt(d2); gr.target = [x * s, y * s, 0]; } else gr.target = [x, y, gr.sign * Math.sqrt(r2 - d2)];
}

export const releaseGlobe3d = (g) => { g.grab = null; };

// A tap: a jolt, a little spin, and the water churns.
export function shakeGlobe3d(g) {
  const c = g.cfg, s = randUnit(g.rand), w = randUnit(g.rand);
  for (let i = 0; i < 3; i++) { g.w[i] += s[i] * c.tapSpin; g.water[i] += w[i] * c.tapSwirl; }
  g.stir += c.tapStir;
  const a = g.rand() * Math.PI * 2;
  g.jolt.vx += Math.cos(a) * c.jolt;
  g.jolt.vy += Math.sin(a) * c.jolt;
}

// Advance by dt seconds (in fixed substeps, so it behaves the same at any frame rate).
export function stepGlobe3d(g, dt) {
  const n = Math.max(1, Math.ceil(dt * g.cfg.substepRate)), h = dt / n;
  for (let i = 0; i < n; i++) substep(g, h);
}

function substep(g, h) {
  const c = g.cfg, R = g.model.glassR, m = quatMatrix(g.q), w = g.w;
  // The heavy base: the center of mass sits below the glass center, so gravity turns it upright.
  const down = toWorld(m, [0, -1, 0]), tau = cross(down, [0, -c.weight, 0]);
  if (g.grab) {
    const pw = toWorld(m, g.grab.local), v = cross(w, pw);
    const f = [0, 1, 2].map((i) => c.grabSpring * (g.grab.target[i] - pw[i]) - c.grabDamp * v[i]);
    const t = cross(pw, f);
    for (let i = 0; i < 3; i++) tau[i] += t[i];
  }
  const damp = g.grab ? c.dampHeld : c.damp;
  for (let i = 0; i < 3; i++) w[i] += (tau[i] + g.torque[i] - damp * w[i]) * h;
  const spin = len(w);
  if (spin > c.maxSpin) for (let i = 0; i < 3; i++) w[i] *= c.maxSpin / spin;
  // dq/dt = ½ (0, w) q, with w in world space.
  const [qw, qx, qy, qz] = g.q, k = 0.5 * h;
  const q = [qw + k * (-w[0] * qx - w[1] * qy - w[2] * qz), qx + k * (w[0] * qw + w[1] * qz - w[2] * qy),
    qy + k * (w[1] * qw + w[2] * qx - w[0] * qz), qz + k * (w[2] * qw + w[0] * qy - w[1] * qx)];
  const ql = Math.hypot(...q);
  g.q = q.map((v) => v / ql);
  // The water lags behind the glass; the difference stirs it up.
  const lag = [0, 1, 2].map((i) => w[i] - g.water[i]);
  for (let i = 0; i < 3; i++) g.water[i] += lag[i] * Math.min(1, c.waterFollow * h);
  g.stir += len(lag) * c.stirRate * h;
  g.stir -= g.stir * Math.min(1, c.stirDecay * h);
  const j = g.jolt;
  j.vx += (-c.joltSpring * j.x - c.joltDamp * j.vx) * h; j.x += j.vx * h;
  j.vy += (-c.joltSpring * j.y - c.joltDamp * j.vy) * h; j.y += j.vy * h;

  // Everything inside moves in the globe's own frame: there, gravity turns with the globe and the water flows
  // around the center at the speed it lags behind the glass.
  const m2 = quatMatrix(g.q), gl = toLocal(m2, [0, -1, 0]), rel = toLocal(m2, [-lag[0], -lag[1], -lag[2]]);
  const { center: mc, r: mr } = g.model.mound, rin = R - 1.5, kick = c.jitter * g.stir * h, rand = g.rand;
  for (const f of g.flakes) {
    const p = f.p, v = f.v, vw = cross(rel, p), follow = Math.min(1, c.flakeDrag * h);
    for (let i = 0; i < 3; i++) {
      v[i] += (vw[i] + gl[i] * c.sink * f.sink - v[i]) * follow + (rand() - 0.5) * 2 * kick;
      p[i] += v[i] * h;
    }
    contain(p, v, rin, mc, mr + 0.5, h);
    f.ph += len(v) * c.tumble * h;
  }
  for (const s of g.strands) {
    const { p, prev, rest, seg } = s;
    for (let b = 1; b < p.length; b++) {
      const pb = p[b], vw = cross(rel, pb), np = [];
      for (let i = 0; i < 3; i++) {
        const v = (pb[i] - prev[b][i]) / h;
        const a = gl[i] * c.hairSink + (vw[i] - v) * c.hairDrag + (rest[b][i] - pb[i]) * c.hairStiff;
        np.push(pb[i] + v * h + a * h * h);
      }
      prev[b] = pb;
      p[b] = np;
    }
    for (let it = 0; it < 2; it++) {
      for (let b = 1; b < p.length; b++) {
        const d = [0, 1, 2].map((i) => p[b][i] - p[b - 1][i]), dl = len(d) || 1, e = (dl - seg[b]) / dl;
        const share = b === 1 ? 1 : 0.5;
        for (let i = 0; i < 3; i++) { p[b][i] -= d[i] * e * share; if (b > 1) p[b - 1][i] += d[i] * e * share; }
      }
    }
    for (let b = 1; b < p.length; b++) { const d = len(p[b]); if (d > rin) p[b] = p[b].map((x) => (x * rin) / d); }
  }
}

// Keep a point inside the glass and above the snow, sliding along them.
function contain(p, v, rin, mc, mr, h) {
  const d = len(p);
  if (d > rin) {
    const nrm = p.map((x) => x / d), vn = dot(v, nrm);
    for (let i = 0; i < 3; i++) { p[i] = nrm[i] * rin; if (vn > 0) v[i] -= vn * nrm[i]; }
  }
  const o = [p[0] - mc[0], p[1] - mc[1], p[2] - mc[2]], od = len(o);
  if (od < mr) {
    const nrm = o.map((x) => x / od), vn = dot(v, nrm), fr = Math.max(0, 1 - 6 * h);
    for (let i = 0; i < 3; i++) { p[i] = mc[i] + nrm[i] * mr; if (vn < 0) v[i] -= vn * nrm[i]; v[i] *= fr; }
  }
}
