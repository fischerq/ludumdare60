import { COLORS, MAZE, PIXEL, UI } from '../config.js';
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
    return tex;
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
