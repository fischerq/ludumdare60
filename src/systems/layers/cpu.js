// Deep layer 5, the CPU. No Phaser. Game Genie: one routine of the real program (game.asm as the browser
// assembled it) per screen, DEEP.cpu.lines big lines of it. A patch token lies on one line: a replacement
// instruction, shown as its text. Carry it onto the marked line and it is really written into the machine's ROM,
// so the game in the small picture at the top changes (dots worth more, Pac-Man faster, ghosts slower, Pac-Man
// eats any ghost). Then the next routine comes up; four patches win the layer.
// The enemy is the program counter: a glowing cursor that replays a real trace of a frame, slowed down
// (DEEP.cpu.rate lines per second while it's in this routine, DEEP.cpu.awayTime for each stretch it spends
// elsewhere). It steps line by line and an arrow shows where it jumps; the line it lands on hits you.
// Patches stay in the ROM for the session (until the page reloads); entering the layer starts from the original
// program again (revertPatches), so it can be played again.

import { DEEP } from '../../config.js';
import { world, requestTrace } from '../arcade/world.js';
import { drawPlayfield, W as MW, H as MH } from '../arcade/video.js';
import { readState } from '../arcade/state.js';
import { tinyText } from './font.js';
import { css, floor, neonLine, neonBox, neonBlock, HAZARD } from './tron.js';

const C = DEEP.cpu;
const N = C.lines;
const COLS = 13, TOP = 5, ROWS = TOP + N + 2;  // picture and patch panel above, registers below
const hex = (v, n) => v.toString(16).toUpperCase().padStart(n, '0');
const GLOBAL = /^([A-Za-z_]\w*):/;

// A listing line split into its label and its instruction (comment left out, spaces squeezed).
function parse(source) {
  let s = source.replace(/;.*/, '');
  const m = /^\s*(\.?[A-Za-z_]\w*):/.exec(s);
  if (m) s = s.slice(m[0].length);
  return { label: m ? `${m[1]}:` : '', instr: s.trim().replace(/\s+/g, ' ') };
}
const squeeze = (s) => s.toUpperCase().replace(/,\s*/g, ',');

// The original bytes under each patch, so they can be put back: addr -> byte.
const original = new Map();

// Puts the original program back (entering the layer, and between playtest runs).
export function revertPatches(m = world.machine) {
  if (!m) return;
  for (const [a, v] of original) m.rom[a] = v;
  original.clear();
}

function writeRom(m, addr, bytes) {
  bytes.forEach((v, i) => {
    if (!original.has(addr + i)) original.set(addr + i, m.rom[addr + i]);
    m.rom[addr + i] = v;
  });
}

// One screen per patch: the routine's instruction lines around the patched one.
function buildRoutine(p, listing, symbols, labels) {
  const start = listing.findIndex((l) => GLOBAL.exec(l.source)?.[1] === p.routine);
  if (start < 0) return null;
  const all = [];
  for (let i = start; i < listing.length; i++) {
    const l = listing[i];
    if (i > start && GLOBAL.test(l.source)) break;
    if (!l.bytes.length || /^\s*(db|dw|ds)\b/i.test(parse(l.source).instr)) continue;
    const { label, instr } = parse(l.source);
    all.push({ addr: l.addr, bytes: l.bytes, label: label.toUpperCase(), text: squeeze(instr), src: instr });
  }
  const at = all.findIndex((l) => l.src === p.line);
  if (at < 0) return null;
  const from = Math.max(0, Math.min(all.length - N, at - p.above));
  const lines = all.slice(from, from + N);
  const row = at - from, line = lines[row];
  // The bytes the patch writes, checked against what the listing says is there.
  let bytes;
  if (p.nop) bytes = line.bytes.map(() => 0x00);
  else if (p.word) {
    if (line.bytes.length !== 3) return null;
    const v = Math.max(1, Math.min(0xffff, Math.round(symbols[p.word.sym] * p.word.times)));
    bytes = [line.bytes[0], v & 0xff, v >> 8];
  }
  if (!bytes) return null;
  const rowOf = new Map(lines.map((l, i) => [l.addr, i]));
  return { p, lines, row, addr: line.addr, bytes, rowOf, first: lines[0].addr, last: lines[N - 1]?.addr ?? lines[lines.length - 1].addr, labels };
}

// The global label a PC address is in (for "PC IN ACCUM").
function routineOf(labels, pc) {
  let name = '';
  for (const l of labels) { if (l.addr > pc) break; name = l.name; }
  return name.toUpperCase();
}

