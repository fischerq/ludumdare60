import { COLORS, MAZE, PIXEL, UI, CABINET } from '../config.js';
import { mazeTiles, tileKey } from '../systems/tiles.js';

const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;

// Ghost body, 14x14 inside a 16x16 sprite: 11 shared rows plus 3 skirt rows per animation frame.
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

// Generates all placeholder art in code, pixel by pixel at native size: 16x16 sprites, the 'maze' tileset of
// 16x16 tiles (one texture per tile), and the maze built from that tileset. Real art can replace any of
// these later under the same texture keys (tools/export_assets.py writes them to assets/).
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.makePellets();
    this.makePac();
    this.makeGhosts();
    this.makeTileset();
    this.buildMaze();
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
    return tex;
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

  // Lit where (x + 0.5, y + 0.5) is inside a circle of radius r around (cx, cy).
  disc(set, size, r, color) {
    const c = size / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x + 0.5 - c, dy = y + 0.5 - c;
        if (dx * dx + dy * dy <= r * r) set(x, y, color);
      }
    }
  }

  // Pellets at tile resolution: a 4x4 dot, a 16x16 power pellet.
  makePellets() {
    this.pixels('dot', 4, 4, (set) => this.disc(set, 4, 2.1, COLORS.dot));
    this.pixels('power', 16, 16, (set) => this.disc(set, 16, 7.6, COLORS.dot));
  }

  // Chomper facing right, 16x16: pac-0 (closed) .. pac-3 (wide open), death frames pac-die-0..9.
  makePac() {
    const frame = (key, mouth) => this.pixels(key, 16, 16, (set) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const dx = x + 0.5 - 8, dy = y + 0.5 - 8;
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
    const body = (set, color, f) => this.bitmap(set, [...GHOST_TOP, ...GHOST_SKIRT[f]], color, 1, 1);
    [0, 1].forEach((f) => {
      this.pixels(`ghost-${f}`, 16, 16, (set) => body(set, 0xffffff, f));
      this.pixels(`ghost-fright-${f}`, 16, 16, (set) => {
        body(set, COLORS.fright, f); this.bitmap(set, FRIGHT_FACE, COLORS.frightFace, 1, 1);
      });
      this.pixels(`ghost-flash-${f}`, 16, 16, (set) => {
        body(set, COLORS.frightFlash, f); this.bitmap(set, FRIGHT_FACE, COLORS.frightFlashFace, 1, 1);
      });
    });
    // Eyes look where the ghost is going: whites shift one pixel, pupils sit at that edge.
    const white = ['.##.', '####', '####', '####', '.##.'];
    const look = { left: [-1, 0, 0, 2], right: [1, 0, 2, 2], up: [0, -1, 1, 0], down: [0, 1, 1, 3] };
    for (const [dir, [dx, dy, px, py]] of Object.entries(look)) {
      this.pixels(`eyes-${dir}`, 16, 16, (set) => {
        for (const ex of [3, 9]) {
          const x0 = ex + dx, y0 = 4 + dy;
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

  // The 'maze' tileset (see src/systems/tiles.js): 16 wall pieces, one per combination of the four cells
  // around a tile corner, plus the ghost door and the floor. Wall pieces light the pixels at PIXEL.wallLine
  // distance from the floor, which rounds the corners like the arcade maze.
  makeTileset() {
    const T = PIXEL.tile, [near, far] = PIXEL.wallLine;
    for (let mask = 1; mask < 16; mask++) {
      // The piece covers the inner quarters of a 2x2 block of cells; bit order TL, TR, BR, BL.
      const wall = (x, y) => (mask >> [[0, 1], [3, 2]][y][x]) & 1;
      const floor = (x, y) => x >= 0 && y >= 0 && x < 2 * T && y < 2 * T
        && !wall(Math.floor(x / T), Math.floor(y / T));
      this.pixels(tileKey('maze', `wall-${mask}`), T, T, (set) => {
        for (let y = 0; y < T; y++) {
          for (let x = 0; x < T; x++) {
            const wx = x + T / 2, wy = y + T / 2;
            if (!wall(Math.floor(wx / T), Math.floor(wy / T))) continue;
            let d2 = Infinity;
            for (let oy = -far; oy <= far; oy++) {
              for (let ox = -far; ox <= far; ox++) {
                const n = ox * ox + oy * oy;
                if (n < d2 && floor(wx + ox, wy + oy)) d2 = n;
              }
            }
            const d = Math.sqrt(d2);
            if (d >= near && d < far) set(x, y, COLORS.wall);
          }
        }
      });
    }
    // Ghost door: a 4 px pink bar across the middle. The floor tile stays empty (black shows through).
    this.pixels(tileKey('maze', 'door'), T, T, (set) => {
      for (let x = 0; x < T; x++) for (let y = 8; y < 12; y++) set(x, y, COLORS.door);
    });
    this.pixels(tileKey('maze', 'floor'), T, T, () => {});
  }

  // Bakes the maze into one 'maze' texture from the tileset: floor and door on the cell grid, wall pieces
  // on the grid shifted by half a tile (each piece sits where four cells meet).
  buildMaze() {
    const T = PIXEL.tile;
    const { w, h, cells, walls } = mazeTiles(MAZE.layout);
    const tex = this.textures.createCanvas('maze', w * T, h * T);
    const ctx = tex.getContext();
    const draw = (tile, x, y) => ctx.drawImage(this.textures.get(tileKey('maze', tile)).getSourceImage(), x, y, T, T);
    cells.forEach(({ x, y, tile }) => draw(tile, x * T, y * T));
    walls.forEach(({ x, y, tile }) => draw(tile, x * T - T / 2, y * T - T / 2));
    tex.refresh();
  }
}
