// Tiny WebAudio synth for arcade bleeps and the background beds. No files to load; swap in samples later if we want.
import { SOUND, MUSIC } from './config.js';

let ctx = null;
let master = null;
let siren = null;
let music = null;
let muted = false;
try { muted = localStorage.getItem('muted') === '1'; } catch (e) { /* private mode: not muted */ }

// Browsers only allow audio after a user gesture: call this from a tap or key handler.
export function unlockAudio() {
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : SOUND.volume;
      master.connect(ctx.destination);
      music = ctx.createGain();
      music.gain.value = MUSIC.volume;
      music.connect(master);
      setInterval(tick, 25);
      setBed(wanted);
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
  // The snow globe's glitter swirling: a few soft, high chimes.
  glitter() {
    [2093, 2637, 3136, 2349, 3520].forEach((f, i) => tone(f, 0.35, { type: 'sine', vol: 0.08, at: i * 0.06 + Math.random() * 0.03 }));
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

// ---- Background beds (one per layer, MUSIC.beds in config) ----

let wanted = null;   // the bed the current scene asked for, started once audio is unlocked
let bed = null;      // the playing bed
let sirenStage = -1; // maze siren: stage of dots eaten, -1 silent
let noise = null;
const waves = {};

export function isMuted() { return muted; }
// Is sound actually playing (unlocked by a tap and not suspended)?
export function audioRunning() { return ctx?.state === 'running'; }
export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('muted', muted ? '1' : '0'); } catch (e) { /* ignore */ }
  if (master) master.gain.setTargetAtTime(muted ? 0 : SOUND.volume, ctx.currentTime, 0.02);
  return muted;
}

// Every scene calls this on create with its layer's bed (null for silence); beds crossfade.
export function setBed(id) {
  wanted = id;
  if (!ctx || bed?.id === id) return;
  if (bed) stopBed(bed);
  bed = id && MUSIC.beds[id] ? startBed(id) : null;
}

export function setSiren(stage) { sirenStage = stage; }

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

// A 4-bit wavetable as a band-limited WebAudio wave (its first 15 harmonics, like the chip's 32 steps allow).
function wave(name) {
  if (!waves[name]) {
    const s = [...MUSIC.waves[name]].map((c) => parseInt(c, 16) - 7.5);
    const N = s.length, re = new Float32Array(N / 2), im = new Float32Array(N / 2);
    for (let k = 1; k < N / 2; k++) {
      for (let n = 0; n < N; n++) {
        re[k] += s[n] * Math.cos(2 * Math.PI * k * n / N);
        im[k] += s[n] * Math.sin(2 * Math.PI * k * n / N);
      }
    }
    waves[name] = ctx.createPeriodicWave(re, im);
  }
  return waves[name];
}

function noiseBuffer() {
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noise;
}

function filter(type, freq, q = 0.7) {
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  return f;
}

function startBed(id) {
  const def = MUSIC.beds[id];
  const t = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(def.vol ?? 1, t + MUSIC.fade);
  out.connect(music);
  let tracksIn = out;
  if (def.filter) { tracksIn = filter(def.filter.type, def.filter.freq, def.filter.q); tracksIn.connect(out); }
  const b = {
    id, def, out, tracksIn, step: 0, next: t + 0.05, nodes: [], siren: null,
    tracks: (def.tracks || []).map((tr) => ({ ...tr, seq: tr.notes.trim().split(/\s+/) })),
    stepped: (def.textures || []).filter((tx) => ['ticks', 'blips'].includes(tx.type)),
  };
  b.lp = new Map(b.stepped.filter((tx) => tx.lp).map((tx) => {
    const f = filter('lowpass', tx.lp);
    f.connect(out);
    return [tx, f];
  }));
  for (const tx of def.textures || []) {
    if (tx.type === 'tone' || tx.type === 'siren') {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.setPeriodicWave(wave(tx.wave));
      o.frequency.value = tx.freq ?? tx.stages[0].lo;
      g.gain.value = tx.type === 'tone' ? tx.vol : 0;
      o.connect(g).connect(out);
      o.start(t);
      b.nodes.push(o);
      if (tx.lfo) { // optional slow swell: the gain wobbles by depth (0 to 1) of vol, rate times a second
        const l = ctx.createOscillator(), lg = ctx.createGain();
        l.frequency.value = tx.lfo.rate; lg.gain.value = tx.vol * tx.lfo.depth / 2;
        g.gain.value = tx.vol * (1 - tx.lfo.depth / 2);
        l.connect(lg).connect(g.gain);
        l.start(t);
        b.nodes.push(l);
      }
      if (tx.type === 'siren') b.siren = { tx, o, g };
    } else if (tx.type === 'noise') {
      const src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = noiseBuffer(); src.loop = true;
      g.gain.value = tx.vol;
      src.connect(filter(tx.filter, tx.freq)).connect(g).connect(out);
      src.start(t);
      b.nodes.push(src);
    }
  }
  return b;
}

