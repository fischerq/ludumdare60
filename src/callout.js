// A boxed message in the pixel font, centered on (x, y) in the scene's art pixels: used when the outer game loop
// unlocks a layer ("WANT TO GO DEEPER?") or a round ends. scale 2 for scenes with a 16 px font. Returns the
// objects so the caller can remove them (callout.destroy()).
import { COLORS, UI } from './config.js';

export function showCallout(scene, x, y, text, scale = 2) {
  const t = scene.add.text(x, y, text, {
    fontFamily: UI.arcadeFont, fontSize: 8 * scale, color: COLORS.text, align: 'center', resolution: 1,
  }).setOrigin(0.5).setLineSpacing(6 * scale).setDepth(11);
  const pad = 8 * scale, w = Math.ceil(t.width) + pad * 2, h = Math.ceil(t.height) + pad * 2;
  const left = Math.round(x - w / 2), top = Math.round(y - h / 2);
  const box = scene.add.graphics().setDepth(10).fillStyle(0x000000, 0.9).fillRect(left, top, w, h)
    .lineStyle(scale, 0xffff00, 1).strokeRect(left + scale / 2, top + scale / 2, w - scale, h - scale);
  return { destroy() { t.destroy(); box.destroy(); } };
}
