// Draws the arcade picture of a maze game state into a 2D canvas, at arcade resolution (CABINET.screenTile px
// per tile, half the maze level's PIXEL.tile), so the art is drawn scaled down.
// No Phaser: the cabinet layer puts this picture on its 3D screen, and the CRT layer can read its pixels.
// `art(key)` returns the source canvas of a texture made in BootScene.

import { CABINET, COLORS, MAZE, PIXEL, RULES, SPEED } from '../config.js';
import { PAC_CYCLE, charFrame } from './anim.js';
import { DIRS } from './maze.js';

const T = CABINET.screenTile;
const K = T / PIXEL.tile;  // picture px per maze-level px
const SPRITE = PIXEL.sprite * K;
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
    ctx.drawImage(src, -SPRITE / 2, -SPRITE / 2, SPRITE, SPRITE);
    ctx.restore();
  };

  const clearing = g.phase === 'clearing' && Math.floor(time * 5) % 2;
  const maze = clearing ? tint(art('maze'), COLORS.mazeFlash) : art('maze');
  ctx.drawImage(maze, ox, oy, maze.width * K, maze.height * K);
  const pellet = (src, x, y) => {
    const s = src.width * K;
    ctx.drawImage(src, Math.round(x - s / 2), Math.round(y - s / 2), s, s);
  };

  const blink = Math.floor(time * 5) % 2 === 0;
  g.pellets.forEach((row, y) => row.forEach((k, x) => {
    if (k === 1) pellet(art('dot'), cx(x), cy(y));
    else if (k === 2 && blink) pellet(art('power'), cx(x), cy(y));
  }));

  const p = g.pac;
  if (g.phase === 'dying') {
    const k = 1 - Math.max(0, g.phaseTime) / RULES.dyingTime;
    if (k < 0.85) sprite(art(`pac-die-${Math.min(9, Math.floor(k * 12))}`), cx(p.x), cy(p.y), ANGLE.up);
  } else {
    const frame = g.phase === 'ready' ? 0 : PAC_CYCLE[charFrame('pac', p.moved / SPEED.pac, PAC_CYCLE.length)];
    sprite(art(`pac-${frame}`), cx(p.x), cy(p.y), ANGLE[p.dir] ?? 0);
  }

  if (!['dying', 'clearing', 'cleared'].includes(g.phase)) {
    const flashing = g.fright > 0 && g.fright < RULES.frightFlashTime && Math.floor(time * 6) % 2 === 0;
    for (const gh of g.ghosts) {
      const x = cx(gh.x), y = cy(gh.y);
      const skirt = charFrame(gh.name, time, 2);
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
