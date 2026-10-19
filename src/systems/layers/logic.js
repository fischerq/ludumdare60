// Deep layer 6, the game logic. No Phaser. No pixels or sprites: the maze as the program's rules see it,
// with Pac-Man and the ghosts as points at their positions in work RAM and each ghost's target vector, the
// line from the ghost to the tile it's aiming for (scatter corner, or its chase rule). Line of sight, like a
// Pokémon trainer: crossing a ghost's vector gets you spotted, and a seeker comes out of that ghost and hunts you
// for a while (the enemy). Frightened ghosts have no vector and see nothing. Objectives: stand on each ghost's
// target tile once. The pellets are dots to eat (the machine's Pac-Man eats them too).

import { DEEP } from '../../config.js';
import { CELL, tileOffset } from '../arcade/memmap.js';
import { W, H } from '../arcade/video.js';
import { readState } from '../arcade/state.js';
import { ghostTarget } from '../maze.js';
import { tinyText } from './font.js';
import { createChaser, stepChaser, touching } from './chaser.js';
import { css, floor, neonBox, dot } from './tron.js';

const C = DEEP.logic;
const COLORS = C.vectorColors;

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  const k = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
  return Math.hypot(px - ax - k * dx, py - ay - k * dy);
}

export default {
  id: 'logic',
  title: 'THE GAME LOGIC',
  subtitle: 'STAND ON EACH GHOST\'S TARGET TILE\nCROSS A TARGET LINE AND IT SEES YOU',
  cols: W, rows: H,
  start: { x: 9, y: 17 },
  get goal() { return C.goal; }, // read live: levels can change it (levels.js)

  init() {
    return { eaten: new Set(), vectors: [], seekers: [], done: new Set() };
  },

  open(st, env, x, y) {
    return x >= 0 && x < W && y >= 0 && y < H;
  },

  target(v) {
    return { x: Math.max(0, Math.min(W - 1, Math.round(v.to.x))), y: Math.max(0, Math.min(H - 1, Math.round(v.to.y))) };
  },

  info(st) {
    if (st.seekers.length) return `SPOTTED BY ${st.seekers.map((s) => s.name.toUpperCase()).join(', ')}!`;
    const left = ['blinky', 'pinky', 'inky', 'clyde'].filter((n) => !st.done.has(n));
    return left.length ? `TARGETS LEFT: ${left.join(' ').toUpperCase()}` : '';
  },

  onHit(st) {
    st.seekers = [];
  },

  update(st, env) {
    const { m, S, t, dt, player } = env;
    const g = readState(m, S);
    st.g = g;
    st.vectors = g.phase === 'play' || g.phase === 'ready' ? g.ghosts
      .filter((gh) => (gh.state === 'active' || gh.state === 'eyes') && !gh.frightened)
      .map((gh) => ({ name: gh.name, from: { x: gh.x, y: gh.y }, to: ghostTarget(g, gh) })) : [];
    // Line of sight: crossing a vector sends that ghost's seeker after you.
    for (const v of st.vectors) {
      if (st.seekers.some((s) => s.name === v.name)) continue;
      if (segDist(player.x, player.y, v.from.x, v.from.y, v.to.x, v.to.y) < C.vectorWidth) {
        const x = Math.max(0, Math.min(W - 1, Math.round(v.from.x))), y = Math.max(0, Math.min(H - 1, Math.round(v.from.y)));
        st.seekers.push({ name: v.name, until: t + C.seekTime, ...createChaser(x, y) });
      }
    }
    st.seekers = st.seekers.filter((s) => t < s.until);
    for (const s of st.seekers) {
      stepChaser(s, C.seekSpeed * dt, (x, y) => this.open(st, env, x, y), player.x, player.y, W, H);
      if (touching(s, player)) return 'hit';
    }
    const px = Math.round(player.x), py = Math.round(player.y);
    for (const v of st.vectors) {
      const tg = this.target(v);
      if (!st.done.has(v.name) && tg.x === px && tg.y === py) { st.done.add(v.name); return 'objective'; }
    }
    const i = tileOffset(px, py), c = m.vram[i];
    if ((c === CELL.dot || c === CELL.power) && !st.eaten.has(i)) { st.eaten.add(i); return 'dot'; }
    return null;
  },

  draw(ctx, st, env, S) {
    const { m, P, t } = env;
    floor(ctx, P, W, H, S);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = tileOffset(x, y), c = m.vram[i];
        if (c >= CELL.wall) neonBox(ctx, x * S + 3, y * S + 3, S - 5, S - 5, P.glow, P.grid);
        else if ((c === CELL.dot || c === CELL.power) && !st.eaten.has(i)) dot(ctx, env, 'dot', x, y, S);
      }
    }
    const c = (v) => (v + 0.5) * S;
    for (const [width, alpha] of [[4, 0.35], [2, 1]]) {
      ctx.lineWidth = width;
      for (const v of st.vectors) {
        ctx.strokeStyle = css(COLORS[v.name], alpha);
        ctx.beginPath(); ctx.moveTo(c(v.from.x), c(v.from.y)); ctx.lineTo(c(v.to.x), c(v.to.y)); ctx.stroke();
      }
    }
    ctx.lineWidth = 1;
    // Target tiles: the objectives (done ones stay as a faint box).
    for (const v of st.vectors) {
      const tg = this.target(v);
      if (st.done.has(v.name)) neonBox(ctx, tg.x * S + 1, tg.y * S + 1, S - 2, S - 2, P.glow, P.grid);
      else { neonBox(ctx, tg.x * S + 1, tg.y * S + 1, S - 2, S - 2, COLORS[v.name], P.glow); dot(ctx, env, 'special', tg.x, tg.y, S); }
    }
    const g = st.g;
    if (!g) return;
    for (const gh of g.ghosts) {
      ctx.fillStyle = css(gh.frightened ? P.line : COLORS[gh.name]);
      ctx.fillRect(c(gh.x) - 3, c(gh.y) - 3, 6, 6);
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(c(g.pac.x) - 3, c(g.pac.y) - 3, 6, 6);
    // Seekers: hunting diamonds in their ghost's color, blinking when they're about to give up.
    for (const s of st.seekers) {
      if (s.until - t < 1.5 && Math.floor(t * 8) % 2) continue;
      const x = Math.round(c(s.x)), y = Math.round(c(s.y));
      ctx.fillStyle = css(COLORS[s.name]);
      for (let k = 0; k < 6; k++) ctx.fillRect(x - 6 + k, y - k, 2 * (6 - k), 2 * k + 1);
      ctx.fillStyle = '#ffffff';
      tinyText(ctx, '!', x - Math.floor(3 * DEEP.labelScale / 2), y - 8 - 5 * DEEP.labelScale, DEEP.labelScale);
    }
    ctx.fillStyle = css(P.line);
    tinyText(ctx, `MODE ${g.chase ? 'CHASE' : 'SCATTER'}${g.fright ? ' FRIGHT' : ''}`, 2, 2, DEEP.labelScale);
  },
};
