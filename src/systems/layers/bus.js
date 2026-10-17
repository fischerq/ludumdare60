// Deep layer 4, the system bus. No Phaser. 16 address lanes, 8 data lanes and the control lines, with the
// bus cycles of a real frame scrolling down the screen, slowed to DEEP.bus.rate per second. Instruction
// fetches from ROM are left out (they're most of the traffic); what's left is the program touching RAM,
// video RAM and I/O. A 1 on an address lane is live voltage: don't be there when that row reaches you. On
// a read the data lanes carry the payload in: grab the 1s. On a write the CPU drives them: avoid them too.

import { DEEP } from '../../config.js';
import { BUS } from '../arcade/machine.js';
import { region } from '../arcade/memmap.js';
import { tinyText } from './font.js';

const C = DEEP.bus;
const COLS = 27;          // 16 address lanes, a gap, 8 data lanes, a gap, the control column
const ROWS = 30;
const DATA0 = 17, CTRL = 26;
const REGION_COLOR = { vram: '#1a2a8a', cram: '#2a1a6a', ram: '#1a5030', io: '#603018', port: '#603018', rom: '#303030' };

export default {
  id: 'bus',
  title: 'THE SYSTEM BUS',
  subtitle: 'GRAB THE DATA THAT GETS READ\nAVOID LIVE ADDRESS LINES AND WRITES',
  cols: COLS, rows: ROWS,
  start: { x: 25, y: ROWS - 3 },   // the gap between data and control: never live
  goal: C.goal,

  init() {
    return { rows: [], queue: [], step: 0, taken: new Set() };
  },

  open(st, env, x, y) {
    return x >= 0 && x < COLS && y >= 0 && y < ROWS;
  },

  // Takes the latest frame's bus cycles (without ROM reads) when the queue runs out.
  refill(st, m) {
    const r = m.frameRange(0);
    if (!r) return;
    const N = m.busAddr.length;
    for (let i = r.from; i < r.to; i++) {
      const j = i % N, kind = m.busKind[j], addr = m.busAddr[j];
      if (!(kind & BUS.io) && !(kind & BUS.write) && addr < 0x4000) continue;
      st.queue.push({ addr, value: m.busVal[j], write: !!(kind & BUS.write), io: !!(kind & BUS.io), frame: r.frame });
    }
  },

  // Lane state of a row: 'live' (address 1), 'data' (read payload 1), 'drive' (write data 1) or null.
  lane(row, x) {
    if (!row) return null;
    if (x < 16) return (row.addr >> (15 - x)) & 1 ? 'live' : null;
    if (x >= DATA0 && x < DATA0 + 8) return (row.value >> (7 - (x - DATA0))) & 1 ? (row.write ? 'drive' : 'data') : null;
    return null;
  },

  update(st, env) {
    const { m, t, player } = env;
    const step = Math.floor(t * C.rate);
    while (st.step < step) {
      st.step++;
      if (!st.queue.length) this.refill(st, m);
      st.rows.unshift(st.queue.shift() ?? null);
      if (st.rows.length > ROWS) st.rows.pop();
    }
    const px = Math.round(player.x), py = Math.round(player.y), row = st.rows[py];
    const kind = this.lane(row, px);
    if (kind === 'live' || kind === 'drive') return 'hit';
    const key = `${st.step - py}:${px}`;
    if (kind === 'data' && !st.taken.has(key)) { st.taken.add(key); return 'collect'; }
    return null;
  },

  draw(ctx, st, env, S) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, COLS * S, ROWS * S);
    for (let y = 0; y < ROWS; y++) {
      const row = st.rows[y];
      if (row) {
        ctx.fillStyle = REGION_COLOR[row.io ? 'port' : region(row.addr)] ?? '#202020';
        ctx.globalAlpha = 0.35;
        ctx.fillRect(0, y * S, COLS * S, S - 1);
        ctx.globalAlpha = 1;
      }
      for (let x = 0; x < COLS; x++) {
        const kind = this.lane(row, x);
        const lane = x < 16 || (x >= DATA0 && x < DATA0 + 8);
        if (lane) { ctx.fillStyle = '#1c1c28'; ctx.fillRect(x * S + S / 2 - 1, y * S, 2, S); }
        if (kind === 'live') { ctx.fillStyle = '#ff3030'; ctx.fillRect(x * S + 2, y * S + 2, S - 4, S - 4); }
        if (kind === 'drive') { ctx.fillStyle = '#ff8000'; ctx.fillRect(x * S + 2, y * S + 2, S - 4, S - 4); }
        if (kind === 'data' && !st.taken.has(`${st.step - y}:${x}`)) {
          ctx.fillStyle = '#40ff80';
          ctx.fillRect(x * S + S / 2 - 2, y * S + S / 2 - 2, 4, 4);
        }
      }
      if (row) {
        ctx.fillStyle = row.write ? '#ff8000' : '#40ff80';
        tinyText(ctx, row.io ? (row.write ? 'O' : 'I') : row.write ? 'W' : 'R', CTRL * S + 2, y * S + Math.floor((S - 5) / 2));
      }
    }
    ctx.fillStyle = '#9aa4bf';
    tinyText(ctx, 'A15', 0, 1);
    tinyText(ctx, 'A0', 15 * S, 1);
    tinyText(ctx, 'D7', DATA0 * S, 1);
    tinyText(ctx, 'D0', (DATA0 + 7) * S, 1);
  },
};
