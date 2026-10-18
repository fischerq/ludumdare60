// The bot (no Phaser): steers Pac-Man on the machine while the player is in another layer. It reads the same
// raw data a player sees (VRAM for the maze and pellets, RAM for where everyone is) and holds the joystick.
// Simple and readable: head for the nearest pellet, keep away from ghosts that hunt, chase frightened ones.

import { CELL, tileOffset, blocksActors } from './memmap.js';
import { W, H, DIR_NAMES } from './video.js';
import { readState } from './state.js';

const STEP = [[0, -1], [-1, 0], [0, 1], [1, 0]];    // up, left, down, right
const DANGER = 3;                                   // tiles: stay this far from a hunting ghost

const wrap = (x) => ((x % W) + W) % W;
const open = (vram, x, y) => {
  if (y < 0 || y >= H) return false;
  return !blocksActors(vram[tileOffset(wrap(x), y)]);   // the program's own rule (game.asm can_enter)
};

// The direction to hold this frame, or null to let go.
export function botDirection(m, S) {
  const st = readState(m, S);
  if (st.phase !== 'play') return null;
  const px = wrap(Math.round(st.pac.x)), py = Math.round(st.pac.y);
  const hunters = st.ghosts.filter((g) => !g.frightened && (g.state === 'active' || g.state === 'exit'));
  const prey = st.ghosts.filter((g) => g.frightened && g.state === 'active');
  const near = (x, y, list, d) => list.some((g) => {
    const dx = Math.min(Math.abs(wrap(Math.round(g.x)) - x), W - Math.abs(wrap(Math.round(g.x)) - x));
    return dx + Math.abs(Math.round(g.y) - y) <= d;
  });

  // Breadth-first search from Pac-Man to the nearest goal, around the tiles near hunting ghosts.
  const first = new Int8Array(W * H).fill(-1);
  const seen = new Uint8Array(W * H);
  seen[py * W + px] = 1;
  let queue = [[px, py]];
  for (let depth = 0; queue.length && depth < W * H; depth++) {
    const next = [];
    for (const [x, y] of queue) {
      for (let d = 0; d < 4; d++) {
        const nx = wrap(x + STEP[d][0]), ny = y + STEP[d][1];
        if (!open(m.vram, nx, ny) || seen[ny * W + nx]) continue;
        seen[ny * W + nx] = 1;
        if (near(nx, ny, hunters, DANGER)) continue;
        const dir = depth === 0 ? d : first[y * W + x];
        first[ny * W + nx] = dir;
        const c = m.vram[tileOffset(nx, ny)];
        if (c === CELL.dot || c === CELL.power || near(nx, ny, prey, 0)) return DIR_NAMES[dir];
        next.push([nx, ny]);
      }
    }
    queue = next;
  }
  // Boxed in: move away from the nearest hunter.
  let best = null, bestD = -1;
  for (let d = 0; d < 4; d++) {
    const nx = wrap(px + STEP[d][0]), ny = py + STEP[d][1];
    if (!open(m.vram, nx, ny)) continue;
    const dist = Math.min(...hunters.map((g) => Math.abs(g.x - nx) + Math.abs(g.y - ny)), 99);
    if (dist > bestD) { bestD = dist; best = DIR_NAMES[d]; }
  }
  return best;
}
