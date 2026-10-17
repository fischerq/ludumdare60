import { COLORS, MAZE, PIXEL, UI, CABINET } from '../config.js';

const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;

// Ghost body, 14x14 like the arcade sprite: 11 shared rows plus 3 skirt rows per animation frame.
const GHOST_TOP = [
  '.....####.....',
  '...########...',
  '..##########..',
  '.############.',
  '.############.',
  '.############.',
  '##############',
  '##############',
  '##############',
  '##############',
  '##############',
];
const GHOST_SKIRT = [
  ['##############', '##.###..###.##', '#...##..##...#'],
  ['##############', '####.####.####', '.##...##...##.'],
];
const FRIGHT_FACE = [
  '..............', '..............', '..............', '..............', '..............',
  '....##..##....', '....##..##....', '..............', '..............',
  '..##..##..##..', '.#..##..##..#.',
];
const POWER = ['..####..', '.######.', '########', '########', '########', '########', '.######.', '..####..'];

// Generates all placeholder art in code, pixel by pixel at arcade resolution. Real art can replace any
// of these later under the same texture keys.
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.makeDots();
    this.makePac();
    this.makeGhosts();
    this.makeMaze('maze', COLORS.wall);
    this.makeMaze('maze-white', 0xdedede);
    this.makeCabinet();
    this.makeSticks();
    // Wait for the arcade font so text doesn't render in the fallback first (give up after 2 s).
    const font = document.fonts?.load(`8px ${UI.arcadeFont}`) ?? Promise.resolve();
    const timeout = new Promise((r) => setTimeout(r, 2000));
    // ?scene=Cabinet (or any scene key) jumps straight to that layer, for playtesting.
    const start = new URLSearchParams(window.location.search).get('scene');
    const target = start && this.scene.get(start) ? start : 'Menu';
    Promise.race([font, timeout]).catch(() => {}).finally(() => this.scene.start(target));
  }

  // Draw a w x h texture; paint(set) calls set(x, y, color) for each lit pixel.
  pixels(key, w, h, paint) {
    const tex = this.textures.createCanvas(key, w, h);
    const ctx = tex.getContext();
    paint((x, y, color) => { ctx.fillStyle = hex(color); ctx.fillRect(x, y, 1, 1); });
    tex.refresh();
  }

  // Fill a polygon with hard pixel edges (no anti-aliasing): a pixel is in if its center is.
  poly(set, pts, color) {
    const ys = pts.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y < Math.ceil(Math.max(...ys)); y++) {
      const cy = y + 0.5, xs = [];
      pts.forEach(([x0, y0], i) => {
        const [x1, y1] = pts[(i + 1) % pts.length];
        if ((y0 <= cy) !== (y1 <= cy)) xs.push(x0 + ((cy - y0) / (y1 - y0)) * (x1 - x0));
      });
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        for (let x = Math.ceil(xs[i] - 0.5); x <= Math.floor(xs[i + 1] - 0.5); x++) set(x, y, color);
      }
    }
  }

  bitmap(set, rows, color, ox = 0, oy = 0) {
    rows.forEach((row, y) => [...row].forEach((c, x) => { if (c === '#') set(ox + x, oy + y, color); }));
  }

  makeDots() {
    this.pixels('dot', 2, 2, (set) => { for (let i = 0; i < 4; i++) set(i % 2, i >> 1, COLORS.dot); });
    this.pixels('power', 8, 8, (set) => this.bitmap(set, POWER, COLORS.dot));
  }

  // Chomper facing right, 14x14: pac-0 (closed) .. pac-3 (wide open), death frames pac-die-0..9.
  makePac() {
    const frame = (key, mouth) => this.pixels(key, 14, 14, (set) => {
      for (let y = 0; y < 14; y++) {
        for (let x = 0; x < 14; x++) {
          const dx = x + 0.5 - 7, dy = y + 0.5 - 7;
          if (dx * dx + dy * dy > 6.6 * 6.6) continue;
          if (mouth > 0 && Math.abs(Math.atan2(dy, dx)) < mouth) continue;
          set(x, y, COLORS.pac);
        }
      }
    });
    [0, 0.3, 0.6, 0.9].forEach((m, i) => frame(`pac-${i}`, m));
    for (let i = 0; i < 10; i++) frame(`pac-die-${i}`, 0.3 + (i / 9) * (Math.PI - 0.3));
  }

  makeGhosts() {
    const body = (set, color, f) => this.bitmap(set, [...GHOST_TOP, ...GHOST_SKIRT[f]], color);
    [0, 1].forEach((f) => {
      this.pixels(`ghost-${f}`, 14, 14, (set) => body(set, 0xffffff, f));
      this.pixels(`ghost-fright-${f}`, 14, 14, (set) => {
        body(set, COLORS.fright, f); this.bitmap(set, FRIGHT_FACE, COLORS.frightFace);
      });
      this.pixels(`ghost-flash-${f}`, 14, 14, (set) => {
        body(set, COLORS.frightFlash, f); this.bitmap(set, FRIGHT_FACE, COLORS.frightFlashFace);
      });
    });
    // Eyes look where the ghost is going: whites shift one pixel, pupils sit at that edge.
    const white = ['.##.', '####', '####', '####', '.##.'];
    const look = { left: [-1, 0, 0, 2], right: [1, 0, 2, 2], up: [0, -1, 1, 0], down: [0, 1, 1, 3] };
    for (const [dir, [dx, dy, px, py]] of Object.entries(look)) {
      this.pixels(`eyes-${dir}`, 14, 14, (set) => {
        for (const ex of [2, 8]) {
          const x0 = ex + dx, y0 = 3 + dy;
          this.bitmap(set, white, COLORS.eyeWhite, x0, y0);
          this.bitmap(set, ['##', '##'], COLORS.pupil, x0 + px, y0 + py);
        }
      });
    }
  }

  // The cabinet in an oblique view: the front is drawn flat, depth goes up and right at 45°, so the right side
  // panel and the top show. The screen is left black; the scene draws the game picture into it.
  makeCabinet() {
    const C = CABINET, K = C.colors;
    const W = Math.round(720 / C.zoom), H = Math.round(1280 / C.zoom);
    // A point on a front-facing plane at depth d.
    const P = (x, y, d) => [x + d / 2, y - d / 2];
    const L = C.left, R = C.right, D = C.depth, pd = C.panelDepth, md = C.marqueeDepth;
    this.pixels('cabinet', W, H, (set) => {
      this.poly(set, [[0, C.ground], [W, C.ground], [W, H], [0, H]], K.floor);
      // Shadow on the floor behind the cabinet.
      this.poly(set, [P(L, C.ground, 0), P(R + 10, C.ground, 0), P(R + 10, C.ground, D + 12), P(L, C.ground, D + 12)], 0x0e0a10);
      // Right side panel: the side profile, sheared by depth.
      this.poly(set, [
        P(R, C.ground, 0), P(R, C.panelY, 0), P(R, C.panelY - 20, pd), P(R, C.screenTop, pd), P(R, C.screenTop, md),
        P(R, C.marqueeTop, md), P(R, C.marqueeTop, D), P(R, C.ground, D),
      ], K.side);
      // Top.
      this.poly(set, [P(L, C.marqueeTop, md), P(R, C.marqueeTop, md), P(R, C.marqueeTop, D), P(L, C.marqueeTop, D)], K.top);
      // Lower body front with a black kick plate.
      this.poly(set, [[L, C.panelY], [R, C.panelY], [R, C.ground], [L, C.ground]], K.front);
      this.poly(set, [[L, C.ground - 18], [R, C.ground - 18], [R, C.ground], [L, C.ground]], K.trim);
      // Control panel: sloped top surface from the front edge back to the screen.
      this.poly(set, [[L, C.panelY], [R, C.panelY], P(R, C.panelY - 20, pd), P(L, C.panelY - 20, pd)], K.panel);
      this.poly(set, [[L, C.panelY], [R, C.panelY], [R, C.panelY + 4], [L, C.panelY + 4]], K.top);
      // Screen section, set back, with the black bezel.
      const [sx0, sy0] = P(L, C.screenTop, pd), [sx1, sy1] = P(R, C.panelY - 20, pd);
      this.poly(set, [[sx0, sy0], [sx1, sy0], [sx1, sy1], [sx0, sy1]], K.trim);
      // Marquee box sticking out over the screen.
      const [mx0, my0] = P(L, C.marqueeTop, md), [mx1, my1] = P(R, C.screenTop, md);
      this.poly(set, [[mx0, my0], [mx1, my0], [mx1, my1], [mx0, my1]], 0x140c00);
      this.poly(set, [[mx0, my1 - 3], [mx1, my1 - 3], [mx1, my1], [mx0, my1]], K.front);
      // Coin door with two lit slots and a coin return.
      const cd = C.coinDoor;
      this.poly(set, [[cd.x, cd.y], [cd.x + cd.w, cd.y], [cd.x + cd.w, cd.y + cd.h], [cd.x, cd.y + cd.h]], K.door);
      for (const x of [cd.x + 12, cd.x + cd.w - 18]) {
        this.poly(set, [[x, cd.y + 12], [x + 6, cd.y + 12], [x + 6, cd.y + 24], [x, cd.y + 24]], K.slot);
      }
      this.poly(set, [[cd.x + 18, cd.y + 50], [cd.x + cd.w - 18, cd.y + 50], [cd.x + cd.w - 18, cd.y + 62], [cd.x + 18, cd.y + 62]], 0x000000);
    });
  }

  // The joystick as seen on the control panel: neutral and pushed four ways. 24x32, base at the bottom.
  makeSticks() {
    const ball = CABINET.colors.ball;
    const push = { n: [0, 0], up: [0, -5], down: [0, 3], left: [-6, 0], right: [6, 0] };
    for (const [k, [dx, dy]] of Object.entries(push)) {
      this.pixels(`stick-${k}`, 24, 32, (set) => {
        for (let x = 4; x < 20; x++) for (let y = 25; y < 30; y++) if (((x - 11.5) / 8) ** 2 + ((y - 27) / 2.6) ** 2 <= 1) set(x, y, 0x050505);
        const bx = 12 + dx, by = 10 + dy;
        for (let i = 0; i <= 16; i++) {
          const t = i / 16;
          const x = Math.round(12 + (bx - 12) * t), y = Math.round(27 + (by - 27) * t);
          set(x, y, 0xbbbbbb); set(x - 1, y, 0x888888);
        }
        for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) {
          if (x * x + y * y > 38) continue;
          set(bx + x, by + y, x + y < -5 ? 0xff8080 : ball);
        }
      });
    }
  }

  // The maze as one texture at 8 px per tile. Wall lines run 3 px inside each wall block, measured by
  // distance to the nearest floor pixel, which rounds the corners like the arcade maze. Blocks connected to
  // the outer border get a second line, like the original's double outer wall.
  makeMaze(key, color) {
    const rows = MAZE.layout;
    const T = PIXEL.tile, w = rows[0].length, h = rows.length, W = w * T, H = h * T;
    const isWallTile = (tx, ty) => tx < 0 || ty < 0 || tx >= w || ty >= h || rows[ty][tx] === '#';

    // Wall tiles connected to the outside of the map.
    const border = new Set();
    const stack = [];
    for (let tx = 0; tx < w; tx++) stack.push([tx, 0], [tx, h - 1]);
    for (let ty = 0; ty < h; ty++) stack.push([0, ty], [w - 1, ty]);
    while (stack.length) {
      const [tx, ty] = stack.pop();
      const k = `${tx},${ty}`;
      if (tx < 0 || ty < 0 || tx >= w || ty >= h || border.has(k) || !isWallTile(tx, ty)) continue;
      border.add(k);
      stack.push([tx + 1, ty], [tx - 1, ty], [tx, ty + 1], [tx, ty - 1]);
    }

    const floor = (x, y) => !isWallTile(Math.floor(x / T), Math.floor(y / T));
    const R = 7;
    // The line mask is the same for every color, so compute it once.
    this.mazeMask ??= this.mazeLines(W, H, T, isWallTile, floor, border, R);
    this.pixels(key, W, H, (set) => {
      this.mazeMask.forEach((i) => set(i % W, Math.floor(i / W), color));
      // Ghost door: a 2 px pink bar.
      rows.forEach((row, ty) => [...row].forEach((c, tx) => {
        if (c !== '-') return;
        for (let x = 0; x < T; x++) { set(tx * T + x, ty * T + 4, COLORS.door); set(tx * T + x, ty * T + 5, COLORS.door); }
      }));
    });
  }

  mazeLines(W, H, T, isWallTile, floor, border, R) {
    const lit = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const tx = Math.floor(x / T), ty = Math.floor(y / T);
        if (!isWallTile(tx, ty)) continue;
        let d2 = Infinity;
        for (let oy = -R; oy <= R; oy++) {
          for (let ox = -R; ox <= R; ox++) {
            const n = ox * ox + oy * oy;
            if (n < d2 && floor(x + ox, y + oy)) d2 = n;
          }
        }
        const d = Math.sqrt(d2);
        if ((d >= 3 && d < 4) || (border.has(`${tx},${ty}`) && d >= 6 && d < 7)) lit.push(y * W + x);
      }
      }
    return lit;
  }
}
