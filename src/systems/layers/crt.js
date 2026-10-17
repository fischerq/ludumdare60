// Deep layer 1, inside the screen (CRT). No Phaser. The maze picture of the emulated machine, magnified to its
// phosphor: walls and dots come from VRAM, the glowing ghosts from the sprite registers. A slowed-down
// electron beam sweeps the picture row by row: dots glow after it passes and can only be eaten while they
// glow. The beam only fires where the picture is lit, so it's deadly on a dot that's still there (and the
// ghosts always are); black floor is safe, and so is everything in the vertical blank, when it flies back.
// A dark room: away from the beam the picture fades almost to black (darkFloor). The enemies are the ghost
// sprites and the beam itself; the only sweep in the deep layers. Objectives: the four power pellets (where the
// maze layout has them, whether or not the machine's Pac-Man ate them), eaten while lit.

import { DEEP, MAZE } from '../../config.js';
import { CELL, tileOffset } from '../arcade/memmap.js';
import { W, H, SPRITE } from '../arcade/video.js';
import { css, floor, neonBlock, neonBox, dot } from './tron.js';

const C = DEEP.crt;
const PELLETS = MAZE.layout.flatMap((row, y) => [...row].map((ch, x) => (ch === 'o' ? tileOffset(x, y) : -1))).filter((i) => i >= 0);

export default {
  id: 'crt',
  title: 'INSIDE THE SCREEN',
  subtitle: 'EAT THE 4 POWER PELLETS WHILE LIT\nSTAY IN THE DARK WHEN THE BEAM COMES',
  cols: W, rows: H,
  start: { x: 9, y: 17 },
  goal: C.goal,

  init() {
    return { eaten: new Set(), got: new Set(), passed: new Float32Array(H).fill(-99) };
  },

  // Beam row (fractional) at time t, or null in the vertical blank.
  beam(t) {
    const k = (t % C.beamPeriod) / C.beamPeriod;
    return k < 1 - C.vblank ? (k / (1 - C.vblank)) * H : null;
  },

  glow(st, y, t) {
    return Math.pow(1 / 3, (t - st.passed[y]) / C.decay);
  },

  // The whole face of the tube, except its rounded corners: the maze is only light on the phosphor.
  open(st, env, x, y) {
    return x >= 0 && x < W && y >= 0 && y < H && !this.corner(x, y);
  },

  corner(x, y) {
    const R = C.cornerRadius;
    const dx = x < R ? R - x : x > W - 1 - R ? x - (W - 1 - R) : 0;
    const dy = y < R ? R - y : y > H - 1 - R ? y - (H - 1 - R) : 0;
    return dx * dx + dy * dy > R * R;
  },

  // Returns 'dot', 'objective', 'hit' or null for this frame.
  update(st, env) {
    const { m, t, player } = env;
    const b = this.beam(t);
    if (b !== null) for (let y = 0; y <= Math.min(H - 1, Math.floor(b)); y++) if (t - st.passed[y] > C.beamPeriod * 0.5) st.passed[y] = t;
    const px = Math.round(player.x), py = Math.round(player.y);
    const i = tileOffset(px, py), c = m.vram[i];
    const pellet = PELLETS.includes(i) && !st.got.has(i);
    const dotHere = pellet || ((c === CELL.dot || c === CELL.power) && !st.eaten.has(i));
    const lit = dotHere || c === CELL.wall || c === CELL.door;
    if (lit && b !== null && Math.abs(b - (py + 0.5)) < 0.5) return 'hit';
    for (const sp of m.sprites()) {
      if (sp.code < SPRITE.ghost || sp.code >= SPRITE.eyes) continue; // ghost bodies only
      if (Math.abs(sp.x / 16 - 0.5 - player.x) + Math.abs(sp.y / 16 - 0.5 - player.y) < 0.8) return 'hit';
    }
    if (dotHere && this.glow(st, py, t) > C.litAbove) {
      if (pellet) { st.got.add(i); return 'objective'; }
      st.eaten.add(i);
      return 'dot';
    }
    return null;
  },

  draw(ctx, st, env, S) {
    const { m, t, P } = env;
    floor(ctx, P, W, H, S);
    ctx.fillStyle = css(DEEP.style.crt.bg);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (this.corner(x, y)) ctx.fillRect(x * S, y * S, S, S);
    // The tube is mounted on its side, so the scanlines run vertically: faint stripes, three per tile.
    ctx.fillStyle = css(P.grid);
    for (let x = 0; x < W * 3; x++) if (x % 3) ctx.fillRect(Math.round((x * S) / 3), 0, 1, H * S);
    for (let y = 0; y < H; y++) {
      const g = this.glow(st, y, t);
      for (let x = 0; x < W; x++) {
        const i = tileOffset(x, y), c = m.vram[i];
        if (PELLETS.includes(i) && !st.got.has(i)) {
          dot(ctx, env, 'special', x, y, S, g > C.litAbove ? 1 : C.darkFloor + 0.3);
        } else if (c === CELL.wall) {
          ctx.globalAlpha = C.darkFloor + (1 - C.darkFloor) * g;
          neonBlock(ctx, x * S + 1, y * S + 1, S - 2, S - 2, P.line, P.glow);
          ctx.globalAlpha = 1;
        } else if ((c === CELL.dot || c === CELL.power) && !st.eaten.has(i)) {
          dot(ctx, env, g > C.litAbove ? 'dot2' : 'dot', x, y, S, g > C.litAbove ? 1 : C.darkFloor + 0.15);
        }
      }
    }
    for (const sp of m.sprites()) {
      if (!sp.code || sp.code >= SPRITE.points) continue;
      const ghost = sp.code >= SPRITE.ghost && sp.code < SPRITE.eyes;
      const x = Math.round((sp.x / 16 - 1) * S), y = Math.round((sp.y / 16 - 1) * S);
      if (ghost) neonBox(ctx, x + 1, y + 1, S * 2 - 3, S * 2 - 3, DEEP.hazard, DEEP.hazardGlow);
      else neonBox(ctx, x + 1, y + 1, S * 2 - 3, S * 2 - 3, sp.code < SPRITE.ghost ? C.pacColor : P.line, P.glow);
    }
    const b = this.beam(t);
    if (b !== null) {
      ctx.fillStyle = css(P.line, 0.6);
      ctx.fillRect(0, Math.round(b * S - 3), W * S, 6);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, Math.round(b * S - 1), W * S, 2);
    } else {
      const k = ((t % C.beamPeriod) / C.beamPeriod - (1 - C.vblank)) / C.vblank; // flying back, switched off
      ctx.strokeStyle = css(P.line, 0.25);
      ctx.beginPath(); ctx.moveTo(W * S * (1 - k), H * S * (1 - k)); ctx.lineTo(W * S, H * S); ctx.stroke();
    }
  },
};
