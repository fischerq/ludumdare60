import { COLORS, MAZE, PIXEL, UI, CABINET, HALL, DEEP, LOBBY, LEVELS, ADDER } from '../config.js';
import { tinyText } from '../systems/layers/font.js';
import { mazeTiles, tileKey } from '../systems/tiles.js';
import { world } from '../systems/arcade/world.js';
import { openManual } from '../manual/index.js';
import { setWonCount } from '../progress.js';

const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;

// Every character sprite is 32x32, one file per state, so Max can redraw any of them on its own.
const S = 32;
const DIRS4 = ['left', 'right', 'up', 'down'];
const LOOK = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
const EYE_WHITE = ['.####.', '######', '######', '######', '######', '######', '######', '.####.'];

// Loads the art from assets/ (one PNG per texture key, listed in assets/export.json) and draws a code
// placeholder, pixel by pixel at native size, for any key whose file is missing: 16x16 sprites, the 'maze'
// tileset of 16x16 tiles (one texture per tile), and the maze built from that tileset.
// tools/export_assets.py writes the placeholders to assets/ and never overwrites a file Max edited there.
// ?codeart skips the files and shows only the code-drawn art (the export uses this).
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    window.bootScreen?.step('ROM', 0.4);
    // The art fills the boot bar from 40 to 85 %.
    this.load.on('progress', (p) => window.bootScreen?.progress(0.4 + p * 0.45));
    if (new URLSearchParams(window.location.search).has('codeart')) return;
    // Over plain http (a local server) always fetch fresh files, so an edited PNG shows on the next reload.
    const bust = window.location.protocol === 'http:' ? `?t=${Date.now()}` : '';
    this.load.json('art-manifest', `assets/export.json${bust}`);
    this.load.once('filecomplete-json-art-manifest', (key, type, data) => {
      for (const k of Object.keys(data?.textures ?? {})) this.load.image(k, `assets/${k}.png${bust}`);
    });
  }

  create() {
    this.makePellets();
    this.makeFruit();
    this.makePac();
    this.makeGhosts();
    this.makeTileset();
    this.buildMaze();
    this.makeCabinet();
    this.makeSticks();
    this.makeCoinMech();
    this.makeHall();
    this.makeHallCharacters();
    this.makeDeep();
    this.makeBoard();
    this.makeAdder();
    // Wait for the arcade font so text doesn't render in the fallback first (give up after 2 s).
    const font = document.fonts?.load(`8px ${UI.arcadeFont}`) ?? Promise.resolve();
    const timeout = new Promise((r) => setTimeout(r, 2000));
    // ?scene=Cabinet (or any scene key) jumps straight to that layer, for playtesting.
    // ?scene=Deep&layer=2 picks a deep layer.
    const params = new URLSearchParams(window.location.search), start = params.get('scene');
    const data = params.has('layer') ? { layer: Number(params.get('layer')) } : undefined;
    // ?won=n: the first n subsystems inside the cabinet count as won (for testing the unlocks).
    if (params.has('won')) setWonCount(Number(params.get('won')));
    // With ?manual the arcade hall is underneath, so closing the manual lands where the booklet lies.
    const target = start && this.scene.get(start) ? start : params.has('manual') ? 'Hall' : 'Menu';
    // The emulated arcade machine has to be running too: the maze level is its picture.
    const machine = (world.ready ?? Promise.resolve()).catch((e) => console.error('arcade machine failed', e));
    // ?manual opens the service manual over it (for debugging the emulator on the live page).
    window.bootScreen?.step('VIDEO', 0.85);
    machine.then(() => window.bootScreen?.step('CPU', 0.95));
    Promise.all([Promise.race([font, timeout]).catch(() => {}), machine]).finally(() => {
      window.bootScreen?.done();
      this.scene.start(target, data);
      if (params.has('manual')) openManual();
    });
  }

  // Draw a w x h texture; paint(set) calls set(x, y, color) for each lit pixel.
  // Skipped when the texture was loaded from assets/.
  pixels(key, w, h, paint) {
    if (this.textures.exists(key)) return this.textures.get(key);
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

  // The arcade hall (layer 3), a cozy top-down room: tileset assets/arcade/ (16x16 each), plus the coin.
  // 1x2 machines are two tiles, top and bottom.
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
    // What each cabinet's screen shows: ours the maze, the others famous games of the time.
    const px = (set, pts, color) => pts.forEach(([x, y]) => set(x, y, color));
    const screens = {
      y: (set) => { px(set, [[6, 10], [7, 10]], 0xffff00); px(set, [[9, 9], [11, 9]], 0xffb897); },
      r: (set) => { // Space Invaders: rows of invaders over a green base
        px(set, [[5, 8], [7, 8], [9, 8], [11, 8]], 0xffffff);
        px(set, [[4, 10], [6, 10], [8, 10], [10, 10]], 0xffffff);
        px(set, [[7, 13], [8, 13], [9, 13], [8, 12]], 0x40ff40);
      },
      b: (set) => { // Asteroids: outlined rocks and the ship, drawn as lines
        px(set, [[5, 7], [6, 7], [4, 8], [7, 8], [5, 9], [6, 9], [10, 8], [11, 9], [10, 10]], 0xd0d0d0);
        px(set, [[8, 11], [7, 12], [9, 12], [8, 13]], 0xffffff);
      },
      g: (set) => { // Donkey Kong: red girders, a cyan ladder, the ape and a barrel
        px(set, [[4, 9], [5, 9], [6, 9], [7, 9], [8, 10], [9, 10], [10, 10], [11, 10]], 0xff3060);
        px(set, [[4, 13], [5, 13], [6, 13], [7, 12], [8, 12], [9, 12], [10, 12], [11, 12]], 0xff3060);
        px(set, [[9, 11], [9, 13]], 0x40e0ff);
        px(set, [[4, 7], [5, 7], [4, 8], [5, 8]], 0xa05020);
        set(6, 11, 0xd08030);
      },
      v: (set) => { // Galaxian: a formation in color under stars
        px(set, [[7, 7], [8, 7]], 0xffd000);
        px(set, [[5, 8], [7, 8], [9, 8], [11, 8]], 0xff3030);
        px(set, [[4, 9], [6, 9], [8, 9], [10, 9]], 0xc040ff);
        px(set, [[5, 10], [7, 10], [9, 10]], 0x30a0ff);
        px(set, [[8, 13], [7, 13], [9, 13], [8, 12]], 0xffffff);
        px(set, [[11, 12], [4, 12]], 0x808080);
      },
    };
    for (const [c, col] of Object.entries(K.cabinets)) {
      // Top: side panels in the cabinet color, black marquee band and a lit screen.
      tile(`cab-top-${c}`, (set) => {
        rect(set, 1, 1, 14, 15, col);
        rect(set, 3, 2, 10, 3, 0x000000);
        rect(set, 4, 3, 8, 1, 0xffffff);
        rect(set, 3, 6, 10, 9, 0x101018);
        rect(set, 4, 7, 8, 7, c === 'y' ? 0x2121de : 0x000000);
        screens[c]?.(set);
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
    // Pickles: the owner's bitten Gurke and a jar of cornichons on the counter, a mini-Gurke on the floor.
    const counter = (set) => {
      rect(set, 0, 1, T, 7, K.counterTop);
      rect(set, 0, 2, T, 1, 0xe0b080);
      rect(set, 0, 8, T, 6, K.counter);
      for (let x = 3; x < T; x += 8) rect(set, x, 9, 1, 4, 0x5a3418);
      shadow(set);
    };
    tile('counter', counter);
    tile('counter-gurke', (set) => {
      counter(set);
      rect(set, 2, 3, 11, 3, K.gurke); rect(set, 3, 2, 9, 1, K.gurke); rect(set, 3, 6, 9, 1, K.gurkeDark);
      [[4, 3], [7, 3], [10, 4]].forEach(([x, y]) => set(x, y, K.gurkeLight));
      [[5, 5], [8, 5]].forEach(([x, y]) => set(x, y, K.gurkeDark));
      rect(set, 12, 3, 1, 3, K.gurkeInside); set(11, 2, K.counterTop); set(11, 6, K.counterTop); // the bite
    });
    tile('counter-jar', (set) => {
      counter(set);
      rect(set, 4, 1, 8, 9, K.jarGlass); rect(set, 5, 0, 6, 1, K.jarGlass);
      rect(set, 5, 0, 6, 2, K.jarLid);
      [[5, 4], [7, 3], [9, 5], [6, 7], [8, 6], [10, 8], [5, 8]].forEach(([x, y]) => { set(x, y, K.gurke); set(x, y + 1, K.gurkeDark); });
      rect(set, 4, 3, 1, 5, 0xffffff);
    });
    tile('mini-gurke', (set) => {
      rect(set, 6, 10, 5, 1, 0x5a3a20);
      rect(set, 6, 8, 4, 2, K.gurke); set(10, 9, K.gurke); set(7, 8, K.gurkeLight); set(9, 9, K.gurkeDark);
    });
    // The paper sign on the counter in front of the owner.
    tile('counter-sign', (set) => {
      counter(set);
      rect(set, 3, 0, 10, 8, K.signPaper); rect(set, 3, 0, 10, 1, K.signEdge); rect(set, 3, 7, 10, 1, K.signEdge);
      rect(set, 3, 0, 1, 8, K.signEdge); rect(set, 12, 0, 1, 8, K.signEdge);
      rect(set, 5, 2, 6, 1, K.signInk); rect(set, 5, 4, 4, 1, K.signInk); rect(set, 10, 4, 1, 1, K.signInk);
    });
    // The manuals table, two tiles: the stack (Space Invaders, Asteroids, Donkey Kong, Galaxian's torn one) on the
    // left, ours on its own on the right.
    const table = (set, left) => {
      rect(set, left ? 1 : 0, 4, 15, 7, K.table); rect(set, left ? 1 : 0, 4, 15, 1, 0xc89058);
      rect(set, left ? 2 : 12, 11, 2, 3, K.counter);
      rect(set, left ? 1 : 0, 14, 15, 2, 0x5a3a20);
    };
    tile('manual-stack', (set) => {
      table(set, true);
      [[0x8040c0, 9], [0x30a050, 7], [0x3060d0, 5], [0xd03030, 3]].forEach(([c, y], i) => {
        rect(set, 4 + (i % 2), y - 2, 8, 4, c); rect(set, 4 + (i % 2), y + 2, 8, 1, 0xf0f0e0);
      });
      set(11, 7, K.table); set(12, 8, K.table); // Galaxian's, torn at the corner
    });
    tile('manual-pac', (set) => {
      table(set, false);
      rect(set, 3, 1, 10, 10, K.signPaper); rect(set, 3, 10, 10, 1, K.signEdge); rect(set, 12, 1, 1, 10, K.signEdge);
      this.disc((x, y, c) => set(x + 4, y + 2, c), 7, 2.8, COLORS.pac);
      set(9, 5, K.signPaper); set(10, 5, K.signPaper); set(10, 4, K.signPaper); // mouth
      rect(set, 4, 9, 7, 1, K.signInk);
      set(5, 8, 0xa08050); set(11, 2, 0xa08050); // coffee stains
    });
    this.pixels('arcade/coin', 10, 10, (set) => {
      this.disc(set, 10, 4.6, 0xa07010);
      this.disc(set, 10, 3.6, K.coin);
      set(4, 3, 0xffffff); set(3, 4, 0xffffff);
    });
  }

  // Pellets at tile resolution: a 4x4 dot, a 16x16 power pellet.
  makePellets() {
    this.pixels('maze/dot', 4, 4, (set) => this.disc(set, 4, 2.1, COLORS.dot));
    this.pixels('maze/power', 16, 16, (set) => this.disc(set, 16, 7.6, COLORS.dot));
  }

  // The level shelf's fruits (one 16x16 tile each, maze/fruit-<name>, cell codes in memmap.js), colors drawn in.
  makeFruit() {
    const C = LEVELS.colors;
    const legend = {
      r: C.red, d: C.darkRed, g: C.green, b: C.brown, w: C.white, o: C.orange, m: C.melon, n: C.melonDark,
      y: C.yellow, u: C.blue, c: C.cyan, s: C.grey,
    };
    const art = {
      cherry: [
        '..........bb....', '.........b.b....', '........b...b...', '.......b....b...', '......b.....b...',
        '.....b......b...', '..rrrb.....rrr..', '.rrrrr....rrrrr.', '.rwrrr....rwrrr.', '.rrrrr....rrrrr.',
        '.rrrrd....rrrrd.', '..rdd......rdd..', '................', '................', '................', '................'],
      strawberry: [
        '................', '......gggg......', '.....gggggg.....', '...rrrrrrrrrr...', '..rrwrrrrrwrrr..',
        '..rrrrrwrrrrrr..', '..rwrrrrrrrwrr..', '...rrrwrrrrrr...', '...rrrrrrwrr....', '....rwrrrrrr....',
        '.....rrrrwr.....', '......rrrr......', '.......rr.......', '................', '................', '................'],
      orange: [
        '.......b........', '.......bgg......', '......gggg......', '....oooooooo....', '...oooooooooo...',
        '..oowooooooooo..', '..owoooooooooo..', '..oooooooooooo..', '..oooooooooooo..', '..oooooooooooo..',
        '...oooooooooo...', '....oooooooo....', '................', '................', '................', '................'],
      apple: [
        '.......b........', '.......b.gg.....', '...rrrrbrrrr....', '..rrrrrrrrrrr...', '.rrwwrrrrrrrrr..',
        '.rrwrrrrrrrrrr..', '.rrrrrrrrrrrrr..', '.rrrrrrrrrrrrr..', '.rrrrrrrrrrrrr..', '..rrrrrrrrrrd...',
        '..rrrrrrrrrdd...', '...rrdrrrddd....', '................', '................', '................', '................'],
      melon: [
        '.......bb.......', '......gg........', '....mmnmmnmm....', '...mnmmnmmnmm...', '..mnmmnmmnmmnm..',
        '..mnmwnmmnmmnm..', '..mnmmnmmnmmnm..', '..mnmmnmmnmmnm..', '..mnmmnmmnmmnm..', '...mnmmnmmnmm...',
        '....mmnmmnmm....', '......nnn.......', '................', '................', '................', '................'],
      ship: [
        '.......y........', '.......y........', '......yyy.......', '......uyu.......', '.r...uuyuu...r..',
        '.r..uuuyuuu..r..', '.rr.uuyyyuu.rr..', '.rruuyyyyyuurr..', '.rruyyyyyyyurr..', '.r..yyy.yyy..r..',
        '....rr...rr.....', '................', '................', '................', '................', '................'],
      bell: [
        '.......yy.......', '......yyyy......', '.....yyyyyy.....', '....yywyyyyy....', '....ywyyyyyy....',
        '....ywyyyyyy....', '...yyyyyyyyyy...', '...yyyyyyyyyy...', '..yyyyyyyyyyyy..', '..yyyyyyyyyyyy..',
        '...cccccccccc...', '.......ww.......', '................', '................', '................', '................'],
      key: [
        '.....cccccc.....', '....cc....cc....', '....c..uu..c....', '....cc....cc....', '.....cccccc.....',
        '.......ss.......', '.......ss.......', '.......ssss.....', '.......ss.......', '.......sss......',
        '.......ss.......', '.......ssss.....', '.......ss.......', '................', '................', '................'],
    };
    for (const [name, rows] of Object.entries(art)) {
      this.pixels(`maze/fruit-${name}`, 16, 16, (set) => rows.forEach((row, y) => [...row].forEach((ch, x) => {
        if (legend[ch] != null) set(x, y + 2, legend[ch]);
      })));
    }
  }

  // Lit where pixel (x, y) of an S x S sprite is inside a circle of radius r around (cx, cy), outside the mouth: a
  // wedge of half-angle `mouth` around the direction `facing` (radians, 0 = right, -PI/2 = up).
  chomper(set, color, r, mouth, facing = 0, cx = 16, cy = 16) {
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        if (dx * dx + dy * dy > r * r) continue;
        const a = Math.atan2(dy, dx) - facing;
        if (mouth > 0 && Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < mouth) continue;
        set(x, y, color);
      }
    }
  }

  // The deep layers' Tron look, one folder per layer (assets/deep/<layer>/), colors from DEEP.style:
  // pac-0..3 a neon outline Pac-Man (facing right like maze/pac-*), dot and dot2 the collectibles in the
  // layer's two accents, special the special collectible (a ring with a core).
  makeDeep() {
    for (const [id, P] of Object.entries(DEEP.style)) {
      [0, 0.3, 0.6, 0.9].forEach((m, i) => this.pixels(`deep/${id}/pac-${i}`, S, S, (set) => {
        const on = new Set();
        this.chomper((x, y) => on.add(y * S + x), 0, 13.2, m);
        const inside = (x, y, d) => [[-d, 0], [d, 0], [0, -d], [0, d]].every(([dx, dy]) => on.has((y + dy) * S + x + dx));
        for (const k of on) {
          const x = k % S, y = Math.floor(k / S);
          set(x, y, !inside(x, y, 1) ? 0xffffff : !inside(x, y, 2) ? P.line : !inside(x, y, 3) ? P.glow : P.bg);
        }
      }));
      // The screen layer's pickup glow: the same chomp lit up, filled bright, with a two-pixel halo around it.
      if (id === 'crt') [0, 0.3, 0.6, 0.9].forEach((m, i) => this.pixels(`deep/${id}/pac-glow-${i}`, S, S, (set) => {
        const on = new Set();
        this.chomper((x, y) => on.add(y * S + x), 0, 13.2, m);
        const near = (x, y, d) => { for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) if (on.has((y + dy) * S + x + dx)) return true; return false; };
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !on.has((y + dy) * S + x + dx));
          if (on.has(y * S + x)) set(x, y, edge ? 0xffffff : P.dot2);
          else if (near(x, y, 1)) set(x, y, P.line);
          else if (near(x, y, 2)) set(x, y, P.glow);
        }
      }));
      for (const [key, c] of [['dot', P.dot], ['dot2', P.dot2]]) {
        this.pixels(`deep/${id}/${key}`, 6, 6, (set) => {
          this.disc(set, 6, 3, c);
          this.bitmap(set, ['##', '##'], 0xffffff, 2, 2);
        });
      }
      this.pixels(`deep/${id}/special`, 12, 12, (set) => {
        this.disc(set, 12, 6, P.line);
        this.disc((x, y, cc) => set(x, y, cc), 12, 4.6, P.glow);
        this.disc(set, 12, 2.6, P.special);
      });
    }
  }

  // The adder layer (assets/deep/adder/, 32x32 each): the carry bit (carry-0, carry-1 idle glow, carry-hop, carry-hit),
  // a signal pulse in tiles (pulse-single, pulse-body, pulse-head-<dir> at its front, pulse-tail-<dir> at its back,
  // for pulses moving left and right), the gates with their output drawn in (gate-<xor|and|or>-<0|1>: 1 lets the
  // carry through, 0 blocks) and the chip between them (chip).
  makeAdder() {
    const A = ADDER.style, red = DEEP.hazard, redGlow = DEEP.hazardGlow;
    const text = (set, str, x, y, k, color) => tinyText({ fillRect: (fx, fy, w, h) => {
      for (let yy = fy; yy < fy + h; yy++) for (let xx = fx; xx < fx + w; xx++) set(xx, yy, color);
    } }, str, x, y, k);
    // The carry: a round chip with a big 1 on it.
    const carry = (key, { line = A.line, glow = A.glow, core = A.carry, ring = 0, sx = 1, sy = 1 } = {}) => this.pixels(`deep/adder/${key}`, S, S, (set) => {
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const dx = (x + 0.5 - 16) / sx, dy = (y + 0.5 - 16) / sy, d = Math.sqrt(dx * dx + dy * dy);
          if (d <= 11) set(x, y, glow);
          else if (d <= 12.5) set(x, y, line);
          else if (d <= 13.6) set(x, y, 0xffffff);
          else if (ring && d <= 15.5 && d > 14.4) set(x, y, line);
        }
      }
      text(set, '1', 12, 9, 3, core);
    });
    carry('carry-0');
    carry('carry-1', { ring: 1 });
    carry('carry-hop', { sx: 0.88, sy: 1.12 });
    carry('carry-hit', { line: red, glow: redGlow, core: 0xffffff, ring: 1 });
    // Pulses: a band across the tile's middle, white core, rounded ends.
    const pulse = (key, round) => this.pixels(`deep/adder/${key}`, S, S, (set) => {
      for (let y = 9; y < 23; y++) {
        for (let x = 0; x < S; x++) {
          const dy = Math.abs(y + 0.5 - 16);
          const cut = (end) => { const dx = end === 'left' ? 7 - x - 0.5 : x + 0.5 - 25; return dx > 0 && dx * dx + dy * dy > 49; };
          if (round.some(cut)) continue;
          set(x, y, dy < 2.5 ? 0xffffff : dy < 5 ? red : redGlow);
        }
      }
    });
    pulse('pulse-single', ['left', 'right']);
    pulse('pulse-body', []);
    pulse('pulse-head-right', ['right']);
    pulse('pulse-tail-right', ['left']);
    pulse('pulse-head-left', ['left']);
    pulse('pulse-tail-left', ['right']);
    // Gates: a chip box with its pins, the gate's name and its output.
    for (const g of ['xor', 'and', 'or']) {
      for (const out of [0, 1]) {
        const line = out ? A.line : 0x6a6a6a, fill = out ? A.glow : A.wall, ink = out ? 0xffffff : 0x8a8a8a;
        this.pixels(`deep/adder/gate-${g}-${out}`, S, S, (set) => {
          for (let y = 3; y < 29; y++) for (let x = 3; x < 29; x++) set(x, y, x === 3 || x === 28 || y === 3 || y === 28 ? line : fill);
          for (const px of [10, 21]) for (let y = 29; y < 32; y++) set(px, y, line); // two inputs below
          for (let y = 0; y < 3; y++) set(16, y, line); // the output on top
          const name = g.toUpperCase(), w = name.length * 8 - 2;
          text(set, name, Math.floor((S - w) / 2), 7, 2, ink);
          text(set, String(out), 13, 18, 2, out ? A.line : red);
        });
      }
    }
    this.pixels('deep/adder/chip', S, S, (set) => {
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, (x + y) % 8 === 0 ? A.grid : A.wall);
      for (let x = 0; x < S; x++) { set(x, 0, A.glow); set(x, S - 1, A.glow); }
    });
  }

  // The maze level's Pac-Man: maze/pac-0 .. pac-6, the chomp's 7 frames facing right (the game flips it for left
  // and turns it for up and down), maze/pac-die-0..9 facing up, maze/life (a spare life, facing left).
  makePac() {
    [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9].forEach((m, i) => this.pixels(`maze/pac-${i}`, S, S, (set) => this.chomper(set, COLORS.pac, 13.2, m)));
    for (let i = 0; i < 10; i++) {
      this.pixels(`maze/pac-die-${i}`, S, S, (set) => this.chomper(set, COLORS.pac, 13.2, 0.3 + (i / 9) * (Math.PI - 0.3), -Math.PI / 2));
    }
    this.pixels('maze/life', S, S, (set) => this.chomper(set, COLORS.pac, 13.2, 0.6, Math.PI));
  }

  // Ghost body: a dome, straight sides and four skirt teeth that shift half a tooth in frame 1.
  ghostBody(set, color, f) {
    for (let y = 2; y < 31; y++) {
      for (let x = 2; x < 30; x++) {
        const dx = x + 0.5 - 16, dy = y + 0.5 - 15;
        if (y < 15 && dx * dx + dy * dy > 14 * 14) continue;
        if (y >= 27 && y - 26 > 4 - Math.abs(((x - 2 + 0.5 + f * 3.5) % 7) - 3.5)) continue;
        set(x, y, color);
      }
    }
  }

  // Eyes looking `dir`: the whites shift two pixels that way, the pupils sit at that edge.
  ghostEyes(set, dir) {
    const [dx, dy] = LOOK[dir];
    for (const ex of [8, 18]) {
      const x0 = ex + dx * 2, y0 = 9 + dy * 2;
      this.bitmap(set, EYE_WHITE, COLORS.eyeWhite, x0, y0);
      this.bitmap(set, ['####', '####', '####', '####'], COLORS.pupil, x0 + 1 + dx, y0 + 2 + dy * 2);
    }
  }

  // The maze level's ghosts, one sprite per state: maze/ghost-<name>-<dir>-<frame> (body and eyes),
  // maze/ghost-fright-<frame>, maze/ghost-flash-<frame> (shared by all four), maze/eyes-<dir> (eaten, eyes only).
  makeGhosts() {
    const frightened = (set, f, body, face) => {
      this.ghostBody(set, body, f);
      for (const ex of [10, 18]) this.bitmap(set, ['####', '####', '####', '####'], face, ex, 11);
      for (let x = 6; x < 26; x++) { const z = Math.floor((x - 6) / 3) % 2 * 2; set(x, 19 + z, face); set(x, 20 + z, face); }
    };
    [0, 1].forEach((f) => {
      for (const [name, color] of Object.entries(COLORS.ghosts)) {
        for (const dir of DIRS4) {
          this.pixels(`maze/ghost-${name}-${dir}-${f}`, S, S, (set) => { this.ghostBody(set, color, f); this.ghostEyes(set, dir); });
        }
      }
      this.pixels(`maze/ghost-fright-${f}`, S, S, (set) => frightened(set, f, COLORS.fright, COLORS.frightFace));
      this.pixels(`maze/ghost-flash-${f}`, S, S, (set) => frightened(set, f, COLORS.frightFlash, COLORS.frightFlashFace));
    });
    for (const dir of DIRS4) this.pixels(`maze/eyes-${dir}`, S, S, (set) => this.ghostEyes(set, dir));
  }

  // The arcade hall's characters, top-down, feet at the bottom of the 32x32 sprite, two walk frames each:
  // arcade/pac-<right|up|down>-<frame> (the game flips right for left) and arcade/ghost-<name>-<dir>-<frame>, the
  // ghost visitors with their cap on (seen from behind when walking up).
  makeHallCharacters() {
    const K = HALL.colors;
    const rect = (set, x, y, w, h, c) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, c); };
    const feet = (set, f) => { rect(set, 10, f ? 27 : 28, 5, 3, K.shoe); rect(set, 17, f ? 28 : 27, 5, 3, K.shoe); };
    const pac = {
      right: (set, f) => { feet(set, f); this.chomper(set, COLORS.pac, 12.5, f ? 0.6 : 0.2, 0, 16, 15); rect(set, 17, 7, 2, 3, K.pacFace); },
      up: (set, f) => { feet(set, f); this.chomper(set, COLORS.pac, 12.5, 0, 0, 16, 15); },
      down: (set, f) => {
        feet(set, f);
        this.chomper(set, COLORS.pac, 12.5, 0, 0, 16, 15);
        rect(set, 11, 10, 2, 4, K.pacFace); rect(set, 19, 10, 2, 4, K.pacFace);
        rect(set, 12, 19, 8, 1, K.pacFace); rect(set, 11, 18, 1, 1, K.pacFace); rect(set, 20, 18, 1, 1, K.pacFace);
        if (f) rect(set, 13, 20, 6, 2, K.pacFace);
      },
    };
    const brim = { right: [22, 6, 9, 2], left: [1, 6, 9, 2], down: [6, 7, 20, 2] };
    const cap = (set, dir) => {
      for (let y = 1; y < 7; y++) {
        for (let x = 0; x < S; x++) {
          const dx = x + 0.5 - 16, dy = y + 0.5 - 15;
          if (dx * dx + dy * dy <= 14.5 * 14.5) set(x, y, K.cap);
        }
      }
      if (brim[dir]) rect(set, ...brim[dir], K.cap);
      rect(set, 15, 1, 2, 1, 0xffffff);
    };
    [0, 1].forEach((f) => {
      for (const [dir, draw] of Object.entries(pac)) this.pixels(`arcade/pac-${dir}-${f}`, S, S, (set) => draw(set, f));
      for (const [name, color] of Object.entries(COLORS.ghosts)) {
        for (const dir of DIRS4) {
          this.pixels(`arcade/ghost-${name}-${dir}-${f}`, S, S, (set) => {
            this.ghostBody(set, color, f);
            if (dir !== 'up') this.ghostEyes(set, dir);
            cap(set, dir);
          });
        }
      }
    });

    // The shop owner, asleep behind the counter: the top of his head on his folded arms, a "z" rising.
    [0, 1].forEach((f) => this.pixels(`arcade/owner-sleep-${f}`, S, S, (set) => {
      rect(set, 8, 16, 16, 13, K.ownerShirt);
      rect(set, 11, 20, 10, 9, K.ownerApron);
      rect(set, 3, 18, 26, 6, K.ownerShirt);
      rect(set, 3, 22, 5, 3, K.ownerSkin); rect(set, 24, 22, 5, 3, K.ownerSkin);
      this.disc((x, y, c) => set(x + 8, y + 7, c), 16, 7.5, K.ownerHair);
      this.disc((x, y, c) => set(x + 8, y + 6, c), 16, 5, K.ownerSkin);
      const z = f ? [[25, 1], ['#####', '...#.', '..#..', '.#...', '#####']] : [[23, 6], ['####', '..#.', '.#..', '####']];
      this.bitmap(set, z[1], K.snore, ...z[0]);
    }));

    // Text box portraits, 48x48 (HALL.portraitSize): each ghost from the front, all four together, the owner.
    const P = HALL.portraitSize;
    const shift = (set, ox, oy) => (x, y, c) => set(x + ox, y + oy, c);
    const face = (set, name, ox, oy) => {
      const s = shift(set, ox, oy);
      this.ghostBody(s, COLORS.ghosts[name], 0);
      this.ghostEyes(s, 'down');
      cap(s, 'down');
    };
    for (const name of Object.keys(COLORS.ghosts)) {
      this.pixels(`arcade/portrait-${name}`, P, P, (set) => { rect(set, 0, 0, P, P, K.portraitBg); face(set, name, 8, 12); });
    }
    this.pixels('arcade/portrait-ghosts', P, P, (set) => {
      rect(set, 0, 0, P, P, K.portraitBg);
      face(set, 'pinky', -4, 2); face(set, 'inky', 20, 2);
      face(set, 'blinky', -8, 20); face(set, 'clyde', 24, 20);
    });
    this.pixels('arcade/portrait-owner', P, P, (set) => {
      rect(set, 0, 0, P, P, K.portraitBg);
      rect(set, 8, 38, 32, 10, K.ownerShirt); rect(set, 16, 40, 16, 8, K.ownerApron);
      this.disc((x, y, c) => set(x + 8, y + 8, c), 32, 14, K.ownerSkin);
      rect(set, 9, 14, 5, 12, K.ownerHair); rect(set, 34, 14, 5, 12, K.ownerHair);
      rect(set, 15, 22, 6, 1, K.pacFace); rect(set, 27, 22, 6, 1, K.pacFace); // eyes shut
      rect(set, 17, 29, 14, 3, K.ownerHair); // mustache
      rect(set, 22, 34, 4, 3, K.pacFace); // mouth open, snoring
      this.bitmap(set, ['#####', '...#.', '..#..', '.#...', '#####'], K.snore, 39, 3);
      this.bitmap(set, ['####', '..#.', '.#..', '####'], K.snore, 34, 10);
    });
    // The "!" the ghosts show when they recognize Pac-Man, like a trainer spotting you.
    this.pixels('arcade/exclaim', 16, 16, (set) => {
      rect(set, 4, 0, 8, 14, 0x000000); rect(set, 3, 1, 10, 12, 0x000000);
      rect(set, 5, 1, 6, 12, 0xffffff); rect(set, 4, 2, 8, 10, 0xffffff);
      rect(set, 7, 2, 2, 6, K.exclaim); rect(set, 7, 9, 2, 2, K.exclaim);
      set(7, 14, 0x000000); set(8, 14, 0x000000); set(7, 15, 0x000000);
    });
  }

  // Inside the cabinet: the board lobby's tileset, assets/board/ (16x16 each, see LobbyScene). The PCB floor, the
  // cabinet wall, auto-joined copper traces and the wider harness (trace-<mask>, harness-<mask>: up 1, right 2,
  // down 4, left 8), the ghosts' wires to the brain (all lines in the same copper), the cabinet's parts, and the
  // subsystems with faces, each on its own island in its layer's colors: <id>-on (awake), <id>-off (locked,
  // asleep, grey island), <id>-lit (just unlocked, glowing), each with a 48x48 portrait.
  makeBoard() {
    const T = PIXEL.tile, K = LOBBY.colors, P = LOBBY.portraitSize;
    const rect = (set, x, y, w, h, c) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, c); };
    const tile = (name, paint, w = T, h = T) => this.pixels(tileKey('board', name), w, h, paint);
    const ellipse = (set, cx, cy, rx, ry, c) => {
      for (let y = Math.floor(cy - ry); y < Math.ceil(cy + ry); y++) {
        for (let x = Math.floor(cx - rx); x < Math.ceil(cx + rx); x++) {
          if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) set(x, y, c);
        }
      }
    };
    // The muted green solder mask, one faint dot per tile.
    const floor = (set) => {
      rect(set, 0, 0, T, T, K.pcb);
      set(0, 0, K.pcbDark);
    };
    // A subsystem's island: its layer's dark ground with a 1 px border in its line color (grey while locked).
    const island = (set, id, mood, w = T, h = T) => {
      const st = id === 'adder' ? ADDER.style : DEEP.style[id], off = mood === 'off';
      rect(set, 0, 0, w, h, off ? K.padEdge : st.line);
      rect(set, 1, 1, w - 2, h - 2, off ? K.pad : mood === 'lit' ? st.glow : st.grid);
    };
    tile('floor', floor);
    // The inside of the cabinet: dark plywood with a lighter edge.
    tile('wall', (set) => {
      rect(set, 0, 0, T, T, K.wall);
      rect(set, 0, 0, T, 1, K.wallLight);
      for (let y = 3; y < T; y += 5) rect(set, (y * 3) % 7, y, 6, 1, K.wallEdge);
    });
    // Copper traces: 2 px wide from the center to each joined side, a pad where they meet.
    for (let mask = 1; mask < 16; mask++) {
      tile(`trace-${mask}`, (set) => {
        floor(set);
        const arm = (c) => {
          if (mask & 1) rect(set, 7, 0, 2, 8, c);
          if (mask & 2) rect(set, 8, 7, 8, 2, c);
          if (mask & 4) rect(set, 7, 8, 2, 8, c);
          if (mask & 8) rect(set, 0, 7, 8, 2, c);
        };
        arm(K.copper);
        if (![5, 10].includes(mask)) { rect(set, 6, 6, 4, 4, K.copper); rect(set, 7, 7, 2, 2, K.copperDark); }
      });
    }
    // The wiring harness: the same copper, two lines side by side.
    for (let mask = 1; mask < 16; mask++) {
      tile(`harness-${mask}`, (set) => {
        floor(set);
        const v = (y0, y1) => [6, 9].forEach((x) => rect(set, x, y0, 1, y1 - y0, K.copper));
        const hz = (x0, x1) => [6, 9].forEach((y) => rect(set, x0, y, x1 - x0, 1, K.copper));
        if (mask & 1) v(0, 10);
        if (mask & 4) v(6, 16);
        if (mask & 8) hz(0, 10);
        if (mask & 2) hz(6, 16);
        if (![5, 10].includes(mask)) { rect(set, 6, 6, 4, 4, K.copper); rect(set, 7, 7, 2, 2, K.copperDark); }
      });
    }
    // Each ghost's wire to the brain: a plain copper trace like the rest (one file per ghost so Max can tell them apart).
    for (const name of Object.keys(COLORS.ghosts)) {
      tile(`wire-${name}-h`, (set) => { floor(set); rect(set, 0, 7, T, 2, K.copper); });
      tile(`wire-${name}-v`, (set) => { floor(set); rect(set, 7, 0, 2, T, K.copper); });
    }

    // The monitor, 3x2 tiles at the top front: a black bezel, the tube glowing magenta with a sleepy-happy face.
    const monitor = (set, k, ox, oy) => {
      const r = (x, y, w, h, c) => rect(set, ox + Math.round(x * k), oy + Math.round(y * k), Math.round(w * k), Math.round(h * k), c);
      r(1, 2, 46, 29, K.monitor);
      r(2, 3, 44, 27, K.bezel);
      ellipse((x, y, c) => set(x, y, c), ox + 24 * k, oy + 16 * k, 19 * k, 12 * k, K.tube);
      for (let i = 0; i < 4; i++) r(9 + i * 8, 9, 5, 1, K.tubeLight); // a maze row, faintly
      r(15, 13, 4, 4, 0xffffff); r(29, 13, 4, 4, 0xffffff);
      r(16, 14, 2, 2, K.pupil); r(30, 14, 2, 2, K.pupil);
      r(19, 21, 10, 1, K.tubeLight); r(18, 20, 1, 1, K.tubeLight); r(29, 20, 1, 1, K.tubeLight);
      r(1, 30, 46, 1, 0x000000);
    };
    const parts = [['tl', 0, 0], ['tc', 1, 0], ['tr', 2, 0], ['bl', 0, 1], ['bc', 1, 1], ['br', 2, 1]];
    for (const [n, tx, ty] of parts) {
      tile(`monitor-${n}`, (set) => {
        island((x, y, c) => { if (x >= tx * T && x < tx * T + T && y >= ty * T && y < ty * T + T) set(x - tx * T, y - ty * T, c); }, 'crt', 'on', 3 * T, 2 * T);
        monitor((x, y, c) => { if (x >= tx * T && x < tx * T + T && y >= ty * T && y < ty * T + T) set(x - tx * T, y - ty * T, c); }, 1, 0, 0);
      });
    }
    // The cabinet's other parts, on the floor.
    tile('speaker', (set) => {
      ellipse(set, 8, 8, 7, 7, K.speaker);
      ellipse(set, 8, 8, 5, 5, K.grill);
      for (let y = 4; y < 13; y += 2) for (let x = 4; x < 13; x += 2) set(x, y, K.speaker);
      ellipse(set, 8, 8, 1.5, 1.5, K.speaker);
    });
    tile('coin-door', (set) => {
      rect(set, 2, 1, 12, 14, K.door); rect(set, 2, 1, 12, 1, 0xffffff);
      rect(set, 4, 3, 2, 5, K.slot); rect(set, 10, 3, 2, 5, K.slot);
      rect(set, 5, 11, 6, 2, 0x000000);
    });
    tile('power', (set) => {
      rect(set, 1, 2, 14, 13, K.power); rect(set, 1, 2, 14, 1, 0xa0a0a8);
      for (let y = 4; y < 14; y += 2) rect(set, 2, y, 3, 1, 0x2a2a30);
      this.bitmap(set, ['..##', '.##.', '####', '.##.', '##..'], K.warn, 8, 5);
    });
    tile('edge', (set) => {
      rect(set, 0, 4, T, 8, K.chip);
      for (let x = 1; x < T; x += 2) rect(set, x, 9, 1, 4, K.edge);
      wiresAcross(set);
    });
    function wiresAcross(set) { [6, 9].forEach((y) => rect(set, 0, y, T, 1, K.copper)); }

    // The subsystems with faces. paint(set, k, mood) draws one at k px per unit of a 16 unit square.
    const face = (set, k, cx, cy, mood) => {
      const r = (x, y, w, h, c) => rect(set, Math.round(cx + x * k), Math.round(cy + y * k), Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)), c);
      if (mood === 'off') {
        r(-4, -1, 3, 1, K.sleep); r(1, -1, 3, 1, K.sleep);
        r(-1, 2, 2, 1, K.sleep);
        return;
      }
      r(-4, -2, 3, 3, K.eye); r(1, -2, 3, 3, K.eye);
      r(-3, -1, 1.5, 1.5, K.pupil); r(2, -1, 1.5, 1.5, K.pupil);
      r(-2, 2, 4, 1, K.eye);
      if (mood === 'lit') { r(-3, 1, 1, 1, K.eye); r(2, 1, 1, 1, K.eye); r(-5, 1, 1, 1, K.cheek); r(4, 1, 1, 1, K.cheek); }
    };
    const chipBody = (set, k, x, y, w, h, mood, legs) => {
      const r = (a, b, ww, hh, c) => rect(set, Math.round(a * k), Math.round(b * k), Math.max(1, Math.round(ww * k)), Math.max(1, Math.round(hh * k)), c);
      const leg = mood === 'off' ? K.legOff : K.leg;
      for (const side of legs) {
        const n = side === 'top' || side === 'bottom' ? w : h;
        for (let i = 1; i < n; i += 2) {
          if (side === 'top') r(x + i, y - 1, 1, 1, leg);
          if (side === 'bottom') r(x + i, y + h, 1, 1, leg);
          if (side === 'left') r(x - 1, y + i, 1, 1, leg);
          if (side === 'right') r(x + w, y + i, 1, 1, leg);
        }
      }
      r(x, y, w, h, mood === 'off' ? K.chipOff : K.chip);
      r(x, y, w, 1 / k, mood === 'off' ? K.chipOff : K.chipLight);
      r(x + 0.5, y + 0.5, 1, 1, mood === 'off' ? K.legOff : K.leg); // pin 1
    };
    const accent = (id, mood) => (mood === 'off' ? K.chipOff : DEEP.style[id].line);
    const SUBS = {
      signals: (set, k, mood) => {
        chipBody(set, k, 1, 4, 14, 9, mood, ['top', 'bottom']);
        rect(set, Math.round(3 * k), Math.round(11 * k), Math.round(10 * k), Math.max(1, Math.round(k)), accent('signals', mood));
        face(set, k, 8 * k, 8 * k, mood);
      },
      ram: (set, k, mood) => {
        chipBody(set, k, 4, 1, 8, 14, mood, ['left', 'right']);
        rect(set, Math.round(5 * k), Math.round(12 * k), Math.round(6 * k), Math.max(1, Math.round(k)), accent('ram', mood));
        face(set, k, 8 * k, 7 * k, mood);
      },
      bus: (set, k, mood) => {
        chipBody(set, k, 0, 5, 16, 7, mood, ['top', 'bottom']);
        for (let i = 0; i < 16; i += 3) rect(set, Math.round(i * k), Math.round(10 * k), Math.max(1, Math.round(2 * k)), Math.max(1, Math.round(k)), accent('bus', mood));
        face(set, k, 8 * k, 8 * k, mood);
      },
      cpu: (set, k, mood) => {
        chipBody(set, k, 2, 2, 12, 12, mood, ['top', 'bottom', 'left', 'right']);
        rect(set, Math.round(4 * k), Math.round(12 * k), Math.round(8 * k), Math.max(1, Math.round(k)), accent('cpu', mood));
        face(set, k, 8 * k, 7.5 * k, mood);
      },
      logic: (set, k, mood) => {
        const off = mood === 'off', c = off ? K.brainOff : K.brain, d = off ? K.brainOffDark : K.brainDark;
        ellipse(set, 8 * k, 8 * k, 7.5 * k, 6.5 * k, c);
        for (let i = 0; i < 3; i++) rect(set, Math.round((3 + i * 4) * k), Math.round((3 + (i % 2) * 1.5) * k), Math.max(1, Math.round(2.5 * k)), Math.max(1, Math.round(k * 0.6)), d);
        rect(set, Math.round(8 * k), Math.round(2 * k), Math.max(1, Math.round(k * 0.6)), Math.round(3 * k), d);
        face(set, k, 8 * k, 9 * k, mood);
      },
      input: (set, k, mood) => {
        const off = mood === 'off';
        rect(set, Math.round(2 * k), Math.round(12 * k), Math.round(12 * k), Math.round(3 * k), off ? K.chipOff : K.panel);
        rect(set, Math.round(7.5 * k), Math.round(9 * k), Math.max(1, Math.round(k)), Math.round(3 * k), off ? K.legOff : K.leg);
        ellipse(set, 8 * k, 6.5 * k, 5.5 * k, 5.5 * k, off ? K.chipOff : K.stick);
        face(set, k, 8 * k, 6.5 * k, mood);
      },
    };
    // A glowing outline in the layer's accent around everything drawn (the lit state).
    const withGlow = (set, size, color, draw) => {
      const px = new Map();
      draw((x, y, c) => { if (x >= 0 && y >= 0 && x < size && y < size) px.set(y * size + x, c); });
      for (const key of [...px.keys()]) {
        const x = key % size, y = Math.floor(key / size);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, nk = ny * size + nx;
          if (nx >= 0 && ny >= 0 && nx < size && ny < size && !px.has(nk)) px.set(nk, -color - 1);
        }
      }
      for (const [key, c] of px) set(key % size, Math.floor(key / size), c < 0 ? -c - 1 : c);
    };
    for (const [id, paint] of Object.entries(SUBS)) {
      for (const mood of ['on', 'off', 'lit']) {
        tile(`${id}-${mood}`, (set) => {
          island(set, id, mood);
          if (mood === 'lit') withGlow(set, T, DEEP.style[id].line, (s2) => paint(s2, 1, mood));
          else paint(set, 1, mood);
        });
      }
      for (const mood of ['on', 'off']) {
        this.pixels(`board/portrait-${id}${mood === 'off' ? '-off' : ''}`, P, P, (set) => {
          rect(set, 0, 0, P, P, mood === 'off' ? K.pad : DEEP.style[id].bg);
          paint((x, y, c) => set(x + 4, y + 4, c), 2.5, mood);
        });
      }
    }
    this.pixels('board/portrait-crt', P, P, (set) => {
      rect(set, 0, 0, P, P, DEEP.style.crt.bg);
      monitor(set, 1, 0, 8);
    });
    // The round counter's adder (the bonus layer): a chip with "+1" in the adder layer's yellow.
    const A = ADDER.style;
    const adder = (set, k, mood) => {
      chipBody(set, k, 1, 2, 14, 12, mood, ['top', 'bottom']);
      const r = (x, y, w, h, c) => rect(set, Math.round(x * k), Math.round(y * k), Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)), c);
      r(3, 11, 3, 1, A.line); r(4, 10, 1, 3, A.line);  // +
      r(9, 10, 1, 3, A.line); r(8, 10, 1, 1, A.line);  // 1
      face(set, k, 8 * k, 6.5 * k, mood);
    };
    tile('adder-on', (set) => { island(set, 'adder', 'on'); adder(set, 1, 'on'); });
    tile('adder-lit', (set) => { island(set, 'adder', 'lit'); withGlow(set, T, A.line, (s2) => adder(s2, 1, 'lit')); });
    this.pixels('board/portrait-adder', P, P, (set) => {
      rect(set, 0, 0, P, P, A.bg);
      adder((x, y, c) => set(x + 4, y + 4, c), 2.5, 'on');
    });
    // The 256 switch: a toggle on a plate. Stuck (held down by the adder, grey), off (lever down), on (up, lit).
    const toggle = (set, k, state) => {
      const r = (x, y, w, h, c) => rect(set, Math.round(x * k), Math.round(y * k), Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)), c);
      const stuck = state === 'stuck', on = state === 'on';
      r(3, 3, 10, 11, stuck ? K.chipOff : K.chip);
      r(3, 3, 10, 1, stuck ? K.chipOff : K.chipLight);
      r(4, 4, 8, 3, stuck ? K.legOff : on ? A.line : A.wire); // the 256 label plate
      r(5, 5, 1, 1, K.chip); r(7.5, 5, 1, 1, K.chip); r(10, 5, 1, 1, K.chip);
      r(6, 9, 4, 3, K.legOff); // the toggle's collar
      if (on) { r(7, 7, 2, 3, K.leg); r(6.5, 6.5, 3, 1, K.eye); }
      else { r(7, 11, 2, 3, stuck ? K.legOff : K.leg); r(6.5, 13.5, 3, 1, stuck ? K.legOff : K.eye); }
      if (on) { r(12, 12, 1, 1, A.line); } else if (!stuck) { r(12, 12, 1, 1, K.slot); }
    };
    for (const state of ['stuck', 'off', 'on']) tile(`switch-${state}`, (set) => { island(set, 'adder', state === 'stuck' ? 'off' : 'on'); toggle(set, 1, state); });
    this.pixels('board/portrait-switch', P, P, (set) => {
      rect(set, 0, 0, P, P, A.bg);
      toggle((x, y, c) => set(x + 4, y + 4, c), 2.5, 'on');
    });
  }

  // The cabinet in an oblique view: the front is drawn flat, depth goes up and right at 45°, so the right side
  // panel and the top show. The screen is left black; the scene draws the game picture into it.
  makeCabinet() {
    const C = CABINET, K = C.colors;
    const W = Math.round(720 / C.zoom), H = Math.round(1280 / C.zoom);
    // A point on a front-facing plane at depth d.
    const P = (x, y, d) => [x + d / 2, y - d / 2];
    const L = C.left, R = C.right, D = C.depth, pd = C.panelDepth, md = C.marqueeDepth;
    this.pixels('cabinet/machine', W, H, (set) => {
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

  // The coin mechanism behind the coin door, for the coin minigame (CABINET.coinMech, shown at 4x): the backdrop
  // with slot, track, coin return, cash box and wire (180x320), and one file per state of the moving parts:
  // reject arm (in / warn / out), slug magnet (off / warn / on), coin switch (up / down), the coin (two roll
  // frames) and the pulse on the wire. Each part is drawn centered on its point in the config.
  makeCoinMech() {
    const P = CABINET.coinMech, K = P.colors;
    const line = (set, x0, y0, x1, y1, color, th = 1) => {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let i = 0; i <= n; i++) {
        const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
        for (let a = 0; a < th; a++) for (let b = 0; b < th; b++) set(x + a, y + b, color);
      }
    };
    const rect = (set, x0, y0, x1, y1, color) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) set(x, y, color); };
    this.pixels('cabinet/coinmech-bg', P.w, P.h, (set) => {
      rect(set, 0, 0, P.w, P.h, K.back);
      // The mechanism's steel plate, riveted to the inside of the door.
      rect(set, 16, 40, 170, 230, K.plate);
      rect(set, 16, 228, 170, 230, K.plateDark);
      rect(set, 168, 40, 170, 230, K.plateDark);
      for (const [x, y] of [[20, 44], [164, 44], [20, 224], [164, 224]]) rect(set, x, y, x + 2, y + 2, K.rivet);
      // The slot the coin goes in, edge on, with a funnel.
      const [sx, sy] = P.track[0];
      rect(set, sx - 12, 36, sx + 12, 40, K.plateDark);
      rect(set, sx - 10, 38, sx + 10, sy - P.coinR, K.slot);
      // The rails under the coin, light on top, dark below.
      for (let i = 1; i < P.track.length; i++) {
        const [ax, ay] = P.track[i - 1], [bx, by] = P.track[i], o = P.coinR;
        line(set, ax - 2, ay + o, bx + 2, by + o, K.rail, 2);
        line(set, ax - 2, ay + o + 2, bx + 2, by + o + 2, K.railDark, 1);
      }
      // The end stops on the two ledges.
      for (const i of P.stops) { const [x, y] = P.track[i]; rect(set, x + P.coinR, y - 3, x + P.coinR + 3, y + P.coinR + 2, K.railDark); }
      // The coin return: a dark chute and a cup at the bottom right.
      const c = P.cup;
      rect(set, c.x - 16, c.y - 10, c.x + 16, c.y + 12, K.cup);
      rect(set, c.x - 18, c.y - 12, c.x + 18, c.y - 10, K.cupRim);
      rect(set, c.x - 18, c.y - 10, c.x - 16, c.y + 12, K.cupRim);
      rect(set, c.x + 16, c.y - 10, c.x + 18, c.y + 12, K.cupRim);
      rect(set, c.x - 18, c.y + 12, c.x + 18, c.y + 14, K.cupRim);
      // The cash box under the coin switch.
      const s = P.switchAt;
      rect(set, s.x - 16, s.y + 12, s.x + 22, s.y + 40, K.box);
      rect(set, s.x - 8, s.y + 12, s.x + 14, s.y + 15, K.slot);
      // The wire from the coin switch down to the board.
      for (let i = 1; i < P.wire.length; i++) line(set, ...P.wire[i - 1], ...P.wire[i], K.wire, 2);
    });
    // The reject arm swings on a pivot top right, across the coin's path when out.
    const arm = { in: [6, 4], warn: [11, 11], out: [10, 27] };
    for (const [k, [ex, ey]] of Object.entries(arm)) {
      this.pixels(`cabinet/coinmech-arm-${k}`, 32, 32, (set) => {
        line(set, 26, 3, ex, ey, K.armDark, 3);
        line(set, 26, 3, ex, ey, K.arm, 2);
        if (k !== 'in') line(set, ex, ey, ex + 1, ey + 1, K.armWarn, 3);
        rect(set, 24, 1, 30, 7, K.armDark);
        rect(set, 26, 3, 28, 5, K.rivet);
      });
    }
    // The slug magnet: a horseshoe over the track, poles down; sparks when it's on.
    for (const k of ['off', 'warn', 'on']) {
      this.pixels(`cabinet/coinmech-magnet-${k}`, 32, 32, (set) => {
        const red = k === 'on' ? K.magnetOn : K.magnet;
        for (let y = 2; y < 22; y++) for (let x = 4; x < 28; x++) {
          const dx = x + 0.5 - 16, dy = y + 0.5 - 14, r = Math.hypot(dx, dy);
          if ((y >= 14 && (Math.abs(dx) >= 5 && Math.abs(dx) <= 11)) || (y < 14 && r >= 5 && r <= 11)) set(x, y, red);
        }
        rect(set, 5, 20, 11, 24, k === 'warn' ? K.armWarn : K.magnetPole);
        rect(set, 21, 20, 27, 24, k === 'warn' ? K.armWarn : K.magnetPole);
        if (k === 'on') for (const [x0, x1] of [[8, 6], [8, 11], [24, 21], [24, 27]]) line(set, x0, 25, x1, 30, K.spark, 1);
      });
    }
    // The coin switch: a microswitch with a lever; down (and lit) while the coin presses it.
    for (const k of ['up', 'down']) {
      this.pixels(`cabinet/coinmech-switch-${k}`, 24, 24, (set) => {
        rect(set, 2, 12, 22, 22, K.switchBody);
        rect(set, 4, 14, 8, 17, k === 'down' ? K.switchLit : K.railDark);
        line(set, 4, 11, 20, k === 'up' ? 4 : 10, K.switchLever, 2);
      });
    }
    // The coin, close up: two frames of its shine as it rolls.
    for (const f of [0, 1]) {
      this.pixels(`cabinet/coinmech-coin-${f}`, 16, 16, (set) => {
        this.disc(set, 16, 8, K.coinDark);
        this.disc((x, y, c) => set(x, y, c), 16, 6.5, K.coin);
        if (f === 0) { set(5, 4, K.coinLight); set(4, 5, K.coinLight); set(6, 4, K.coinLight); }
        else { set(10, 11, K.coinLight); set(11, 10, K.coinLight); set(11, 11, K.coinLight); }
        rect(set, 7, 5, 9, 11, K.coinDark);
      });
    }
    this.pixels('cabinet/coinmech-pulse', 8, 8, (set) => this.disc(set, 8, 4, K.wireLit));
  }

  // The joystick as seen on the control panel: neutral and pushed four ways. 24x32, base at the bottom.
  makeSticks() {
    const ball = CABINET.colors.ball;
    const push = { n: [0, 0], up: [0, -5], down: [0, 3], left: [-6, 0], right: [6, 0] };
    for (const [k, [dx, dy]] of Object.entries(push)) {
      this.pixels(`cabinet/stick-${k}`, 24, 32, (set) => {
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
