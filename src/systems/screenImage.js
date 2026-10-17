// Draws the arcade picture of a maze game state into a 2D canvas, at art resolution (8 px per tile).
// No Phaser: the cabinet layer puts this picture on its 3D screen, and the CRT layer can read its pixels.
// `art(key)` returns the source canvas of a texture made in BootScene.

import { COLORS, MAZE, PIXEL, RULES } from '../config.js';
import { DIRS } from './maze.js';

const T = PIXEL.tile;
const ANGLE = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
const MARGIN = 8;          // art px left and right of the maze
const HUD = 40;            // art px above the maze (MAZE.top in the game)
const FOOT = 24;           // art px below the maze for the lives

export function screenSize(g) {
  return { w: g.maze.w * T + MARGIN * 2, h: HUD + g.maze.h * T + FOOT };
}

const tinted = new Map();
function tint(src, color) {
  const key = `${src.__key}-${color}`;
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

// lines: optional centered messages, e.g. [{ text: 'INSERT COIN', color: '#00ffde', row: 13 }]
export function drawScreen(ctx, g, art, time, lines = [], best = 0) {
  const { w, h } = screenSize(g);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  const ox = MARGIN, oy = HUD;
  const cx = (x) => Math.round(ox + x * T + T / 2);
  const cy = (y) => Math.round(oy + y * T + T / 2);
  const sprite = (src, x, y, angle = 0) => {
    ctx.save();
    ctx.translate(x, y);
    if (angle) ctx.rotate(angle);
    ctx.drawImage(src, -src.width / 2, -src.height / 2);
    ctx.restore();
  };

  const clearing = g.phase === 'clearing' && Math.floor(time * 5) % 2;
  ctx.drawImage(art(clearing ? 'maze-white' : 'maze'), ox, oy);

  const blink = Math.floor(time * 5) % 2 === 0;
  g.pellets.forEach((row, y) => row.forEach((k, x) => {
    if (k === 1) ctx.drawImage(art('dot'), cx(x) - 1, cy(y) - 1);
    else if (k === 2 && blink) ctx.drawImage(art('power'), cx(x) - 4, cy(y) - 4);
  }));

  const p = g.pac;
  if (g.phase === 'dying') {
    const k = 1 - Math.max(0, g.phaseTime) / RULES.dyingTime;
    if (k < 0.85) sprite(art(`pac-die-${Math.min(9, Math.floor(k * 12))}`), cx(p.x), cy(p.y), ANGLE.up);
  } else {
    const cycle = [0, 1, 2, 3, 2, 1];
    const frame = g.phase === 'ready' ? 0 : cycle[Math.floor(p.moved * 4) % cycle.length];
    sprite(art(`pac-${frame}`), cx(p.x), cy(p.y), ANGLE[p.dir] ?? 0);
  }

  if (!['dying', 'clearing', 'cleared'].includes(g.phase)) {
    const skirt = Math.floor(time * 6) % 2;
    const flashing = g.fright > 0 && g.fright < RULES.frightFlashTime && Math.floor(time * 6) % 2 === 0;
    for (const gh of g.ghosts) {
      const x = cx(gh.x), y = cy(gh.y);
      if (gh.state !== 'eyes' && gh.state !== 'enter') {
        const body = gh.frightened
          ? art(`ghost-${flashing ? 'flash' : 'fright'}-${skirt}`)
          : tint(art(`ghost-${skirt}`), COLORS.ghosts[gh.name]);
        sprite(body, x, y);
      }
      if (!gh.frightened) sprite(art(`eyes-${DIRS[gh.dir] ? gh.dir : 'left'}`), x, y);
    }
  }
  // Tunnel: hide sprites in the side margins, like the arcade screen.
  ctx.fillStyle = '#000';
  ctx.fillRect(0, oy, ox, g.maze.h * T);
  ctx.fillRect(w - ox, oy, ox, g.maze.h * T);

  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textBaseline = 'top';
  ctx.fillStyle = COLORS.text;
  ctx.textAlign = 'left';
  ctx.fillText('1UP', 8, 12);
  ctx.fillText(String(g.score || '00'), 8, 22);
  ctx.textAlign = 'right';
  ctx.fillText('HIGH SCORE', w - 8, 12);
  ctx.fillText(String(Math.max(best, g.score) || '00'), w - 8, 22);
  for (let i = 0; i < g.lives - 1; i++) sprite(art('pac-2'), ox + 12 + i * 16, oy + g.maze.h * T + 12, Math.PI);
  ctx.textAlign = 'center';
  if (g.phase === 'ready') { ctx.fillStyle = COLORS.textReady; ctx.fillText('READY!', cx(MAZE.houseExit.x), oy + 13 * T + 1); }
  for (const l of lines) {
    ctx.fillStyle = l.color ?? COLORS.text;
    ctx.fillText(l.text, w / 2, oy + l.row * T + 1);
  }
}
