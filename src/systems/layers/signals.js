// Deep layer 2, the video board (tile engine, sprite line buffer, palette, DAC, sound). No Phaser. A circuit
// board (DEEP.signals.layout) with the chips that turn video RAM into a signal: the tile fetcher reads a tile from
// video RAM, the palette PROM turns its color index into a color, the DAC turns that into the voltage the tube
// gets. Carry and deliver: every dot tile the fetcher reads (real VRAM and color RAM) puts its color index out on
// one of its pins; carry it (it follows one tile behind you) to the palette's input pins, then to the DAC's.
// Enemies: the 8 hardware sprites, moving over the board at their real register positions (touching one drops
// what you carry), and the sound chip, whose area is deadly for a moment after every sound command but the chomp.

import { DEEP } from '../../config.js';
import { CELL, tileOffset } from '../arcade/memmap.js';
import { W as MW, H as MH, SPRITE } from '../arcade/video.js';
import { tinyText, hex2 } from './font.js';
import { css, floor, neonBox, neonLine, dot, HAZARD } from './tron.js';

const C = DEEP.signals;
const MAP = C.layout, ROWS = MAP.length, COLS = MAP[0].length;
const at = (x, y) => (x >= 0 && y >= 0 && x < COLS && y < ROWS ? MAP[y][x] : '#');
const CHIP_NAMES = { V: 'VRAM', T: 'TILES', L: 'SPRITES', P: 'PALETTE', D: 'DAC', S: 'SND' };
const CHIPS = {};
for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
  const ch = MAP[y][x];
  if (!CHIP_NAMES[ch]) continue;
  const c = (CHIPS[ch] ??= { x, y, x1: x, y1: y });
  c.x1 = Math.max(c.x1, x); c.y1 = Math.max(c.y1, y);
}
const PINS = { f: [], p: [], d: [] };
for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (PINS[MAP[y][x]]) PINS[MAP[y][x]].push({ x, y });

