// Bench: every animation's speed, with the game's own art and timing (src/systems/anim.js). Pick a character
// (or a set of effects) at the top; its animations and sliders show. The numbers come from
// src/settings/animation.json; Download settings writes a new copy of that file.
import { ANIM, SPEED } from '../../src/config.js';
import { PAC_CYCLE, animFrame } from '../../src/systems/anim.js';

const CHARS = ['pac', 'blinky', 'pinky', 'inky', 'clyde'];
const GHOSTS = CHARS.slice(1);
const EFFECTS = ['pacDeath', 'powerPellet', 'frightFlash', 'mazeClear', 'coinBob', 'insertCoin', 'tapPrompt'];
const LABELS = {
  pac: 'Pac', blinky: 'Blinky', pinky: 'Pinky', inky: 'Inky', clyde: 'Clyde',
  pacDeath: 'Pac death', powerPellet: 'Power pellet', frightFlash: 'Fright flash (all ghosts)',
  mazeClear: 'Maze clear flash', coinBob: 'Hall coin bob', insertCoin: 'Insert coin blink', tapPrompt: 'Tap prompt fade',
};
const DIRS = ['right', 'left', 'up', 'down'];
const ANGLE = { right: 0, left: 0, up: -Math.PI / 2, down: Math.PI / 2 }; // maze Pac: left is mirrored
const SIZE = 96;   // px a sprite is drawn at
const col = (i) => 90 + i * 180;

// The exported 1x PNGs, the same files the game loads.
const KEYS = [
  ...[0, 1, 2, 3].map((i) => `maze/pac-${i}`),
  ...Array.from({ length: 10 }, (_, i) => `maze/pac-die-${i}`),
  ...['right', 'up', 'down'].flatMap((d) => [`arcade/pac-${d}-0`, `arcade/pac-${d}-1`]),
  ...GHOSTS.flatMap((g) => DIRS.flatMap((d) => [0, 1].flatMap((f) => [`maze/ghost-${g}-${d}-${f}`, `arcade/ghost-${g}-${d}-${f}`]))),
  'maze/ghost-fright-0', 'maze/ghost-fright-1', 'maze/ghost-flash-0', 'maze/ghost-flash-1', 'maze/power', 'arcade/coin',
];
const img = {};
for (const k of KEYS) {
  img[k] = new Image();
  img[k].src = new URL(`../../assets/${k}.png`, import.meta.url).href;
}
const ready = (i) => i && i.complete && i.naturalWidth;

