// Deep layer 7, the input wires. No Phaser. The joystick's switches as pads on the circuit board, wired to
// the bits of IN0 (and START on IN1). Standing on a pad closes that switch: it pulls the bit low and the
// program polls it, so here you steer the machine's Pac-Man yourself, watching it on the small picture at the
// top. A switch chatters for DEEP.input.bounce s when it closes (contact bounce). Every dot Pac-Man eats
// counts; Pac-Man dying is a hit.

import { DEEP } from '../../config.js';
import { pressStart } from '../arcade/world.js';
import { drawPlayfield, W as MW, H as MH } from '../arcade/video.js';
import { readState } from '../arcade/state.js';
import { tinyText } from './font.js';
import { css, floor, neonLine, neonBox, HAZARD } from './tron.js';

const C = DEEP.input;
const COLS = 12, ROWS = 17, TOP = 10;   // the picture of the machine takes the rows above TOP
const PADS = [
  { name: 'up', x: 5, y: 10 }, { name: 'left', x: 2, y: 12 }, { name: 'right', x: 8, y: 12 },
  { name: 'down', x: 5, y: 14 }, { name: 'start', x: 0, y: 15 },
];
const LABEL = { up: 'UP', left: 'LEFT', right: 'RIGHT', down: 'DOWN', start: 'START' };

const padAt = (x, y) => PADS.find((p) => x >= p.x && x < p.x + 2 && y >= p.y && y < p.y + 2);

export default {
  id: 'input',
  title: 'THE INPUT WIRES',
  subtitle: 'STAND ON A SWITCH TO STEER PAC-MAN\nSTART PAD STARTS A GAME',
  cols: COLS, rows: ROWS,
  start: { x: 5, y: 12 },
  goal: C.goal,

  init() {
    return { pad: null, since: 0 };
  },

  open(st, env, x, y) {
    return x >= 0 && x < COLS && y >= TOP && y < ROWS;
  },

  // The joystick direction this layer holds on the machine (with contact bounce).
  drive(st, env) {
    const p = st.pad;
    if (!p || p.name === 'start') return null;
    if (env.t - st.since < C.bounce && Math.floor(env.t * 40) % 2) return null;
    return p.name;
  },

  update(st, env) {
    const { t, player, sounds } = env;
    const p = padAt(Math.round(player.x), Math.round(player.y)) ?? null;
    if (p !== st.pad) {
      st.pad = p;
      st.since = t;
      if (p?.name === 'start') pressStart();
    }
    if (sounds.some((e) => e.name === 'death')) return 'hit';
    if (sounds.some((e) => e.name === 'dot' || e.name === 'power')) return 'collect';
    return null;
  },

  draw(ctx, st, env, S) {
    const { m, S: syms, t, P } = env;
    floor(ctx, P, COLS, ROWS, S);
    ctx.fillStyle = css(P.bg);
    ctx.fillRect(0, 0, COLS * S, TOP * S);
    // The machine's picture, small, at the top.
    const T = Math.floor(((TOP - 1) * S) / MH);
    drawPlayfield(ctx, m, env.art, { T, ox: Math.floor((COLS * S - MW * T) / 2), oy: 2 });
    // Traces from the pads up to the input latch.
    const live = this.drive(st, env);
    for (const p of PADS) {
      const on = st.pad === p && (p.name === 'start' || live === p.name);
      const line = on ? 0xffffff : P.line, glow = on ? P.line : P.glow;
      neonLine(ctx, p.x * S + S - 1, TOP * S - 6, p.x * S + S - 1, p.y * S + 2, line, glow);
      neonBox(ctx, p.x * S + 2, p.y * S + 2, 2 * S - 4, 2 * S - 4, line, glow);
      ctx.fillStyle = css(line);
      tinyText(ctx, LABEL[p.name], p.x * S + 5, p.y * S + S - 3);
    }
    // The input latch: IN0's bits as the CPU reads them (1 = open, pulled up to 5 V).
    const bits = m.in0.toString(2).padStart(8, '0');
    ctx.fillStyle = css(P.dot);
    tinyText(ctx, `IN0 ${bits} IN1 ${m.in1.toString(2).padStart(8, '0')}`, 4, TOP * S - 14);
    const g = readState(m, syms);
    ctx.fillStyle = g.phase === 'over' || g.phase === 'attract' || g.phase === 'cleared' ? (Math.floor(t * 2) % 2 ? HAZARD : css(P.bg)) : css(P.line);
    const status = g.phase === 'play' ? `SCORE ${g.score}` : g.phase === 'over' ? 'GAME OVER: START' : g.phase.toUpperCase();
    tinyText(ctx, status, COLS * S - 4 - status.length * 4, TOP * S - 14);
  },
};
