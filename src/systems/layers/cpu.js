// Deep layer 5, the CPU. No Phaser. The program's own source listing (game.asm as assembled), with the
// program counter replaying a real trace of the CPU's instructions from the start of a frame, slowed to
// DEEP.cpu.rate per second. The trace starts where the vblank interrupt lands. The line the PC jumps to is
// hit; every instruction that leaves the Zero or Carry flag set drops that flag on its line to collect.
// The registers after the current instruction are shown along the bottom.

import { DEEP } from '../../config.js';
import { world, requestTrace } from '../arcade/world.js';
import { tinyText } from './font.js';

const C = DEEP.cpu;
const COLS = 22, ROWS = 30, TEXT_ROWS = ROWS - 3;
const hex = (v, n) => v.toString(16).toUpperCase().padStart(n, '0');

// Instruction lines of the listing: { addr, text } in address order.
function program() {
  return world.program.listing
    .filter((l) => l.bytes.length && !/^\s*(\.?\w+:)?\s*(db|dw|ds|defb|defw|defs)\b/i.test(l.source))
    .map((l) => ({ addr: l.addr, text: `${hex(l.addr, 4)} ${l.source.replace(/;.*/, '').replace(/^\s*\.?\w+:/, '').trim()}`.toUpperCase() }));
}

export default {
  id: 'cpu',
  title: 'THE CPU',
  subtitle: 'DODGE THE PROGRAM COUNTER\nGRAB THE FLAGS IT SETS',
  cols: COLS, rows: ROWS,
  start: { x: 20, y: 2 },
  goal: C.goal,

  init() {
    const lines = program();
    return { lines, byAddr: new Map(lines.map((l, i) => [l.addr, i])), trace: null, i: 0, step: -1, page: 0, flags: new Map(), regs: null };
  },

  open(st, env, x, y) {
    return x >= 0 && x < COLS && y >= 0 && y < TEXT_ROWS;
  },

  update(st, env) {
    const { t, player } = env;
    if (!st.trace) {
      if (!st.waiting) { st.waiting = true; requestTrace(C.trace, (steps) => { st.trace = steps; st.i = 0; st.waiting = false; st.t0 = t; }); }
      return null;
    }
    const step = Math.floor((t - st.t0) * C.rate);
    let landed = false;
    while (st.step < step) {
      st.step++;
      if (st.i >= st.trace.length) { st.trace = null; st.step = -1; return null; }
      const s = st.trace[st.i++];
      st.regs = s;
      const line = st.byAddr.get(s.pc);
      if (line === undefined) continue;
      st.line = line;
      st.page = Math.floor(line / TEXT_ROWS) * TEXT_ROWS;
      landed = true;
      const prev = st.trace[st.i - 2];
      if (prev && (s.f.Z || s.f.C)) {
        const at = st.byAddr.get(prev.pc);
        if (at !== undefined) {
          if (s.f.Z) st.flags.set(`${at}:Z`, true);
          if (s.f.C) st.flags.set(`${at}:C`, true);
        }
      }
    }
    const py = Math.round(player.y), px = Math.round(player.x);
    if (landed && st.line - st.page === py) return 'hit';
    const line = st.page + py;
    for (const f of ['Z', 'C']) {
      if (px === (f === 'Z' ? COLS - 3 : COLS - 1) && st.flags.delete(`${line}:${f}`)) return 'collect';
    }
    return null;
  },

  draw(ctx, st, env, S) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, COLS * S, ROWS * S);
    for (let y = 0; y < TEXT_ROWS; y++) {
      const i = st.page + y, l = st.lines[i];
      if (!l) continue;
      if (i === st.line) { ctx.fillStyle = '#803010'; ctx.fillRect(0, y * S, COLS * S, S - 1); }
      ctx.fillStyle = i === st.line ? '#ffffff' : '#8890b0';
      tinyText(ctx, l.text.slice(0, Math.floor((COLS - 3) * S / 8)), 2, y * S + Math.floor((S - 10) / 2), 2);
      for (const f of ['Z', 'C']) {
        if (!st.flags.has(`${i}:${f}`)) continue;
        ctx.fillStyle = f === 'Z' ? '#40ff80' : '#40c0ff';
        tinyText(ctx, f, (f === 'Z' ? COLS - 3 : COLS - 1) * S + Math.floor((S - 6) / 2), y * S + Math.floor((S - 10) / 2), 2);
      }
    }
    const r = st.regs;
    ctx.fillStyle = '#ffe600';
    const yy = TEXT_ROWS * S + 4;
    if (!r) { tinyText(ctx, 'WAITING FOR VBLANK', 2, yy, 2); return; }
    tinyText(ctx, `PC ${hex(r.pc, 4)} SP ${hex(r.sp, 4)} A ${hex(r.a, 2)}`, 2, yy, 2);
    const fl = ['S', 'Z', 'H', 'P', 'N', 'C'].map((k) => (r.f[k] ? k : '-')).join('');
    tinyText(ctx, `BC ${hex(r.b, 2)}${hex(r.c, 2)} DE ${hex(r.d, 2)}${hex(r.e, 2)} HL ${hex(r.h, 2)}${hex(r.l, 2)} ${fl}`, 2, yy + 14, 2);
  },
};
