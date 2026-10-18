// The adder layer's rules (no Phaser): the round counter's +1 as an 8-bit ripple-carry adder, played like Crossy
// Road. The counter holds 255 (11111111); you are the carry bit coming in at bit 0 and hop up through the 8 full-adder
// stages. Each stage: a CIN row (safe, the stage's checkpoint), wire lanes with signal pulses moving along them (a
// pulse touching you is a hit: back to the stage's CIN row), and a gate row with the full adder's five gates in a
// chip: gates whose output is 1 let you through, gates at 0 and the chip block. Reaching the next stage's CIN row
// flips the stage's sum bit to 0 (the carry ripples on); past bit 7 the carry falls out of the register: overflow,
// the byte wraps to 00000000. Numbers in ADDER (src/config.js), see design/systems/layer-adder.md.
//
// Rows count up from 0 (bit 0's CIN row, the start) to the OVERFLOW row at the top; x is the column, 0 at the left.

import { ADDER } from '../../config.js';

// Small seeded generator (mulberry32), so a seed gives the same board.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DIRS = { up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0] };
export const GATES = ['xor1', 'and1', 'xor2', 'and2', 'or'];
// What each gate is, for the labels: A and B are this bit of the counter and of the +1 (A = 1, B = 0, the +1 comes in
// as bit 0's carry), P = A XOR B, G = A AND B, S = P XOR CIN (the sum bit), COUT = G OR (P AND CIN).
export const GATE_NAMES = { xor1: 'P', and1: 'G', xor2: 'S', and2: 'PC', or: 'COUT' };
const LANE_NAMES = ['A', 'P', 'G', 'CIN'];

// A gate's output in a stage; cin is 1 once the carry has arrived there.
export function gateOut(gate, cin) {
  const A = 1, B = 0, P = A ^ B, G = A & B;
  return { xor1: P, and1: G, xor2: P ^ cin, and2: P & cin, or: G | (P & cin) }[gate];
}

const lerp = (a, b, k) => a + (b - a) * k;

// A new board and run. seed picks the lanes and gate positions.
export function createAdder(seed = 1, C = ADDER) {
  const random = rng(seed * 2654435761 + 11);
  const rows = [];
  for (let bit = 0; bit < C.bits; bit++) {
    const k = C.bits > 1 ? bit / (C.bits - 1) : 0;
    rows.push({ kind: 'cin', bit });
    let dir = random() < 0.5 ? 1 : -1;
    for (let i = 0; i < C.lanes[bit]; i++) {
      const speed = lerp(C.speed[0], C.speed[1], k) * (1 + (random() * 2 - 1) * C.speedJitter);
      const gmin = lerp(C.gap[0][0], C.gap[1][0], k), gmax = lerp(C.gap[0][1], C.gap[1][1], k);
      // Pulses around a loop at least as wide as the board plus the longest pulse, so one is always coming in.
      const pulses = [];
      let x = 0;
      while (x < C.cols + C.pulse[1] + gmin) {
        const len = Math.round(lerp(C.pulse[0], C.pulse[1], random()));
        pulses.push({ x, len });
        x += len + lerp(gmin, gmax, random());
      }
      rows.push({ kind: 'lane', bit, name: `${LANE_NAMES[i % LANE_NAMES.length]}${bit}`, dir, speed, pulses, loop: x, phase: random() * x });
      dir = -dir;
    }
    // The gate row: five gates on every other column (one of the six slots stays chip), in a shuffled order.
    const slots = [0, 2, 4, 6, 8, 10].map((s) => Math.round((s * (C.cols - 1)) / 10));
    slots.splice(Math.floor(random() * slots.length), 1);
    const order = [...GATES];
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const gates = {};
    slots.forEach((x, i) => { gates[x] = order[i]; });
    rows.push({ kind: 'gate', bit, gates });
  }
  rows.push({ kind: 'top' }); // the OVERFLOW row: the carry out of bit 7
  const st = {
    C, rows, t: 0, stage: 0, // stage: the bit the carry is at (C.bits once it's out)
    sum: Array(C.bits).fill(1), // the counter's bits, bit 0 first: 255 until the carry passes
    hits: 0, hitT: 0, won: false, events: [],
    p: { x: C.startCol, y: 0, fx: C.startCol, fy: 0, tx: C.startCol, ty: 0, hop: 0, queued: null, dir: 'up' },
  };
  st.checkpoint = 0;
  return st;
}

// Row index of a stage's CIN row (bit = C.bits gives the OVERFLOW row).
export function cinRow(st, bit) {
  return st.rows.findIndex((r) => (bit >= st.C.bits ? r.kind === 'top' : r.kind === 'cin' && r.bit === bit));
}

