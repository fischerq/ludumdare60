// A boxed message in the pixel font, centered on (x, y) in the scene's art pixels: used when the outer game loop
// unlocks a layer ("WANT TO GO DEEPER?") or a round ends. scale 2 for scenes with a 16 px font. Returns the
// objects so the caller can remove them (callout.destroy()).
// button: optional { label, onTap }: a tappable button inside the box, under the text, that does what the
// callout asks (INSERT COIN, LAYER UP). Its hit area is padded like the layer buttons'.
import { COLORS, UI } from './config.js';

export function showCallout(scene, x, y, text, scale = 2, button = null) {
  const t = scene.add.text(x, y, text, {
    fontFamily: UI.arcadeFont, fontSize: 8 * scale, color: COLORS.text, align: 'center', resolution: 1,
  }).setOrigin(0.5).setLineSpacing(6 * scale).setDepth(11);
  const pad = 8 * scale, bh = button ? 22 * scale : 0, gap = button ? 8 * scale : 0;
  let label = null;
  if (button) {
    label = scene.add.text(0, 0, button.label, {
      fontFamily: UI.arcadeFont, fontSize: 8 * scale, color: COLORS.textReady, align: 'center', resolution: 1,
    }).setOrigin(0.5).setDepth(12);
  }
  const bw = button ? Math.max(64 * scale, Math.ceil(label.width) + 16 * scale) : 0;
  const w = Math.max(Math.ceil(t.width), bw) + pad * 2, h = Math.ceil(t.height) + gap + bh + pad * 2;
  const left = Math.round(x - w / 2), top = Math.round(y - h / 2);
  t.setPosition(x, top + pad + Math.ceil(t.height) / 2);
  const box = scene.add.graphics().setDepth(10).fillStyle(0x000000, 0.9).fillRect(left, top, w, h)
    .lineStyle(scale, 0xffff00, 1).strokeRect(left + scale / 2, top + scale / 2, w - scale, h - scale);
  const objects = [box, t];
  if (button) {
    const bx = Math.round(x - bw / 2), by = top + h - pad - bh;
    box.fillStyle(COLORS.wall, 1).fillRect(bx, by, bw, bh)
      .lineStyle(scale, 0xffffff, 1).strokeRect(bx + scale / 2, by + scale / 2, bw - scale, bh - scale);
    label.setPosition(x, by + bh / 2);
    const hp = 6 * scale;
    const zone = scene.add.zone(bx - hp, by - hp, bw + hp * 2, bh + hp * 2).setOrigin(0).setDepth(12)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerup', button.onTap);
    objects.push(label, zone);
  }
  return { objects, destroy() { objects.forEach((o) => o.destroy()); } };
}
