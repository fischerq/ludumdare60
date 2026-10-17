// Deep layer 7, the input wires. No Phaser. The joystick's switches as pads on the circuit board, wired to
// the bits of IN0 (and START on IN1). Standing on a pad closes that switch: it pulls the bit low and the
// program polls it, so here you steer the machine's Pac-Man yourself, watching it on the small picture at the
// top. A switch chatters for DEEP.input.bounce s when it closes (contact bounce). Pressure plates: a push
// block (Zelda, Sokoban) put on a pad holds that switch while you walk elsewhere. The enemy is a noise spark that
// crawls over the board after you; Pac-Man dying is a hit too. Every dot Pac-Man eats counts as a dot.
// Objectives: steer the machine's Pac-Man into each of the maze's four corners.

import { DEEP } from '../../config.js';
import { pressStart } from '../arcade/world.js';
import { drawPlayfield, W as MW, H as MH } from '../arcade/video.js';
import { readState } from '../arcade/state.js';
import { tinyText } from './font.js';
import { createChaser, stepChaser, touching } from './chaser.js';
import { css, floor, neonLine, neonBox, neonBlock, HAZARD } from './tron.js';

const C = DEEP.input;
const COLS = 12, ROWS = 17, TOP = 10;   // the picture of the machine takes the rows above TOP
const PADS = [
  { name: 'up', x: 5, y: 10 }, { name: 'left', x: 2, y: 12 }, { name: 'right', x: 8, y: 12 },
  { name: 'down', x: 5, y: 14 }, { name: 'start', x: 0, y: 15 },
];
const LABEL = { up: 'UP', left: 'LEFT', right: 'RIGHT', down: 'DOWN', start: 'START' };

const padAt = (x, y) => PADS.find((p) => x >= p.x && x < p.x + 2 && y >= p.y && y < p.y + 2);

const CORNERS = [{ name: 'TL', x: 0, y: 0 }, { name: 'TR', x: 1, y: 0 }, { name: 'BL', x: 0, y: 1 }, { name: 'BR', x: 1, y: 1 }];
const SPARK_HOME = { x: COLS - 1, y: ROWS - 1 };

