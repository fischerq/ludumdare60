// Deep layer 2, the video board (tile fetcher, palette, DAC). No Phaser. A circuit board (DEEP.signals.layout)
// with the chips that turn video RAM into a signal. No enemies: a race against the frame timer. Every frame the
// tile fetcher shows one real tile of the picture, its pixels mapped to the palette; walk onto the 3 marked
// pixels to take them, then onto their lit entries in the palette (each pixel becomes a color), then into the DAC.
// When the frame timer runs out, what you carry is dropped and the fetcher moves on to a new tile.

import { DEEP } from '../../config.js';
import { drawPlayfield, W as MW, H as MH } from '../arcade/video.js';
import { tinyText, hex2 } from './font.js';
import { css, floor, neonBox, neonLine } from './tron.js';

const C = DEEP.signals;
const MAP = C.layout, ROWS = MAP.length, COLS = MAP[0].length;
const at = (x, y) => (x >= 0 && y >= 0 && x < COLS && y < ROWS ? MAP[y][x] : '#');
const NAMES = { V: 'VRAM', T: 'TILES', P: 'PALETTE', D: 'DAC', F: 'FRAME' };
const BOX = {};
for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
  const ch = MAP[y][x].toUpperCase();
  if (!NAMES[ch]) continue;
  const b = (BOX[ch] ??= { x, y, x1: x, y1: y });
  b.x = Math.min(b.x, x); b.x1 = Math.max(b.x1, x); b.y1 = Math.max(b.y1, y);
}
// Inside a box (without its frame).
const inside = (b, x, y) => x > b.x && x < b.x1 && y > b.y && y < b.y1;
const TP = 16; // pixels per tile side; the tile fetcher shows 2x2 pixels per cell
const SW = 2;  // palette swatches are SW x SW cells
const SWROW = Math.floor((BOX.P.x1 - BOX.P.x - 1) / SW);
// The video-out wire's row: where the DAC's pixels leave the board.
const OUT = { y: MAP.findIndex((r) => r.includes('o')) };

const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
const dist = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

