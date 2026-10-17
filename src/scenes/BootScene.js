import { COLORS, MAZE, PIXEL, UI, CABINET, HALL } from '../config.js';
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
    this.makeHall();
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

  // The arcade hall (layer 3), a cozy top-down room: tileset assets/arcade/ (16x16 each), plus the coin and the
  // cap the ghost visitors wear. 1x2 machines are two tiles, top and bottom.
  makeHall() {
    const T = PIXEL.tile, K = HALL.colors;
    const rect = (set, x, y, w, h, c) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, c); };
    const tile = (name, paint) => this.pixels(tileKey('arcade', name), T, T, (set) => paint(set));
    const shadow = (set) => rect(set, 1, 14, 14, 2, 0x5a3a20); // contact shadow on the wooden floor

    // Wooden floor: planks 4 px high with staggered joints and a light edge.
    tile('floor', (set) => {
      rect(set, 0, 0, T, T, K.floor);
      for (let y = 0; y < T; y += 4) {
        rect(set, 0, y + 3, T, 1, K.floorLine);
        rect(set, 0, y, T, 1, K.floorLight);
        set((y * 5 + 3) % T, y + 1, K.floorLine); set((y * 5 + 3) % T, y + 2, K.floorLine);
      }
    });
    // Rug, 9-slice: red with a yellow border; the game picks the piece from the neighbours.
    for (const [v, top, bottom] of [['t', true, false], ['m', false, false], ['b', false, true]]) {
      for (const [h, left, right] of [['l', true, false], ['c', false, false], ['r', false, true]]) {
        tile(`rug-${v}${h}`, (set) => {
          rect(set, 0, 0, T, T, K.rug);
          for (let y = 0; y < T; y += 4) for (let x = (y / 2) % 4; x < T; x += 4) set(x, y + 1, K.rugDark);
          if (top) { rect(set, 0, 1, T, 2, K.rugBorder); rect(set, 0, 0, T, 1, K.rugDark); }
          if (bottom) { rect(set, 0, 13, T, 2, K.rugBorder); rect(set, 0, 15, T, 1, K.rugDark); }
          if (left) { rect(set, 1, 0, 2, T, K.rugBorder); rect(set, 0, 0, 1, T, K.rugDark); }
          if (right) { rect(set, 13, 0, 2, T, K.rugBorder); rect(set, 15, 0, 1, T, K.rugDark); }
        });
      }
    }
    tile('wall-top', (set) => rect(set, 0, 0, T, T, K.wallTop));
    // Back wall: striped wallpaper with a baseboard; windows, posters and a clock sit on it.
    const wallpaper = (set) => {
      rect(set, 0, 0, T, T, K.wallpaper);
      for (let x = 2; x < T; x += 6) rect(set, x, 0, 2, 13, K.wallStripe);
      rect(set, 0, 13, T, 3, K.baseboard);
    };
    tile('wall-face', wallpaper);
    tile('window', (set) => {
      wallpaper(set);
      rect(set, 2, 1, 12, 10, 0xffffff);
      rect(set, 3, 2, 10, 8, K.sky);
      rect(set, 3, 5, 10, 1, 0xffffff); rect(set, 7, 2, 1, 8, 0xffffff);
      [[4, 3], [10, 6], [5, 8], [11, 2]].forEach(([x, y]) => set(x, y, 0xc8ecff)); // rain
      rect(set, 1, 11, 14, 1, K.baseboard);
    });
    tile('poster-pac', (set) => {
      wallpaper(set);
      rect(set, 3, 1, 10, 11, 0x101030);
      // A small chomper with its mouth open to the right.
      for (let y = 3; y < 10; y++) {
        for (let x = 5; x < 12; x++) {
          const dx = x + 0.5 - 8, dy = y + 0.5 - 6.5;
          if (dx * dx + dy * dy <= 12.5 && !(dx > 0 && Math.abs(dy) < dx)) set(x, y, 0xffff00);
        }
      }
      rect(set, 4, 10, 8, 1, 0xffb897);
    });
    tile('poster-ghost', (set) => {
      wallpaper(set);
      rect(set, 3, 1, 10, 11, 0x101030);
      rect(set, 5, 4, 6, 6, 0xff0000); rect(set, 6, 3, 4, 1, 0xff0000);
      set(5, 10, 0xff0000); set(8, 10, 0xff0000); set(10, 10, 0xff0000);
      rect(set, 6, 5, 2, 2, 0xffffff); rect(set, 9, 5, 1, 2, 0xffffff);
    });
    tile('clock', (set) => {
      wallpaper(set);
      this.disc((x, y, c) => set(x + 1, y, c), 14, 5.5, K.baseboard);
      this.disc((x, y, c) => set(x + 1, y, c), 14, 4.5, 0xffffff);
      rect(set, 8, 3, 1, 4, 0x000000); rect(set, 8, 7, 3, 1, 0x000000);
    });
    tile('counter', (set) => {
      rect(set, 0, 1, T, 7, K.counterTop);
      rect(set, 0, 2, T, 1, 0xe0b080);
      rect(set, 0, 8, T, 6, K.counter);
      for (let x = 3; x < T; x += 8) rect(set, x, 9, 1, 4, 0x5a3418);
      shadow(set);
    });
    tile('plant', (set) => {
      rect(set, 5, 10, 6, 4, K.plantPot); rect(set, 4, 9, 8, 2, 0xd07a4a);
      [[8, 2], [5, 4], [11, 4], [7, 6], [9, 6], [4, 7], [12, 7]].forEach(([x, y]) => {
        rect(set, x - 1, y - 1, 3, 3, K.leaf); set(x, y - 1, K.leafLight);
      });
      shadow(set);
    });
    tile('bin', (set) => {
      rect(set, 4, 4, 8, 10, 0x707a80); rect(set, 3, 3, 10, 2, 0x9aa4aa);
      rect(set, 6, 2, 2, 2, 0xffe0e0); set(9, 2, 0xffd23f); // tickets sticking out
      shadow(set);
    });
    tile('change-top', (set) => { rect(set, 2, 2, 12, 14, K.change); rect(set, 4, 4, 8, 3, 0x30ff60); });
    tile('change-bottom', (set) => { rect(set, 2, 0, 12, 13, K.change); rect(set, 6, 4, 4, 4, 0x202020); shadow(set); });
    tile('claw-top', (set) => {
      rect(set, 1, 1, 14, 15, 0xff7ac0); rect(set, 2, 2, 12, 13, 0xd8f4ff);
      rect(set, 7, 2, 2, 4, 0x888888); set(6, 6, 0x888888); set(9, 6, 0x888888);
      [[4, 12, 0xffd23f], [7, 13, 0x6cff6c], [10, 12, 0x3fd0ff], [12, 13, 0xff4fa0]].forEach(([x, y, c]) => rect(set, x, y, 2, 2, c));
    });
    tile('claw-bottom', (set) => {
      rect(set, 1, 0, 14, 14, 0xff7ac0); rect(set, 2, 0, 12, 3, 0x262626);
      set(5, 1, 0xd81818); rect(set, 9, 1, 2, 1, 0x30ff60);
      rect(set, 6, 7, 4, 4, 0x2c2c2c); shadow(set);
    });
    tile('soda-top', (set) => {
      rect(set, 1, 1, 14, 15, 0xd02828); rect(set, 3, 3, 10, 5, 0xffffff);
      rect(set, 4, 5, 8, 1, 0xd02828);
      for (let x = 3; x < 13; x += 3) rect(set, x, 10, 2, 4, 0x8a1010);
    });
    tile('soda-bottom', (set) => {
      rect(set, 1, 0, 14, 14, 0xd02828); rect(set, 3, 2, 10, 4, 0x200808);
      rect(set, 11, 8, 2, 3, 0xffd23f); shadow(set);
    });
    tile('door', (set) => {
      rect(set, 0, 0, T, T, K.wallTop);
      rect(set, 2, 0, 12, T, K.door);
      rect(set, 4, 2, 8, 5, K.sky);
      set(11, 10, 0xffd23f);
    });
    for (const [c, col] of Object.entries(K.cabinets)) {
      // Top: side panels in the cabinet color, black marquee band and a lit screen.
      tile(`cab-top-${c}`, (set) => {
        rect(set, 1, 1, 14, 15, col);
        rect(set, 3, 2, 10, 3, 0x000000);
        rect(set, 4, 3, 8, 1, 0xffffff);
        rect(set, 3, 6, 10, 9, 0x101018);
        rect(set, 4, 7, 8, 7, c === 'y' ? 0x2121de : 0x183048);
        if (c === 'y') { set(6, 10, 0xffff00); set(7, 10, 0xffff00); set(9, 9, 0xffb897); set(11, 9, 0xffb897); }
      });
      // Bottom: control panel with a joystick, then the front with the coin door.
      tile(`cab-bottom-${c}`, (set) => {
        rect(set, 1, 0, 14, 14, col);
        rect(set, 2, 0, 12, 4, 0x262626);
        set(6, 1, 0xd81818); set(6, 2, 0x888888);
        rect(set, 6, 7, 4, 5, 0x2c2c2c);
        set(7, 8, 0xff3030); set(8, 8, 0xff3030);
        shadow(set);
      });
    }
    this.pixels('coin', 10, 10, (set) => {
      this.disc(set, 10, 4.6, 0xa07010);
      this.disc(set, 10, 3.6, K.coin);
      set(4, 3, 0xffffff); set(3, 4, 0xffffff);
    });
    // A cap for the ghost visitors, drawn over the (tinted) ghost body, 16x16 like the ghost.
    this.pixels('visitor-cap', 16, 16, (set) => {
      rect(set, 4, 0, 8, 1, K.cap);
      rect(set, 3, 1, 10, 3, K.cap);
      rect(set, 8, 3, 7, 1, K.cap);
      set(7, 1, 0xffffff);
    });
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
      // The floor is drawn by the scene, so this texture is only the machine (and its shadow) on transparent.
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