export default {
  id: 'cpu',
  title: 'THE CPU',
  subtitle: 'CARRY PATCHES ONTO THE PROGRAM\nDODGE THE PROGRAM COUNTER',
  cols: COLS, rows: ROWS,
  start: { x: 0, y: TOP + N - 1 },
  goal: C.goal,
  dots: false,

  init({ m }) {
    revertPatches(m);
    const { listing, symbols } = world.program;
    const labels = listing.filter((l) => GLOBAL.test(l.source))
      .map((l) => ({ addr: l.addr, name: GLOBAL.exec(l.source)[1] })).sort((a, b) => a.addr - b.addr);
    const routines = C.patches.map((p) => buildRoutine(p, listing, symbols, labels)).filter(Boolean);
    const st = { routines, k: 0, done: [], carry: false, q: [], cur: null, endT: 0, arrows: [], regs: null, waiting: false, retryT: 0, lastT: 0, graceT: C.grace, nextT: null, flash: 0 };
    this.enter(st, 0);
    return st;
  },

  // Shows routine k: a fresh PC playback and the patch token lying on the line farthest from the marked one.
  enter(st, t) {
    const r = st.routines[st.k];
    st.q = []; st.cur = null; st.arrows = []; st.carry = false; st.graceT = t + C.grace; st.nextT = null;
    if (!r) return;
    // The token lies at least a third of the screen away from the marked line, on the line with the most room
    // beside its text (the card is about w tiles wide at the phone's cell size).
    const w = Math.min(COLS - 1, Math.ceil((r.p.text.length * 8 + 10) / 25));
    const rows = [...r.lines.keys()].filter((i) => Math.abs(i - r.row) >= Math.ceil(N / 3));
    const room = (i) => r.lines[i].label.length * 8 + r.lines[i].text.length * 12;
    const tokenRow = rows.reduce((a, i) => (room(i) < room(a) || (room(i) === room(a) && Math.abs(i - r.row) > Math.abs(a - r.row)) ? i : a), rows[0]);
    st.token = { row: tokenRow, x0: COLS - w, w };
  },

  routine(st) { return st.routines[st.k]; },

  open(st, env, x, y) {
    return x >= 0 && x < COLS && y >= TOP && y < TOP + N;
  },

  counter(st) { return `PATCHES ${st.done.length}/${C.goal}`; },

  info(st) {
    const r = this.routine(st);
    if (!r) return '';
    if (st.nextT !== null) return `PATCHED: ${r.p.name}!`;
    return st.carry ? 'PUT THE PATCH ON THE MARKED LINE' : 'PICK UP THE PATCH';
  },

  onRespawn(st, env) {
    st.carry = false;
    st.graceT = env.t + C.grace;
  },

  // The PC's events from a trace: { row, s } while it's on a line on screen, { away, s, up } for each stretch
  // it spends elsewhere (collapsed into one).
  events(r, steps) {
    const out = [];
    for (const s of steps) {
      const row = r.rowOf.get(s.pc);
      if (row !== undefined) out.push({ row, s });
      else if (!out.length || !out[out.length - 1].away) out.push({ away: true, s, up: s.pc < r.first });
    }
    while (out.length && out[out.length - 1].away) out.pop();
    return out.some((e) => !e.away) ? out : [];
  },

  // Advances the PC playback; true when it lands on a new line this frame.
  stepPC(st, t) {
    const r = this.routine(st);
    let landed = false;
    while (st.q.length && t >= st.endT) {
      const prev = st.cur, e = st.q.shift();
      st.cur = e;
      st.regs = e.s;
      st.endT = Math.max(st.endT, t - 0.5) + (e.away ? C.awayTime : 1 / C.rate);
      if (!e.away) landed = true;
      // An arrow wherever the PC doesn't just go on to the next line.
      const from = prev ? (prev.away ? (prev.up ? 'top' : 'bottom') : prev.row) : null;
      const to = e.away ? (e.up ? 'top' : 'bottom') : e.row;
      if (from !== null && !(typeof from === 'number' && to === from + 1) && !(typeof from === 'string' && typeof to === 'string')) {
        st.arrows.push({ from, to, t });
      }
    }
    if (!st.q.length && t >= st.endT && !st.waiting && t >= st.retryT) {
      st.waiting = true;
      requestTrace(C.trace, (steps) => {
        st.waiting = false;
        if (this.routine(st) !== r) return;
        st.q = this.events(r, steps);
        if (!st.q.length) st.retryT = st.lastT + C.retry;
      });
    }
    st.lastT = t;
    st.arrows = st.arrows.filter((a) => t - a.t < C.arrowTime);
    return landed;
  },

  // The PC's line now, and the next one it will land on (the warning).
  pcRow(st) { return st.cur && !st.cur.away ? st.cur.row : null; },
  nextRow(st) { const e = st.q.find((x) => !x.away); return st.q[0] && !st.q[0].away ? st.q[0].row : (st.cur?.away && e ? e.row : null); },

  update(st, env) {
    const { t, player, m } = env;
    const r = this.routine(st);
    if (!r) return null;
    if (st.nextT !== null) {
      if (t >= st.nextT && st.k < st.routines.length - 1) { st.k++; this.enter(st, t); }
      return null;
    }
    const landed = this.stepPC(st, t);
    const px = Math.round(player.x), row = Math.round(player.y) - TOP;
    if (landed && st.cur.row === row && t >= st.graceT) return 'hit';
    // Picking up the patch token, and putting it on the marked line.
    if (!st.carry && row === st.token.row && px >= st.token.x0) { st.carry = true; return 'pickup'; }
    if (st.carry && row === r.row && Math.abs(player.y - Math.round(player.y)) < 0.3) {
      writeRom(m, r.addr, r.bytes);
      st.done.push(r);
      st.carry = false;
      st.flash = t;
      st.nextT = t + C.nextDelay;
      return 'objective';
    }
    return null;
  },

  draw(ctx, st, env, S) {
    const { m, S: syms, t, P } = env;
    floor(ctx, P, COLS, ROWS, S);
    const r = this.routine(st);
    ctx.fillStyle = css(P.bg);
    ctx.fillRect(0, 0, COLS * S, TOP * S);
    ctx.fillRect(0, (TOP + N) * S, COLS * S, (ROWS - TOP - N) * S);
    if (!r) { ctx.fillStyle = css(P.line); tinyText(ctx, 'NO PROGRAM', 8, 8, 3); return; }
    this.drawPanel(ctx, st, env, S, r);
    const y0 = TOP * S, patched = st.done.includes(r);
    const pc = this.pcRow(st), next = this.nextRow(st);
    for (let i = 0; i < r.lines.length; i++) {
      const l = r.lines[i], y = y0 + i * S;
      const isPatch = i === r.row;
      if (i === pc) {
        // The program counter: a glowing cursor over its line.
        ctx.fillStyle = css(DEEP.hazardGlow);
        ctx.fillRect(S, y - 2, (COLS - 1) * S, S + 4);
        neonBlock(ctx, S, y, (COLS - 1) * S, S, DEEP.hazard, DEEP.hazardGlow);
        ctx.fillStyle = HAZARD;
        for (let k = 0; k < 7; k++) ctx.fillRect(4 + k, y + S / 2 - 7 + k, 1, 15 - 2 * k);
      } else if (i === next) {
        neonBox(ctx, S + 1, y + 1, (COLS - 1) * S - 2, S - 2, DEEP.hazard, DEEP.hazardGlow);
      }
      if (isPatch && !patched) {
        // The marked line: where the patch goes.
        const on = Math.floor(t * 3) % 2 === 0;
        neonBox(ctx, S + 3, y + 3, (COLS - 1) * S - 6, S - 6, on ? 0xffffff : P.dot, P.glow);
      }
      const text = isPatch && patched ? r.p.text : l.text;
      let x = S + 6;
      if (l.label) { ctx.fillStyle = css(i === pc ? 0xffffff : P.dot2); x += tinyText(ctx, l.label, x, y + Math.floor((S - 10) / 2), 2) + 4; }
      ctx.fillStyle = css(i === pc ? 0xffffff : isPatch && patched ? 0xffffff : isPatch ? P.dot : P.line);
      tinyText(ctx, text.slice(0, Math.floor((COLS * S - x - 4) / 12)), x, y + Math.floor((S - 15) / 2), 3);
    }
    this.drawArrows(ctx, st, t, S, y0);
    // The patch token: a card with the new instruction on it, lying on its line or carried along.
    if (!patched && !st.carry) this.drawCard(ctx, r.p.text, st.token.x0 * S + 2, y0 + st.token.row * S + 2, st.token.w * S - 4, S - 4, P, t);
    if (st.carry) {
      const p = env.player, w = Math.min(COLS * S - 4, r.p.text.length * 8 + 12);
      const above = Math.round(p.y) - TOP > 0;
      const cx = Math.max(2, Math.min(COLS * S - w - 2, Math.round((p.x + 0.5) * S - w / 2)));
      this.drawCard(ctx, r.p.text, cx, Math.round((p.y + (above ? -0.85 : 0.95)) * S), w, 18, P, t);
    }
    this.drawRegs(ctx, st, S, P);
  },

  drawCard(ctx, text, x, y, w, h, P, t) {
    ctx.fillStyle = css(P.bg);
    ctx.fillRect(x, y, w, h);
    neonBox(ctx, x, y, w, h, Math.floor(t * 4) % 2 ? 0xffffff : P.special, P.line);
    ctx.fillStyle = '#ffffff';
    tinyText(ctx, text, x + Math.floor((w - text.length * 8) / 2), y + Math.floor((h - 10) / 2), 2);
  },

  // Branch arrows in the left gutter: from line to line, or off the top / bottom edge when the PC leaves.
  drawArrows(ctx, st, t, S, y0) {
    const ry = (v) => (v === 'top' ? y0 + 2 : v === 'bottom' ? y0 + N * S - 3 : y0 + v * S + Math.floor(S / 2));
    for (const a of st.arrows) {
      ctx.globalAlpha = 1 - (t - a.t) / C.arrowTime;
      const ya = ry(a.from), yb = ry(a.to), x = Math.floor(S / 2) + 2;
      neonLine(ctx, x, ya, x, yb, 0xffffff, DEEP.hazard);
      if (typeof a.from === 'number') neonLine(ctx, x, ya, S - 2, ya, 0xffffff, DEEP.hazard);
      if (typeof a.to === 'number') {
        neonLine(ctx, x, yb, S - 2, yb, 0xffffff, DEEP.hazard);
        ctx.fillStyle = '#ffffff';
        for (let k = 0; k < 4; k++) ctx.fillRect(S - 2 - k, yb - k, 1, 2 * k + 1);
      } else {
        ctx.fillStyle = '#ffffff';
        const d = a.to === 'top' ? 1 : -1;
        for (let k = 0; k < 4; k++) ctx.fillRect(x - k, yb + d * k, 2 * k + 1, 1);
      }
    }
    ctx.globalAlpha = 1;
  },

  // Above the code: the machine's picture (the patches change it) and the patch list.
  drawPanel(ctx, st, env, S, r) {
    const { m, S: syms, t, P } = env;
    const T = Math.floor((TOP * S) / MH), pw = MW * T;
    drawPlayfield(ctx, m, env.art, { T, ox: 0, oy: 0 });
    const flash = t - st.flash < C.nextDelay && st.done.length;
    neonBox(ctx, 0, 0, pw, MH * T, flash && Math.floor(t * 8) % 2 ? 0xffffff : P.line, P.glow);
    const x = pw + 10;
    ctx.fillStyle = css(P.dot2);
    tinyText(ctx, `ROUTINE ${st.k + 1}/${st.routines.length}`, x, 4, 2);
    ctx.fillStyle = css(P.line);
    tinyText(ctx, r.p.routine.toUpperCase(), x, 18, 3);
    st.routines.forEach((q, i) => {
      const on = st.done.includes(q);
      ctx.fillStyle = css(on ? 0xffffff : i === st.k ? P.dot : P.grid);
      tinyText(ctx, `${on ? '+' : i === st.k ? ' ' : '-'} ${q.p.name}`, x, 42 + i * 14, 2);
      if (i === st.k && !on) for (let j = 0; j < 5; j++) ctx.fillRect(x + j, 42 + i * 14 + j, 1, 10 - 2 * j);
    });
    const g = readState(m, syms);
    ctx.fillStyle = css(P.dot);
    tinyText(ctx, `SCORE ${g.score}`, x, 98, 2);
    if (st.cur?.away) {
      ctx.fillStyle = css(P.dot2);
      tinyText(ctx, `PC IN ${routineOf(r.labels, st.cur.s.pc)}`, x, 112, 2);
    } else if (st.cur) {
      ctx.fillStyle = HAZARD;
      tinyText(ctx, 'PC HERE!', x, 112, 2);
    }
  },

  // Below the code: the registers as the trace has them at the PC's step, in big boxes.
  drawRegs(ctx, st, S, P) {
    const s = st.regs, y = (TOP + N) * S + 4, h = 2 * S - 8, w = Math.floor((COLS * S - 6 * 4) / 5);
    const boxes = s ? [
      ['PC', hex(s.pc, 4)], ['A', hex(s.a, 2)], ['HL', hex(s.h, 2) + hex(s.l, 2)], ['DE', hex(s.d, 2) + hex(s.e, 2)],
      ['FLAGS', `${s.f.Z ? 'Z' : '-'}${s.f.C ? 'C' : '-'}`],
    ] : [['PC', '----'], ['A', '--'], ['HL', '----'], ['DE', '----'], ['FLAGS', '--']];
    boxes.forEach(([k, v], i) => {
      const x = 4 + i * (w + 4);
      const hot = i === 0 && st.cur && !st.cur.away;
      neonBox(ctx, x, y, w, h, hot ? DEEP.hazard : P.line, P.glow);
      ctx.fillStyle = css(P.dot2);
      tinyText(ctx, k, x + 4, y + 4, 2);
      ctx.fillStyle = css(hot ? 0xffffff : P.dot);
      tinyText(ctx, v, x + 4, y + 18, 3);
    });
  },
};
