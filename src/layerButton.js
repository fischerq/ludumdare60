// The button that moves between layers (up = zoom out, down = zoom in). Pixel style, drawn in the scene's art
// pixels (scale 2 doubles box and font, for scenes with a 16 px font); the hit area is padded so it's easy to tap on a phone. Returns the hit zone so swipe/joystick input
// can ignore touches that start on it.
import { COLORS, UI } from './config.js';

// fixed: stays put on screen while the camera scrolls (x, y are then view coordinates).
export function addLayerButton(scene, x, y, label, onTap, scale = 1, fixed = false) {
  const w = 56 * scale, h = 30 * scale, pad = 6 * scale;
  const box = scene.add.graphics().fillStyle(0x000000, 0.7).fillRect(x, y, w, h).lineStyle(scale, 0xffffff, 0.6).strokeRect(x + scale / 2, y + scale / 2, w - scale, h - scale);
  const text = scene.add.text(x + w / 2, y + h / 2, label, {
    fontFamily: UI.arcadeFont, fontSize: 8 * scale, color: COLORS.text, align: 'center', resolution: 1,
  }).setOrigin(0.5).setLineSpacing(4 * scale);
  const zone = scene.add.zone(x - pad, y - pad, w + pad * 2, h + pad * 2).setOrigin(0).setInteractive({ useHandCursor: true });
  zone.on('pointerup', onTap);
  if (fixed) [box, text, zone].forEach((o) => o.setScrollFactor(0));
  return zone;
}