// Whether the carry can stand on (x, y).
export function open(st, x, y) {
  if (x < 0 || x >= st.C.cols || y < 0 || y >= st.rows.length) return false;
  const r = st.rows[y];
  if (r.kind !== 'gate') return true;
  const g = r.gates[x];
  return !!g && gateOut(g, cinOf(st, r.bit)) === 1;
}

// 1 once the carry has reached that stage.
export const cinOf = (st, bit) => (st.stage >= bit ? 1 : 0);

// The left edges of a lane's pulses now (tiles, may be off the board), with their lengths.
export function pulsesAt(row, t) {
  const out = [];
  for (const q of row.pulses) {
    let x = (q.x + row.phase + row.dir * row.speed * t) % row.loop;
    if (x < 0) x += row.loop;
    x -= q.len; // so a pulse slides in from off the board
    out.push({ x, len: q.len }); // the loop is wider than the board plus a pulse, so one copy covers it
  }
  return out;
}

// Whether a pulse covers the span [x0, x1] on row y at time t.
export function pulseHits(st, y, x0, x1, t) {
  const r = st.rows[y];
  if (!r || r.kind !== 'lane') return false;
  return pulsesAt(r, t).some((q) => q.x < x1 && q.x + q.len > x0);
}

// Ask for a hop ('up', 'down', 'left', 'right'); one more can wait while a hop is under way.
export function hop(st, dir) {
  if (st.won || st.hitT > 0 || !DIRS[dir]) return;
  if (st.p.hop > 0) st.p.queued = dir;
  else startHop(st, dir);
}

function startHop(st, dir) {
  const p = st.p, [dx, dy] = DIRS[dir];
  p.dir = dir;
  if (!open(st, p.x + dx, p.y + dy)) { st.events.push({ type: 'bump', dir }); return; }
  Object.assign(p, { fx: p.x, fy: p.y, tx: p.x + dx, ty: p.y + dy, hop: st.C.hopTime });
  st.events.push({ type: 'hop', dir });
}

// Where the carry is drawn: tile coordinates, mid-hop in between.
export function carryPos(st) {
  const p = st.p, k = p.hop > 0 ? 1 - p.hop / st.C.hopTime : 1;
  return { x: p.hop > 0 ? lerp(p.fx, p.tx, k) : p.x, y: p.hop > 0 ? lerp(p.fy, p.ty, k) : p.y, k, hopping: p.hop > 0 };
}

// Advance dt seconds. Returns this step's events: hop, bump, hit, respawn, stage (a sum bit flipped: { bit }),
// overflow (the carry left bit 7: the win).
export function stepAdder(st, dt) {
  const ev = st.events;
  st.t += dt;
  const p = st.p;
  if (st.won) return ev.splice(0);
  if (st.hitT > 0) {
    st.hitT -= dt;
    if (st.hitT <= 0) {
      Object.assign(p, { x: st.C.startCol, y: st.checkpoint, hop: 0, queued: null, dir: 'up' });
      ev.push({ type: 'respawn' });
    }
    return ev.splice(0);
  }
  if (p.hop > 0) {
    p.hop -= dt;
    // Halfway through a hop the carry counts as on the new tile.
    if (p.hop <= st.C.hopTime / 2) { p.x = p.tx; p.y = p.ty; }
    if (p.hop <= 0) {
      p.hop = 0;
      arrive(st);
      if (p.queued && !st.won) { const d = p.queued; p.queued = null; startHop(st, d); }
    }
  }
  // Hit: a pulse on the carry's row overlaps its hitbox.
  if (!st.won) {
    const c = carryPos(st), half = st.C.hitbox / 2, cx = c.x + 0.5;
    if (pulseHits(st, p.y, cx - half, cx + half, st.t)) {
      st.hits++;
      st.hitT = st.C.hitPause;
      p.queued = null;
      ev.push({ type: 'hit' });
    }
  }
  return ev.splice(0);
}

// The carry landed on a tile: a new stage's CIN row flips the stage below's sum bit and moves the checkpoint.
function arrive(st) {
  const r = st.rows[st.p.y];
  const bit = r.kind === 'top' ? st.C.bits : r.kind === 'cin' ? r.bit : -1;
  while (bit > st.stage) {
    st.sum[st.stage] = 0;
    st.events.push({ type: 'stage', bit: st.stage });
    st.stage++;
    st.checkpoint = st.p.y;
  }
  if (r.kind === 'top' && !st.won) { st.won = true; st.events.push({ type: 'overflow' }); }
}

// The counter as the register holds it now (bit 7 first), and its value.
export function byteString(st) { return [...st.sum].reverse().join(''); }
export function byteValue(st) { return st.sum.reduce((v, b, i) => v + (b << i), 0); }
