// Deep layer 1, inside the screen (CRT). No Phaser. We stand on the phosphor inside the tube: a grid of RGB
// phosphor triads behind the shadow mask, one triad per tile of the machine's picture. The electron gun's beam
// paints the picture the way a raster CRT does, one spot at a time, left to right along a row and row after row
// (slowed to DEEP.crt.beamPeriod), then flies back switched off (vertical blank). A triad lights in the color the
// beam painted there and fades. The beam spot is the only enemy: being under it where it paints light is a hit;
// dark phosphor is safe.
// The monitor is out of adjustment, so the beam paints a broken frame: the picture rolls (V-HOLD), its rows tear
// sideways (H-HOLD), red and blue miss green (CONVERGE) and the colors are blotchy (DEGAUSS). The objectives are
// those four adjustments, pads on the tube's edge: walk onto one and the beam paints that part right from then on.
// Bonus dots: the four power pellets, eaten while lit. Each one makes the beam scan another way for a while
// (column by column, or bottom to top).

import { DEEP, MAZE } from '../../config.js';
import { CELL, tileOffset, tileAt } from '../arcade/memmap.js';
import { W, H, SPRITE } from '../arcade/video.js';
import { css, dot, neonBox } from './tron.js';
import { tinyText } from './font.js';

const C = DEEP.crt;
const N = W * H;
const PELLETS = MAZE.layout.flatMap((row, y) => [...row].map((ch, x) => (ch === 'o' ? tileOffset(x, y) : -1))).filter((i) => i >= 0);
const mod = (a, n) => ((a % n) + n) % n;

// Scan orders: the j-th cell the beam paints in a picture, and back.
const ORDER = {
  rows: { cell: (j) => j, pos: (i) => i },
  columns: { cell: (j) => (j % H) * W + Math.floor(j / H), pos: (i) => (i % W) * H + Math.floor(i / W) },
  up: { cell: (j) => (H - 1 - Math.floor(j / W)) * W + (j % W), pos: (i) => (H - 1 - Math.floor(i / W)) * W + (i % W) },
};
const BONUS_TEXT = { columns: 'BONUS: THE BEAM SCANS\nCOLUMN BY COLUMN', up: 'BONUS: THE BEAM SCANS\nFROM THE BOTTOM UP' };

