// A big boxed text button in the pixel font, centered on (x, y) in the scene's art pixels, styled like the callout
// box (src/callout.js): used for the NEXT LEVEL / BACK TO THE BOARD choice after a layer's clear. Size from
// DEEP.choiceButton (art px; the deep layers and the adder show art px at 2x, so it stays a large tap target).
// opts.fixed: stays put when the camera scrolls. Returns the objects.
import { COLORS, UI, DEEP } from './config.js';

export function addTextButton(scene, x, y, label, onTap, { fixed = false, depth = 12 } = {}) {
  const { w, h } = DEEP.choiceButton;
  const left = Math.round(x - w / 2), top = Math.round(y - h / 2);
  const box = scene.add.graphics().setDepth(depth).fillStyle(0x000000, 0.9).fillRect(left, top, w, h)
    .lineStyle(1, 0xffff00, 1).strokeRect(left + 0.5, top + 0.5, w - 1, h - 1);
  const t = scene.add.text(x, y, label, {
    fontFamily: UI.arcadeFont, fontSize: 8, color: COLORS.text, align: 'center', resolution: 1,
  }).setOrigin(0.5).setDepth(depth + 1);
  const zone = scene.add.zone(left, top, w, h).setOrigin(0).setDepth(depth + 2).setInteractive({ useHandCursor: true });
  let fired = false;
  zone.on('pointerup', () => { if (!fired) { fired = true; onTap(); } });
  const objects = [box, t, zone];
  if (fixed) objects.forEach((o) => o.setScrollFactor(0));
  return objects;
}
