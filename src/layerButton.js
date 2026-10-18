// The button that moves between layers (up = zoom out, down = zoom in). Pixel style, drawn in the scene's art
// pixels (scale 0.5 halves box and font, for the hall's 4x zoom, so it looks the same on screen); the hit area is padded so it's easy to tap on a phone. Returns the hit zone so swipe/joystick input
// can ignore touches that start on it.
import { COLORS, UI, GAME_WIDTH, GAME_HEIGHT, LAYER_BUTTONS } from './config.js';

// fixed: stays put on screen while the camera scrolls (x, y are then view coordinates).
export function addLayerButton(scene, x, y, label, onTap, scale = 1, fixed = false) {
  const w = 56 * scale, h = 30 * scale, pad = 6 * scale;
  const box = scene.add.graphics().fillStyle(0x000000, 0.7).fillRect(x, y, w, h).lineStyle(scale, 0xffffff, 0.6).strokeRect(x + scale / 2, y + scale / 2, w - scale, h - scale);
  const text = scene.add.text(x + w / 2, y + h / 2, label, {
    fontFamily: UI.arcadeFont, fontSize: 8 * scale, color: COLORS.text, align: 'center', resolution: Math.max(1, 1 / scale),
  }).setOrigin(0.5).setLineSpacing(4 * scale);
  const zone = scene.add.zone(x - pad, y - pad, w + pad * 2, h + pad * 2).setOrigin(0).setInteractive({ useHandCursor: true });
  zone.on('pointerup', onTap);
  if (fixed) [box, text, zone].forEach((o) => o.setScrollFactor(0));
  return zone;
}

// The standard spot every layer uses: along the bottom of the screen, UP in the left corner, DOWN in the right one.
// zoom: the scene's screen px per art px (x, y are art px in view coordinates); pass scale 2 / zoom to keep the
// button the same size on screen as on the zoom-2 layers.
export function addLayerButtonAt(scene, side, onTap, { zoom = 2, scale = 1, fixed = false } = {}) {
  const B = LAYER_BUTTONS, mx = B.marginX / zoom, w = 56 * scale, h = 30 * scale;
  const x = side === 'up' ? mx : GAME_WIDTH / zoom - mx - w, y = GAME_HEIGHT / zoom - B.marginBottom / zoom - h;
  return addLayerButton(scene, x, y, side === 'up' ? 'LAYER\nUP' : 'LAYER\nDOWN', onTap, scale, fixed);
}
