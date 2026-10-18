// Tiny WebAudio synth for arcade bleeps. No files to load; swap in samples later if we want.
import { SOUND } from './config.js';

let ctx = null;
let master = null;
let siren = null;

// Browsers only allow audio after a user gesture: call this from a tap or key handler.
export function unlockAudio() {
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = SOUND.volume;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch (e) { ctx = null; }
}

export function setAudioPaused(paused) {
  if (!ctx) return;
  if (paused) ctx.suspend(); else ctx.resume();
}

function tone(freq, dur, { type = 'square', vol = 0.5, at = 0, slideTo = null } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

// notes: [frequency or 0 for a rest, beats]
function melody(notes, beat, opts) {
  let at = 0;
  for (const [f, beats] of notes) {
    if (f) tone(f, beat * beats * 0.9, { ...opts, at });
    at += beat * beats;
  }
}

let waka = false;

export const sfx = {
  start() {
    melody([[494, 1], [988, 1], [740, 1], [622, 1], [988, 0.5], [740, 1.5], [622, 2],
      [523, 1], [1047, 1], [784, 1], [659, 1], [1047, 0.5], [784, 1.5], [659, 2]], 0.07, { vol: 0.35 });
  },
  dot() {
    waka = !waka;
    tone(waka ? 480 : 300, 0.08, { type: 'triangle', slideTo: waka ? 260 : 520, vol: 0.6 });
  },
  power() {
    tone(200, 0.25, { slideTo: 800, vol: 0.4 });
  },
  ghost() {
    tone(150, 0.4, { type: 'sawtooth', slideTo: 1600, vol: 0.35 });
  },
  death() {
    tone(900, 1.2, { type: 'square', slideTo: 80, vol: 0.4 });
    tone(450, 1.2, { type: 'triangle', slideTo: 40, vol: 0.4, at: 0.05 });
  },
  clear() {
    melody([[523, 1], [659, 1], [784, 1], [1047, 2], [784, 1], [1047, 3]], 0.09, { vol: 0.35 });
  },
  coin() {
    tone(1400, 0.06, { vol: 0.4 });
    tone(1900, 0.25, { at: 0.07, vol: 0.4 });
  },
  // The hall ghosts spotting Pac-Man: a sharp double blip under their "!".
  alert() {
    tone(1200, 0.06, { vol: 0.4 });
    tone(1600, 0.12, { at: 0.08, vol: 0.4 });
  },
  // The joystick's microswitch clicking over.
  click() {
    tone(2400, 0.015, { type: 'square', vol: 0.25 });
  },
  // A wobbling tone while ghosts are frightened.
  frightOn() {
    if (!ctx || siren) return;
    const o = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = 220;
    lfo.frequency.value = 8;
    lfoGain.gain.value = 80;
    g.gain.value = 0.12;
    lfo.connect(lfoGain).connect(o.frequency);
    o.connect(g).connect(master);
    o.start(); lfo.start();
    siren = { o, lfo };
  },
  frightOff() {
    if (!siren) return;
    siren.o.stop(); siren.lfo.stop();
    siren = null;
  },
};
