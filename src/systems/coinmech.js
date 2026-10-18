// The coin mechanism behind the cabinet's coin door (pure, no Phaser; numbers in CABINET.coinMech).
// The coin is flicked into the slot, rolls down the track and rests on two ledges. A tap rolls it on from a
// ledge: past the reject arm (swings across the track) and past the slug magnet (pulses on and off). Touching
// either while it's active knocks the coin into the coin return (no coin lost, try again). Reaching the end it
// presses the coin switch: the scene sends the pulse down the wire and spends the coin.
//
// Phases: hand -> drop -> roll <-> hold -> switch (done) ; any roll can end in reject -> returned -> hand.

const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

export function createMech(P, phase0 = 0) {
  const lens = [0];
  for (let i = 1; i < P.track.length; i++) lens.push(lens[i - 1] + dist(P.track[i - 1], P.track[i]));
  return {
    phase: 'hand', t: 0, clock: phase0, s: 0, lens, stop: 0, fail: null, from: null, tries: 0,
    // Distance along the track of each obstacle: the point on the track closest to it.
    armS: closestS(P.track, lens, P.arm), magnetS: closestS(P.track, lens, P.magnet),
  };
}

function closestS(track, lens, p) {
  let best = 0, bestD = Infinity;
  for (let i = 1; i < track.length; i++) {
    const [ax, ay] = track[i - 1], [bx, by] = track[i];
    const L = lens[i] - lens[i - 1];
    for (let k = 0; k <= 20; k++) {
      const x = ax + (bx - ax) * k / 20, y = ay + (by - ay) * k / 20, d = Math.hypot(x - p.x, y - p.y);
      if (d < bestD) { bestD = d; best = lens[i - 1] + L * k / 20; }
    }
  }
  return best;
}

const frac = (m, period, offset = 0) => (((m.clock / period + offset) % 1) + 1) % 1;

// 'out' blocks the track; 'warn' is the moment before and after (harmless, a heads-up); 'in' is clear.
export function armState(m, P) {
  const A = P.arm, f = frac(m, A.period, A.offset ?? 0);
  if (f < A.block) return 'out';
  if (f < A.block + A.warn || f > 1 - A.warn) return 'warn';
  return 'in';
}

export function magnetState(m, P) {
  const G = P.magnet, f = frac(m, G.period, G.offset ?? 0);
  if (f < G.on) return 'on';
  if (f > 1 - G.warn) return 'warn';
  return 'off';
}

// The coin's center in mech art px.
export function coinPos(m, P) {
  if (m.phase === 'returned') return { x: P.cup.x, y: P.cup.y };
  if (m.phase === 'hand') {
    return { x: P.hand.x, y: P.hand.y + Math.round(Math.sin(m.clock * 5) * P.handBob) };
  }
  if (m.phase === 'drop') {
    const k = Math.min(1, m.t / P.dropTime), [x, y] = P.track[0];
    return { x: P.hand.x + (x - P.hand.x) * k, y: P.hand.y + (y - P.hand.y) * k * k };
  }
  if (m.phase === 'reject') {
    // Off the track and down into the coin return: across quickly, then a fall.
    const k = Math.min(1, m.t / P.rejectTime), a = m.from;
    return { x: a.x + (P.cup.x - a.x) * k, y: a.y + (P.cup.y - a.y) * k * k };
  }
  return pointAt(m, P, m.s);
}

function pointAt(m, P, s) {
  const { track } = P, { lens } = m;
  for (let i = 1; i < track.length; i++) {
    if (s <= lens[i] || i === track.length - 1) {
      const k = Math.max(0, Math.min(1, (s - lens[i - 1]) / (lens[i] - lens[i - 1])));
      return { x: track[i - 1][0] + (track[i][0] - track[i - 1][0]) * k, y: track[i - 1][1] + (track[i][1] - track[i - 1][1]) * k };
    }
  }
  return { x: track[0][0], y: track[0][1] };
}

// The player's tap or flick. Returns an event name, or null if it did nothing.
export function tapMech(m, P) {
  if (m.phase === 'hand') { m.phase = 'drop'; m.t = 0; m.tries++; return 'drop'; }
  if (m.phase === 'hold') { m.phase = 'roll'; m.t = 0; m.stop++; return 'release'; }
  return null;
}

// Advance dt seconds; returns the events that happened ('hold', 'reject-arm', 'reject-magnet', 'return',
// 'retry', 'switch').
export function stepMech(m, dt, P) {
  const ev = [];
  m.clock += dt;
  m.t += dt;
  if (m.phase === 'drop' && m.t >= P.dropTime) { m.phase = 'roll'; m.s = 0; m.stop = 0; m.t = 0; }
  if (m.phase === 'roll') {
    const end = m.stop < P.stops.length ? m.lens[P.stops[m.stop]] : m.lens[m.lens.length - 1];
    m.s = Math.min(end, m.s + P.speed * dt);
    const hit = (s, zone) => Math.abs(m.s - s) <= zone;
    let fail = null;
    if (hit(m.armS, P.arm.zone) && armState(m, P) === 'out') fail = 'arm';
    else if (hit(m.magnetS, P.magnet.zone) && magnetState(m, P) === 'on') fail = 'magnet';
    if (fail) {
      m.fail = fail; m.from = coinPos(m, P); m.phase = 'reject'; m.t = 0;
      ev.push(`reject-${fail}`);
    } else if (m.s >= end) {
      if (m.stop < P.stops.length) { m.phase = 'hold'; ev.push('hold'); } else { m.phase = 'switch'; m.t = 0; ev.push('switch'); }
    }
  } else if (m.phase === 'reject' && m.t >= P.rejectTime) {
    m.phase = 'returned'; m.t = 0; ev.push('return');
  } else if (m.phase === 'returned' && m.t >= P.retryDelay) {
    m.phase = 'hand'; m.t = 0; m.fail = null; ev.push('retry');
  }
  return ev;
}
