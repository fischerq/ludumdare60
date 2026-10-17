// The board's video chip (no Phaser): draws the playfield from VRAM (cell codes), color RAM (palettes) and the
// 8 hardware sprites into a 2D canvas, at any tile size. Graphics come from the textures in assets/ through
// `art(key)` (the source canvas or image of a texture), so Max's art is the board's graphics ROM.

import { COLORS, MAZE } from '../../config.js';
import { CELL, tileOffset } from './memmap.js';
import { mazeTiles, tileKey } from '../tiles.js';

export const W = MAZE.layout[0].length, H = MAZE.layout.length;

// Directions in the program's order. Sprite angles for Pac-Man, whose art faces right.
export const DIR_NAMES = ['up', 'left', 'down', 'right'];
export const GHOST_NAMES = ['blinky', 'pinky', 'inky', 'clyde'];
// Pac-Man's art faces right: left is a mirror image, up and down are turned.
const ANGLE = { up: -Math.PI / 2, left: 0, down: Math.PI / 2, right: 0 };

// Palettes (our color PROM): what a palette index does to the art.
export const PALETTE = {
  0: null,                     // black: not drawn (blinking power pellets)
  1: 'art',                    // the art's own colors
  2: COLORS.mazeFlash,         // the maze flashing white after the last dot
  7: 0x00ffde,                 // points
};

// Sprite codes (our sprite ROM). 0 is an empty slot. Pac-Man: pac + dir*4 + frame. Ghosts have their own art
// per ghost and direction: ghost + ghost*8 + dir*2 + skirt.
export const SPRITE = { pac: 1, pacDie: 17, ghost: 32, fright: 64, flash: 66, eyes: 68, points: 72 };
const POINTS = ['200', '400', '800', '1600'];

// What a sprite code shows: { key, angle, flipX } or { text }. Pure, so tests and the deeper layers can use it.
export function spriteArt(code) {
  if (code >= SPRITE.pac && code < SPRITE.pac + 16) {
    const d = DIR_NAMES[(code - 1) >> 2];
    return { key: `maze/pac-${(code - 1) & 3}`, angle: ANGLE[d], flipX: d === 'left' };
  }
  if (code >= SPRITE.pacDie && code < SPRITE.pacDie + 10) return { key: `maze/pac-die-${code - SPRITE.pacDie}` };
  if (code >= SPRITE.ghost && code < SPRITE.ghost + 32) {
    const o = code - SPRITE.ghost;
    return { key: `maze/ghost-${GHOST_NAMES[o >> 3]}-${DIR_NAMES[(o >> 1) & 3]}-${o & 1}` };
  }
  if (code >= SPRITE.fright && code < SPRITE.fright + 2) return { key: `maze/ghost-fright-${code - SPRITE.fright}` };
  if (code >= SPRITE.flash && code < SPRITE.flash + 2) return { key: `maze/ghost-flash-${code - SPRITE.flash}` };
  if (code >= SPRITE.eyes && code < SPRITE.eyes + 4) return { key: `maze/eyes-${DIR_NAMES[code - SPRITE.eyes]}` };
  if (code >= SPRITE.points && code < SPRITE.points + 4) return { text: POINTS[code - SPRITE.points] };
  return null;
}

// The maze as layout rows, read back from VRAM: the walls the chip draws are whatever VRAM says.
export function layoutFromVram(vram) {
  const ch = { [CELL.wall]: '#', [CELL.door]: '-', [CELL.tunnel]: 'T', [CELL.house]: 'G' };
  const rows = [];
  for (let y = 0; y < H; y++) {
    let r = '';
    for (let x = 0; x < W; x++) r += ch[vram[tileOffset(x, y)]] ?? '.';
    rows.push(r);
  }
  return rows;
}

const tinted = new Map();
function tint(src, color) {
  const key = `${src.__key ?? src.src ?? ''}-${src.width}-${color}`;
  if (!tinted.has(key)) {
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const x = c.getContext('2d');
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    x.fillRect(0, 0, c.width, c.height);
    tinted.set(key, c);
  }
  return tinted.get(key);
}
const paint = (src, pal) => (PALETTE[pal] === 'art' || PALETTE[pal] == null ? src : tint(src, PALETTE[pal]));

// The walls only change when VRAM's wall cells do, so they're drawn once per layout into a cached canvas.
let wallCache = { sig: '', canvas: null };
function wallCanvas(rows, art) {
  const sig = rows.join('');
  if (wallCache.sig === sig) return wallCache.canvas;
  const T = 16, { cells, walls } = mazeTiles(rows);
  const c = document.createElement('canvas');
  c.width = W * T; c.height = H * T;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  for (const t of cells) x.drawImage(art(tileKey('maze', t.tile)), t.x * T, t.y * T, T, T);
  for (const t of walls) x.drawImage(art(tileKey('maze', t.tile)), t.x * T - T / 2, t.y * T - T / 2, T, T);
  wallCache = { sig, canvas: c };
  return c;
}

// Draws the playfield with its top-left at (ox, oy), T px per tile; sprites are 2x2 tiles like the original.
// Sprites outside the maze (the tunnel) are clipped.
export function drawPlayfield(ctx, m, art, { T = 16, ox = 0, oy = 0 } = {}) {
  const k = T / 16;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.beginPath();
  ctx.rect(ox, oy, W * T, H * T);
  ctx.clip();
  ctx.fillStyle = '#000';
  ctx.fillRect(ox, oy, W * T, H * T);

  const walls = wallCanvas(layoutFromVram(m.vram), art);
  ctx.drawImage(paint(walls, m.cram[tileOffset(0, 0)]), ox, oy, W * T, H * T);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = tileOffset(x, y), c = m.vram[i];
      if (c !== CELL.dot && c !== CELL.power) continue;
      if (!PALETTE[m.cram[i]]) continue;
      const src = paint(art(c === CELL.dot ? 'maze/dot' : 'maze/power'), m.cram[i]);
      const s = src.width * k;
      ctx.drawImage(src, Math.round(ox + x * T + T / 2 - s / 2), Math.round(oy + y * T + T / 2 - s / 2), s, s);
    }
  }

  const S = 2 * T;
  for (const sp of m.sprites()) {
    const a = spriteArt(sp.code);
    if (!a) continue;
    const x = Math.round(ox + sp.x * k), y = Math.round(oy + sp.y * k);
    if (a.text) {
      ctx.font = `${Math.round(T / 2)}px "Press Start 2P", monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = `#${(PALETTE[sp.palette] ?? 0xffffff).toString(16).padStart(6, '0')}`;
      ctx.fillText(a.text, x, y);
      continue;
    }
    ctx.save();
    ctx.translate(x, y);
    if (a.angle) ctx.rotate(a.angle);
    if (a.flipX) ctx.scale(-1, 1);
    ctx.drawImage(art(a.key), -S / 2, -S / 2, S, S);
    ctx.restore();
  }
  ctx.restore();
}
