// Deep layer 1, inside the screen (CRT). No Phaser. We stand on the phosphor inside the tube: a grid of RGB
// phosphor triads behind the shadow mask, one triad per tile of the machine's picture. The electron gun's beam
// paints the picture the way a raster CRT does, one spot at a time, left to right along a row and row after row
// (slowed to DEEP.crt.beamPeriod), then flies back switched off (vertical blank). A triad lights in the
// picture's color for that spot (walls blue, dots peach, ghosts red, ...) and fades. Dots can only be eaten while
// lit. The beam spot is the enemy: it only fires where the picture is lit, so being under it on a lit triad is a
// hit; dark phosphor is safe. The ghost sprites hit too. Objectives: the four power pellets (where the maze layout
// has them, whether or not the machine's Pac-Man ate them), eaten while lit.

import { DEEP, MAZE } from '../../config.js';
import { CELL, tileOffset } from '../arcade/memmap.js';
import { W, H, SPRITE } from '../arcade/video.js';
import { css, dot } from './tron.js';

const C = DEEP.crt;
const N = W * H;
const PELLETS = MAZE.layout.flatMap((row, y) => [...row].map((ch, x) => (ch === 'o' ? tileOffset(x, y) : -1))).filter((i) => i >= 0);

export default {
  id: 'crt',
  title: 'INSIDE THE SCREEN',
  subtitle: 'THE BEAM PAINTS ONE PIXEL AT A TIME\nEAT GLOWING DOTS, DODGE THE SPOT',
  cols: W, rows: H,
  start: { x: 9, y: 17 },
  goal: C.goal,

  init() {
    return { eaten: new Set(), got: new Set(), passed: new Float32Array(N).fill(-99), last: null };
  },

  // The beam's spot as a raster index (cell = y * W + x, fractional), or null in the vertical blank.
  beam(t) {
    const k = (t % C.beamPeriod) / C.beamPeriod;
    return k < 1 - C.vblank ? (k / (1 - C.vblank)) * N : null;
  },

  glow(st, i, t) {
    return Math.pow(1 / 3, (t - st.passed[i]) / C.decay);
  },

  // The whole face of the tube, except its rounded corners.
  open(st, env, x, y) {
    return x >= 0 && x < W && y >= 0 && y < H && !this.corner(x, y);
  },

  corner(x, y) {
    const R = C.cornerRadius;
    const dx = x < R ? R - x : x > W - 1 - R ? x - (W - 1 - R) : 0;
    const dy = y < R ? R - y : y > H - 1 - R ? y - (H - 1 - R) : 0;
    return dx * dx + dy * dy > R * R;
  },

  // What the picture shows on each cell this frame: a color name from C.rgb, or null for black.
  picture(st, m) {
    const pic = new Array(N).fill(null);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, o = tileOffset(x, y), c = m.vram[o];
      if (c >= CELL.wall) pic[i] = 'wall';   // like the program: every code from the wall up blocks (fruit, garbage)
      else if (c === CELL.door) pic[i] = 'door';
      else if (PELLETS.includes(o) ? !st.got.has(o) : (c === CELL.dot || c === CELL.power) && !st.eaten.has(o)) pic[i] = 'dot';
    }
    for (const sp of m.sprites()) {
      if (!sp.code || sp.code >= SPRITE.points) continue;
      const name = sp.code < SPRITE.ghost ? 'pac' : sp.code < SPRITE.eyes ? 'ghost' : 'scared';
      const x0 = Math.round(sp.x / 16 - 1), y0 = Math.round(sp.y / 16 - 1);
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const x = x0 + dx, y = y0 + dy;
        if (x >= 0 && y >= 0 && x < W && y < H) pic[y * W + x] = name;
      }
    }
    return pic;
  },

  info(st, env) {
    return this.beam(env.t) === null ? 'VERTICAL BLANK: THE BEAM IS OFF' : '';
  },

  update(st, env) {
    const { m, t, player } = env;
    st.pic = this.picture(st, m);
    const px = Math.round(player.x), py = Math.round(player.y), me = py * W + px;
    // Cells the spot passed since the last frame light up; a lit one under you is a hit.
    const b = this.beam(t);
    let hit = false;
    if (b !== null) {
      const from = st.last !== null && st.last <= b ? Math.floor(st.last) : Math.floor(b);
      for (let i = from; i <= Math.min(N - 1, Math.floor(b)); i++) {
        st.passed[i] = t;
        if (i === me && st.pic[i]) hit = true;
      }
    }
    st.last = b;
    if (hit) return 'hit';
    for (const sp of m.sprites()) {
      if (sp.code < SPRITE.ghost || sp.code >= SPRITE.eyes) continue; // ghost bodies only
      if (Math.abs(sp.x / 16 - 0.5 - player.x) + Math.abs(sp.y / 16 - 0.5 - player.y) < 0.8) return 'hit';
    }
    const o = tileOffset(px, py);
    if (st.pic[me] === 'dot' && this.glow(st, me, t) > C.litAbove) {
      if (PELLETS.includes(o)) { st.got.add(o); return 'objective'; }
      st.eaten.add(o);
      return 'dot';
    }
    return null;
  },

  draw(ctx, st, env, S) {
    const { t, P } = env;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W * S, H * S);
    const pic = st.pic ?? [];
    const sw = Math.floor((S - 2) / 3); // stripe width: three phosphor stripes per triad, the shadow mask between
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (this.corner(x, y)) continue;
      const i = y * W + x, rgb = C.rgb[pic[i]], g = this.glow(st, i, t);
      for (let k = 0; k < 3; k++) {
        const v = rgb ? C.darkFloor + (1 - C.darkFloor) * g * rgb[k] : 0;
        const level = Math.round(255 * Math.max(v, 0.07));
        ctx.fillStyle = rgb && v > 0.02 ? `rgb(${k === 0 ? level : 0},${k === 1 ? level : 0},${k === 2 ? level : 0})` : css(P.grid);
        ctx.fillRect(x * S + 1 + k * sw, y * S + 1, sw - 1, S - 2);
      }
      // Lit dots read as dots; the power pellets are the special.
      const o = tileOffset(x, y);
      if (pic[i] === 'dot' && g > C.litAbove) dot(ctx, env, PELLETS.includes(o) ? 'special' : 'dot2', x, y, S);
      else if (pic[i] === 'dot' && PELLETS.includes(o)) dot(ctx, env, 'special', x, y, S, 0.3);
    }
    const b = this.beam(t);
    if (b === null) return;
    // The beam's path ahead (warning), the three converging beams from the gun, and the spot.
    const cell = Math.floor(b), sx = (cell % W) * S, sy = Math.floor(cell / W) * S;
    for (let k = 1; k <= C.lookAhead; k++) {
      const c = cell + k;
      if (c >= N) break;
      ctx.fillStyle = css(P.line, 0.5 * (1 - k / (C.lookAhead + 1)));
      ctx.fillRect((c % W) * S + 2, Math.floor(c / W) * S + S / 2 - 1, S - 4, 2);
    }
    ['#ff3030', '#30ff30', '#3080ff'].forEach((color, k) => {
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.35;
      ctx.beginPath(); ctx.moveTo((W * S) / 2 + (k - 1) * 6, 0); ctx.lineTo(sx + S / 2, sy + S / 2); ctx.stroke();
    });
    ctx.globalAlpha = 1;
    ctx.fillStyle = css(P.line);
    ctx.fillRect(sx - 1, sy - 1, S + 2, S + 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(sx + 3, sy + 3, S - 6, S - 6);
  },
};
