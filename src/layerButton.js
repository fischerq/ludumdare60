// The button that moves between layers (up = zoom out, down = zoom in). Pixel style, drawn in the scene's art
// pixels (scale 2 doubles box and font, for scenes with a 16 px font); the hit area is padded so it's easy to tap on a phone. Returns the hit zone so swipe/joystick input
// can ignore touches that start on it.
import { COLORS, UI } from './config.js';

export function addLayerButton(scene, x, y, label, onTap, scale = 1) {
  const w = 56 * scale, h = 30 * scale, pad = 6 * scale;
  scene.add.graphics().lineStyle(scale, 0xffffff, 0.6).strokeRect(x + scale / 2, y + scale / 2, w - scale, h - scale);
  scene.add.text(x + w / 2, y + h / 2, label, {
    fontFamily: UI.arcadeFont, fontSize: 8 * scale, color: COLORS.text, align: 'center', resolution: 1,
  }).setOrigin(0.5).setLineSpacing(4 * scale);
  const zone = scene.add.zone(x - pad, y - pad, w + pad * 2, h + pad * 2).setOrigin(0).setInteractive({ useHandCursor: true });
  zone.on('pointerup', onTap);
  return zone;
}
