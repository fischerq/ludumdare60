import { COLORS, MAZE, PIXEL, UI } from '../config.js';

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
    // Wait for the arcade font so text doesn't render in the fallback first (give up after 2 s).
    const font = document.fonts?.load(`8px ${UI.arcadeFont}`) ?? Promise.resolve();
    const timeout = new Promise((r) => setTimeout(r, 2000));
    Promise.race([font, timeout]).catch(() => {}).finally(() => this.scene.start('Menu'));
  }

  // Draw a w x h texture; paint(set) calls set(x, y, color) for each lit pixel.
  pixels(key, w, h, paint) {
    const tex = this.textures.createCanvas(key, w, h);
    const ctx = tex.getContext();
    paint((x, y, color) => { ctx.fillStyle = hex(color); ctx.fillRect(x, y, 1, 1); });
    tex.refresh();
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