export default {
  title: 'Animation speed',
  summary: 'Pick a character or a set of effects. Each animation frame is held for this many game frames (60 per second); higher is slower. Blinks are on for one tick and off for the next. Pac only animates while moving.',
  doc: 'https://github.com/fischerq/ludumdare60/blob/main/design/systems/art.md',
  world: { w: 720, h: 600 },

  groupLabel: 'Character',
  groups: [
    { id: 'pac', name: 'Pac', keys: ['pac', 'pacDeath'] },
    ...GHOSTS.map((g) => ({ id: g, name: LABELS[g], keys: [g, 'frightFlash'] })),
    { id: 'maze', name: 'Maze effects', keys: ['powerPellet', 'mazeClear'] },
    { id: 'hall', name: 'Hall effects', keys: ['coinBob'] },
    { id: 'text', name: 'Text blinks', keys: ['insertCoin', 'tapPrompt'] },
  ],

  params: [...CHARS, ...EFFECTS].map((k) => ({ key: k, label: `${LABELS[k]} (frames per tick)`, min: 1, max: 60, step: 1 })),

  variants: [
    { name: 'Settings file', note: 'src/settings/animation.json; tune, then Download settings (top) and save over that file',
      params: { ...ANIM.characters, ...ANIM.effects }, editable: true },
  ],

  scenarios: [{ id: 'loop', name: 'Loop', duration: 6, input: () => null }],

  init() { return { t: 0 }; },
  step(s, p, input, dt) { s.t += dt; },

  draw(ctx, s, p, input, c, group) {
    const t = s.t;
    const frame = (k, length) => animFrame(t, p[k], length);
    const on = (k) => frame(k, 2) === 0;
    ctx.imageSmoothingEnabled = false;
    const sprite = (key, x, y, { angle = 0, flip = false, size = SIZE } = {}) => {
      const src = img[key];
      if (!ready(src)) return;
      ctx.save(); ctx.translate(x, y);
      if (angle) ctx.rotate(angle);
      if (flip) ctx.scale(-1, 1);
      ctx.drawImage(src, -size / 2, -size / 2, size, size);
      ctx.restore();
    };
    const text = (str, x, y, color = c.muted, size = 20) => {
      ctx.fillStyle = color; ctx.font = `${size}px system-ui, sans-serif`; ctx.textAlign = 'center';
      ctx.fillText(str, x, y);
    };
    const heading = (str, y) => { ctx.textAlign = 'left'; ctx.fillStyle = c.text; ctx.font = '600 22px system-ui, sans-serif'; ctx.fillText(str, 16, y); };
    const rate = (k) => `${p[k]} frames · ${(ANIM.fps / p[k]).toFixed(1)}/s`;
    const id = group?.id ?? 'pac';

    if (id === 'pac') {
      const chomp = `maze/pac-${PAC_CYCLE[frame('pac', PAC_CYCLE.length)]}`;
      heading(`Maze chomp · ${rate('pac')}`, 30);
      DIRS.forEach((d, i) => { sprite(chomp, col(i), 100, { angle: ANGLE[d], flip: d === 'left' }); text(d, col(i), 172); });
      heading('Moving at his maze speed', 220);
      const run = (t * SPEED.pac * (SIZE / 2)) % (720 + SIZE);
      sprite(chomp, run - SIZE / 2, 280);
      heading('Hall walk (2 frames)', 350);
      const walk = frame('pac', 2);
      DIRS.forEach((d, i) => { sprite(`arcade/pac-${d === 'left' ? 'right' : d}-${walk}`, col(i), 410, { flip: d === 'left' }); text(d, col(i), 482); });
      heading(`Death (plays once) · ${rate('pacDeath')}`, 530);
      const die = Math.floor((t * ANIM.fps) / p.pacDeath) % 14; // 10 frames, then 4 ticks hidden
      if (die < 10) sprite(`maze/pac-die-${die}`, col(0), 560, { size: 56 });
      text(die < 10 ? `frame ${die}` : 'hidden', col(1), 568);
    } else if (GHOSTS.includes(id)) {
      const f = frame(id, 2);
      heading(`Maze · ${rate(id)}`, 30);
      DIRS.forEach((d, i) => { sprite(`maze/ghost-${id}-${d}-${f}`, col(i), 100); text(d, col(i), 172); });
      heading('Hall', 220);
      DIRS.forEach((d, i) => { sprite(`arcade/ghost-${id}-${d}-${f}`, col(i), 290); text(d, col(i), 362); });
      heading(`Frightened, then flashing · ${rate('frightFlash')}`, 410);
      sprite(`maze/ghost-fright-${f}`, col(0), 480); text('frightened', col(0), 552);
      sprite(`maze/ghost-${on('frightFlash') ? 'fright' : 'flash'}-${f}`, col(1), 480); text('flashing', col(1), 552);
    } else if (id === 'maze') {
      heading(`Power pellet · ${rate('powerPellet')}`, 30);
      if (on('powerPellet')) sprite('maze/power', col(0), 120, { size: 64 });
      heading(`Maze clear flash · ${rate('mazeClear')}`, 230);
      ctx.fillStyle = on('mazeClear') ? '#2121de' : '#dedede';
      ctx.fillRect(40, 280, 640, 20); ctx.fillRect(40, 420, 640, 20); ctx.fillRect(40, 280, 20, 160); ctx.fillRect(660, 280, 20, 160);
    } else if (id === 'hall') {
      heading(`Hall coin bob · ${rate('coinBob')}`, 30);
      for (let i = 0; i < 4; i++) sprite('arcade/coin', col(i), 140 + animFrame(t + (i * p.coinBob) / ANIM.fps, p.coinBob, 2) * 8, { size: 64 });
    } else if (id === 'text') {
      ctx.font = '40px "Press Start 2P", monospace';
      heading(`Insert coin blink · ${rate('insertCoin')}`, 30);
      if (!on('insertCoin')) text('INSERT COIN', 360, 130, '#00ffde', 44);
      heading(`Tap prompt fade (one tick each way) · ${rate('tapPrompt')}`, 230);
      const k = ((t * ANIM.fps) / p.tapPrompt) % 2;
      ctx.globalAlpha = 1 - 0.8 * (k < 1 ? k : 2 - k);
      text('TAP TO START', 360, 330, c.text, 44);
      ctx.globalAlpha = 1;
    }
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
