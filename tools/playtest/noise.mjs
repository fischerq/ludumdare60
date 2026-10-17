// The noise model: turns a bot's perfect decisions into what a thumb on a phone does with them. The bot says
// which direction it wants every frame; the hand swipes (or holds the stick) late, sometimes not at all,
// sometimes 90 degrees off, and now and then stops paying attention. Numbers in PLAYTEST.noise (src/config.js).

import { PLAYTEST } from '../../src/config.js';

// Small seeded generator (mulberry32), so a run with the same seed plays out the same way.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SIDE = { up: ['left', 'right'], down: ['left', 'right'], left: ['up', 'down'], right: ['up', 'down'] };

// The noise knobs at a level (0..1). knob 'all' scales every knob; 'reaction', 'slip' (drop + wrong) or 'lapse'
// scales only that one and leaves the others at zero.
export function noiseAt(level, knob = 'all') {
  const N = PLAYTEST.noise, on = (k) => (knob === 'all' || knob === k ? level : 0);
  return {
    reaction: N.reaction * on('reaction'),
    drop: N.drop * on('slip'), wrong: N.wrong * on('slip'),
    lapseRate: N.lapseRate * on('lapse'), lapseTime: N.lapseTime,
  };
}

// update(t, dt, want, taken) returns the swipes that land this frame (an array of directions).
// want: the bot's direction now (or null); taken(dir): whether the game already does what the bot wants,
// so a dropped or wrong swipe gets noticed and swiped again after another reaction time.
export function createHand(noise, random) {
  const h = { pending: [], intent: null, issued: -99, lapseUntil: -1, swipes: 0, slips: 0 };
  const reaction = () => noise.reaction * (0.5 + random());
  h.update = (t, dt, want, taken) => {
    if (noise.lapseRate && t >= h.lapseUntil && random() < noise.lapseRate * dt) h.lapseUntil = t + noise.lapseTime;
    if (want && t >= h.lapseUntil) {
      const retry = want === h.intent && !taken(want) && t - h.issued > noise.reaction + 0.25;
      if (want !== h.intent || retry) {
        h.intent = want;
        h.issued = t;
        // One swipe at a time: a thumb already on its way just changes direction, it doesn't queue a second one.
        if (h.pending.length) h.pending[0].dir = want;
        else h.pending.push({ at: t + reaction(), dir: want });
      }
    }
    const out = [];
    while (h.pending.length && h.pending[0].at <= t) {
      const { dir } = h.pending.shift();
      const r = random();
      h.swipes++;
      if (r < noise.drop) { h.slips++; continue; }
      if (r < noise.drop + noise.wrong && SIDE[dir]) { h.slips++; out.push(SIDE[dir][random() < 0.5 ? 0 : 1]); continue; }
      out.push(dir);
    }
    return out;
  };
  return h;
}
