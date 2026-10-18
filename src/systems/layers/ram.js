// Deep layer 3, work RAM: poke the game state. No Phaser. Eight of the game's variables in the machine's real work
// RAM (by the program's own symbols, DEEP.ram.vars) as big boxes: name, value and 8 bit lamps. Stepping onto a
// lamp flips that bit in the emulated RAM, like a cheat device, and the game reacts (watch it in the small picture
// at the top). The enemy is the CPU's write head, a blade trap: when the program really writes a variable (from
// the bus log), the head telegraphs at the variable's left edge, then dashes along its bits; anyone on them is hit.
// Objectives (DEEP.ram.goals): changes the game shows, e.g. 5 lives, Blinky moved, Blinky scared.

import { DEEP } from '../../config.js';
import { MAP, tileOffset, blocksActors } from '../arcade/memmap.js';
import { BUS } from '../arcade/machine.js';
import { drawPlayfield, W as MW, H as MH } from '../arcade/video.js';
import { readState } from '../arcade/state.js';
import { tinyText } from './font.js';
import { css, floor, neonBox, neonBlock, HAZARD } from './tron.js';

const C = DEEP.ram;
const BASE = MAP.ram[0];
const COLS = 19, PIC = 11, ROWS = PIC + 13;   // the picture of the machine takes the rows above PIC
const LANES = [0, 9, 18];                     // walkable columns left, between and right of the boxes
// Box i: left column for the first four, right column for the rest; a label row, the lamp row, a lane under it.
const boxAt = (i) => ({ x: i < 4 ? 1 : 10, y: PIC + 1 + 3 * (i % 4) });
const isLabelRow = (y) => y > PIC && (y - PIC - 1) % 3 === 0 && y < ROWS - 1;