export default {
  id: 'input',
  title: 'THE INPUT WIRES',
  subtitle: 'STAND ON A SWITCH TO STEER PAC-MAN\nPUSH THE BLOCK ONTO ONE TO HOLD IT',
  cols: COLS, rows: ROWS,
  start: { x: 5, y: 12 },
  goal: C.goal,

  init() {
    return { pad: null, since: 0, block: { ...C.block }, spark: createChaser(SPARK_HOME.x, SPARK_HOME.y), sparkFrom: C.sparkDelay, corners: new Set() };
  },

  area(x, y) {
    return x >= 0 && x < COLS && y >= TOP && y < ROWS;
  },

  open(st, env, x, y) {
    return this.area(x, y) && !(st.block.x === x && st.block.y === y);
  },

  info(st) {
    const left = CORNERS.filter((c) => !st.corners.has(c.name)).map((c) => c.name);
    return left.length ? `CORNERS LEFT: ${left.join(' ')}` : '';
  },

  onHit(st, env) {
    Object.assign(st.spark, createChaser(SPARK_HOME.x, SPARK_HOME.y));
    st.sparkFrom = env.t + C.sparkDelay;
  },

  // The pad pressed right now: yours, or else the one the block stands on.
  pressed(st) {
    return st.pad ?? padAt(st.block.x, st.block.y) ?? null;
  },

  // The joystick direction this layer holds on the machine (with contact bounce).
  drive(st, env) {
    const p = this.pressed(st);
    if (!p || p.name === 'start') return null;
    if (env.t - st.since < C.bounce && Math.floor(env.t * 40) % 2) return null;
    return p.name;
  },

  update(st, env) {
    const { m, S: syms, t, dt, player, sounds } = env;
    // Pushing the block: walking into it at a tile center moves it one tile if there's room behind it.
    const want = player.next ?? player.dir;
    if (want && Math.abs(player.x - Math.round(player.x)) < 1e-6 && Math.abs(player.y - Math.round(player.y)) < 1e-6) {
      const [dx, dy] = { up: [0, -1], left: [-1, 0], down: [0, 1], right: [1, 0] }[want];
      if (st.block.x === player.x + dx && st.block.y === player.y + dy && this.area(st.block.x + dx, st.block.y + dy)) {
        st.block.x += dx; st.block.y += dy;
      }
    }
    const before = this.pressed(st);
    st.pad = padAt(Math.round(player.x), Math.round(player.y)) ?? null;
    const now = this.pressed(st);
    if (now !== before) {
      st.since = t;
      if (now?.name === 'start') pressStart();
    }
    if (t >= st.sparkFrom) stepChaser(st.spark, C.sparkSpeed * dt, (x, y) => this.open(st, env, x, y), player.x, player.y, COLS, ROWS);
    if (touching(st.spark, player)) return 'hit';
    if (sounds.some((e) => e.name === 'death')) return 'hit';
    const g = readState(m, syms);
    if (g.phase === 'play') {
      for (const c of CORNERS) {
        const cx = c.x ? MW - 1 : 0, cy = c.y ? MH - 1 : 0;
        if (!st.corners.has(c.name) && Math.max(Math.abs(g.pac.x - cx), Math.abs(g.pac.y - cy)) <= C.corner) { st.corners.add(c.name); return 'objective'; }
      }
    }
    if (sounds.some((e) => e.name === 'dot' || e.name === 'power')) return 'dot';
    return null;
  },

  draw(ctx, st, env, S) {
    const { m, S: syms, t, P } = env;
    floor(ctx, P, COLS, ROWS, S);
    ctx.fillStyle = css(P.bg);
    ctx.fillRect(0, 0, COLS * S, TOP * S);
    // The machine's picture, small, at the top, with the corners still to reach.
    const T = Math.floor(((TOP - 1) * S) / MH), ox = Math.floor((COLS * S - MW * T) / 2), oy = 2;
    drawPlayfield(ctx, m, env.art, { T, ox, oy });
    for (const c of CORNERS) {
      if (st.corners.has(c.name)) continue;
      const n = C.corner + 1, x = ox + (c.x ? MW - n : 0) * T, y = oy + (c.y ? MH - n : 0) * T;
      if (Math.floor(t * 3) % 2) neonBox(ctx, x, y, n * T, n * T, 0xffffff, P.line);
    }
    // Traces from the pads up to the input latch.
    const live = this.drive(st, env), pressed = this.pressed(st);
    for (const p of PADS) {
      const on = pressed === p && (p.name === 'start' || live === p.name);
      const line = on ? 0xffffff : P.line, glow = on ? P.line : P.glow;
      neonLine(ctx, p.x * S + S - 1, TOP * S - 6, p.x * S + S - 1, p.y * S + 2, line, glow);
      neonBox(ctx, p.x * S + 2, p.y * S + 2, 2 * S - 4, 2 * S - 4, line, glow);
      ctx.fillStyle = css(line);
      tinyText(ctx, LABEL[p.name], p.x * S + 5, p.y * S + S - 3);
    }
    // The push block.
    neonBlock(ctx, st.block.x * S + 2, st.block.y * S + 2, S - 4, S - 4, P.dot2, P.glow);
    ctx.fillStyle = css(P.dot2);
    ctx.fillRect(st.block.x * S + 6, st.block.y * S + 6, S - 12, S - 12);
    // The noise spark: a jagged little star.
    const sx = Math.round((st.spark.x + 0.5) * S), sy = Math.round((st.spark.y + 0.5) * S), r = 4 + (Math.floor(t * 12) % 3);
    ctx.fillStyle = HAZARD;
    ctx.fillRect(sx - r, sy - 1, 2 * r + 1, 3);
    ctx.fillRect(sx - 1, sy - r, 3, 2 * r + 1);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(sx - 1, sy - 1, 3, 3);
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
