// Deep layer 2, the signal hardware (tile engine, sprite line buffer, sound). No Phaser. The playfield as the
// video chip sees it: a grid of tile codes from VRAM plus the 8 hardware sprites as boxes at their register
// positions. The tile fetcher reads the grid row by row (slowed down); every dot or pellet tile it fetches
// sends out a color index that waits a moment to be picked up. Sprites crush; every sound command the
// program writes to the sound latch raises a wave along the bottom of the screen, as high as the sound is loud.

import { DEEP } from '../../config.js';
import { CELL, tileOffset } from '../arcade/memmap.js';
import { W, H, SPRITE } from '../arcade/video.js';
import { tinyText, hex2 } from './font.js';
import { css, floor, neonBlock, neonBox, dot, HAZARD } from './tron.js';

const C = DEEP.signals;

export default {
  id: 'signals',
  title: 'THE SIGNAL CHIPS',
  subtitle: 'GRAB THE COLORS THE TILE FETCHER\nSENDS OUT. SPRITES AND SOUND HURT',
  cols: W, rows: H,
  start: { x: 9, y: 17 },
  goal: C.goal,

  init() {
    return { sparks: new Map(), waves: [], fetchRow: -1 };
  },

  open(st, env, x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return false;
    const c = env.m.vram[tileOffset(x, y)];
    return c !== CELL.wall && c !== CELL.door && c !== CELL.house;
  },

  // Rows the sound waves cover at the bottom right now: each swells and fades over waveTime.
  waveHeight(st, t) {
    let h = 0;
    for (const w of st.waves) h = Math.max(h, w.rows * Math.sin((Math.PI * (t - w.t)) / C.waveTime));
    return h;
  },

  fetchRow(t) {
    return Math.floor(t / C.rowTime) % H;
  },

  update(st, env) {
    const { m, t, player, sounds } = env;
    const row = this.fetchRow(t);
    if (row !== st.fetchRow) {
      st.fetchRow = row;
      for (let x = 0; x < W; x++) {
        const c = m.vram[tileOffset(x, row)];
        if (c === CELL.dot || c === CELL.power) st.sparks.set(row * W + x, { t, pal: m.cram[tileOffset(x, row)] });
      }
    }
    for (const [k, s] of st.sparks) if (t - s.t > C.sparkLife) st.sparks.delete(k);
    for (const e of sounds) if (C.waveRows[e.name]) st.waves.push({ t, rows: C.waveRows[e.name], name: e.name });
    st.waves = st.waves.filter((w) => t - w.t < C.waveTime);

    const px = Math.round(player.x), py = Math.round(player.y);
    for (const sp of m.sprites()) {
      if (!sp.code || sp.code >= SPRITE.points || sp.code < SPRITE.ghost) continue;
      if (Math.abs(sp.x / 16 - 0.5 - player.x) < 1 && Math.abs(sp.y / 16 - 0.5 - player.y) < 1) return 'hit';
    }
    if (py >= H - this.waveHeight(st, t)) return 'hit';
    if (st.sparks.delete(py * W + px)) return 'collect';
    return null;
  },

  draw(ctx, st, env, S) {
    const { m, t, P } = env;
    floor(ctx, P, W, H, S);
    const row = this.fetchRow(t);
    ctx.fillStyle = css(P.glow);
    ctx.fillRect(0, row * S + 1, W * S, S - 1);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const c = m.vram[tileOffset(x, y)];
        if (c === CELL.wall) neonBlock(ctx, x * S + 1, y * S + 1, S - 1, S - 1, P.glow, P.bg);
        ctx.fillStyle = css(c === CELL.wall ? P.line : c ? P.dot : P.grid);
        tinyText(ctx, hex2(c), x * S + Math.floor((S - 7) / 2), y * S + Math.floor((S - 5) / 2));
      }
    }
    for (const [k, s] of st.sparks) dot(ctx, env, s.pal ? 'dot2' : 'dot', k % W, Math.floor(k / W), S, 1 - (t - s.t) / C.sparkLife);
    // The line buffer: the 8 hardware sprites as boxes with their codes.
    m.sprites().forEach((sp, i) => {
      if (!sp.code) return;
      const x = Math.round((sp.x / 16 - 1) * S), y = Math.round((sp.y / 16 - 1) * S);
      const ghost = sp.code >= SPRITE.ghost && sp.code < SPRITE.eyes;
      const line = ghost ? DEEP.hazard : sp.code < SPRITE.ghost ? 0xffffff : P.line;
      neonBox(ctx, x + 1, y + 1, 2 * S - 2, 2 * S - 2, line, ghost ? DEEP.hazardGlow : P.glow);
      ctx.fillStyle = css(line);
      tinyText(ctx, `${i}${hex2(sp.code)}`, x + 3, y + 3);
    });
    const wh = this.waveHeight(st, t);
    if (wh > 0) {
      ctx.fillStyle = css(DEEP.hazard, 0.25);
      ctx.fillRect(0, Math.round((H - wh) * S), W * S, Math.round(wh * S));
      ctx.fillStyle = HAZARD;
      for (let k = 0; k < W * S; k += 2) {
        const yy = (H - wh * (0.5 + 0.5 * Math.sin(k / 5 + t * 12))) * S;
        ctx.fillRect(k, Math.round(yy), 2, 2);
      }
    }
  },
};
