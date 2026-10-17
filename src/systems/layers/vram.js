// Deep layer 3, video RAM. No Phaser. The 1 KB of VRAM as it sits in memory: 32 bytes per row, each cell
// printed in hex; the 13 unused bytes at the end of each row are floor too. Blade trap (the enemy): the CPU's write
// head replays the program's real VRAM writes from the bus log. It waits at the start of the row it will write
// (telegraph), then dashes along the row to the address and writes; anything in its way is hit. Every byte that
// changed since this layer last looked is dirty and can be eaten as a dot. Objectives: the bytes of the four
// power pellets (where the maze layout has them).

import { DEEP, MAZE } from '../../config.js';
import { CELL, MAP } from '../arcade/memmap.js';
import { BUS } from '../arcade/machine.js';
import { H } from '../arcade/video.js';
import { tinyText, hex2 } from './font.js';
import { css, floor, neonBox, dot, HAZARD } from './tron.js';

const C = DEEP.vram;
const COLS = 32;
const PELLETS = MAZE.layout.flatMap((row, y) => [...row].map((ch, x) => (ch === 'o' ? y * COLS + x : -1))).filter((a) => a >= 0);

export default {
  id: 'vram',
  title: 'VIDEO RAM',
  subtitle: 'GET THE FOUR POWER PELLET BYTES\nTHE WRITE HEAD DASHES ALONG ITS ROW',
  cols: COLS, rows: H,
  start: { x: 24, y: 12 },
  goal: C.goal,

  init({ m }) {
    return { seen: m.vram.slice(), dirty: new Set(), queue: [], head: null, busFrom: m.busCount, flash: [], got: new Set() };
  },

  open(st, env, x, y) {
    return x >= 0 && x < COLS && y >= 0 && y < H;
  },

  info(st) {
    return st.head ? `CPU WRITES ${hex2(st.head.v)} TO ${(MAP.vram[0] + st.head.a).toString(16).toUpperCase()}` : 'WAITING FOR A WRITE';
  },

  // Where the head is: { x, y, dashing } (x in bytes along the row).
  headPos(st, t) {
    const h = st.head, y = Math.floor(h.a / COLS), k = t - h.t - C.waitTime;
    return k < 0 ? { x: 0, y, dashing: false } : { x: Math.min(h.a % COLS, k * C.dashSpeed), y, dashing: true };
  },

  update(st, env) {
    const { m, t, player } = env;
    // New VRAM writes on the bus since last time (the ring holds the last N accesses).
    const N = m.busAddr.length;
    for (let i = Math.max(st.busFrom, m.busCount - N); i < m.busCount; i++) {
      const j = i % N, a = m.busAddr[j];
      if (m.busKind[j] === BUS.write && a >= MAP.vram[0] && a < MAP.vram[0] + COLS * H) st.queue.push({ a: a - MAP.vram[0], v: m.busVal[j] });
    }
    st.busFrom = m.busCount;
    if (st.queue.length > C.queue) st.queue.splice(0, st.queue.length - C.queue);
    if (!st.head && st.queue.length) st.head = { ...st.queue.shift(), t };
    st.flash = st.flash.filter((f) => t - f.t < 0.3);
    for (let i = 0; i < COLS * H; i++) {
      if (m.vram[i] !== st.seen[i]) { st.seen[i] = m.vram[i]; st.dirty.add(i); }
    }
    if (st.head) {
      const p = this.headPos(st, t);
      if (p.dashing && Math.abs(player.y - p.y) < 0.6 && Math.abs(player.x - p.x) < 0.8) return 'hit';
      if (p.x >= st.head.a % COLS) { st.flash.push({ a: st.head.a, t }); st.head = null; }
    }
    const a = Math.round(player.y) * COLS + Math.round(player.x);
    if (PELLETS.includes(a) && !st.got.has(a)) { st.got.add(a); return 'objective'; }
    if (st.dirty.delete(a)) return 'dot';
    return null;
  },

  draw(ctx, st, env, S) {
    const { m, t, P } = env;
    floor(ctx, P, COLS, H, S);
    if (st.head) {
      const p = this.headPos(st, t);
      ctx.fillStyle = css(DEEP.hazard, p.dashing ? 0.3 : 0.12 + 0.12 * Math.sin(t * 20));
      ctx.fillRect(0, p.y * S + 1, ((st.head.a % COLS) + 1) * S, S - 1);
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < COLS; x++) {
        const i = y * COLS + x, v = m.vram[i];
        if (PELLETS.includes(i) && !st.got.has(i)) { dot(ctx, env, 'special', x, y, S); continue; }
        if (st.dirty.has(i)) { dot(ctx, env, 'dot', x, y, S); continue; }
        ctx.fillStyle = css(v === CELL.wall ? P.line : v ? P.dot : P.grid, x >= 19 ? 0.5 : 1);
        tinyText(ctx, hex2(v), x * S + Math.floor((S - 8) / 2), y * S + Math.floor((S - 5) / 2));
      }
    }
    if (st.head) {
      const p = this.headPos(st, t), x = Math.round(p.x * S), y = p.y * S;
      neonBox(ctx, (st.head.a % COLS) * S, y, S, S, DEEP.hazard, DEEP.hazardGlow);
      ctx.fillStyle = HAZARD;
      ctx.fillRect(x - 1, y - 2, S + 2, S + 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 2, y + 1, S - 4, S - 2);
      ctx.fillStyle = HAZARD;
      tinyText(ctx, `W${hex2(st.head.v)}`, Math.min(x, COLS * S - 14), Math.max(0, y - 8));
    }
    for (const f of st.flash) {
      ctx.fillStyle = `rgba(255,255,255,${1 - (t - f.t) / 0.3})`;
      ctx.fillRect((f.a % COLS) * S, Math.floor(f.a / COLS) * S, S - 1, S - 1);
    }
  },
};
