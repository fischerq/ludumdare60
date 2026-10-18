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
const W = 720;
const THUMB = 64, PITCH = 84, PER_LINE = Math.floor((W - 32) / PITCH); // the "all frames" strip
const stripHeight = (n) => Math.ceil(n / PER_LINE) * (PITCH + 16) + 8;
const DIE_FRAMES = 10, DIE_GAP = 4; // the death plays once, then this many ticks hidden before the bench loops it

// What each group shows: rows of animations. A row draws itself at its y (env has t, p, helpers) and may list
// its frames (each a draw function into a THUMB box plus a label) and which one is showing now.
function rowsFor(id) {
  const sp = (key, opts) => (e, x, y, size) => e.sprite(key, x, y, { ...opts, size });
  if (id === 'pac') {
    const chompKey = (e) => `maze/pac-${PAC_CYCLE[e.frame('pac', PAC_CYCLE.length)]}`;
    return [
      { id: 'pac-chomp', title: (e) => `Maze chomp · ${e.rate('pac')}`, h: 190,
        draw: (e, y) => DIRS.forEach((d, i) => { e.sprite(chompKey(e), col(i), y + 80, { angle: ANGLE[d], flip: d === 'left' }); e.text(d, col(i), y + 152); }),
        frames: { items: PAC_CYCLE.map((f, i) => ({ draw: sp(`maze/pac-${f}`), label: `${i}: pac-${f}` })), cur: (e) => e.frame('pac', PAC_CYCLE.length) } },
      { id: 'pac-run', title: () => 'Moving at his maze speed', h: 130,
        draw: (e, y) => e.sprite(chompKey(e), ((e.t * SPEED.pac * (SIZE / 2)) % (W + SIZE)) - SIZE / 2, y + 70) },
      { id: 'pac-walk', title: (e) => `Hall walk (2 frames) · ${e.rate('pac')}`, h: 190,
        draw: (e, y) => DIRS.forEach((d, i) => { e.sprite(`arcade/pac-${d === 'left' ? 'right' : d}-${e.frame('pac', 2)}`, col(i), y + 80, { flip: d === 'left' }); e.text(d, col(i), y + 152); }),
        frames: { items: ['right', 'up', 'down'].flatMap((d) => [0, 1].map((f) => ({ draw: sp(`arcade/pac-${d}-${f}`), label: `${d} ${f}`, f }))), cur: (e) => e.frame('pac', 2), byF: true } },
      { id: 'pac-death', title: (e) => `Death (plays once) · ${e.rate('pacDeath')}`, h: 130,
        draw: (e, y) => {
          const f = deathFrame(e);
          if (f < DIE_FRAMES) e.sprite(`maze/pac-die-${f}`, col(0), y + 70);
          e.text(f < DIE_FRAMES ? `frame ${f}` : 'hidden', col(1), y + 78);
        },
        frames: { items: Array.from({ length: DIE_FRAMES }, (_, i) => ({ draw: sp(`maze/pac-die-${i}`), label: String(i) })), cur: (e) => deathFrame(e) } },
    ];
  }
  if (GHOSTS.includes(id)) {
    const dirFrames = (layer) => ({ items: DIRS.flatMap((d) => [0, 1].map((f) => ({ draw: sp(`${layer}/ghost-${id}-${d}-${f}`), label: `${d} ${f}`, f }))), cur: (e) => e.frame(id, 2), byF: true });
    const fright = (e) => (e.on('frightFlash') ? 'fright' : 'flash');
    return [
      { id: `${id}-maze`, title: (e) => `Maze · ${e.rate(id)}`, h: 190,
        draw: (e, y) => DIRS.forEach((d, i) => { e.sprite(`maze/ghost-${id}-${d}-${e.frame(id, 2)}`, col(i), y + 80); e.text(d, col(i), y + 152); }),
        frames: dirFrames('maze') },
      { id: `${id}-hall`, title: () => 'Hall', h: 190,
        draw: (e, y) => DIRS.forEach((d, i) => { e.sprite(`arcade/ghost-${id}-${d}-${e.frame(id, 2)}`, col(i), y + 80); e.text(d, col(i), y + 152); }),
        frames: dirFrames('arcade') },
      { id: `${id}-fright`, title: (e) => `Frightened, then flashing · ${e.rate('frightFlash')}`, h: 190,
        draw: (e, y) => {
          e.sprite(`maze/ghost-fright-${e.frame(id, 2)}`, col(0), y + 80); e.text('frightened', col(0), y + 152);
          e.sprite(`maze/ghost-${fright(e)}-${e.frame(id, 2)}`, col(1), y + 80); e.text('flashing', col(1), y + 152);
        },
        frames: { items: ['fright', 'flash'].flatMap((k) => [0, 1].map((f) => ({ draw: sp(`maze/ghost-${k}-${f}`), label: `${k} ${f}`, k, f }))),
          isCur: (e, it) => it.f === e.frame(id, 2) && it.k === fright(e) } },
    ];
  }
  if (id === 'maze') {
    const box = (color) => (e, x, y, size) => { e.ctx.fillStyle = color; e.ctx.fillRect(x - size / 2, y - size / 2, size, size); };
    return [
      { id: 'power', title: (e) => `Power pellet · ${e.rate('powerPellet')}`, h: 150,
        draw: (e, y) => { if (e.on('powerPellet')) e.sprite('maze/power', col(0), y + 80, { size: 64 }); },
        frames: { items: [{ draw: sp('maze/power'), label: 'on' }, { draw: () => {}, label: 'off' }], cur: (e) => e.frame('powerPellet', 2) } },
      { id: 'clear', title: (e) => `Maze clear flash · ${e.rate('mazeClear')}`, h: 210,
        draw: (e, y) => {
          e.ctx.fillStyle = e.on('mazeClear') ? '#2121de' : '#dedede';
          e.ctx.fillRect(40, y + 40, 640, 20); e.ctx.fillRect(40, y + 180, 640, 20); e.ctx.fillRect(40, y + 40, 20, 160); e.ctx.fillRect(660, y + 40, 20, 160);
        },
        frames: { items: [{ draw: box('#2121de'), label: 'walls' }, { draw: box('#dedede'), label: 'flash' }], cur: (e) => e.frame('mazeClear', 2) } },
    ];
  }
  if (id === 'hall') {
    return [
      { id: 'coin', title: (e) => `Hall coin bob · ${e.rate('coinBob')}`, h: 170,
        draw: (e, y) => { for (let i = 0; i < 4; i++) e.sprite('arcade/coin', col(i), y + 80 + animFrame(e.t + (i * e.p.coinBob) / ANIM.fps, e.p.coinBob, 2) * 8, { size: 64 }); },
        frames: { items: [0, 1].map((f) => ({ draw: (e, x, y, size) => e.sprite('arcade/coin', x, y - 4 + f * 8, { size: size * 0.75 }), label: f ? 'down 1 px' : 'up' })), cur: (e) => e.frame('coinBob', 2) } },
    ];
  }
  // Text blinks.
  const word = (str, color, alpha = 1) => (e, x, y) => { e.ctx.globalAlpha = alpha; e.text(str, x, y + 8, color, 18); e.ctx.globalAlpha = 1; };
  return [
    { id: 'coin-text', title: (e) => `Insert coin blink · ${e.rate('insertCoin')}`, h: 150,
      draw: (e, y) => { if (!e.on('insertCoin')) e.text('INSERT COIN', 360, y + 90, '#00ffde', 44); },
      frames: { items: [{ draw: () => {}, label: 'off' }, { draw: word('COIN', '#00ffde'), label: 'on' }], cur: (e) => e.frame('insertCoin', 2) } },
    { id: 'tap-text', title: (e) => `Tap prompt fade (one tick each way) · ${e.rate('tapPrompt')}`, h: 150,
      draw: (e, y) => {
        const k = ((e.t * ANIM.fps) / e.p.tapPrompt) % 2;
        e.ctx.globalAlpha = 1 - 0.8 * (k < 1 ? k : 2 - k);
        e.text('TAP TO START', 360, y + 90, e.c.text, 44);
        e.ctx.globalAlpha = 1;
      },
      frames: { items: [{ draw: word('TAP', null, 1), label: 'alpha 1' }, { draw: word('TAP', null, 0.2), label: 'alpha 0.2' }], cur: (e) => Math.floor((e.t * ANIM.fps) / e.p.tapPrompt) % 2 } },
  ];
}
const deathFrame = (e) => Math.floor((e.t * ANIM.fps) / e.p.pacDeath) % (DIE_FRAMES + DIE_GAP);
const layout = (view) => rowsFor(view?.group?.id ?? 'pac').map((r) => ({ ...r, strip: r.frames && view?.toggled?.has(r.id) }));
const height = (rows) => rows.reduce((h, r) => h + r.h + (r.strip ? stripHeight(r.frames.items.length) : 0), 0);

