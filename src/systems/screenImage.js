// Draws the arcade picture of the emulated machine into a 2D canvas at arcade resolution (CABINET.screenTile
// px per tile, half the maze level's PIXEL.tile): the board's video chip draws the playfield, the HUD comes
// from the game's RAM. No Phaser: the cabinet layer puts this picture on its 3D screen, and the CRT layer can
// read its pixels. `art(key)` returns the source canvas of a texture made in BootScene.

import { CABINET, COLORS, MAZE, PIXEL } from '../config.js';
import { drawPlayfield, W, H } from './arcade/video.js';
import { readState } from './arcade/state.js';

const T = CABINET.screenTile;
const K = T / PIXEL.tile;  // picture px per maze-level px
const MARGIN = 8;          // art px left and right of the maze
const HUD = 40;            // art px above the maze (MAZE.top in the game)
const FOOT = 24;           // art px below the maze for the lives

export function screenSize() {
  return { w: W * T + MARGIN * 2, h: HUD + H * T + FOOT };
}

// lines: optional centered messages, e.g. [{ text: 'INSERT COIN', color: '#00ffde', row: 13 }]
export function drawScreen(ctx, m, S, art, lines = [], best = 0) {
  const { w, h } = screenSize();
  const g = readState(m, S);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  const ox = MARGIN, oy = HUD;
  drawPlayfield(ctx, m, art, { T, ox, oy });

  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textBaseline = 'top';
  ctx.fillStyle = COLORS.text;
  ctx.textAlign = 'left';
  ctx.fillText('1UP', 8, 12);
  ctx.fillText(String(g.score || '00'), 8, 22);
  ctx.textAlign = 'right';
  ctx.fillText('HIGH SCORE', w - 8, 12);
  ctx.fillText(String(Math.max(best, g.score) || '00'), w - 8, 22);
  const life = art('maze/life'), s = PIXEL.sprite * K;
  for (let i = 0; i < g.lives - 1; i++) ctx.drawImage(life, ox + 4 + i * 16, oy + H * T + 4, s, s);
  ctx.textAlign = 'center';
  if (g.phase === 'ready') {
    ctx.fillStyle = COLORS.textReady;
    ctx.fillText('READY!', ox + MAZE.houseExit.x * T + T / 2, oy + 13 * T + 1);
  }
  for (const l of lines) {
    ctx.fillStyle = l.color ?? COLORS.text;
    ctx.fillText(l.text, w / 2, oy + l.row * T + 1);
  }
}
