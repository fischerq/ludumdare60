// The deep layers' Tron look (no Phaser): a dark floor with a faint grid, neon lines with a dim halo, and the
// collectibles as the layer's dot sprites (assets/deep/<layer>/). Colors from DEEP.style in config.js.

import { DEEP } from '../../config.js';

export const css = (c, a = 1) => (a >= 1
  ? `#${c.toString(16).padStart(6, '0')}`
  : `rgba(${c >> 16},${(c >> 8) & 255},${c & 255},${a})`);

// Background and floor grid; every 4th grid line a bit brighter.
export function floor(ctx, P, cols, rows, S) {
  ctx.fillStyle = css(P.bg);
  ctx.fillRect(0, 0, cols * S, rows * S);
  for (let x = 0; x <= cols; x++) {
    ctx.fillStyle = css(x % 4 ? P.grid : P.glow);
    ctx.fillRect(x * S, 0, 1, rows * S);
  }
  for (let y = 0; y <= rows; y++) {
    ctx.fillStyle = css(y % 4 ? P.grid : P.glow);
    ctx.fillRect(0, y * S, cols * S, 1);
  }
}

// A neon outline: 1 px line with a 1 px halo inside and outside.
export function neonBox(ctx, x, y, w, h, line, glow) {
  frame(ctx, x - 1, y - 1, w + 2, h + 2, 3, css(glow));
  frame(ctx, x, y, w, h, 1, css(line));
}

function frame(ctx, x, y, w, h, t, style) {
  ctx.fillStyle = style;
  ctx.fillRect(x, y, w, t);
  ctx.fillRect(x, y + h - t, w, t);
  ctx.fillRect(x, y + t, t, h - 2 * t);
  ctx.fillRect(x + w - t, y + t, t, h - 2 * t);
}

// A filled neon block (walls, live lanes): halo-colored body with a bright edge.
export function neonBlock(ctx, x, y, w, h, line, glow) {
  ctx.fillStyle = css(line);
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = css(glow);
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
}

// A 1 px neon line from (x0, y0) to (x1, y1), horizontal or vertical, with its halo.
export function neonLine(ctx, x0, y0, x1, y1, line, glow) {
  const x = Math.min(x0, x1), y = Math.min(y0, y1), w = Math.abs(x1 - x0) + 1, h = Math.abs(y1 - y0) + 1;
  ctx.fillStyle = css(glow);
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = css(line);
  ctx.fillRect(x, y, w, h);
}

// One of the layer's collectible sprites (dot, dot2, special), centered on tile (x, y).
export function dot(ctx, env, key, x, y, S, alpha = 1) {
  const img = env.art(`deep/${env.id}/${key}`);
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, Math.round(x * S + (S - img.width) / 2), Math.round(y * S + (S - img.height) / 2));
  ctx.globalAlpha = 1;
}

export const HAZARD = css(DEEP.hazard);
export const HAZARD_GLOW = css(DEEP.hazardGlow);