// The exported 1x PNGs, the same files the game loads.
const KEYS = [
  ...[0, 1, 2, 3, 4, 5, 6].map((i) => `maze/pac-${i}`),
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
  summary: 'Pick a character or a set of effects. Each animation frame is held for this many game frames (60 per second); higher is slower. Blinks are on for one tick and off for the next. Pac only animates while moving. "Frames" buttons show every frame of an animation; the one showing now is outlined.',
  doc: 'https://github.com/fischerq/ludumdare60/blob/main/design/systems/art.md',
  world: { w: W, h: 600 },
  worldFor: (view) => ({ w: W, h: height(layout(view)) }),

  groupLabel: 'Character',
  groups: [
    { id: 'pac', name: 'Pac', keys: ['pac', 'pacDeath'] },
    ...GHOSTS.map((g) => ({ id: g, name: LABELS[g], keys: [g, 'frightFlash'] })),
    { id: 'maze', name: 'Maze effects', keys: ['powerPellet', 'mazeClear'] },
    { id: 'hall', name: 'Hall effects', keys: ['coinBob'] },
    { id: 'text', name: 'Text blinks', keys: ['insertCoin', 'tapPrompt'] },
  ],
  // One "show all frames" button per animation that has frames.
  toggles: (group) => rowsFor(group?.id ?? 'pac').filter((r) => r.frames)
    .map((r) => ({ id: r.id, label: `Frames: ${r.title({ rate: () => '' }).replace(/ · $/, '')}` })),

  params: [...CHARS, ...EFFECTS].map((k) => ({ key: k, label: `${LABELS[k]} (frames per tick)`, min: 1, max: 60, step: 1 })),

  variants: [
    { name: 'Settings file', note: 'src/settings/animation.json; tune, then Download settings (top) and save over that file',
      params: { ...ANIM.characters, ...ANIM.effects }, editable: true },
  ],

  scenarios: [{ id: 'loop', name: 'Loop', duration: 6, input: () => null }],

  init() { return { t: 0 }; },
  step(s, p, input, dt) { s.t += dt; },

  draw(ctx, s, p, input, c, view) {
    ctx.imageSmoothingEnabled = false;
    const e = {
      ctx, c, p, t: s.t,
      frame: (k, length) => animFrame(s.t, p[k], length),
      on: (k) => animFrame(s.t, p[k], 2) === 0,
      rate: (k) => `${p[k]} frames · ${(ANIM.fps / p[k]).toFixed(1)}/s`,
      sprite(key, x, y, { angle = 0, flip = false, size = SIZE } = {}) {
        const src = img[key];
        if (!ready(src)) return;
        ctx.save(); ctx.translate(x, y);
        if (angle) ctx.rotate(angle);
        if (flip) ctx.scale(-1, 1);
        ctx.drawImage(src, -size / 2, -size / 2, size, size);
        ctx.restore();
      },
      text(str, x, y, color = c.muted, size = 20) {
        ctx.fillStyle = color ?? c.text; ctx.font = `${size}px system-ui, sans-serif`; ctx.textAlign = 'center';
        ctx.fillText(str, x, y);
      },
    };
    let y = 0;
    for (const r of layout(view)) {
      ctx.textAlign = 'left'; ctx.fillStyle = c.text; ctx.font = '600 22px system-ui, sans-serif';
      ctx.fillText(r.title(e), 16, y + 30);
      r.draw(e, y);
      y += r.h;
      if (!r.strip) continue;
      const { items } = r.frames;
      const cur = r.frames.cur?.(e);
      items.forEach((it, i) => {
        const x = 16 + (i % PER_LINE) * PITCH + PITCH / 2;
        const ty = y + Math.floor(i / PER_LINE) * (PITCH + 16) + THUMB / 2 + 4;
        const now = r.frames.isCur ? r.frames.isCur(e, it) : r.frames.byF ? it.f === cur : i === cur;
        ctx.strokeStyle = now ? c.accent : c.line; ctx.lineWidth = now ? 4 : 1;
        ctx.strokeRect(x - THUMB / 2 - 4, ty - THUMB / 2 - 4, THUMB + 8, THUMB + 8);
        it.draw(e, x, ty, THUMB);
        e.text(it.label, x, ty + THUMB / 2 + 22, now ? c.text : c.muted, 14);
      });
      y += stripHeight(items.length);
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
