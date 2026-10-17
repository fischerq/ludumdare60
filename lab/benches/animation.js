// Bench: every animation's speed, with the game's own art and timing (src/systems/anim.js).
// The numbers come from src/settings/animation.json; Download writes a new copy of that file.
import { ANIM, COLORS, SPEED } from '../../src/config.js';
import { PAC_CYCLE, animFrame } from '../../src/systems/anim.js';

const CHARS = ['pac', 'blinky', 'pinky', 'inky', 'clyde'];
const EFFECTS = ['pacDeath', 'powerPellet', 'frightFlash', 'mazeClear', 'coinBob', 'insertCoin', 'tapPrompt'];
const LABELS = {
  pac: 'Pac', blinky: 'Blinky', pinky: 'Pinky', inky: 'Inky', clyde: 'Clyde',
  pacDeath: 'Pac death', powerPellet: 'Power pellet', frightFlash: 'Fright flash', mazeClear: 'Maze clear flash',
  coinBob: 'Hall coin bob', insertCoin: 'Insert coin blink', tapPrompt: 'Tap prompt fade',
};
const SIZE = 96;   // px a sprite is drawn at
const GAP = 144;   // px between sprite centres
const col = (i) => 72 + i * GAP;

// The exported 1x PNGs, the same files the game loads.
const KEYS = ['pac-0', 'pac-1', 'pac-2', 'pac-3', 'power', 'ghost-fright-0', 'ghost-fright-1', 'ghost-flash-0', 'ghost-flash-1',
  ...['blinky', 'pinky', 'inky', 'clyde'].flatMap((g) => [`ghost-${g}-right-0`, `ghost-${g}-right-1`]),
  ...Array.from({ length: 10 }, (_, i) => `pac-die-${i}`)].map((k) => `maze/${k}`).concat('arcade/coin');
const img = {};
for (const k of KEYS) {
  img[k] = new Image();
  img[k].src = new URL(`../../assets/${k}.png`, import.meta.url).href;
}
const ready = (i) => i && (i instanceof HTMLCanvasElement || (i.complete && i.naturalWidth));
const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

export default {
  title: 'Animation speed',
  summary: 'Each animation frame is held for this many game frames (60 per second). Higher is slower. Blinks are on for one tick and off for the next. Pac only animates while moving; the second row shows him crossing the screen at his maze speed.',
  doc: 'https://github.com/fischerq/ludumdare60/blob/main/design/systems/art.md',
  world: { w: 720, h: 860 },

  params: [...CHARS, ...EFFECTS].map((k) => ({ key: k, label: `${LABELS[k]} (frames per tick)`, min: 1, max: 60, step: 1 })),

  variants: [
    { name: 'Settings file', note: 'src/settings/animation.json; drag, then Download and save over that file',
      params: { ...ANIM.characters, ...ANIM.effects }, editable: true },
  ],

  scenarios: [{ id: 'loop', name: 'Loop', duration: 6, input: () => null }],

  init() { return { t: 0 }; },
  step(s, p, input, dt) { s.t += dt; },

  draw(ctx, s, p, input, c) {
    const t = s.t;
    const frame = (k, length) => animFrame(t, p[k], length);
    const on = (k) => frame(k, 2) === 0;
    ctx.imageSmoothingEnabled = false;
    const sprite = (src, x, y, size = SIZE) => {
      if (ready(src)) ctx.drawImage(src, x - size / 2, y - size / 2, size, size);
    };
    const label = (k, x, y, extra = '') => {
      ctx.fillStyle = c.muted;
      ctx.font = '20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(LABELS[k], x, y);
      ctx.fillText(`${p[k]} · ${(ANIM.fps / p[k]).toFixed(1)}/s${extra}`, x, y + 24);
    };

    // Characters.
    CHARS.forEach((k, i) => {
      const x = col(i), y = 90;
      if (k === 'pac') sprite(img[`maze/pac-${PAC_CYCLE[frame('pac', PAC_CYCLE.length)]}`], x, y);
      else {
        sprite(img[`maze/ghost-${k}-right-${frame(k, 2)}`], x, y);
      }
      label(k, x, y + 76);
    });
    // Pac on the move, wrapping around: the chomp rate against how fast he covers ground.
    const run = (t * SPEED.pac * (SIZE / 2)) % (720 + SIZE);
    sprite(img[`maze/pac-${PAC_CYCLE[frame('pac', PAC_CYCLE.length)]}`], run - SIZE / 2, 270);

    // Effects, row one: death (plays once, then a short pause), power pellet, fright flash, maze clear.
    const y1 = 430;
    const deathTicks = Math.floor((t * ANIM.fps) / p.pacDeath) % 14; // 10 frames + 4 ticks hidden
    if (deathTicks < 10) sprite(img[`maze/pac-die-${deathTicks}`], col(0), y1);
    label('pacDeath', col(0), y1 + 76);
    if (on('powerPellet')) sprite(img['maze/power'], col(1), y1, 64);
    label('powerPellet', col(1), y1 + 76);
    sprite(img[`maze/ghost-${on('frightFlash') ? 'fright' : 'flash'}-${frame('blinky', 2)}`], col(2), y1);
    label('frightFlash', col(2), y1 + 76);
    ctx.fillStyle = on('mazeClear') ? hex(COLORS.wall) : hex(COLORS.mazeFlash);
    ctx.fillRect(col(3) - 70, y1 - 40, 140, 16);
    ctx.fillRect(col(3) - 70, y1 + 24, 140, 16);
    ctx.fillRect(col(3) - 70, y1 - 40, 16, 80);
    label('mazeClear', col(3), y1 + 76);
    for (let i = 0; i < 2; i++) sprite(img['arcade/coin'], col(4) - 24 + i * 48, y1 + animFrame(t + (i * p.coinBob) / ANIM.fps, p.coinBob, 2) * 4, 40);
    label('coinBob', col(4), y1 + 76);

    // Effects, row two: text blinks.
    const y2 = 650;
    ctx.font = '36px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    if (!on('insertCoin')) { ctx.fillStyle = '#00ffde'; ctx.fillText('INSERT COIN', 180, y2); }
    label('insertCoin', 180, y2 + 60);
    // The menu prompt fades to 0.2 and back, one tick each way (a yoyo tween).
    const k = (t * ANIM.fps) / p.tapPrompt % 2;
    ctx.globalAlpha = 1 - 0.8 * (k < 1 ? k : 2 - k);
    ctx.fillStyle = c.text;
    ctx.font = '36px "Press Start 2P", monospace';
    ctx.fillText('TAP', 540, y2);
    ctx.globalAlpha = 1;
    label('tapPrompt', 540, y2 + 60, ' each way');
  },

  readout(s, p) {
    return [...CHARS, ...EFFECTS].map((k) => `${k} ${p[k]}`).join(' · ');
  },

  exportFile(p) {
    const file = {
      _readme: 'Animation speeds: how many game frames (at 60 per second) each animation frame is shown. Higher is slower. characters: walk/chomp and skirt wobble. effects: blinks, flashes and the death animation (blinks are on for one tick, off for one). Tune in the lab (/lab/bench.html?b=animation), press Download, and save the file over this one.',
      fps: ANIM.fps,
      characters: Object.fromEntries(CHARS.map((k) => [k, p[k]])),
      effects: Object.fromEntries(EFFECTS.map((k) => [k, p[k]])),
    };
    return { name: 'animation.json', text: `${JSON.stringify(file, null, 2)}\n` };
  },
};