function stopBed(b) {
  const t = ctx.currentTime;
  b.stopped = true;
  b.out.gain.cancelScheduledValues(t);
  b.out.gain.setValueAtTime(b.out.gain.value, t);
  b.out.gain.linearRampToValueAtTime(0, t + MUSIC.fade);
  b.nodes.forEach((n) => n.stop(t + MUSIC.fade + 0.05));
  setTimeout(() => b.out.disconnect(), (MUSIC.fade + 0.5) * 1000);
}

// Schedules the next steps a little ahead, so timers on a busy phone don't make the beat stumble.
function tick() {
  if (!ctx || ctx.state !== 'running' || !bed) return;
  const now = ctx.currentTime, b = bed, dt = 15 / (b.def.bpm ?? 120);
  if (b.next < now) b.next = now;
  while (b.next < now + MUSIC.lookahead) { playStep(b, b.step, b.next, dt); b.step++; b.next += dt; }
  if (b.siren) {
    const { tx, o, g } = b.siren;
    const on = sirenStage >= 0;
    g.gain.setTargetAtTime(on ? tx.vol : 0, now, 0.02);
    if (on) {
      const st = tx.stages[Math.min(sirenStage, tx.stages.length - 1)];
      const p = (now / st.period) % 1, tri = p < 0.5 ? p * 2 : 2 - p * 2;
      o.frequency.setTargetAtTime(st.lo + (st.hi - st.lo) * tri, now, 0.01);
    }
  }
}

function playStep(b, step, t, dt) {
  for (const tr of b.tracks) {
    const tok = tr.seq[step % tr.seq.length];
    if (tok === '.') continue;
    if (tr.synth === 'drum') drum(b.tracksIn, tok, t, tr.vol);
    else for (const n of tok.split(',')) voice(b.tracksIn, tr, hz(b.def.root + (tr.oct ?? 0) + Number(n)), t, (tr.len ?? 1) * dt);
  }
  for (const tx of b.stepped) {
    if (tx.every ? step % tx.every : Math.random() >= tx.chance) continue;
    if (tx.type === 'ticks') click(b.out, t, tx.freq, tx.vol);
    else {
      const dest = b.lp.get(tx) ?? b.out;
      const midi = tx.lo + Math.floor(Math.random() * (tx.hi - tx.lo + 1));
      voice(dest, { wave: tx.wave, vol: tx.vol }, hz(midi), t, tx.len * dt);
    }
  }
}

// One note: a wavetable voice gated on and off like the chip, or a two-operator FM voice that decays.
function voice(dest, tr, f, t, dur) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.value = f;
  if (tr.synth === 'fm') {
    const m = ctx.createOscillator(), mg = ctx.createGain();
    m.frequency.value = f * tr.ratio;
    mg.gain.setValueAtTime(f * tr.index, t);
    mg.gain.setTargetAtTime(f * tr.index * 0.1, t, tr.decay);
    m.connect(mg).connect(o.frequency);
    m.start(t); m.stop(t + dur + 0.2);
  } else o.setPeriodicWave(wave(tr.wave));
  const sustain = tr.sustain ?? (tr.synth === 'fm' ? 0.3 : 1);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(tr.vol, t + 0.005);
  if (sustain < 1) g.gain.setTargetAtTime(tr.vol * sustain, t + 0.005, tr.decay / 3);
  g.gain.setTargetAtTime(0, t + dur, 0.02);
  o.connect(g).connect(dest);
  o.start(t); o.stop(t + dur + 0.2);
}

function click(dest, t, freq, vol) {
  const src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = noiseBuffer();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.015);
  src.connect(filter('highpass', freq)).connect(g).connect(dest);
  src.start(t, Math.random() * 0.9); src.stop(t + 0.03);
}

function drum(dest, kind, t, vol) {
  const g = ctx.createGain();
  g.connect(dest);
  if (kind === 'k') {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g); o.start(t); o.stop(t + 0.22);
    return;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer();
  const len = kind === 's' ? 0.14 : 0.04;
  g.gain.setValueAtTime(vol * (kind === 's' ? 0.6 : 0.25), t);
  g.gain.exponentialRampToValueAtTime(0.001, t + len);
  src.connect(kind === 's' ? filter('bandpass', 1800, 0.8) : filter('highpass', 7000)).connect(g);
  src.start(t, Math.random() * 0.8); src.stop(t + len + 0.02);
}
