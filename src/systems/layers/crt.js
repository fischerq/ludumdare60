// Deep layer 1, inside the screen (CRT). No Phaser. The maze picture of the emulated machine, magnified to its
// phosphor: walls and dots come from VRAM, the glowing ghosts from the sprite registers. A slowed-down
// electron beam sweeps the picture row by row: dots glow after it passes and can only be eaten while they
// glow. The beam only fires where the picture is lit, so it's deadly on a dot that's still there (and the
// ghosts always are); black floor is safe, and so is everything in the vertical blank, when it flies back.

import { DEEP } from '../../config.js';
import { CELL, tileOffset } from '../arcade/memmap.js';
import { W, H, SPRITE } from '../arcade/video.js';

const C = DEEP.crt;

export default {
  id: 'crt',
  title: 'INSIDE THE SCREEN',
  subtitle: 'EAT DOTS WHILE THEY GLOW\nDON\'T BE ON ONE WHEN THE BEAM COMES',
  cols: W, rows: H,
  start: { x: 9, y: 17 },
  goal: C.goal,

  init() {
    return { eaten: new Set(), passed: new Float32Array(H).fill(-99) };
  },

  // Beam row (fractional) at time t, or null in the vertical blank.
  beam(t) {
    const k = (t % C.beamPeriod) / C.beamPeriod;
    return k < 1 - C.vblank ? (k / (1 - C.vblank)) * H : null;
  },

  glow(st, y, t) {
    return Math.pow(1 / 3, (t - st.passed[y]) / C.decay);
  },

  open(st, env, x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return false;
    const c = env.m.vram[tileOffset(x, y)];
    return c !== CELL.wall && c !== CELL.door && c !== CELL.house;
  },

  // Returns 'collect', 'hit' or null for this frame.
  update(st, env) {
    const { m, t, player } = env;
    const b = this.beam(t);
    if (b !== null) for (let y = 0; y <= Math.min(H - 1, Math.floor(b)); y++) if (t - st.passed[y] > C.beamPeriod * 0.5) st.passed[y] = t;
    const px = Math.round(player.x), py = Math.round(player.y);
    const i = tileOffset(px, py), c = m.vram[i];
    const lit = (c === CELL.dot || c === CELL.power) && !st.eaten.has(i);
    if (lit && b !== null && Math.abs(b - (py + 0.5)) < 0.5) return 'hit';
    for (const sp of m.sprites()) {
      if (sp.code < SPRITE.ghost || sp.code >= SPRITE.eyes) continue; // ghost bodies only
      if (Math.abs(sp.x / 16 - 0.5 - player.x) + Math.abs(sp.y / 16 - 0.5 - player.y) < 0.8) return 'hit';
    }
    if (lit && this.glow(st, py, t) > C.litAbove) {
      st.eaten.add(i);
      return 'collect';
    }
    return null;
  },

  draw(ctx, st, env, S) {
    const { m, t } = env;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W * S, H * S);
    for (let y = 0; y < H; y++) {
      const g = this.glow(st, y, t);
      for (let x = 0; x < W; x++) {
        const i = tileOffset(x, y), c = m.vram[i];
        if (c === CELL.wall) {
          ctx.fillStyle = `rgba(40,60,255,${0.25 + 0.75 * g})`;
          ctx.fillRect(x * S + 1, y * S + 1, S - 2, S - 2);
        } else if ((c === CELL.dot || c === CELL.power) && !st.eaten.has(i)) {
          const r = c === CELL.power ? S / 3 : S / 6;
          ctx.fillStyle = g > C.litAbove ? `rgba(255,${180 + 60 * g},150,${0.4 + 0.6 * g})` : 'rgba(120,90,80,0.35)';
          ctx.fillRect(Math.round(x * S + S / 2 - r), Math.round(y * S + S / 2 - r), Math.round(2 * r), Math.round(2 * r));
        }
      }
    }
    for (const sp of m.sprites()) {
      if (!sp.code || sp.code >= SPRITE.points) continue;
      const ghost = sp.code >= SPRITE.ghost && sp.code < SPRITE.eyes;
      ctx.fillStyle = ghost ? 'rgba(255,60,60,0.8)' : sp.code < SPRITE.ghost ? 'rgba(255,240,0,0.6)' : 'rgba(80,120,255,0.6)';
      ctx.fillRect(Math.round((sp.x / 16 - 1) * S), Math.round((sp.y / 16 - 1) * S), S * 2 - 1, S * 2 - 1);
    }
    // RGB phosphor triads: three thin columns per tile.
    ctx.globalAlpha = 0.12;
    for (let x = 0; x < W * 3; x++) {
      ctx.fillStyle = ['#f00', '#0f0', '#00f'][x % 3];
      ctx.fillRect(Math.round((x * S) / 3), 0, 1, H * S);
    }
    ctx.globalAlpha = 1;
    const b = this.beam(t);
    if (b !== null) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(0, Math.round(b * S - 2), W * S, 4);
    } else {
      const k = ((t % C.beamPeriod) / C.beamPeriod - (1 - C.vblank)) / C.vblank; // flying back, switched off
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath(); ctx.moveTo(W * S * (1 - k), H * S * (1 - k)); ctx.lineTo(W * S, H * S); ctx.stroke();
    }
  },
};
