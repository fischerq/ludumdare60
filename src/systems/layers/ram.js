// Deep layer 3, work RAM. No Phaser. The program's work RAM (MAP.ram, 0x4c00-0x4fef) as it sits in memory: 32
// bytes per row, each cell printed in hex. Blade trap (the enemy): the CPU's write head replays the program's real
// RAM writes from the bus log. It waits at the start of the row it will write (telegraph), then dashes along the
// row to the address and writes; anything in its way is hit. Every byte that changed since this layer last looked
// is dirty and can be eaten as a dot. Objectives: bytes of the game state, found by the program's own symbols
// (DEEP.ram.goals: the score, the lives, Pac-Man's and Blinky's x position).

import { DEEP } from '../../config.js';
import { MAP } from '../arcade/memmap.js';
import { BUS } from '../arcade/machine.js';
import { tinyText, hex2 } from './font.js';
import { css, floor, neonBox, dot, HAZARD } from './tron.js';

const C = DEEP.ram;
const COLS = 32;
const BASE = MAP.ram[0];
const SIZE = MAP.ram[1] - MAP.ram[0] + 1;   // 1008 bytes: the last row is half (the sprite registers follow)
const ROWS = Math.ceil(SIZE / COLS);

// The name of a work RAM address from the program's symbols: the nearest one at or below it ("GHOST0+4").
function namer(S) {
  const syms = Object.entries(S).filter(([, v]) => v >= BASE && v < BASE + SIZE).sort((a, b) => a[1] - b[1]);
  return (a) => {
    let best = null;
    for (const s of syms) if (s[1] <= BASE + a) best = s; else break;
    if (!best || BASE + a - best[1] > C.nameReach) return '';
    return BASE + a === best[1] ? best[0] : `${best[0]}+${BASE + a - best[1]}`;
  };
}

export default {
  id: 'ram',
  title: 'WORK RAM',
  subtitle: 'GET THE GAME STATE BYTES\nTHE WRITE HEAD DASHES ALONG ITS ROW',
  cols: COLS, rows: ROWS,
  start: { x: 16, y: 20 },
  goal: C.goals.length,

  init({ m, S }) {
    // Objectives: { a: offset into work RAM, name }; a symbol the program doesn't have is left out.
    const goals = C.goals.filter((g) => S[g.sym] != null).map((g) => ({ a: S[g.sym] + (g.add ?? 0) - BASE, name: g.name }));
    return { seen: m.ram.slice(0, SIZE), dirty: new Set(), queue: [], head: null, busFrom: m.busCount, flash: [], got: new Set(), goals, name: namer(S) };
  },

  open(st, env, x, y) {
    return x >= 0 && x < COLS && y >= 0 && y * COLS + x < SIZE;
  },

  info(st) {
    if (!st.head) return 'WAITING FOR A WRITE';
    const n = st.name(st.head.a);
    return `CPU WRITES ${hex2(st.head.v)} TO ${(BASE + st.head.a).toString(16).toUpperCase()}${n ? ` ${n}` : ''}`;
  },

  // Where the head is: { x, y, dashing } (x in bytes along the row).
  headPos(st, t) {
    const h = st.head, y = Math.floor(h.a / COLS), k = t - h.t - C.waitTime;
    return k < 0 ? { x: 0, y, dashing: false } : { x: Math.min(h.a % COLS, k * C.dashSpeed), y, dashing: true };
  },

  update(st, env) {
    const { m, t, player } = env;
    // New work RAM writes on the bus since last time (the ring holds the last N accesses).
    const N = m.busAddr.length;
    for (let i = Math.max(st.busFrom, m.busCount - N); i < m.busCount; i++) {
      const j = i % N, a = m.busAddr[j];
      if (m.busKind[j] === BUS.write && a >= BASE && a < BASE + SIZE) st.queue.push({ a: a - BASE, v: m.busVal[j] });
    }
    st.busFrom = m.busCount;
    if (st.queue.length > C.queue) st.queue.splice(0, st.queue.length - C.queue);
    if (!st.head && st.queue.length) st.head = { ...st.queue.shift(), t };
    st.flash = st.flash.filter((f) => t - f.t < 0.3);
    for (let i = 0; i < SIZE; i++) {
      if (m.ram[i] !== st.seen[i]) { st.seen[i] = m.ram[i]; st.dirty.add(i); }
    }
    if (st.head) {
      const p = this.headPos(st, t);
      if (p.dashing && Math.abs(player.y - p.y) < 0.6 && Math.abs(player.x - p.x) < 0.8) return 'hit';
      if (p.x >= st.head.a % COLS) { st.flash.push({ a: st.head.a, t }); st.head = null; }
    }
    const a = Math.round(player.y) * COLS + Math.round(player.x);
    if (st.goals.some((g) => g.a === a) && !st.got.has(a)) { st.got.add(a); st.dirty.delete(a); return 'objective'; }
    if (st.dirty.delete(a)) return 'dot';
    return null;
  },

  draw(ctx, st, env, S) {
    const { m, t, P } = env;
    floor(ctx, P, COLS, ROWS, S);
    if (st.head) {
      const p = this.headPos(st, t);
      ctx.fillStyle = css(DEEP.hazard, p.dashing ? 0.3 : 0.12 + 0.12 * Math.sin(t * 20));
      ctx.fillRect(0, p.y * S + 1, ((st.head.a % COLS) + 1) * S, S - 1);
    }
    const goal = new Set(st.goals.filter((g) => !st.got.has(g.a)).map((g) => g.a));
    for (let i = 0; i < SIZE; i++) {
      const x = i % COLS, y = Math.floor(i / COLS), v = m.ram[i];
      if (goal.has(i)) { dot(ctx, env, 'special', x, y, S); continue; }
      if (st.dirty.has(i)) { dot(ctx, env, 'dot', x, y, S); continue; }
      ctx.fillStyle = css(v ? P.dot : P.grid);
      tinyText(ctx, hex2(v), x * S + Math.floor((S - 8) / 2), y * S + Math.floor((S - 5) / 2));
    }
    // The objectives' names over their bytes (under the row when there's no room above).
    ctx.fillStyle = css(P.line);
    for (const g of st.goals) {
      if (!goal.has(g.a)) continue;
      const x = g.a % COLS, y = Math.floor(g.a / COLS);
      tinyText(ctx, g.name, Math.min(x * S, COLS * S - g.name.length * 4), y > 0 ? y * S - 6 : (y + 1) * S + 1);
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
