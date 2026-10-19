// Draws the 3D snow globe (src/systems/globe3d.js) as pixel art into an RGBA buffer, with no Phaser: the glass and
// its water, the base and the snowy mound ray-cast per pixel, the unicorn and its strands as shaded spheres, a 1 px
// outline wherever the depth jumps, glitter as single pixels, then the glass rim and its highlight. Every color is
// one of the palette's (assets/arcade/globe-palette.png: per part outline, dark, mid, light), lit in three bands.

import { quatMatrix, toLocal } from './globe3d.js';

const BAYER = [0, 0.5, 0.75, 0.25];
const Z0 = 200; // the camera plane, world z (in front of everything)

// palette: { part: [outline, dark, mid, light] as 0xRRGGBB }, its keys in the order of the PNG's rows.
export function createView(cfg, palette) {
  const W = cfg.view, parts = Object.keys(palette);
  const abgr = (c) => (0xff000000 | ((c & 0xff) << 16) | (c & 0xff00) | ((c >> 16) & 0xff)) >>> 0;
  const L = cfg.light, ll = Math.hypot(...L);
  return {
    W, cfg, parts, ids: Object.fromEntries(parts.map((p, i) => [p, i + 1])),
    pal: parts.map((p) => palette[p].map(abgr)), solid: parts.map((p) => p !== 'glass' && !p.startsWith('glitter')),
    b0: cfg.bands[0], b1: cfg.bands[1], dither: cfg.dither,
    light: L.map((x) => x / ll), image: new ImageData(W, W),
    z: new Float32Array(W * W), id: new Uint8Array(W * W), cx: W / 2, cy: W / 2,
  };
}

// The light band (0 dark, 1 mid, 2 light) of brightness s at pixel x, y, dithered at the band edges.
const band = (v, s, x, y) => {
  const t = s + (BAYER[(x & 1) + (y & 1) * 2] - 0.375) * v.dither;
  return t > v.b1 ? 3 : t > v.b0 ? 2 : 1;
};

function sphereHit(o, d, c, r) {
  const ox = o[0] - c[0], oy = o[1] - c[1], oz = o[2] - c[2];
  const b = ox * d[0] + oy * d[1] + oz * d[2], cc = ox * ox + oy * oy + oz * oz - r * r, disc = b * b - cc;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  return [-b - s, -b + s];
}

// The nearest hit of a ray with a capped cone frustum around the y axis (y[0] top, y[1] bottom): its t, with the
// normal in out.n (no allocation: this runs for most pixels, three times).
const hitN = [0, 0, 0];
function frustumHit(o, d, f) {
  const y0 = f.y[0], y1 = f.y[1], r0 = f.r[0], r1 = f.r[1], k = (r1 - r0) / (y1 - y0);
  let best = Infinity;
  const A0 = r0 + k * (o[1] - y0), A1 = k * d[1];
  const a = d[0] * d[0] + d[2] * d[2] - A1 * A1, b = 2 * (o[0] * d[0] + o[2] * d[2] - A0 * A1), c = o[0] * o[0] + o[2] * o[2] - A0 * A0;
  let t0 = NaN, t1 = NaN;
  if (Math.abs(a) < 1e-9) { if (Math.abs(b) > 1e-9) t0 = -c / b; } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) { const s = Math.sqrt(disc); t0 = (-b - s) / (2 * a); t1 = (-b + s) / (2 * a); }
  }
  const side = (t) => {
    if (!(t > 0) || t >= best) return;
    const y = o[1] + d[1] * t, ry = r0 + k * (y - y0);
    if (y > y0 || y < y1 || ry < 0) return;
    best = t; hitN[0] = o[0] + d[0] * t; hitN[1] = -k * ry; hitN[2] = o[2] + d[2] * t;
  };
  side(t0); side(t1);
  const cap = (y, r, ny) => {
    const t = (y - o[1]) / d[1];
    if (!(t > 0) || t >= best) return;
    const x = o[0] + d[0] * t, z = o[2] + d[2] * t;
    if (x * x + z * z <= r * r) { best = t; hitN[0] = 0; hitN[1] = ny; hitN[2] = 0; }
  };
  if (Math.abs(d[1]) > 1e-9) { cap(y0, r0, 1); cap(y1, r1, -1); }
  if (best === Infinity) return -1;
  const nl = Math.hypot(hitN[0], hitN[1], hitN[2]);
  hitN[0] /= nl; hitN[1] /= nl; hitN[2] /= nl;
  return best;
}

