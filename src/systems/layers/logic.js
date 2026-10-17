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

const C = DEEP.logic;
const COLORS = { blinky: '#ff3030', pinky: '#ffb8de', inky: '#00ffde', clyde: '#ffb847' };

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
    if (x < 0 || x >= W || y < 0 || y >= H) return false;
    const c = env.m.vram[tileOffset(x, y)];
    return c !== CELL.wall && c !== CELL.door && c !== CELL.house;
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
    const { m } = env;
    ctx.fillStyle = '#05050a';
    ctx.fillRect(0, 0, W * S, H * S);
    ctx.strokeStyle = '#141428';
    for (let x = 0; x <= W; x++) { ctx.beginPath(); ctx.moveTo(x * S + 0.5, 0); ctx.lineTo(x * S + 0.5, H * S); ctx.stroke(); }
    for (let y = 0; y <= H; y++) { ctx.beginPath(); ctx.moveTo(0, y * S + 0.5); ctx.lineTo(W * S, y * S + 0.5); ctx.stroke(); }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = tileOffset(x, y), c = m.vram[i];
        if (c === CELL.wall) { ctx.strokeStyle = '#2a3a9a'; ctx.strokeRect(x * S + 2.5, y * S + 2.5, S - 5, S - 5); }
        else if ((c === CELL.dot || c === CELL.power) && !st.eaten.has(i)) {
          ctx.fillStyle = '#c0c0ff';
          ctx.beginPath(); ctx.arc(x * S + S / 2, y * S + S / 2, c === CELL.power ? 3 : 1.5, 0, 7); ctx.fill();
        }
      }
    }
    const c = (v) => (v + 0.5) * S;
    ctx.lineWidth = 2;
    for (const v of st.vectors) {
      ctx.strokeStyle = COLORS[v.name];
      ctx.beginPath(); ctx.moveTo(c(v.from.x), c(v.from.y)); ctx.lineTo(c(v.to.x), c(v.to.y)); ctx.stroke();
      ctx.strokeRect(c(v.to.x) - 4, c(v.to.y) - 4, 8, 8);
    }
    ctx.lineWidth = 1;
    const g = st.g;
    if (!g) return;
    for (const gh of g.ghosts) {
      ctx.fillStyle = gh.frightened ? '#4060ff' : COLORS[gh.name];
      ctx.fillRect(c(gh.x) - 3, c(gh.y) - 3, 6, 6);
    }
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(c(g.pac.x) - 3, c(g.pac.y) - 3, 6, 6);
    ctx.fillStyle = '#9aa4bf';
    tinyText(ctx, `MODE ${g.chase ? 'CHASE' : 'SCATTER'}${g.fright ? ' FRIGHT' : ''}`, 2, 2);
  },
};
