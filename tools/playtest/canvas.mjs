// A minimal software 2D canvas for Node, enough for drawPlayfield (src/systems/arcade/video.js): the video board
// layer (signals.js) renders the maze picture into a canvas and reads its pixels back, like the game does. Supports
// fillRect, drawImage (nearest neighbour, any affine transform), save/restore, a rect clip, the 'source-in'
// composite (tinting) and getImageData; text is skipped. art(key) loads assets/<key>.png (8-bit RGBA).

import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

function parseColor(s) {
  s = String(s).trim();
  if (s[0] === '#') {
    const h = s.length === 4 ? [...s.slice(1)].map((c) => c + c).join('') : s.slice(1, 7);
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 255];
  }
  const n = s.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
  if (s.startsWith('hsl')) {
    const [h, sat, l] = [n[0] / 360, n[1] / 100, n[2] / 100];
    const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat, p = 2 * l - q;
    const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((v) => Math.round(v * 255)).concat(255);
  }
  return [n[0], n[1], n[2], 255];
}

const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];

class Ctx {
  constructor(canvas) {
    this.canvas = canvas;
    this.s = { m: [1, 0, 0, 1, 0, 0], clip: null, fillStyle: '#000', comp: 'source-over' };
    this.stack = [];
  }
  get fillStyle() { return this.s.fillStyle; }
  set fillStyle(v) { this.s.fillStyle = v; }
  get globalCompositeOperation() { return this.s.comp; }
  set globalCompositeOperation(v) { this.s.comp = v; }
  save() { this.stack.push({ ...this.s }); }
  restore() { if (this.stack.length) this.s = this.stack.pop(); }
  transform(...t) { this.s.m = mul(this.s.m, t); }
  translate(x, y) { this.transform(1, 0, 0, 1, x, y); }
  scale(x, y) { this.transform(x, 0, 0, y, 0, 0); }
  rotate(a) { const c = Math.cos(a), s = Math.sin(a); this.transform(c, s, -s, c, 0, 0); }
  beginPath() { this.path = null; }
  rect(x, y, w, h) { this.path = this.box(x, y, w, h); }
  clip() { if (this.path) this.s.clip = this.path; }
  fillText() {}
  strokeRect() {}
  // Device-space bounding box of a user-space rect, cut to the canvas and the clip.
  box(x, y, w, h) {
    const m = this.s.m, xs = [], ys = [];
    for (const [u, v] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) { xs.push(m[0] * u + m[2] * v + m[4]); ys.push(m[1] * u + m[3] * v + m[5]); }
    const c = this.s.clip ?? [0, 0, this.canvas.width, this.canvas.height];
    return [Math.max(c[0], Math.round(Math.min(...xs))), Math.max(c[1], Math.round(Math.min(...ys))),
      Math.min(c[2], Math.round(Math.max(...xs))), Math.min(c[3], Math.round(Math.max(...ys)))];
  }
  put(i, r, g, b, a) {
    const d = this.canvas.data;
    if (this.s.comp === 'source-in') { d[i] = r; d[i + 1] = g; d[i + 2] = b; return; }
    if (a >= 255) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; return; }
    if (a <= 0) return;
    const k = a / 255;
    d[i] += (r - d[i]) * k; d[i + 1] += (g - d[i + 1]) * k; d[i + 2] += (b - d[i + 2]) * k; d[i + 3] = Math.max(d[i + 3], a);
  }
  fillRect(x, y, w, h) {
    const [r, g, b] = parseColor(this.s.fillStyle), [x0, y0, x1, y1] = this.box(x, y, w, h), W = this.canvas.width;
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) this.put((yy * W + xx) * 4, r, g, b, 255);
  }
  drawImage(src, dx, dy, dw = src.width, dh = src.height) {
    const m = this.s.m, det = m[0] * m[3] - m[1] * m[2], W = this.canvas.width, sd = src.data;
    const [x0, y0, x1, y1] = this.box(dx, dy, dw, dh);
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
      // Pixel center back to user space, then to the source.
      const px = xx + 0.5 - m[4], py = yy + 0.5 - m[5];
      const u = (m[3] * px - m[2] * py) / det, v = (-m[1] * px + m[0] * py) / det;
      const sx = Math.floor(((u - dx) / dw) * src.width), sy = Math.floor(((v - dy) / dh) * src.height);
      if (sx < 0 || sy < 0 || sx >= src.width || sy >= src.height) continue;
      const j = (sy * src.width + sx) * 4;
      this.put((yy * W + xx) * 4, sd[j], sd[j + 1], sd[j + 2], sd[j + 3]);
    }
  }
  getImageData(x, y, w, h) {
    const out = new Uint8ClampedArray(w * h * 4), W = this.canvas.width;
    for (let r = 0; r < h; r++) out.set(this.canvas.data.subarray(((y + r) * W + x) * 4, ((y + r) * W + x + w) * 4), r * w * 4);
    return { data: out, width: w, height: h };
  }
}

export class Canvas {
  constructor(w = 300, h = 150) { this._w = w; this._h = h; this.data = new Uint8ClampedArray(w * h * 4); }
  get width() { return this._w; }
  set width(v) { this._w = v; this.data = new Uint8ClampedArray(this._w * this._h * 4); }
  get height() { return this._h; }
  set height(v) { this._h = v; this.data = new Uint8ClampedArray(this._w * this._h * 4); }
  getContext() { return (this.ctx ??= new Ctx(this)); }
}

// An 8-bit RGBA, non-interlaced PNG (what tools/export_assets.py writes) as a Canvas.
export function readPng(file) {
  const b = readFileSync(file);
  let p = 8, w = 0, h = 0;
  const idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p), type = b.toString('ascii', p + 4, p + 8), body = b.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = body.readUInt32BE(0); h = body.readUInt32BE(4); if (body[8] !== 8 || body[9] !== 6) throw new Error(`${file}: not 8-bit RGBA`); }
    if (type === 'IDAT') idat.push(body);
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)), c = new Canvas(w, h), out = c.data, stride = w * 4;
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = y * (stride + 1) + 1;
    for (let i = 0; i < stride; i++) {
      const x = raw[row + i], a = i >= 4 ? out[y * stride + i - 4] : 0, up = y ? out[(y - 1) * stride + i] : 0;
      const ul = y && i >= 4 ? out[(y - 1) * stride + i - 4] : 0;
      const pa = Math.abs(up - ul), pb = Math.abs(a - ul), pc = Math.abs(a + up - 2 * ul);
      const pr = pa <= pb && pa <= pc ? a : pb <= pc ? up : ul;
      out[y * stride + i] = (x + [0, a, up, (a + up) >> 1, pr][f]) & 255;
    }
  }
  return c;
}

const loaded = new Map();
export const art = (key) => {
  if (!loaded.has(key)) { const c = readPng(new URL(`../../assets/${key}.png`, import.meta.url)); c.__key = key; loaded.set(key, c); }
  return loaded.get(key);
};