export default {
  id: 'ram',
  title: 'WORK RAM',
  subtitle: 'STEP ON A BIT TO FLIP IT IN THE GAME\nKEEP OFF THE BITS THE CPU WRITES',
  cols: COLS, rows: ROWS,
  start: { x: 9, y: PIC },
  goal: C.goals.length,
  dots: false,

  init({ m, S }) {
    // A variable the program doesn't have is left out (its box stays empty).
    const vars = C.vars.map((v, i) => ({ ...v, i, a: S[v.sym] != null ? S[v.sym] + (v.add ? S[v.add] ?? 0 : 0) - BASE : null, ...boxAt(i) }));
    const byAddr = new Map();
    for (const v of vars) {
      if (v.a == null) continue;
      byAddr.set(v.a, v);
      if (v.kind !== 'byte') byAddr.set(v.a + 1, v);
    }
    return {
      vars, byAddr, busFrom: m.busCount, pending: new Map(), head: null, restUntil: 0, flash: [],
      poked: new Set(), done: new Set(), tile: null, msg: null, msgT: -99, refused: null,
    };
  },

  open(st, env, x, y) {
    if (x < 0 || x >= COLS || y < PIC || y >= ROWS) return false;
    return !isLabelRow(y) || LANES.includes(x);
  },

  // The lamp at tile (x, y): { v, bit } (the high bit on the left), or null.
  lampAt(st, x, y) {
    if (y <= PIC || (y - PIC - 2) % 3) return null;
    const v = st.vars.find((b) => b.y + 1 === y && x >= b.x && x < b.x + 8);
    return v && v.a != null ? { v, bit: 7 - (x - v.x) } : null;
  },

  // The byte the lamps show, and the value the box shows.
  bits(m, v) {
    const lo = m.ram[v.a], hi = m.ram[v.a + 1];
    if (v.kind === 'hi') return hi;
    if (v.kind === 'tile') return ((lo | (hi << 8)) >> 4) & 255;
    return lo;
  },
  value(m, v) {
    if (v.kind === 'hi' || v.kind === 'lo0') return m.ram[v.a] | (m.ram[v.a + 1] << 8);
    return this.bits(m, v) + (v.show ?? 0);
  },
  // The value after flipping a bit (for the goals' hints).
  flipped(m, v, bit) {
    if (v.kind === 'hi') return m.ram[v.a] | ((m.ram[v.a + 1] ^ (1 << bit)) << 8);
    return (this.bits(m, v) ^ (1 << bit)) + (v.show ?? 0);
  },

  // Why a poke of this lamp isn't possible now ('' if it is). Only positions can be refused: the cheat keeps an
  // actor on the maze and out of the walls, and only moves it while it's out in the maze during play.
  refuse(m, S, v, bit, g = readState(m, S)) {
    if (v.kind !== 'tile') return '';
    const ghost = v.ghost != null ? g.ghosts[v.ghost] : null;
    if (g.phase !== 'play') return 'ONLY WHILE THE GAME PLAYS';
    if (ghost && ghost.state !== 'active') return `ONLY WHILE ${v.name.split(' ')[0]} IS OUT`;
    const w = m.ram[v.a] | (m.ram[v.a + 1] << 8), nw = ((((w >> 4) ^ (1 << bit)) & 255) << 4) | (w & 15);
    const o = v.a + (v.axis === 'x' ? 2 : -2), ow = m.ram[o] | (m.ram[o + 1] << 8);
    const tx = (v.axis === 'x' ? nw : ow) + 8 >> 4, ty = (v.axis === 'y' ? nw : ow) + 8 >> 4;
    if (tx < 0 || tx >= MW || ty < 0 || ty >= MH) return 'NO: THAT IS OFF THE MAZE';
    if (blocksActors(m.vram[tileOffset(tx, ty)])) return 'NO: A WALL THERE';
    return '';
  },

  // Flips a bit in the real RAM (directly, not as a CPU write: it isn't on the bus). Returns '' or why not.
  poke(st, env, v, bit) {
    const { m, S } = env, why = this.refuse(m, S, v, bit);
    if (why) return why;
    if (v.kind === 'hi') m.ram[v.a + 1] ^= 1 << bit;
    else if (v.kind === 'tile') {
      const w = (m.ram[v.a] | (m.ram[v.a + 1] << 8)) ^ (1 << (bit + 4));
      m.ram[v.a] = w & 255; m.ram[v.a + 1] = (w >> 8) & 255;
    } else {
      m.ram[v.a] ^= 1 << bit;
      if (v.kind === 'lo0') m.ram[v.a + 1] = 0;
    }
    return '';
  },

  // Goal state, for the counter and the hints: true once done.
  goalMet(st, env, g) {
    const v = st.vars.find((b) => b.id === g.var);
    if (!v || v.a == null || !st.poked.has(v.id)) return false;
    if (g.min != null) return this.value(env.m, v) >= g.min;
    if (g.id === 'scared') {
      const s = readState(env.m, env.S);
      return env.m.ram[v.a] !== 0 && s.ghosts[0].state === 'active';
    }
    return st.movedBy === v.id;
  },

  // The lamps that move an unfinished objective on: they blink (and the playtest bot walks to them).
  wanted(st, env) {
    const { m, S } = env, s = readState(m, S), out = [];
    for (const g of C.goals) {
      if (st.done.has(g.id)) continue;
      const v = st.vars.find((b) => b.id === g.var);
      if (!v || v.a == null) continue;
      const y = v.y + 1, lamp = (bit) => ({ x: v.x + 7 - bit, y });
      if (g.min != null) {
        // The one flip that reaches the value with the smallest change, else the highest bit still off.
        let best = null;
        for (let bit = 0; bit < 8; bit++) {
          const after = this.flipped(m, v, bit);
          if (after >= g.min && (best == null || after < this.flipped(m, v, best))) best = bit;
        }
        if (best == null) for (let bit = 7; bit >= 0 && best == null; bit--) if (!(this.bits(m, v) & (1 << bit))) best = bit;
        if (best != null) out.push(lamp(best));
      } else if (g.id === 'scared') {
        if (s.phase === 'play' && s.ghosts[0].state === 'active') out.push(lamp(m.ram[v.a] === 1 ? 1 : 0)); // any bit on scares him
      } else for (let bit = 0; bit < 8; bit++) if (!this.refuse(m, S, v, bit, s)) out.push(lamp(bit));
    }
    return out;
  },

  info(st, env) {
    if (env.t - st.msgT < C.msgTime && st.msg) return st.msg;
    if (st.head) return `CPU WRITES ${st.vars[st.head.i].name}${env.t < st.head.t + C.waitTime ? '' : '!'}`;
    return 'STEP ON A BLINKING BIT';
  },

  // The write head: { x (tiles, along the variable's lamps), y (its lamp row), dashing }.
  headPos(st, t) {
    const h = st.head, v = st.vars[h.i], k = t - h.t - C.waitTime;
    return { x: v.x + (k < 0 ? 0 : k * C.dashSpeed), y: v.y + 1, dashing: k >= 0 };
  },

  update(st, env) {
    const { m, t, player } = env;
    // The program's writes to our variables since last time (the ring holds the last N accesses).
    const N = m.busAddr.length;
    for (let i = Math.max(st.busFrom, m.busCount - N); i < m.busCount; i++) {
      const j = i % N, a = m.busAddr[j] - BASE;
      if (m.busKind[j] !== BUS.write) continue;
      const v = st.byAddr.get(a);
      if (v && !st.pending.has(v.i)) st.pending.set(v.i, t);
    }
    st.busFrom = m.busCount;
    // The head takes the variable that has waited longest.
    if (!st.head && t >= st.restUntil && st.pending.size) {
      const [i] = [...st.pending].sort((p, q) => p[1] - q[1])[0];
      st.pending.delete(i);
      st.head = { i, t };
    }
    st.flash = st.flash.filter((f) => t - f.t < 0.4);
    if (st.head) {
      const p = this.headPos(st, t), v = st.vars[st.head.i];
      if (p.dashing && Math.abs(player.y - p.y) < 0.6 && Math.abs(player.x - p.x) < 0.8) return 'hit';
      if (p.x >= v.x + 8) { st.flash.push({ i: st.head.i, t }); st.head = null; st.restUntil = t + C.restTime; }
    }
    // Stepping onto a lamp flips its bit (once per visit).
    const x = Math.round(player.x), y = Math.round(player.y), key = y * COLS + x;
    if (key !== st.tile) {
      st.tile = key;
      const l = this.lampAt(st, x, y);
      if (l) {
        const why = this.poke(st, env, l.v, l.bit);
        st.msgT = t;
        if (why) { st.msg = why; st.refused = { x, y, t }; }
        else {
          st.poked.add(l.v.id);
          if (l.v.ghost != null) st.movedBy = l.v.id;
          st.msg = `${l.v.name} = ${this.value(m, l.v)}`;
        }
      }
    }
    for (const g of C.goals) {
      if (!st.done.has(g.id) && this.goalMet(st, env, g)) {
        st.done.add(g.id);
        st.msg = `${g.name}: DONE`; st.msgT = t;
        return 'objective';
      }
    }
    return null;
  },

  draw(ctx, st, env, S) {
    const { m, S: syms, t, P } = env;
    floor(ctx, P, COLS, ROWS, S);
    ctx.fillStyle = css(P.bg);
    ctx.fillRect(0, 0, COLS * S, PIC * S);
    const g = readState(m, syms);
    // The machine's picture, small, at the top left; Blinky framed while an objective is about him.
    const T = Math.floor((PIC * S - 6) / MH), ox = 4, oy = 3;
    if (env.art) drawPlayfield(ctx, m, env.art, { T, ox, oy });
    neonBox(ctx, ox - 1, oy - 1, MW * T + 2, MH * T + 2, P.line, P.glow);
    const blinkyGoal = C.goals.some((q) => !st.done.has(q.id) && /^BLINKY/.test(st.vars.find((b) => b.id === q.var)?.name ?? ''));
    if (blinkyGoal && g.ghosts[0].state === 'active' && Math.floor(t * 3) % 2) {
      const bx = Math.round(ox + g.ghosts[0].x * T + T / 2), by = Math.round(oy + g.ghosts[0].y * T + T / 2);
      neonBox(ctx, bx - T - 1, by - T - 1, 2 * T + 2, 2 * T + 2, 0xffffff, P.line);
    }
    // Next to it: what the game shows of its state, and the objectives.
    const k = C.hudScale, hx = ox + MW * T + 10, lh = 7 * k;
    let hy = oy + 2;
    const line = (s, c) => { ctx.fillStyle = css(c); tinyText(ctx, s, hx, hy, k); hy += lh; };
    line(`SCORE ${g.score}`, P.dot2);
    line(`LIVES ${g.lives}`, P.dot2);
    line(g.phase === 'play' ? 'PLAYING' : g.phase.toUpperCase(), P.dot);
    hy += lh / 2;
    line('GOALS', P.line);
    for (const q of C.goals) {
      const done = st.done.has(q.id);
      line(`${done ? '+' : '-'} ${q.name}`, done ? P.glow : (Math.floor(t * 2) % 2 ? P.dot2 : P.dot));
    }
    // The variables: a box each with its name and value, the 8 bit lamps under them.
    const want = new Set(this.wanted(st, env).map((p) => p.y * COLS + p.x));
    const ts = C.textScale;
    for (const v of st.vars) {
      const bx = v.x * S, by = v.y * S, w = 8 * S;
      neonBox(ctx, bx + 1, by + 1, w - 2, 2 * S - 2, P.line, P.glow);
      ctx.fillStyle = css(P.line);
      tinyText(ctx, v.name, bx + 4, by + Math.floor((S - 5 * ts) / 2) + 1, ts);
      if (v.a == null) continue;
      const val = String(this.value(m, v));
      ctx.fillStyle = css(P.dot2);
      tinyText(ctx, val, bx + w - 4 - val.length * 4 * ts + ts, by + Math.floor((S - 5 * ts) / 2) + 1, ts);
      const b = this.bits(m, v), ly = by + S;
      for (let bit = 0; bit < 8; bit++) {
        const x = v.x + 7 - bit, lx = x * S, on = b & (1 << bit);
        if (on) {
          neonBlock(ctx, lx + 3, ly + 3, S - 6, S - 6, P.line, P.dot);
          ctx.fillStyle = css(P.dot2);
          ctx.fillRect(lx + 6, ly + 6, S - 12, S - 12);
        } else neonBox(ctx, lx + 4, ly + 4, S - 8, S - 8, P.glow, P.grid);
        if (want.has((v.y + 1) * COLS + x) && Math.floor(t * 4) % 2) neonBox(ctx, lx + 1, ly + 1, S - 2, S - 2, 0xffffff, P.line);
      }
    }
    // The write head: its variable's bits glow red while it waits, then it dashes along them.
    if (st.head) {
      const p = this.headPos(st, t), v = st.vars[st.head.i];
      ctx.fillStyle = css(DEEP.hazard, p.dashing ? 0.3 : 0.15 + 0.15 * Math.sin(t * 20));
      ctx.fillRect(v.x * S + 1, p.y * S + 1, 8 * S - 2, S - 2);
      const x = Math.round(Math.min(p.x, v.x + 7.5) * S), y = p.y * S;
      ctx.fillStyle = HAZARD;
      ctx.fillRect(x - 1, y - 2, S + 2, S + 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 3, y + 2, S - 6, S - 4);
    }
    for (const f of st.flash) {
      const v = st.vars[f.i];
      ctx.fillStyle = `rgba(255,255,255,${0.6 * (1 - (t - f.t) / 0.4)})`;
      ctx.fillRect(v.x * S + 1, (v.y + 1) * S + 1, 8 * S - 2, S - 2);
    }
    if (st.refused && t - st.refused.t < 0.5) neonBox(ctx, st.refused.x * S + 1, st.refused.y * S + 1, S - 2, S - 2, DEEP.hazard, DEEP.hazardGlow);
  },
};
