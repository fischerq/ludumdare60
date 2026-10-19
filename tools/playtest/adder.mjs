// The adder layer's bot (src/systems/layers/adder.js, design/systems/layer-adder.md): it sees the pulses and how
// they move (like a player watching the lanes) and plans hops a few seconds ahead in a time-expanded search over
// (column, row, time). Each hop also costs it its mean reaction time, since every swipe goes through the noisy hand
// (tools/playtest/noise.mjs): late, dropped or 90 degrees off. Hits only cost time, as in the game.

import { ADDER, PLAYTEST } from '../../src/config.js';
import { createAdder, stepAdder, hop, open, pulseHits } from '../../src/systems/layers/adder.js';
import { adderConfig } from '../../src/systems/layers/levels.js';

const DT = 1 / 60, Q = 0.05;        // s per search step
const HORIZON = 80, AHEAD = 7, BEHIND = 2, MARGIN = 0.15;
const MOVES = [['up', 0, 1], ['left', -1, 0], ['right', 1, 0], ['down', 0, -1]];

// The first hop of the best plan from the carry's tile, or null to wait. t0: when a swipe would land.
export function plan(st, t0, reaction) {
  const { x: px, y: py } = st.p, C = st.C, y0 = Math.max(0, py - BEHIND), y1 = Math.min(st.rows.length - 1, py + AHEAD);
  const half = C.hitbox / 2 + MARGIN, hopK = Math.ceil(C.hopTime / Q), restK = Math.max(1, Math.round(reaction / Q));
  // safe[y][x][k]: no pulse on tile (x, y) during step k.
  const safe = {};
  for (let y = y0; y <= y1; y++) {
    safe[y] = [];
    for (let x = 0; x < C.cols; x++) {
      const a = new Uint8Array(HORIZON + hopK + restK + 1);
      for (let k = 0; k < a.length; k++) {
        const t = t0 + k * Q;
        a[k] = !pulseHits(st, y, x + 0.5 - half, x + 0.5 + half, t) && !pulseHits(st, y, x + 0.5 - half, x + 0.5 + half, t + Q) ? 1 : 0;
      }
      safe[y][x] = a;
    }
  }
  const ok = (x, y, k0, k1) => { for (let k = k0; k <= k1; k++) if (!safe[y][x][k]) return false; return true; };
  const key = (x, y, k) => (k * 64 + y) * 16 + x;
  const seen = new Map([[key(px, py, 0), null]]);
  let frontier = [[px, py, 0, null]], best = null;
  const score = (n) => n[1] * 1000 + n[2]; // highest row, then the longest survival
  while (frontier.length) {
    const next = [];
    for (const n of frontier) {
      const [x, y, k, first] = n;
      if (!best || score(n) > score(best)) best = n;
      if (k >= HORIZON) continue;
      // Wait one step.
      if (ok(x, y, k, k + 1) && !seen.has(key(x, y, k + 1))) { seen.set(key(x, y, k + 1), 1); next.push([x, y, k + 1, first ?? 'wait']); }
      for (const [d, dx, dy] of MOVES) {
        const nx = x + dx, ny = y + dy, nk = k + hopK + (k === 0 ? 0 : restK);
        if (ny < y0 || ny > y1 || !open(st, nx, ny) || nk > HORIZON) continue;
        // Half the hop on the old tile, the rest (and the time to react before the next swipe) on the new one.
        if (!ok(x, y, k, k + Math.ceil(hopK / 2)) || !ok(nx, ny, k + Math.floor(hopK / 2), nk + 1)) continue;
        const kk = key(nx, ny, nk);
        if (seen.has(kk)) continue;
        seen.set(kk, 1);
        next.push([nx, ny, nk, first ?? d]);
      }
    }
    frontier = next.sort((a, b) => a[2] - b[2]);
    if (frontier.length > 4000) frontier.length = 4000;
  }
  return best && best[3] !== 'wait' ? best[3] : null;
}

// One run: the bot plays until the carry overflows or the time cap. s: a playtest session (seeded hand and random);
// level: the adder's level (src/systems/layers/levels.js).
export function runAdder(s, level = 1) {
  const st = createAdder(s.seed, adderConfig(level));
  const reaction = s.noise.reaction; // its mean (the hand jitters it by +-50%)
  let result = 'timeout', hops = 0;
  const t0 = s.t;
  while (st.t < PLAYTEST.timeCap.deep) {
    let want = null;
    if (st.hitT <= 0 && st.p.hop <= 0 && !s.hand.pending.length) want = plan(st, st.t + reaction, reaction);
    for (const d of s.hand.update(s.t, DT, want, () => false)) { hop(st, d); hops++; s.hand.intent = null; }
    for (const e of stepAdder(st, DT)) if (e.type === 'overflow') result = 'win';
    s.t += DT;
    if (result === 'win') break;
  }
  return { win: result === 'win', result, time: s.t - t0, hits: st.hits, goals: st.stage, hops };
}