export default {
  id: 'crt',
  title: 'INSIDE THE SCREEN',
  subtitle: 'THE PICTURE IS BROKEN: WALK TO\nTHE ADJUSTMENTS, DODGE THE BEAM',
  cols: W, rows: H,
  start: { x: 9, y: 17 },
  goal: C.goal,
  walkSpeed: C.walkSpeed,
  dots: false, // no dot counter: the objectives are the adjustments

  init() {
    return {
      on: new Set(), got: new Set(), msg: null,
      passed: new Float32Array(N).fill(-99), ch: new Float32Array(N * 3), // when the spot last passed, what it painted
      f0: 0, mode: 'rows', bonus: 0, bonusUntil: -1, bonusMode: null, last: null,
    };
  },

  // The beam's position in the current picture's scan order (fractional), or null in the vertical blank.
  beam(st, t) {
    const k = (t - st.f0) / C.beamPeriod;
    return k < 1 - C.vblank ? (k / (1 - C.vblank)) * N : null;
  },

  // When the spot last passed cell i (or will, if T is ahead), assuming the current scan order holds.
  lastPass(st, i, T) {
    const off = (ORDER[st.mode].pos(i) / N) * (1 - C.vblank) * C.beamPeriod;
    return st.f0 + Math.floor((T - st.f0 - off) / C.beamPeriod) * C.beamPeriod + off;
  },

  glow(st, i, t) {
    return Math.pow(1 / 3, (t - st.passed[i]) / C.decay);
  },

  lit(st, i) {
    return st.ch[i * 3] + st.ch[i * 3 + 1] + st.ch[i * 3 + 2] > 0.02;
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

  // What the picture shows on each cell this frame: a color name from C.rgb, or null for black. The ghosts are
  // left out: down here the beam is the only enemy.
  picture(st, m) {
    const pic = new Array(N).fill(null);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, o = tileOffset(x, y), c = m.vram[o];
      if (c === CELL.wall) pic[i] = 'wall';
      else if (c === CELL.door) pic[i] = 'door';
      else if (PELLETS.includes(o) ? !st.got.has(o) : c === CELL.dot || c === CELL.power) pic[i] = 'dot';
    }
    for (const sp of m.sprites()) {
      if (!sp.code || sp.code >= SPRITE.ghost) continue;
      const x0 = Math.round(sp.x / 16 - 1), y0 = Math.round(sp.y / 16 - 1);
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const x = x0 + dx, y = y0 + dy;
        if (x >= 0 && y >= 0 && x < W && y < H) pic[y * W + x] = 'pac';
      }
    }
    return pic;
  },

  // The red, green and blue the beam paints at (x, y) at time t, with every adjustment not yet set as a fault.
  paintAt(st, x, y, t, out = [0, 0, 0]) {
    const on = st.on, pic = st.pic;
    const sy = on.has('vhold') ? y : mod(y + Math.floor(t * C.rollSpeed), H);
    const shift = on.has('hhold') ? 0 : Math.round(C.tear * Math.sin(sy * 0.7 + t * 2));
    const blotch = !on.has('degauss') && Math.sin(x * 0.6 + 1) * Math.sin(y * 0.45) > 0.25;
    for (let k = 0; k < 3; k++) {
      const dx = on.has('conv') ? 0 : (k - 1) * C.misconverge;
      const rgb = C.rgb[pic[sy * W + mod(x + shift + dx, W)]];
      out[k] = rgb ? rgb[blotch ? (k + 2) % 3 : k] : 0;
    }
    return out;
  },

  info(st, env) {
    const t = env.t;
    if (st.msg && t - st.msg.t < C.msgTime) return st.msg.text;
    if (t < st.bonusUntil) return BONUS_TEXT[st.bonusMode];
    if (this.beam(st, t) === null) return 'VERTICAL BLANK: THE BEAM IS OFF';
    const left = C.goals.filter((g) => !st.on.has(g.id)).map((g) => g.name);
    return left.length ? `SET: ${left.slice(0, 2).join(' ')}\n${left.slice(2).join(' ')}` : '';
  },

  update(st, env) {
    const { m, t, player } = env;
    st.pic = this.picture(st, m);
    // A new picture starts: in the bonus scan order while it lasts, else row by row.
    if (t - st.f0 >= C.beamPeriod) {
      st.f0 += Math.floor((t - st.f0) / C.beamPeriod) * C.beamPeriod;
      st.mode = t < st.bonusUntil ? st.bonusMode : 'rows';
      st.last = null;
    }
    const px = Math.round(player.x), py = Math.round(player.y), me = py * W + px;
    // Cells the spot passed since the last frame are painted; light painted under you is a hit.
    const b = this.beam(st, t), order = ORDER[st.mode], rgb = [0, 0, 0];
    let hit = false;
    if (b !== null) {
      const from = st.last !== null && st.last <= b ? Math.floor(st.last) : Math.floor(b);
      for (let j = from; j <= Math.min(N - 1, Math.floor(b)); j++) {
        const i = order.cell(j);
        this.paintAt(st, i % W, Math.floor(i / W), t, rgb);
        st.passed[i] = t;
        st.ch.set(rgb, i * 3);
        if (i === me && this.lit(st, i)) hit = true;
      }
    }
    st.last = b;
    if (hit) return 'hit';
    const g = C.goals.find((gg) => gg.at.x === px && gg.at.y === py && !st.on.has(gg.id));
    if (g) {
      st.on.add(g.id);
      st.msg = { text: g.done, t };
      return 'objective';
    }
    const o = tileOffset(px, py);
    if (PELLETS.includes(o) && !st.got.has(o) && this.lit(st, me) && this.glow(st, me, t) > C.litAbove) {
      st.got.add(o);
      // The beam starts a fresh picture in the next bonus scan order.
      st.bonusMode = C.bonusModes[st.bonus++ % C.bonusModes.length];
      st.bonusUntil = t + C.bonusTime;
      st.mode = st.bonusMode;
      st.f0 = t;
      st.last = null;
      return 'bonus';
    }
    return null;
  },

  draw(ctx, st, env, S) {
    const { t, P } = env;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W * S, H * S);
    const sw = Math.floor((S - 2) / 3); // stripe width: three phosphor stripes per triad, the shadow mask between
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (this.corner(x, y)) continue;
      const i = y * W + x, g = this.glow(st, i, t);
      for (let k = 0; k < 3; k++) {
        const c = st.ch[i * 3 + k], v = c ? C.darkFloor + (1 - C.darkFloor) * g * c : 0;
        const level = Math.round(255 * Math.max(v, 0.07));
        ctx.fillStyle = v > 0.02 ? `rgb(${k === 0 ? level : 0},${k === 1 ? level : 0},${k === 2 ? level : 0})` : css(P.grid);
        ctx.fillRect(x * S + 1 + k * sw, y * S + 1, sw - 1, S - 2);
      }
    }
    // The bonus dots, bright while they can be eaten.
    for (const o of PELLETS) {
      if (st.got.has(o)) continue;
      const { x, y } = tileAt(o), i = y * W + x;
      dot(ctx, env, 'special', x, y, S, this.lit(st, i) && this.glow(st, i, t) > C.litAbove ? 1 : 0.3);
    }
    // The adjustment pads with their names: pulsing until set, solid after.
    for (const gl of C.goals) {
      const { x, y } = gl.at, on = st.on.has(gl.id), pulse = Math.floor(t * 3) % 2;
      neonBox(ctx, x * S + 2, y * S + 2, S - 4, S - 4, on || pulse ? P.special : P.line, P.glow);
      ctx.fillStyle = css(on ? P.line : pulse ? P.glow : P.bg);
      ctx.fillRect(x * S + 5, y * S + 5, S - 10, S - 10);
      const k = C.labelScale, w = (gl.name.length * 4 - 1) * k;
      const lx = x === 0 ? S + 3 : x === W - 1 ? x * S - w - 3 : x * S + (S - w) / 2;
      const ly = y === 0 ? S + 3 : y === H - 1 ? y * S - 5 * k - 3 : y * S + (S - 5 * k) / 2;
      ctx.fillStyle = css(P.bg);
      ctx.fillRect(Math.round(lx) - 2, Math.round(ly) - 2, w + 4, 5 * k + 4);
      ctx.fillStyle = css(on ? P.special : P.dot);
      tinyText(ctx, gl.name, Math.round(lx), Math.round(ly), k);
    }
    const b = this.beam(st, t);
    if (b === null) return;
    // The beam's path ahead (warning), the three converging beams from the gun, and the spot.
    const order = ORDER[st.mode], j = Math.floor(b), cell = order.cell(j), sx = (cell % W) * S, sy = Math.floor(cell / W) * S;
    for (let k = 1; k <= C.lookAhead; k++) {
      if (j + k >= N) break;
      const c = order.cell(j + k);
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