// The picture as it is now: its palette (the most common colors) and every pixel's entry in it.
let canvas = null;
function snapshot(env) {
  canvas ??= document.createElement('canvas');
  canvas.width = MW * TP; canvas.height = MH * TP;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  drawPlayfield(ctx, env.m, env.art, { T: TP });
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const count = new Map();
  for (let i = 0; i < data.length; i += 4) {
    const k = data[i + 3] < 128 ? 0 : (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  const palette = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, C.paletteSize)
    .map(([k]) => [k >> 16, (k >> 8) & 255, k & 255]);
  const entry = (i) => {
    const c = [data[i], data[i + 1], data[i + 2]];
    let best = 0;
    for (let e = 1; e < palette.length; e++) if (dist(c, palette[e]) < dist(c, palette[best])) best = e;
    return best;
  };
  return { palette, tile: (tx, ty) => [...Array(TP * TP)].map((_, k) => entry(((ty * TP + Math.floor(k / TP)) * MW * TP + tx * TP + (k % TP)) * 4)) };
}

// Picks a tile with as many different palette entries as possible and marks C.pixels of its pixels, each with
// its own entry where the tile has enough and each in its own cell.
function fetchTile(env) {
  const { palette, tile } = snapshot(env);
  let best = null;
  for (let n = 0; n < 40; n++) {
    const tx = Math.floor(Math.random() * MW), ty = Math.floor(Math.random() * MH), px = tile(tx, ty);
    const kinds = new Set(px).size;
    if (!best || kinds > best.kinds) best = { tx, ty, px, kinds };
    if (kinds >= C.pixels + 1) break;
  }
  const order = [...best.px.keys()].sort(() => Math.random() - 0.5);
  const marks = [], cells = new Set(), entries = new Set();
  for (const pass of [0, 1]) for (const k of order) {
    if (marks.length >= C.pixels) break;
    const cell = (Math.floor(k / TP) >> 1) * 8 + ((k % TP) >> 1), e = best.px[k];
    if (cells.has(cell) || (pass === 0 && entries.has(e))) continue;
    cells.add(cell); entries.add(e);
    marks.push({ k, e, cx: BOX.T.x + 1 + ((k % TP) >> 1), cy: BOX.T.y + 1 + (Math.floor(k / TP) >> 1), taken: false });
  }
  return { palette, tx: best.tx, ty: best.ty, px: best.px, marks };
}

// The palette swatch under a cell, or -1.
function swatchAt(x, y) {
  if (!inside(BOX.P, x, y)) return -1;
  return Math.floor((y - BOX.P.y - 1) / SW) * SWROW + Math.floor((x - BOX.P.x - 1) / SW);
}

export default {
  id: 'signals',
  title: 'THE VIDEO BOARD',
  subtitle: 'BEAT THE FRAME TIMER: TAKE 3 PIXELS\nTO THEIR PALETTE COLORS, THEN THE DAC',
  cols: COLS, rows: ROWS,
  start: { x: 4, y: 8 },
  get goal() { return C.goal; }, // read live: hard mode can change it (hard.js)

  init() {
    return { frame: null, frameT: 0, carry: [], follow: null, tile: null, out: null, dropped: -99 };
  },

  open(st, env, x, y) {
    const ch = at(x, y);
    return ch !== '#' && !NAMES[ch];
  },

  left(st, t) {
    return Math.max(0, C.frameTime - (t - st.frameT));
  },

  newFrame(st, env) {
    st.frame = fetchTile(env);
    st.frameT = env.t;
    st.carry = [];
  },

  info(st) {
    if (!st.carry.length) return `TAKE THE ${C.pixels} MARKED PIXELS IN THE TILE`;
    if (st.carry.length < C.pixels) return `${st.carry.length} OF ${C.pixels} PIXELS: TAKE THE REST`;
    if (st.carry.some((c) => !c.color)) return 'STEP ON THEIR LIT PALETTE ENTRIES';
    return 'COLORS READY: INTO THE DAC';
  },

  update(st, env) {
    const { t, player } = env;
    if (!st.frame) this.newFrame(st, env);
    if (this.left(st, t) <= 0) { if (st.carry.length) st.dropped = t; this.newFrame(st, env); }

    const px = Math.round(player.x), py = Math.round(player.y);
    if (!st.tile || st.tile.x !== px || st.tile.y !== py) { if (st.tile) st.follow = st.tile; st.tile = { x: px, y: py }; }
    const mark = st.frame.marks.find((mk) => !mk.taken && mk.cx === px && mk.cy === py);
    if (mark) { mark.taken = true; st.carry.push({ e: mark.e, color: false }); return 'dot'; }
    const sw = swatchAt(px, py);
    if (sw >= 0) for (const c of st.carry) if (c.e === sw && !c.color) c.color = true;
    if (inside(BOX.D, px, py) && st.carry.length === C.pixels && st.carry.every((c) => c.color)) {
      st.out = { t, from: st.follow ?? { x: px, y: py }, colors: st.carry.map((c) => st.frame.palette[c.e]) };
      this.newFrame(st, env);
      return 'objective';
    }
    return null;
  },

  draw(ctx, st, env, S) {
    const { t, P } = env;
    floor(ctx, P, COLS, ROWS, S);
    if (!st.frame) return;
    const { palette, px, marks } = st.frame;
    const blink = Math.floor(t * 4) % 2;
    const c = Math.floor(S / 2);
    // Traces: neon lines between neighbouring trace cells, doorways and video out.
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const ch = MAP[y][x];
      if (!'-|o'.includes(ch)) continue;
      for (const [dx, dy] of ch === '|' ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]]) {
        const n = at(x + dx, y + dy);
        if (n === ch || NAMES[n.toUpperCase()]) neonLine(ctx, x * S + c, y * S + c, (x + dx) * S + c, (y + dy) * S + c, P.glow, P.grid);
      }
    }
    // The boxes: dark inside, a neon frame (doorways left open) and the name on top.
    for (const [ch, b] of Object.entries(BOX)) {
      const x = b.x * S, y = b.y * S, w = (b.x1 - b.x + 1) * S, h = (b.y1 - b.y + 1) * S;
      ctx.fillStyle = css(P.bg);
      ctx.fillRect(x, y, w, h);
      neonBox(ctx, x + 1, y + 1, w - 2, h - 2, P.line, P.glow);
      for (let yy = b.y; yy <= b.y1; yy++) for (let xx = b.x; xx <= b.x1; xx++) {
        if (inside(b, xx, yy) || MAP[yy][xx] === ch) continue;
        ctx.fillStyle = css(P.bg);
        ctx.fillRect(xx * S + 2, yy * S, S - 4, S);
      }
      ctx.fillStyle = css(P.line);
      tinyText(ctx, NAMES[ch], x + 4, y + 4);
    }
    // VRAM: the bytes around the fetched tile.
    const V = BOX.V;
    ctx.fillStyle = css(P.dot);
    tinyText(ctx, `${hex2(st.frame.tx)},${hex2(st.frame.ty)}`, V.x * S + 4, V.y * S + 14);
    // The tile fetcher: the fetched tile, 2x2 pixels per cell, in its palette colors; marked pixels blink.
    const T = BOX.T, q = S / 2;
    for (let k = 0; k < TP * TP; k++) {
      ctx.fillStyle = rgb(palette[px[k]]);
      ctx.fillRect(Math.round((T.x + 1) * S + (k % TP) * q), Math.round((T.y + 1) * S + Math.floor(k / TP) * q), Math.ceil(q), Math.ceil(q));
    }
    for (const mk of marks) {
      const x = Math.round((T.x + 1) * S + (mk.k % TP) * q), y = Math.round((T.y + 1) * S + Math.floor(mk.k / TP) * q);
      if (mk.taken) { ctx.fillStyle = '#000'; ctx.fillRect(x, y, Math.ceil(q), Math.ceil(q)); continue; }
      ctx.strokeStyle = blink ? '#ffffff' : '#000000';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 2, y - 2, q + 4, q + 4);
      ctx.lineWidth = 1;
    }
    // The palette: every entry as a swatch, lit while a pixel you carry still needs it.
    const PB = BOX.P;
    palette.forEach((col, e) => {
      const x = (PB.x + 1 + (e % SWROW) * SW) * S, y = (PB.y + 1 + Math.floor(e / SWROW) * SW) * S, w = SW * S;
      const want = st.carry.some((cc) => cc.e === e && !cc.color), done = st.carry.some((cc) => cc.e === e && cc.color);
      ctx.fillStyle = rgb(col);
      ctx.fillRect(x + 4, y + 4, w - 8, w - 8);
      if (want || done) neonBox(ctx, x + 1, y + 1, w - 2, w - 2, want && blink ? 0xffffff : P.line, P.glow);
      ctx.fillStyle = css(P.bg);
      ctx.fillRect(x + 4, y + w - 12, 11, 8);
      ctx.fillStyle = css(want ? 0xffffff : P.dot, want || done ? 1 : 0.6);
      tinyText(ctx, hex2(e), x + 5, y + w - 10);
    });
    // The DAC: delivered pixels drop from you into its slots, their red, green and blue levels rise, then they
    // leave one after the other along the video-out wire.
    const D = BOX.D, out = st.out, sz = Math.round(S * 0.6);
    const slot = (k) => ({ x: (D.x + 1) * S + k * (4 * S / 3) + 4, y: D.y1 * S - sz - 4 });
    const ease = (u) => 1 - (1 - Math.min(1, Math.max(0, u))) ** 2;
    const sendAt = (k) => C.dropTime + C.convertTime + k * C.sendGap;
    if (out && t - out.t < sendAt(out.colors.length - 1) + C.sendTime) {
      const u = t - out.t, wy = OUT.y * S + Math.floor((S - sz) / 2);
      out.colors.forEach((col, k) => {
        const s0 = slot(k), sent = u - sendAt(k);
        if (sent < 0) {
          // Its levels as three bars over its slot, rising while the DAC converts.
          const lv = ease((u - C.dropTime) / C.convertTime);
          for (let ch = 0; ch < 3; ch++) {
            const h = Math.round((col[ch] / 255) * (2 * S - 8) * lv);
            ctx.fillStyle = ['#ff4040', '#40ff40', '#4080ff'][ch];
            ctx.fillRect(s0.x + ch * Math.floor(sz / 3), s0.y - 2 - h, Math.floor(sz / 3) - 1, h);
          }
        }
        let x, y;
        if (u < C.dropTime) {
          const d = ease(u / C.dropTime), fx = out.from.x * S + (S - sz) / 2, fy = out.from.y * S + (S - sz) / 2;
          x = fx + (s0.x - fx) * d; y = fy + (s0.y - fy) * d;
        } else if (sent < 0) {
          x = s0.x; y = s0.y;
        } else {
          // Out through the DAC's right side to the wire, then along it off the board.
          const down = Math.abs(wy - s0.y), p = (sent / C.sendTime) * (down + COLS * S - s0.x);
          if (p < down) { x = s0.x; y = s0.y + Math.sign(wy - s0.y) * p; } else { x = s0.x + p - down; y = wy; }
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = rgb(col);
          ctx.fillRect(x - sz, y + sz / 4, sz, sz / 2);
          ctx.globalAlpha = 1;
        }
        if (x >= COLS * S) return;
        ctx.fillStyle = rgb(col);
        ctx.fillRect(Math.round(x), Math.round(y), sz, sz);
        ctx.strokeStyle = '#ffffff';
        ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, sz - 1, sz - 1);
      });
    } else {
      // The drop-off: a muted outline, lit and blinking once you carry 3 colors.
      const ready = st.carry.length === C.pixels && st.carry.every((cc) => cc.color);
      const dx = (D.x + 1) * S + 1, dy = (D.y + 1) * S + 1, dw = (D.x1 - D.x - 1) * S - 2, dh = (D.y1 - D.y - 1) * S - 2;
      if (ready) neonBox(ctx, dx, dy, dw, dh, blink ? 0xffffff : P.line, P.glow);
      else { ctx.strokeStyle = css(P.line, 0.3); ctx.strokeRect(dx + 0.5, dy + 0.5, dw - 1, dh - 1); }
    }
    // The frame timer: seconds left and a bar running down, red near the end; flashes when it dropped your pixels.
    const F = BOX.F, left = this.left(st, t), k = left / C.frameTime;
    const fx = F.x * S + 4, fw = (F.x1 - F.x + 1) * S - 8, fy = F.y * S + 14, fh = (F.y1 - F.y + 1) * S - 20;
    const hot = k < 0.25 || t - st.dropped < 1;
    ctx.fillStyle = css(P.grid);
    ctx.fillRect(fx, fy, fw, fh);
    ctx.fillStyle = hot ? css(DEEP.hazard, blink || t - st.dropped >= 1 ? 1 : 0.4) : css(P.line);
    ctx.fillRect(fx, fy + fh * (1 - k), fw, fh * k);
    ctx.fillStyle = '#ffffff';
    tinyText(ctx, t - st.dropped < 1 ? 'DROP' : String(Math.ceil(left)).padStart(2, '0'), fx + 2, fy + 2);
    // What you carry follows one tile behind you: each pixel a block (gray with its palette entry), split into its
    // red, green and blue parts once the palette made it a color.
    if (st.carry.length && st.follow) {
      const w = Math.round(S * 0.75), gap = 2, n = st.carry.length;
      const x0 = Math.round(st.follow.x * S + S / 2 - (n * w + (n - 1) * gap) / 2), y = Math.round(st.follow.y * S + (S - w) / 2);
      st.carry.forEach((cc, i) => {
        const x = x0 + i * (w + gap);
        ctx.fillStyle = '#000';
        ctx.fillRect(x - 1, y - 1, w + 2, w + 2);
        if (cc.color) {
          const col = palette[cc.e], pw = Math.floor(w / 3);
          for (let ch = 0; ch < 3; ch++) {
            ctx.fillStyle = rgb(col.map((v, j) => (j === ch ? v : 0)));
            ctx.fillRect(x + ch * pw, y, ch === 2 ? w - 2 * pw : pw - 1, w);
          }
        } else {
          ctx.fillStyle = '#808080';
          ctx.fillRect(x, y, w, w);
          ctx.fillStyle = '#ffffff';
          tinyText(ctx, String(cc.e), x + Math.floor(w / 2) - 2, y + Math.floor(w / 2) - 3);
        }
      });
    }
  },
};