export function renderGlobe(v, g) {
  const { W, z, id, pal, solid, light, cfg } = v, px = new Uint32Array(v.image.data.buffer);
  const mdl = g.model, R = mdl.glassR, m = quatMatrix(g.q), Lw = light, Ll = toLocal(m, light);
  const cx = (v.cx = Math.round(W / 2 + g.jolt.x)), cy = (v.cy = Math.round(W / 2 + g.jolt.y));
  px.fill(0); z.fill(-Infinity); id.fill(0);
  const put = (i, part, lvl, depth) => { z[i] = depth; id[i] = part; px[i] = pal[part - 1][lvl]; };
  const glassId = v.ids.glass, maxR = W / 2 + 2;

  // Ray-cast pass: the water behind everything, then the mound (snow inside the glass) and the base. Each frustum is
  // only tried inside the disc its bounding sphere covers on screen.
  const dl = toLocal(m, [0, 0, -1]), mound = mdl.mound, snowId = v.ids.snow, o = [0, 0, 0];
  const frusta = mdl.base.map((f) => {
    const mid = (f.y[0] + f.y[1]) / 2, c = [m[1] * mid, m[4] * mid, m[7] * mid];
    const r = Math.hypot((f.y[0] - f.y[1]) / 2, Math.max(...f.r)) + 1;
    return { f, id: v.ids[f.part], sx: cx + c[0], sy: cy - c[1], r2: r * r };
  });
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const wx = x + 0.5 - cx, wy = cy - (y + 0.5), gd2 = wx * wx + wy * wy;
      if (gd2 > maxR * maxR) continue;
      const i = y * W + x;
      // The ray's start in the globe's frame (world wx, wy, Z0 turned back).
      o[0] = m[0] * wx + m[3] * wy + m[6] * Z0; o[1] = m[1] * wx + m[4] * wy + m[7] * Z0; o[2] = m[2] * wx + m[5] * wy + m[8] * Z0;
      if (gd2 < R * R) {
        put(i, glassId, 2, -Math.sqrt(R * R - gd2));
        const mh = sphereHit(o, dl, mound.center, mound.r), gh = mh && sphereHit(o, dl, [0, 0, 0], R - 0.5);
        if (gh) {
          const tin = Math.max(mh[0], gh[0]), tout = Math.min(mh[1], gh[1]);
          if (tin < tout) {
            const p = [o[0] + dl[0] * tin, o[1] + dl[1] * tin, o[2] + dl[2] * tin];
            const c = mh[0] >= gh[0] ? mound.center : [0, 0, 0], r = mh[0] >= gh[0] ? mound.r : R;
            const s = ((p[0] - c[0]) * Ll[0] + (p[1] - c[1]) * Ll[1] + (p[2] - c[2]) * Ll[2]) / r;
            put(i, snowId, band(v, s, x, y), Z0 - tin);
          }
        }
      }
      for (const fr of frusta) {
        const ex = x + 0.5 - fr.sx, ey = y + 0.5 - fr.sy;
        if (ex * ex + ey * ey > fr.r2) continue;
        const t = frustumHit(o, dl, fr.f);
        if (t > 0 && Z0 - t > z[i]) put(i, fr.id, band(v, hitN[0] * Ll[0] + hitN[1] * Ll[1] + hitN[2] * Ll[2], x, y), Z0 - t);
      }
    }
  }

  // Sphere pass: the unicorn, then its mane and tail (beads, with more spheres between them so they're unbroken).
  const splat = (lp, r, part) => {
    const c = [m[0] * lp[0] + m[1] * lp[1] + m[2] * lp[2], m[3] * lp[0] + m[4] * lp[1] + m[5] * lp[2], m[6] * lp[0] + m[7] * lp[1] + m[8] * lp[2]];
    const sx = cx + c[0], sy = cy - c[1];
    for (let y = Math.max(0, Math.floor(sy - r)); y < Math.min(W, Math.ceil(sy + r)); y++) {
      for (let x = Math.max(0, Math.floor(sx - r)); x < Math.min(W, Math.ceil(sx + r)); x++) {
        const dx = x + 0.5 - sx, dy = sy - (y + 0.5), dd = dx * dx + dy * dy;
        if (dd > r * r) continue;
        const dz = Math.sqrt(r * r - dd), depth = c[2] + dz, i = y * W + x;
        if (depth <= z[i]) continue;
        const wx = c[0] + dx, wy = c[1] + dy;
        if (wx * wx + wy * wy + depth * depth > (R - 0.3) ** 2) continue;
        put(i, part, band(v, (dx * Lw[0] + dy * Lw[1] + dz * Lw[2]) / r, x, y), depth);
      }
    }
  };
  for (const s of mdl.spheres) splat(s.p, s.r, v.ids[s.part]);
  for (const s of g.strands) {
    const part = v.ids[s.part];
    for (let b = 0; b < s.p.length; b++) {
      splat(s.p[b], s.r, part);
      if (!b) continue;
      const a = s.p[b - 1], e = s.p[b], n = Math.ceil(Math.hypot(e[0] - a[0], e[1] - a[1], e[2] - a[2]) / (s.r * 0.7));
      for (let k = 1; k < n; k++) splat([a[0] + ((e[0] - a[0]) * k) / n, a[1] + ((e[1] - a[1]) * k) / n, a[2] + ((e[2] - a[2]) * k) / n], s.r, part);
    }
  }

  // Outlines: a solid pixel next to empty space or something well behind it takes its part's outline color.
  const step = cfg.outlineDepth, edge = [];
  for (let y = 1; y < W - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x, p = id[i];
      if (!p || !solid[p - 1]) continue;
      const zi = z[i] - step;
      if (!id[i - 1] || !id[i + 1] || !id[i - W] || !id[i + W] || z[i - 1] < zi || z[i + 1] < zi || z[i - W] < zi || z[i + W] < zi) edge.push(i);
    }
  }
  for (const i of edge) px[i] = pal[id[i] - 1][0];

  // Glitter: one pixel per flake, flashing as it tumbles.
  const g0 = v.ids.glitter0;
  for (const f of g.flakes) {
    const c = [m[0] * f.p[0] + m[1] * f.p[1] + m[2] * f.p[2], m[3] * f.p[0] + m[4] * f.p[1] + m[5] * f.p[2], m[6] * f.p[0] + m[7] * f.p[1] + m[8] * f.p[2]];
    const x = Math.floor(cx + c[0]), y = Math.floor(cy - c[1]);
    if (x < 0 || y < 0 || x >= W || y >= W) continue;
    const i = y * W + x;
    if (c[2] < z[i] - 0.8) continue;
    const s = Math.cos(f.ph);
    px[i] = pal[g0 - 1 + f.color][s > 0.6 ? 3 : s > -0.4 ? 2 : 1];
  }

  // The glass in front: its rim, and a highlight that stays put (it's the room's light) while the globe turns.
  const [ha, hb] = cfg.highlight;
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const wx = x + 0.5 - cx, wy = cy - (y + 0.5), d2 = wx * wx + wy * wy;
      if (d2 >= R * R) continue;
      const i = y * W + x, d = Math.sqrt(d2), front = Math.sqrt(R * R - d2);
      if (z[i] >= front) continue;
      if (d > R - 1) px[i] = pal[glassId - 1][0];
      else if (d > R - 4.5 && d < R - 3 && wy > 0 && Math.atan2(wy, wx) > ha && Math.atan2(wy, wx) < hb) px[i] = pal[glassId - 1][3];
      else if (Math.abs(wx + R * 0.42) < 1 && Math.abs(wy - R * 0.62) < 1) px[i] = pal[glassId - 1][3];
    }
  }
  return v.image;
}

// The world point under view pixel x, y (floats) on the globe's front surface, or null when it's off the globe.
export function pickGlobe(v, g, x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  if (ix < 0 || iy < 0 || ix >= v.W || iy >= v.W) return null;
  const i = iy * v.W + ix, p = v.id[i];
  if (!p) return null;
  const wx = x - v.cx, wy = v.cy - y, R = g.model.glassR;
  const z = p === v.ids.glass ? Math.sqrt(Math.max(0, R * R - wx * wx - wy * wy)) : v.z[i];
  return [wx, wy, z];
}
