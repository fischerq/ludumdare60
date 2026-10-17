// Deep layer 2, the signal hardware (tile engine, palette, DAC, sound). No Phaser. The playfield as the video
// chip sees it: a grid of tile codes from VRAM plus the 8 hardware sprites as boxes at their register positions.
// Carry and deliver: the tile fetcher hands out a color index at a dot tile; carry it to the palette chip (which
// turns it into a color), then to the DAC, which puts it on the screen. The hardware sprites are the enemies
// (touching one drops what you carry), and every sound command makes the sound chip's area deadly for a moment.

import { DEEP } from '../../config.js';
import { CELL, tileOffset } from '../arcade/memmap.js';
import { W, H, SPRITE } from '../arcade/video.js';
import { tinyText, hex2 } from './font.js';
import { css, floor, neonBox, dot, HAZARD } from './tron.js';

const C = DEEP.signals;
const CHIPS = [
  { name: 'PAL', ...C.palette, w: 2, h: 2 },
  { name: 'DAC', ...C.dac, w: 2, h: 2 },
  { name: 'SND', ...C.sound, w: 3, h: 2 },
];
const onChip = (c, x, y) => x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h;

export default {
  id: 'signals',
  title: 'THE SIGNAL CHIPS',
  subtitle: 'CARRY A COLOR INDEX TO THE PALETTE\nTHEN TO THE DAC. MIND SPRITES AND SOUND',
  cols: W, rows: H,
  start: { x: 9, y: 17 },
  goal: C.goal,

  init() {
    return { sparks: new Map(), next: 0, carry: null, pulse: -99, follow: { x: 9, y: 17 }, tile: null };
  },

  open(st, env, x, y) {
    return x >= 0 && x < W && y >= 0 && y < H;
  },

  pulsing(st, t) {
    return t - st.pulse < C.pulseTime;
  },

  inPulse(x, y) {
    const s = CHIPS[2];
    const dx = Math.max(s.x - x, 0, x - (s.x + s.w - 1)), dy = Math.max(s.y - y, 0, y - (s.y + s.h - 1));
    return Math.max(dx, dy) <= C.pulseRadius;
  },

  onHit(st) {
    st.carry = null;
  },

  onRespawn(st) {
    st.tile = null;
  },

  info(st) {
    if (!st.carry) return 'GRAB A COLOR INDEX FROM A DOT TILE';
    return st.carry.stage === 'index' ? `INDEX ${hex2(st.carry.pal)}: TAKE IT TO PAL` : 'COLOR READY: TAKE IT TO THE DAC';
  },

  update(st, env) {
    const { m, t, player, sounds } = env;
    // The tile fetcher hands out a color index at a random dot tile now and then.
    if (t >= st.next && st.sparks.size < C.maxSparks) {
      st.next = t + C.sparkEvery;
      const tiles = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const c = m.vram[tileOffset(x, y)];
        if ((c === CELL.dot || c === CELL.power) && !st.sparks.has(y * W + x)) tiles.push([x, y]);
      }
      if (tiles.length) {
        const [x, y] = tiles[Math.floor(Math.random() * tiles.length)];
        st.sparks.set(y * W + x, { t, pal: m.cram[tileOffset(x, y)] });
      }
    }
    for (const [k, s] of st.sparks) if (t - s.t > C.sparkLife) st.sparks.delete(k);
    if (sounds.some((e) => e.name !== 'dot')) st.pulse = t; // dot chomps are too frequent to dodge

    const px = Math.round(player.x), py = Math.round(player.y);
    if (!st.tile || st.tile.x !== px || st.tile.y !== py) { if (st.tile) st.follow = st.tile; st.tile = { x: px, y: py }; }
    for (const sp of m.sprites()) {
      if (!sp.code || sp.code >= SPRITE.points || sp.code < SPRITE.ghost) continue;
      if (Math.abs(sp.x / 16 - 0.5 - player.x) < 1 && Math.abs(sp.y / 16 - 0.5 - player.y) < 1) return 'hit';
    }
    if (this.pulsing(st, t) && this.inPulse(px, py)) return 'hit';
    if (st.carry?.stage === 'index' && onChip(CHIPS[0], px, py)) st.carry.stage = 'color';
    if (st.carry?.stage === 'color' && onChip(CHIPS[1], px, py)) { st.carry = null; return 'objective'; }
    const spark = st.sparks.get(py * W + px);
    if (spark) {
      st.sparks.delete(py * W + px);
      if (!st.carry) { st.carry = { pal: spark.pal, stage: 'index' }; st.follow = { x: px, y: py }; }
      return 'dot';
    }
    return null;
  },

  draw(ctx, st, env, S) {
    const { m, t, P } = env;
    floor(ctx, P, W, H, S);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const c = m.vram[tileOffset(x, y)];
        ctx.fillStyle = css(c === CELL.wall ? P.glow : c ? P.dot : P.grid, c === CELL.wall ? 1 : 0.6);
        tinyText(ctx, hex2(c), x * S + Math.floor((S - 7) / 2), y * S + Math.floor((S - 5) / 2));
      }
    }
    if (this.pulsing(st, t)) {
      const s = CHIPS[2], r = C.pulseRadius, k = 1 - (t - st.pulse) / C.pulseTime;
      ctx.fillStyle = css(DEEP.hazard, 0.25 + 0.35 * k);
      ctx.fillRect((s.x - r) * S, (s.y - r) * S, (s.w + 2 * r) * S, (s.h + 2 * r) * S);
    }
    for (const c of CHIPS) {
      const want = (c.name === 'PAL' && st.carry?.stage === 'index') || (c.name === 'DAC' && st.carry?.stage === 'color');
      const line = c.name === 'SND' ? DEEP.hazard : want && Math.floor(t * 4) % 2 ? 0xffffff : P.line;
      ctx.fillStyle = css(P.bg);
      ctx.fillRect(c.x * S + 1, c.y * S + 1, c.w * S - 2, c.h * S - 2);
      neonBox(ctx, c.x * S + 1, c.y * S + 1, c.w * S - 2, c.h * S - 2, line, c.name === 'SND' ? DEEP.hazardGlow : P.glow);
      ctx.fillStyle = css(line);
      tinyText(ctx, c.name, c.x * S + Math.floor((c.w * S - 11) / 2), c.y * S + Math.floor((c.h * S - 5) / 2));
    }
    for (const [k, s] of st.sparks) dot(ctx, env, s.pal ? 'dot2' : 'dot', k % W, Math.floor(k / W), S, Math.min(1, 2 * (1 - (t - s.t) / C.sparkLife)));
    // What you carry follows one tile behind you: an index (small dot), then a color (the special).
    if (st.carry) dot(ctx, env, st.carry.stage === 'index' ? 'dot2' : 'special', st.follow.x, st.follow.y, S);
    // The line buffer: the 8 hardware sprites as boxes with their codes.
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
