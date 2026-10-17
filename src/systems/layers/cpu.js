// Deep layer 5, the CPU. No Phaser. The program's own source listing (game.asm as assembled), one page at a
// time; walk off the top or bottom to turn the page. Warps: every CALL / JP / JR / DJNZ line has a pad at its
// left edge that warps you to the line it jumps to (CALL also pushes the way back), and RET pads warp you back.
// Switch blocks: the Z and C flags of the real trace raise and lower two columns of blocks, like crystal switches
// (standing in one when it rises is a hit). The enemy is the program counter, replaying a real trace of a frame
// (from the vblank interrupt on): the line it lands on fires, a hit if you're on it. Zero / Carry flags it sets
// drop on their lines as dots. Objectives: reach routines through their CALL warps.

import { DEEP } from '../../config.js';
import { world, requestTrace } from '../arcade/world.js';
import { tinyText } from './font.js';
import { css, floor, neonLine, neonBlock, neonBox, dot } from './tron.js';

const C = DEEP.cpu;
const COLS = 22, ROWS = 30, TEXT_ROWS = ROWS - 3;
const hex = (v, n) => v.toString(16).toUpperCase().padStart(n, '0');
const JUMP = /^(call|jp|jr|djnz)\s+(?:(?:nz|z|nc|c|po|pe|p|m)\s*,\s*)?([a-z_][\w.]*)\s*$/i;
const RET = /^reti?\b/i;

// Instruction lines of the listing: { addr, text, op, target (label) } in address order.
function program() {
  return world.program.listing
    .filter((l) => l.bytes.length && !/^\s*(\.?\w+:)?\s*(db|dw|ds|defb|defw|defs)\b/i.test(l.source))
    .map((l) => {
      const src = l.source.replace(/;.*/, '').replace(/^\s*\.?\w+:/, '').trim();
      const j = JUMP.exec(src);
      return {
        addr: l.addr, text: `${hex(l.addr, 4)} ${src}`.toUpperCase(),
        op: j ? j[1].toLowerCase() : RET.test(src) ? 'ret' : null, target: j?.[2] ?? null,
      };
    });
}