export default {
  id: 'signals',
  title: 'THE VIDEO BOARD',
  subtitle: 'CARRY A COLOR INDEX FROM THE TILE\nFETCHER TO THE PALETTE, THEN THE DAC',
  cols: COLS, rows: ROWS,
  start: { x: 8, y: 10 },
  goal: C.goal,

  init() {
    return { sparks: new Map(), next: 0, carry: null, pulse: -99, sound: '', follow: null, tile: null, fetch: null, out: null };
  },

  open(st, env, x, y) {
    const ch = at(x, y);
    return ch !== '#' && !CHIP_NAMES[ch];
  },

  pulsing(st, t) {
    return t - st.pulse < C.pulseTime;
  },

  inPulse(x, y) {
    const s = CHIPS.S;
    const dx = Math.max(s.x - x, 0, x - s.x1), dy = Math.max(s.y - y, 0, y - s.y1);
    return Math.max(dx, dy) <= C.pulseRadius;
  },

  onHit(st) {
    st.carry = null;
  },

  onRespawn(st) {
    st.tile = null;
  },

  info(st) {
    if (!st.carry) return 'GRAB A COLOR INDEX AT THE FETCHER PINS';
    return st.carry.stage === 'index' ? `INDEX ${hex2(st.carry.pal)}: TO THE PALETTE PINS` : 'COLOR READY: TO THE DAC PINS';
  },

  update(st, env) {
    const { m, t, player, sounds } = env;
    // The tile fetcher reads a dot tile now and then and puts its color index out on a free pin.
    if (t >= st.next) {
      st.next = t + C.sparkEvery;
      const tiles = [];
      for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
        const c = m.vram[tileOffset(x, y)];
        if (c === CELL.dot || c === CELL.power) tiles.push({ x, y, code: c });
      }
      const free = PINS.f.filter((p) => !st.sparks.has(p.y * COLS + p.x));
      if (tiles.length && free.length && st.sparks.size < C.maxSparks) {
        const tile = tiles[Math.floor(Math.random() * tiles.length)], pin = free[Math.floor(Math.random() * free.length)];
        st.fetch = tile;
        st.sparks.set(pin.y * COLS + pin.x, { t, pal: m.cram[tileOffset(tile.x, tile.y)] });
      }
    }
    for (const [k, s] of st.sparks) if (t - s.t > C.sparkLife) st.sparks.delete(k);
    const loud = sounds.filter((e) => e.name !== 'dot'); // dot chomps are too frequent to dodge
    if (loud.length) { st.pulse = t; st.sound = loud[loud.length - 1].name.toUpperCase(); }

    const px = Math.round(player.x), py = Math.round(player.y);
    if (!st.tile || st.tile.x !== px || st.tile.y !== py) { if (st.tile) st.follow = st.tile; st.tile = { x: px, y: py }; }
    for (const sp of m.sprites()) {
      if (!sp.code || sp.code >= SPRITE.points || sp.code < SPRITE.ghost) continue;
      if (Math.abs(sp.x / 16 - 0.5 - player.x) < 1 && Math.abs(sp.y / 16 - 0.5 - player.y) < 1) return 'hit';
    }
    if (this.pulsing(st, t) && this.inPulse(px, py)) return 'hit';
    const pin = at(px, py);
    if (st.carry?.stage === 'index' && pin === 'p') st.carry.stage = 'color';
    if (st.carry?.stage === 'color' && pin === 'd') { st.out = { t, pal: st.carry.pal }; st.carry = null; return 'objective'; }
    const spark = st.sparks.get(py * COLS + px);
    if (spark) {
      st.sparks.delete(py * COLS + px);
      if (!st.carry) { st.carry = { pal: spark.pal, stage: 'index' }; st.follow = { x: px, y: py }; }
      return 'dot';
    }
    return null;
  },

  draw(ctx, st, env, S) {
    const { m, t, P } = env;
    floor(ctx, P, COLS, ROWS, S);
    const c = Math.floor(S / 2);
    // Traces: neon lines between neighbouring trace and pin cells.
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const ch = MAP[y][x];
      if (!'-|+fpdo'.includes(ch)) continue;
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const n = at(x + dx, y + dy);
        if ('-|+fpdo'.includes(n) || (CHIP_NAMES[n] && ch !== 'o')) neonLine(ctx, x * S + c, y * S + c, (x + dx) * S + c, (y + dy) * S + c, P.glow, P.grid);
      }
      if ('fpdo'.includes(ch)) {
        const want = (ch === 'p' && st.carry?.stage === 'index') || (ch === 'd' && st.carry?.stage === 'color');
        neonBox(ctx, x * S + 3, y * S + 3, S - 6, S - 6, want && Math.floor(t * 4) % 2 ? 0xffffff : P.line, P.glow);
      }
    }
    if (this.pulsing(st, t)) {
      const s = CHIPS.S, r = C.pulseRadius, k = 1 - (t - st.pulse) / C.pulseTime;
      ctx.fillStyle = css(DEEP.hazard, 0.2 + 0.35 * k);
      ctx.fillRect((s.x - r) * S, (s.y - r) * S, (s.x1 - s.x + 1 + 2 * r) * S, (s.y1 - s.y + 1 + 2 * r) * S);
    }
    // The chips, each with a live readout of what it's doing.
    for (const [ch, b] of Object.entries(CHIPS)) {
      const x = b.x * S, y = b.y * S, w = (b.x1 - b.x + 1) * S, h = (b.y1 - b.y + 1) * S;
      ctx.fillStyle = css(P.bg);
      ctx.fillRect(x, y, w, h);
      const line = ch === 'S' ? DEEP.hazard : P.line;
      neonBox(ctx, x + 1, y + 1, w - 2, h - 2, line, ch === 'S' ? DEEP.hazardGlow : P.glow);
      for (let k = x + 6; k < x + w - 4; k += 6) { ctx.fillStyle = css(P.glow); ctx.fillRect(k, y - 2, 2, 2); ctx.fillRect(k, y + h, 2, 2); }
      ctx.fillStyle = css(line);
      tinyText(ctx, CHIP_NAMES[ch], x + 4, y + 4);
      ctx.fillStyle = css(P.dot);
      const rd = { x: x + 4, y: y + 12 };
      if (ch === 'V' && st.fetch) {
        for (let r = 0; r < 2; r++) tinyText(ctx, [...Array(5)].map((_, k) => hex2(m.vram[tileOffset((st.fetch.x + k) % MW, (st.fetch.y + r) % MH)])).join(' '), rd.x, rd.y + r * 7);
      }
      if (ch === 'T' && st.fetch) tinyText(ctx, `ROW ${st.fetch.y} COL ${st.fetch.x}`, rd.x, rd.y);
      if (ch === 'L') m.sprites().slice(0, 4).forEach((sp, k) => tinyText(ctx, `${k} ${hex2(sp.code)}`, rd.x + (k % 2) * 24, rd.y + Math.floor(k / 2) * 7));
      if (ch === 'P' && st.carry) tinyText(ctx, `IN ${hex2(st.carry.pal)}${st.carry.stage === 'color' ? ' OUT RGB' : ''}`, rd.x, rd.y);
      if (ch === 'D' && st.out && t - st.out.t < 2) for (let k = 0; k < 3; k++) { ctx.fillStyle = ['#ff4040', '#40ff40', '#4080ff'][k]; ctx.fillRect(rd.x + k * 8, rd.y, 6, 8); }
      if (ch === 'S' && st.sound && this.pulsing(st, t)) { ctx.fillStyle = HAZARD; tinyText(ctx, st.sound, rd.x, rd.y); }
    }
    for (const [k, s] of st.sparks) dot(ctx, env, s.pal ? 'dot2' : 'dot', k % COLS, Math.floor(k / COLS), S, Math.min(1, 2 * (1 - (t - s.t) / C.sparkLife)));
    // What you carry follows one tile behind you: an index (small dot), then a color (the special).
    if (st.carry && st.follow) dot(ctx, env, st.carry.stage === 'index' ? 'dot2' : 'special', st.follow.x, st.follow.y, S);
    // The hardware sprites, over the board at their register positions.
    m.sprites().forEach((sp, i) => {
      if (!sp.code) return;
      const x = Math.round((sp.x / 16 - 1) * S), y = Math.round((sp.y / 16 - 1) * S);
      const ghost = sp.code >= SPRITE.ghost && sp.code < SPRITE.eyes;
      const line = ghost ? DEEP.hazard : sp.code < SPRITE.ghost ? 0xffffff : P.line;
      neonBox(ctx, x + 1, y + 1, 2 * S - 2, 2 * S - 2, line, ghost ? DEEP.hazardGlow : P.glow);
      ctx.fillStyle = ghost ? HAZARD : css(line);
      tinyText(ctx, `${i}${hex2(sp.code)}`, x + 3, y + 3);
    });
  },
};
