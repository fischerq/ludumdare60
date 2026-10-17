// Bench: animation speed per character, with the game's own art and timing (src/systems/anim.js).
// The numbers come from src/settings/animation.json; Download writes a new copy of that file.
import { ANIM, COLORS, SPEED } from '../../src/config.js';
import { PAC_CYCLE, animFrame } from '../../src/systems/anim.js';

const CHARS = ['pac', 'blinky', 'pinky', 'inky', 'clyde'];
const SIZE = 96;   // px a sprite is drawn at
const GAP = 144;   // px between sprite centres

// The exported 1x PNGs, the same files the game loads.
const img = {};
for (const k of ['pac-0', 'pac-1', 'pac-2', 'pac-3', 'ghost-0', 'ghost-1', 'eyes-right']) {
  img[k] = new Image();
  img[k].src = new URL(`../../assets/${k}.png`, import.meta.url).href;
}
const tinted = new Map();
function tint(src, color) {
  const key = `${src.src}-${color}`;
  if (!tinted.has(key) && src.complete && src.naturalWidth) {
    const c = document.createElement('canvas');
    c.width = src.naturalWidth; c.height = src.naturalHeight;
    const x = c.getContext('2d');
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    x.fillRect(0, 0, c.width, c.height);
    tinted.set(key, c);
  }
  return tinted.get(key);
}
const ready = (i) => i && (i instanceof HTMLCanvasElement || (i.complete && i.naturalWidth));

const LABELS = { pac: 'Pac', blinky: 'Blinky', pinky: 'Pinky', inky: 'Inky', clyde: 'Clyde' };

export default {
  title: 'Animation speed',
  summary: 'Each animation frame is held for this many game frames (60 per second). Higher is slower. Pac only animates while moving; the second row shows him crossing the screen at his maze speed.',
  doc: 'https://github.com/fischerq/ludumdare60/blob/main/design/systems/art.md',
  world: { w: 720, h: 400 },

  params: CHARS.map((k) => ({ key: k, label: `${LABELS[k]} (frames per tick)`, min: 1, max: 30, step: 1 })),

  variants: [
    { name: 'Settings file', note: 'src/settings/animation.json; drag, then Download and save over that file', params: { ...ANIM.characters }, editable: true },
  ],

  scenarios: [{ id: 'loop', name: 'Loop', duration: 6, input: () => null }],

  init() { return { t: 0 }; },
  step(s, p, input, dt) { s.t += dt; },

  draw(ctx, s, p, input, c) {
    ctx.imageSmoothingEnabled = false;
    const sprite = (src, x, y, angle = 0) => {
      if (!ready(src)) return;
      ctx.save(); ctx.translate(x, y); if (angle) ctx.rotate(angle);
      ctx.drawImage(src, -SIZE / 2, -SIZE / 2, SIZE, SIZE);
      ctx.restore();
    };
    ctx.fillStyle = c.muted;
    ctx.font = '22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    CHARS.forEach((k, i) => {
      const x = 72 + i * GAP, y = 110;
      if (k === 'pac') sprite(img[`pac-${PAC_CYCLE[animFrame(s.t, p.pac, PAC_CYCLE.length)]}`], x, y);
      else {
        sprite(tint(img[`ghost-${animFrame(s.t, p[k], 2)}`], COLORS.ghosts[k]), x, y);
        sprite(img['eyes-right'], x, y);
      }
      ctx.fillText(LABELS[k], x, y + 80);
      ctx.fillText(`${(ANIM.fps / p[k]).toFixed(1)}/s`, x, y + 108);
    });
    // Pac on the move, wrapping around: shows the chomp rate against how fast he covers ground.
    const tile = SIZE / 2;
    const run = (s.t * SPEED.pac * tile) % (720 + SIZE);
    sprite(img[`pac-${PAC_CYCLE[animFrame(s.t, p.pac, PAC_CYCLE.length)]}`], run - SIZE / 2, 320);
  },

  readout(s, p) {
    return CHARS.map((k) => `${k} ${p[k]}`).join(' · ');
  },

  exportFile(p) {
    const file = {
      _readme: 'Animation speed per character: how many game frames (at 60 per second) each animation frame is shown. Higher is slower. Tune in the lab (/lab/bench.html?b=animation), press Download, and save the file over this one.',
      fps: ANIM.fps,
      characters: Object.fromEntries(CHARS.map((k) => [k, p[k]])),
    };
    return { name: 'animation.json', text: `${JSON.stringify(file, null, 2)}\n` };
  },
};
