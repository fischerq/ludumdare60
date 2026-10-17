import { COLORS, MAZE, UI } from '../config.js';

const T = MAZE.tile;

// Generates all placeholder textures in code. Swap these for real art later (same keys).
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.makeDots();
    this.makePac();
    this.makeGhosts();
    // Wait for the arcade font so text doesn't render in the fallback first (give up after 2 s).
    const font = document.fonts?.load(`32px ${UI.arcadeFont}`) ?? Promise.resolve();
    const timeout = new Promise((r) => setTimeout(r, 2000));
    Promise.race([font, timeout]).catch(() => {}).finally(() => this.scene.start('Menu'));
  }

  draw(key, w, h, fn) {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    fn(g);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  makeDots() {
    this.draw('dot', 8, 8, (g) => { g.fillStyle(COLORS.dot); g.fillRect(1, 1, 6, 6); });
    this.draw('power', 26, 26, (g) => { g.fillStyle(COLORS.dot); g.fillCircle(13, 13, 12); });
  }

  // Chomper facing right: pac-0 (closed) .. pac-3 (wide open), and death frames pac-die-0..9.
  makePac() {
    const r = T * 0.8;
    const s = Math.ceil(r * 2);
    const slice = (key, mouth) => this.draw(key, s, s, (g) => {
      g.fillStyle(COLORS.pac);
      if (mouth <= 0.01) g.fillCircle(r, r, r);
      else if (mouth < Math.PI) { g.slice(r, r, r, mouth, Math.PI * 2 - mouth, false); g.fillPath(); }
    });
    [0, 0.25, 0.5, 0.75].forEach((m, i) => slice(`pac-${i}`, m));
    for (let i = 0; i < 10; i++) slice(`pac-die-${i}`, 0.3 + (i / 9) * (Math.PI - 0.3));
  }

  // Ghost body in white (tinted per ghost), two skirt frames; eyes per direction; frightened face.
  makeGhosts() {
    const s = Math.ceil(T * 1.5);
    const r = s / 2 - 1;
    const body = (g, color, frame) => {
      g.fillStyle(color);
      g.fillCircle(s / 2, r + 1, r);
      g.fillRect(1, r + 1, s - 2, s - r - 6);
      const n = 4, w = (s - 2) / n;
      for (let i = 0; i < n; i++) {
        const x = 1 + i * w;
        const lift = (i + frame) % 2 === 0;
        g.fillTriangle(x, s - 5, x + w, s - 5, x + w / 2, lift ? s - 1 : s - 9);
        if (!lift) g.fillRect(x, s - 5, w, 4);
      }
    };
    [0, 1].forEach((f) => {
      this.draw(`ghost-${f}`, s, s, (g) => body(g, 0xffffff, f));
      this.draw(`ghost-fright-${f}`, s, s, (g) => { body(g, COLORS.fright, f); this.frightFace(g, s, COLORS.frightFace); });
      this.draw(`ghost-flash-${f}`, s, s, (g) => { body(g, COLORS.frightFlash, f); this.frightFace(g, s, 0xff2020); });
    });
    const look = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
    for (const [dir, [dx, dy]] of Object.entries(look)) {
      this.draw(`eyes-${dir}`, s, s, (g) => {
        for (const ex of [s * 0.32, s * 0.68]) {
          const cx = ex + dx * s * 0.05, cy = s * 0.42 + dy * s * 0.05;
          g.fillStyle(0xffffff); g.fillEllipse(cx, cy, s * 0.24, s * 0.3);
          g.fillStyle(0x1a33ff); g.fillCircle(cx + dx * s * 0.06, cy + dy * s * 0.08, s * 0.07);
        }
      });
    }
  }

  frightFace(g, s, color) {
    g.fillStyle(color);
    g.fillRect(s * 0.3, s * 0.36, s * 0.12, s * 0.12);
    g.fillRect(s * 0.58, s * 0.36, s * 0.12, s * 0.12);
    const y = s * 0.66, n = 6, w = (s * 0.7) / n;
    for (let i = 0; i < n; i++) g.fillRect(s * 0.15 + i * w, y + (i % 2 ? -3 : 3), w, 3);
  }
}
