// Deep layer 3, video RAM. No Phaser. The 1 KB of VRAM as it sits in memory: 32 bytes per row, each cell
// printed in hex. Bytes holding the wall code are walls; the 13 unused bytes at the end of each row are open
// floor. The CPU's write head replays the program's real VRAM writes from the bus log (slowed down): it
// hovers over the next address, then writes; being there when it writes is a hit. Every byte that changed
// since this layer last looked is "dirty" and can be collected. The video chip's read sweep just passes by.

import { DEEP } from '../../config.js';
import { CELL, MAP } from '../arcade/memmap.js';
import { BUS } from '../arcade/machine.js';
import { H } from '../arcade/video.js';
import { tinyText, hex2 } from './font.js';

const C = DEEP.vram;
const COLS = 32;

export default {
  id: 'vram',
  title: 'VIDEO RAM',
  subtitle: 'PICK UP THE BYTES THAT CHANGED\nDODGE THE CPU WRITING',
  cols: COLS, rows: H,
  start: { x: 24, y: 12 },
  goal: C.goal,

  init({ m }) {
    return { seen: m.vram.slice(), dirty: new Set(), queue: [], head: null, busFrom: m.busCount, flash: [] };
  },

  open(st, env, x, y) {
    return x >= 0 && x < COLS && y >= 0 && y < H && env.m.vram[y * COLS + x] !== CELL.wall;
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
    let hit = false;
    if (st.head && t - st.head.t >= C.writeTime) {
      const { a } = st.head;
      hit = Math.round(player.x) === a % COLS && Math.round(player.y) === Math.floor(a / COLS);
      st.flash.push({ a, t });
      st.head = null;
    }
    st.flash = st.flash.filter((f) => t - f.t < 0.3);
    for (let i = 0; i < COLS * H; i++) {
      if (m.vram[i] !== st.seen[i]) { st.seen[i] = m.vram[i]; st.dirty.add(i); }
    }
    if (hit) return 'hit';
    if (st.dirty.delete(Math.round(player.y) * COLS + Math.round(player.x))) return 'collect';
    return null;
  },

  draw(ctx, st, env, S) {
    const { m, t } = env;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, COLS * S, H * S);
    const readRow = Math.floor(((t % C.readTime) / C.readTime) * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < COLS; x++) {
        const i = y * COLS + x, v = m.vram[i];
        ctx.fillStyle = v === CELL.wall ? '#1a2a8a' : y === readRow ? '#102818' : st.dirty.has(i) ? '#503010' : '#0a0a14';
        ctx.fillRect(x * S, y * S, S - 1, S - 1);
        ctx.fillStyle = st.dirty.has(i) ? '#ffd040' : v === CELL.wall ? '#7080ff' : v ? '#ffb897' : x >= 19 ? '#202030' : '#383850';
        tinyText(ctx, hex2(v), x * S + Math.floor((S - 8) / 2), y * S + Math.floor((S - 5) / 2));
      }
    }
    if (st.head) {
      const { a } = st.head, x = a % COLS, y = Math.floor(a / COLS);
      const p = (t - st.head.t) / C.writeTime;
      ctx.strokeStyle = `rgba(255,${Math.round(255 * (1 - p))},0,1)`;
      ctx.lineWidth = 1;
      const r = Math.round(S * (1.5 - p));
      ctx.strokeRect(x * S + S / 2 - r + 0.5, y * S + S / 2 - r + 0.5, 2 * r - 1, 2 * r - 1);
      ctx.fillStyle = '#ff6040';
      tinyText(ctx, `W${hex2(st.head.v)}`, Math.min(x * S, COLS * S - 14), Math.max(0, y * S - 7));
    }
    for (const f of st.flash) {
      ctx.fillStyle = `rgba(255,255,255,${1 - (t - f.t) / 0.3})`;
      ctx.fillRect((f.a % COLS) * S, Math.floor(f.a / COLS) * S, S - 1, S - 1);
    }
  },
};
