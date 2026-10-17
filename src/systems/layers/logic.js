// Deep layer 6, the game logic. No Phaser. No pixels or sprites: the maze as the program's rules see it,
// with Pac-Man and the ghosts as points at their positions in work RAM and each ghost's target vector, the
// line from the ghost to the tile it's aiming for (scatter corner, or its chase rule). The vectors are deadly;
// they swing as Pac-Man moves and flip when the mode changes. Frightened ghosts have none. The pellets are
// the nodes to collect (the machine's Pac-Man eats them too).

import { DEEP } from '../../config.js';
import { CELL, tileOffset } from '../arcade/memmap.js';
import { W, H } from '../arcade/video.js';
import { readState } from '../arcade/state.js';
import { ghostTarget } from '../maze.js';
import { tinyText } from './font.js';
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
  subtitle: 'COLLECT THE PELLET NODES\nDON\'T CROSS A GHOST\'S TARGET VECTOR',
  cols: W, rows: H,
  start: { x: 9, y: 17 },
  goal: C.goal,

  init() {
    return { eaten: new Set(), vectors: [] };
  },

  open(st, env, x, y) {
    return x >= 0 && x < W && y >= 0 && y < H;
  },

  update(st, env) {
    const { m, S, player } = env;
    const g = readState(m, S);
    st.g = g;
    st.vectors = g.phase === 'play' || g.phase === 'ready' ? g.ghosts
      .filter((gh) => (gh.state === 'active' || gh.state === 'eyes') && !gh.frightened)
      .map((gh) => ({ name: gh.name, from: { x: gh.x, y: gh.y }, to: ghostTarget(g, gh) })) : [];
    for (const v of st.vectors) {
      if (segDist(player.x, player.y, v.from.x, v.from.y, v.to.x, v.to.y) < C.vectorWidth) return 'hit';
    }
    const i = tileOffset(Math.round(player.x), Math.round(player.y)), c = m.vram[i];
    if ((c === CELL.dot || c === CELL.power) && !st.eaten.has(i)) { st.eaten.add(i); return 'collect'; }
    return null;
  },

  draw(ctx, st, env, S) {
    const { m, P } = env;
    floor(ctx, P, W, H, S);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = tileOffset(x, y), c = m.vram[i];
        if (c === CELL.wall) neonBox(ctx, x * S + 3, y * S + 3, S - 5, S - 5, P.glow, P.grid);
        else if ((c === CELL.dot || c === CELL.power) && !st.eaten.has(i)) dot(ctx, env, c === CELL.power ? 'special' : 'dot', x, y, S);
      }
    }
    const c = (v) => (v + 0.5) * S;
    for (const [width, alpha] of [[4, 0.35], [2, 1]]) {
      ctx.lineWidth = width;
      for (const v of st.vectors) {
        ctx.strokeStyle = css(COLORS[v.name], alpha);
        ctx.beginPath(); ctx.moveTo(c(v.from.x), c(v.from.y)); ctx.lineTo(c(v.to.x), c(v.to.y)); ctx.stroke();
        ctx.strokeRect(c(v.to.x) - 4, c(v.to.y) - 4, 8, 8);
      }
    }
    ctx.lineWidth = 1;
    const g = st.g;
    if (!g) return;
    for (const gh of g.ghosts) {
      ctx.fillStyle = css(gh.frightened ? P.line : COLORS[gh.name]);
      ctx.fillRect(c(gh.x) - 3, c(gh.y) - 3, 6, 6);
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(c(g.pac.x) - 3, c(g.pac.y) - 3, 6, 6);
    ctx.fillStyle = css(P.line);
    tinyText(ctx, `MODE ${g.chase ? 'CHASE' : 'SCATTER'}${g.fright ? ' FRIGHT' : ''}`, 2, 2);
  },
};