export default {
  id: 'cpu',
  title: 'THE CPU',
  subtitle: 'TAKE CALL WARPS INTO ROUTINES\nDODGE THE PROGRAM COUNTER',
  cols: COLS, rows: ROWS,
  start: { x: 12, y: 2 },
  goal: C.goal,

  init() {
    const lines = program();
    const byAddr = new Map(lines.map((l, i) => [l.addr, i]));
    for (const l of lines) {
      const a = l.target ? world.program.symbols[l.target] : undefined;
      l.to = a === undefined ? undefined : byAddr.get(a);
      if (l.to === undefined && l.op !== 'ret') l.op = null; // a jump we can't follow (e.g. JP (HL)) has no pad
    }
    return { lines, byAddr, trace: null, i: 0, step: -1, page: 0, flags: new Map(), regs: null, stack: [], visited: new Set(), tile: null };
  },

  gate(st, x, line) {
    const f = st.regs?.f;
    if (!f) return false;
    return (x === C.zColumn && line % 3 === 1 && f.Z) || (x === C.cColumn && line % 3 === 2 && f.C);
  },

  open(st, env, x, y) {
    if (x < 0 || x >= COLS) return false;
    if (y === -1) return st.page > 0;
    if (y === TEXT_ROWS) return st.page + TEXT_ROWS < st.lines.length;
    if (y < 0 || y > TEXT_ROWS) return false;
    const line = st.page + y;
    return line < st.lines.length && !this.gate(st, x, line);
  },

  info(st) {
    const pages = Math.ceil(st.lines.length / TEXT_ROWS), pcPage = st.line === undefined ? -1 : Math.floor(st.line / TEXT_ROWS);
    return `PAGE ${st.page / TEXT_ROWS + 1}/${pages}  PC ${pcPage === st.page / TEXT_ROWS ? 'HERE!' : `ON PAGE ${pcPage + 1}`}  STACK ${st.stack.length}`;
  },

  onRespawn(st) {
    st.page = 0;
    st.stack = [];
    st.tile = null;
  },

  warp(st, player, line) {
    st.page = Math.floor(line / TEXT_ROWS) * TEXT_ROWS;
    player.x = 1; player.y = line - st.page; player.dir = null; player.next = null;
    st.tile = { x: 1, y: player.y };
  },

  update(st, env) {
    const { t, player } = env;
    // Turning the page: off the top or bottom edge.
    if (player.y <= -1) { st.page -= TEXT_ROWS; player.y += TEXT_ROWS; }
    if (player.y >= TEXT_ROWS) { st.page += TEXT_ROWS; player.y -= TEXT_ROWS; }

    let landed = false;
    if (!st.trace) {
      if (!st.waiting) { st.waiting = true; requestTrace(C.trace, (steps) => { st.trace = steps; st.i = 0; st.step = -1; st.waiting = false; st.t0 = t; }); }
    } else {
      const step = Math.floor((t - st.t0) * C.rate);
      while (st.trace && st.step < step) {
        st.step++;
        if (st.i >= st.trace.length) { st.trace = null; break; }
        const s = st.trace[st.i++];
        st.regs = s;
        const line = st.byAddr.get(s.pc);
        if (line === undefined) continue;
        st.line = line;
        landed = true;
        const prev = st.trace[st.i - 2];
        const at = prev && st.byAddr.get(prev.pc);
        if (at !== undefined && s.f.Z) st.flags.set(`${at}:Z`, true);
        if (at !== undefined && s.f.C) st.flags.set(`${at}:C`, true);
      }
    }
    const px = Math.round(player.x), py = Math.round(player.y), line = st.page + py;
    if (landed && st.line === line) return 'hit';
    if (this.gate(st, px, line) && Math.abs(player.x - px) + Math.abs(player.y - py) < 0.3) return 'hit';
    // Warp pads fire when you step onto them.
    const arrived = !st.tile || st.tile.x !== px || st.tile.y !== py;
    st.tile = { x: px, y: py };
    const l = st.lines[line];
    if (arrived && px === 0 && l?.op) {
      if (l.op === 'ret') {
        if (st.stack.length) this.warp(st, player, st.stack.pop());
        return null;
      }
      if (l.op === 'call') st.stack.push(line + 1);
      this.warp(st, player, l.to);
      if (l.op === 'call' && !st.visited.has(l.target)) { st.visited.add(l.target); return 'objective'; }
      return null;
    }
    for (const f of ['Z', 'C']) {
      if (px === (f === 'Z' ? COLS - 3 : COLS - 1) && st.flags.delete(`${line}:${f}`)) return 'dot';
    }
    return null;
  },

  draw(ctx, st, env, S) {
    const { P } = env;
    floor(ctx, P, COLS, ROWS, S);
    const f = st.regs?.f ?? {};
    for (let y = 0; y < TEXT_ROWS; y++) {
      const i = st.page + y, l = st.lines[i];
      if (!l) continue;
      if (i === st.line) neonBlock(ctx, 0, y * S, COLS * S, S, DEEP.hazard, DEEP.hazardGlow);
      ctx.fillStyle = css(i === st.line ? 0xffffff : P.line);
      tinyText(ctx, l.text.slice(0, Math.floor(((COLS - 4) * S) / 8)), S + 2, y * S + Math.floor((S - 10) / 2), 2);
      if (l.op) {
        // Warp pad: C call, J jump, R return; an unvisited routine's pad carries the special.
        neonBox(ctx, 1, y * S + 1, S - 2, S - 2, l.op === 'ret' ? P.dot2 : P.line, P.glow);
        if (l.op === 'call' && !st.visited.has(l.target)) dot(ctx, env, 'special', 0, y, S);
        else { ctx.fillStyle = css(P.dot); tinyText(ctx, l.op === 'call' ? 'C' : l.op === 'ret' ? 'R' : 'J', 6, y * S + Math.floor((S - 5) / 2)); }
      }
      // Switch blocks: up (solid) while their flag is set, flat outlines while it's clear.
      for (const [x, k, up] of [[C.zColumn, 1, f.Z], [C.cColumn, 2, f.C]]) {
        if (i % 3 !== k) continue;
        const color = k === 1 ? P.dot : P.dot2;
        if (up) { ctx.fillStyle = css(P.glow); ctx.fillRect(x * S, y * S, S, S); ctx.fillStyle = css(color); ctx.fillRect(x * S + 1, y * S + 1, S - 2, S - 2); }
        else { ctx.fillStyle = css(color, 0.35); ctx.fillRect(x * S + 4, y * S + 4, S - 8, S - 8); }
      }
      for (const fl of ['Z', 'C']) if (st.flags.has(`${i}:${fl}`)) dot(ctx, env, fl === 'Z' ? 'dot' : 'dot2', fl === 'Z' ? COLS - 3 : COLS - 1, y, S);
    }
    ctx.fillStyle = css(P.grid);
    ctx.fillRect(0, TEXT_ROWS * S, COLS * S, ROWS * S - TEXT_ROWS * S);
    neonLine(ctx, 0, TEXT_ROWS * S, COLS * S - 1, TEXT_ROWS * S, P.line, P.glow);
    const r = st.regs;
    ctx.fillStyle = css(P.dot);
    const yy = TEXT_ROWS * S + 4;
    if (!r) { tinyText(ctx, 'WAITING FOR VBLANK', 2, yy, 2); return; }
    tinyText(ctx, `PC ${hex(r.pc, 4)} SP ${hex(r.sp, 4)} A ${hex(r.a, 2)}`, 2, yy, 2);
    const fl = ['S', 'Z', 'H', 'P', 'N', 'C'].map((k) => (r.f[k] ? k : '-')).join('');
    tinyText(ctx, `BC ${hex(r.b, 2)}${hex(r.c, 2)} DE ${hex(r.d, 2)}${hex(r.e, 2)} HL ${hex(r.h, 2)}${hex(r.l, 2)} ${fl}`, 2, yy + 14, 2);
  },
};
