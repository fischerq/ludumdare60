// The live page: the machine as it is right now, drawn like a magic map. Everything is read from the
// running machine (registers, memory, the bus log, inputs, the program's RAM), MANUAL.liveHz times a second,
// detailed enough to debug the emulator: ?manual opens it straight away.
import { MANUAL } from '../config.js';
import { world, onFrame, requestTrace } from '../systems/arcade/world.js';
import { MAP, IN0, IN1, DSW, CELL, tileOffset, region } from '../systems/arcade/memmap.js';
import { BUS } from '../systems/arcade/machine.js';
import { readState, PHASES } from '../systems/arcade/state.js';
import { W, H, spriteArt } from '../systems/arcade/video.js';

const C = MANUAL.colors, PRINT = MANUAL.print;
const hex = (n, d = 4) => n.toString(16).toUpperCase().padStart(d, '0');
const DX = { up: 0, left: -1, down: 0, right: 1 }, DY = { up: -1, left: 0, down: 1, right: 0 };
const GHOST_INK = { blinky: '#b02020', pinky: '#c0508a', inky: '#11807a', clyde: '#c06a10' };
const TRAIL = 8;       // footprints kept per actor
const TRACE_EVERY = 1; // s between profiles of a frame's instructions
const TRACE_MAX = 6000;
const GHOST_NAMES = ['blinky', 'pinky', 'inky', 'clyde'];
// The last real readings, kept across visits: a stopped board (game over) runs no frames, so there is nothing new
// to sample or measure until a coin goes in.
const last = { sample: null, prof: null };

export const livePage = {
  title: '10. The live page',
  html: `<p><i>Everything below is read from the running board, ${MANUAL.liveHz} times a second.</i></p>
    <div class="live-head"><h2>The board, right now</h2><button class="live-hold">❚❚ freeze</button></div>
    <div class="live-status"></div>
    <canvas class="live-map" style="width:100%;image-rendering:auto"></canvas>
    <p class="fig">Walls and dots from video RAM, everyone at their position in work RAM. ✕ is the tile each ghost
      last aimed for, as the program wrote it (TGT_X, TGT_Y in ghost_target).</p>
    <h2>The game state</h2><div class="live-game"></div>
    <h2>The actors</h2><div class="live-actors"></div>
    <h2>The Z80</h2><div class="live-cpu"></div>
    <h2>Where the time goes</h2><div class="live-prof"></div>
    <h2>Memory, last frame</h2><canvas class="live-heat" style="width:100%"></canvas>
    <p class="fig">The 64 KB address space in 256-byte pages, row by row from 0x0000: a blue dot for reads, red for writes, bigger = busier.</p>
    <div class="live-regions"></div>
    <h2>The bus, latest cycles</h2><div class="live-bus"></div>
    <h2>Sprites</h2><div class="live-sprites"></div>
    <h2>The input wires</h2><div class="live-input"></div>
    <h2>Sound commands</h2><div class="live-sound"></div>`,
  mount(body) {
    const q = (s) => body.querySelector(s);
    const map = q('.live-map'), heat = q('.live-heat');
    const st = { hold: false, trails: new Map(), sounds: [], lastTrace: 0, routines: null, targets: [], hooked: null };
    q('.live-hold').onclick = (e) => {
      st.hold = !st.hold;
      e.target.textContent = st.hold ? '▶ resume' : '❚❚ freeze';
      e.target.classList.toggle('on', st.hold);
    };
    const offFrame = onFrame((m, sounds) => {
      for (const s of sounds) st.sounds.push(s);
      st.sounds.splice(0, Math.max(0, st.sounds.length - 8));
    });
    // The ghosts' targets as the program computes them: ghost_target writes TGT_X then TGT_Y with IX on the ghost.
    const hook = (addr, value, kind) => {
      const m = world.machine, S = world.program.symbols;
      if (addr !== S.TGT_Y || !(kind & BUS.write) || kind & BUS.io) return;
      const id = m.read(m.cpu.getState().ix + S.A_ID);
      st.targets[id] = { x: (m.read(S.TGT_X) << 24) >> 24, y: (value << 24) >> 24, frame: m.frame };
    };
    const tick = () => {
      if (st.hold) return;
      const m = world.machine, S = world.program?.symbols;
      if (!m || !S) { q('.live-status').textContent = 'The machine is still warming up…'; return; }
      if (st.hooked !== m) { m.hooks.push(hook); st.hooked = m; }
      st.routines ??= routineMap(world.program.listing);
      const now = performance.now() / 1000;
      if (now - st.lastTrace > TRACE_EVERY && !world.trace && !world.halted && !world.paused) {
        st.lastTrace = now;
        requestTrace(TRACE_MAX, (steps) => { last.prof = profile(steps, st.routines); });
      }
      const g = readState(m, S);
      drawStatus(q('.live-status'), m);
      drawMap(map, m, S, g, st);
      drawGame(q('.live-game'), m, S);
      drawActors(q('.live-actors'), g, st.targets);
      if (m.sample) last.sample = m.sample;
      drawCpu(q('.live-cpu'), m, world.program.listing, st.routines);
      drawProfile(q('.live-prof'), last.prof ?? busProfile(m, st.routines));
      drawHeat(heat, q('.live-regions'), m);
      drawBus(q('.live-bus'), m);
      drawSprites(q('.live-sprites'), m);
      drawInput(q('.live-input'), m);
      q('.live-sound').innerHTML = st.sounds.length
        ? table(['frame', 'command'], st.sounds.slice().reverse().map((s) => [s.frame, s.name])) : '<p>(none yet)</p>';
      // The next look at the CPU: somewhere in the part of the frame where it works.
      m.sampleAt = Math.floor(Math.random() * Math.max(1, m.busy));
    };
    tick();
    const timer = setInterval(tick, 1000 / MANUAL.liveHz);
    return {
      stop: () => {
        clearInterval(timer); offFrame();
        if (st.hooked) { st.hooked.hooks.splice(st.hooked.hooks.indexOf(hook) >>> 0, 1); st.hooked.sampleAt = null; }
      },
    };
  },
};

// ---- the panels ---------------------------------------------------------------------------------------------------
// One cell per value: numbers right-aligned in the mono face, so columns line up from one update to the next.
const table = (head, rows) => `<div class="live-t"><table class="live">${head ? `<tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr>` : ''}${rows
  .map((r) => `<tr>${r.map((c) => `<td${typeof c === 'number' ? ' class="n"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</table></div>`;
const mono = (s) => `<span class="mono">${s}</span>`;

function drawStatus(el, m) {
  const state = world.halted ? 'STOPPED (waiting for a coin)' : world.paused ? 'PAUSED' : 'RUNNING';
  // A grid of small fields that wraps onto more rows on a narrow page, the board's state across the top.
  const field = (k, v, wide) => `<div${wide ? ' class="wide"' : ''}><span>${k}</span><b>${v}</b></div>`;
  el.innerHTML = `<div class="live-kv">${field('board', state, true)}${field('frame', m.frame)}
    ${field('joystick', world.driver === 'bot' ? 'autopilot' : 'player')}${field('speed', `${world.speed}×`)}
    ${field('CPU busy', `${Math.round((m.busy / m.frameCycles) * 100)}% <small>(${m.busy} of ${m.frameCycles} cycles)</small>`, true)}</div>`;
}

// ---- the map ------------------------------------------------------------------------------------------------------
// Drawn like a plan from an office printer of the time: walls as hatched blocks with an outline where they meet the
// corridors, one ink plus a spot color per ghost, lines that wobble a little and ink that drops out in specks.
const wob = (x, y, k = 0) => { // a fixed small offset per grid corner, so outlines meet and never shimmer
  const h = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453;
  return (h - Math.floor(h) - 0.5) * PRINT.wobble;
};

function hatch(ctx, ink) {
  const p = document.createElement('canvas');
  p.width = p.height = PRINT.hatch * 2;
  const c = p.getContext('2d');
  c.strokeStyle = ink;
  c.lineWidth = 1;
  c.beginPath();
  for (let k = -1; k <= 2; k++) { c.moveTo(k * PRINT.hatch - 1, PRINT.hatch * 2 + 1); c.lineTo(k * PRINT.hatch + PRINT.hatch * 2 + 1, -1); }
  c.stroke();
  return ctx.createPattern(p, 'repeat');
}

// Specks where the ink didn't take: knocked out of whatever was drawn, the same specks every update.
const grains = new Map();
function dropout(ctx, w, h) {
  const key = `${w}x${h}`;
  if (!grains.has(key)) {
    const g = document.createElement('canvas');
    g.width = w; g.height = h;
    const gc = g.getContext('2d'), img = gc.createImageData(w, h);
    let seed = 60;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
    for (let i = 0; i < w * h; i++) img.data[i * 4 + 3] = rnd() < PRINT.dropout ? 90 + rnd() * 165 : 0;
    gc.putImageData(img, 0, 0);
    grains.set(key, g);
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.drawImage(grains.get(key), 0, 0);
  ctx.restore();
}

function drawMap(cv, m, S, g, st) {
  const T = 16, dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== W * T * dpr) { cv.width = W * T * dpr; cv.height = H * T * dpr; }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W * T, H * T);
  st.hatch ??= hatch(ctx, 'rgba(43,33,23,0.55)');
  const wall = (x, y) => x >= 0 && y >= 0 && x < W && y < H && m.vram[tileOffset(x, y)] >= CELL.wall;
  const pt = (x, y) => [x * T + wob(x, y), y * T + wob(x, y, 1)];
  // Walls, read straight from VRAM: hatched, outlined only along the corridors.
  ctx.fillStyle = st.hatch;
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (wall(x, y)) ctx.fillRect(x * T, y * T, T, T);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!wall(x, y)) continue;
      const edge = (x1, y1, x2, y2) => { ctx.moveTo(...pt(x1, y1)); ctx.lineTo(...pt(x2, y2)); };
      if (!wall(x, y - 1)) edge(x, y, x + 1, y);
      if (!wall(x, y + 1)) edge(x, y + 1, x + 1, y + 1);
      if (!wall(x - 1, y)) edge(x, y, x, y + 1);
      if (!wall(x + 1, y)) edge(x + 1, y, x + 1, y + 1);
    }
  }
  ctx.stroke();
  // Dots as specks, power pellets as a ringed dot, the house door in red.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = m.vram[tileOffset(x, y)], cx = x * T + T / 2, cy = y * T + T / 2;
      if (c === CELL.dot || c === CELL.power) {
        ctx.fillStyle = C.ink;
        ctx.beginPath();
        ctx.arc(cx, cy, c === CELL.power ? 2.5 : 1.4, 0, Math.PI * 2);
        ctx.fill();
        if (c === CELL.power) { ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.stroke(); }
      } else if (c === CELL.door) {
        ctx.strokeStyle = C.accent;
        ctx.beginPath();
        ctx.moveTo(x * T, cy - 1.5); ctx.lineTo(x * T + T, cy - 1.5); ctx.moveTo(x * T, cy + 1.5); ctx.lineTo(x * T + T, cy + 1.5);
        ctx.stroke();
        ctx.strokeStyle = C.ink;
      }
    }
  }
  const actors = [{ name: 'pac-man', ink: C.ink, ...g.pac }, ...g.ghosts.map((gh) => ({ ...gh, ink: GHOST_INK[gh.name] }))];
  for (const a of actors) {
    // A few footsteps: where it was on earlier updates, fading.
    const tr = st.trails.get(a.name) ?? [];
    const lastStep = tr[tr.length - 1];
    if (!lastStep || Math.hypot(lastStep.x - a.x, lastStep.y - a.y) > 0.4) tr.push({ x: a.x, y: a.y, dir: a.dir });
    if (tr.length > TRAIL) tr.shift();
    st.trails.set(a.name, tr);
    tr.forEach((p, i) => {
      ctx.globalAlpha = (i / tr.length) * 0.45;
      ctx.fillStyle = a.ink;
      const side = i % 2 ? 2.5 : -2.5, ox = (DY[p.dir] ?? 0) * side, oy = (DX[p.dir] ?? 0) * side;
      ctx.beginPath();
      ctx.ellipse(p.x * T + T / 2 + ox, p.y * T + T / 2 + oy, 1, 1.6, Math.atan2(DY[p.dir] ?? 1, DX[p.dir] ?? 0) + Math.PI / 2, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    // Targets: where the rules send each ghost.
    const tg = a.name !== 'pac-man' ? target(a, st.targets[GHOST_NAMES.indexOf(a.name)]) : null;
    if (tg) {
      ctx.strokeStyle = a.ink;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(a.x * T + T / 2, a.y * T + T / 2);
      ctx.lineTo(tg.x * T + T / 2, tg.y * T + T / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 2;
      const cx = tg.x * T + T / 2, cy = tg.y * T + T / 2;
      ctx.beginPath(); ctx.moveTo(cx - 4, cy - 4); ctx.lineTo(cx + 4, cy + 4); ctx.moveTo(cx + 4, cy - 4); ctx.lineTo(cx - 4, cy + 4); ctx.stroke();
    }
    // The figure itself (Pac-Man a wedge facing his way, ghosts a little ghost; afraid ones only outlined in blue).
    const px = a.x * T + T / 2, py = a.y * T + T / 2;
    ctx.fillStyle = ctx.strokeStyle = a.frightened ? C.blue : a.ink;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    if (a.name === 'pac-man') {
      const ang = Math.atan2(DY[a.dir] ?? 0, DX[a.dir] ?? 1);
      ctx.moveTo(px, py);
      ctx.arc(px, py, 6, ang + 0.6, ang - 0.6 + Math.PI * 2);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.arc(px, py - 1, 5, Math.PI, 0);
      ctx.lineTo(px + 5, py + 5);
      for (let k = 1; k <= 4; k++) ctx.lineTo(px + 5 - k * 2.5, py + (k % 2 ? 3 : 5));
      ctx.closePath();
      if (a.frightened) ctx.stroke(); else ctx.fill();
    }
    // The name lettered next to it, knocked out of the hatching by a paper halo.
    ctx.font = `bold 10px ${MANUAL.font}`;
    const label = a.name === 'pac-man' ? 'PAC-MAN' : `${a.name.toUpperCase()}${a.frightened ? ' (afraid)' : a.state !== 'active' ? ` (${a.state})` : ''}`;
    const w = ctx.measureText(label).width;
    const lx = Math.max(1, Math.min(W * T - w - 1, px - w / 2)), ly = py - 10 < 10 ? py + 18 : py - 10;
    ctx.lineWidth = 3.5;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = C.paper;
    ctx.strokeText(label, lx, ly);
    ctx.fillStyle = a.ink;
    ctx.fillText(label, lx, ly);
  }
  ctx.lineWidth = 1;
  dropout(ctx, cv.width, cv.height);
}

// The target the program last wrote for a ghost, while it's one the ghost is following (active and not
// frightened, or eyes going home).
function target(gh, tg) {
  if (!tg || gh.frightened || (gh.state !== 'active' && gh.state !== 'eyes')) return null;
  return tg;
}

// Work RAM by the program's own symbols: [name, bytes, how to show the value].
const GAME_VARS = [
  ['FRAME', 2], ['PHASE', 1, (v) => PHASES[v] ?? '?'], ['PHASE_T', 2, (v) => (v ? `${secs(v)} s` : '—')],
  ['SCORE', 2], ['LIVES_LEFT', 1], ['PELLETS', 2], ['LEVEL', 1, (v) => `level ${v + 1}`],
  ['MODE_I', 1, (v) => (v & 1 ? 'chase' : 'scatter')], ['MODE_T', 2, (v) => (v ? `${secs(v)} s` : 'forever')],
  ['FRIGHT', 2, (v) => (v ? `${secs(v)} s` : '—')], ['FREEZE', 1], ['COMBO', 1], ['EATEN', 1, (v) => (v === 0xff ? 'none' : GHOST_NAMES[v - 1] ?? v)],
  ['RNG', 1], ['TGT_X', 1, (v) => (v << 24) >> 24], ['TGT_Y', 1, (v) => (v << 24) >> 24],
];
const secs = (frames) => (frames / 60.6).toFixed(1);

function drawGame(el, m, S) {
  el.innerHTML = table(['variable', 'addr', 'hex', 'value'], GAME_VARS.map(([name, n, show]) => {
    const v = n === 2 ? m.read(S[name]) | (m.read(S[name] + 1) << 8) : m.read(S[name]);
    return [name, mono(hex(S[name])), mono(hex(v, n * 2)), show ? show(v) : v];
  }));
}

function drawActors(el, g, targets) {
  const row = (name, a, tg) => [name, a.x.toFixed(2), a.y.toFixed(2), a.dir ?? '—', a.next ?? '—', a.state ?? '—',
    a.frightened ? 'yes' : '—', a.corner ? `${a.corner.x}, ${a.corner.y}` : '—', tg ? `${tg.x}, ${tg.y}` : '—'];
  el.innerHTML = table(['who', 'x', 'y', 'dir', 'next', 'state', 'afraid', 'corner', 'target'], [
    row('Pac-Man', { ...g.pac, state: null, corner: null }),
    ...g.ghosts.map((gh, i) => row(gh.name, { ...gh, next: null }, targets[i])),
  ]);
}

function drawCpu(el, m, listing, routines) {
  // The newest look at the CPU mid-frame; none yet (the board stopped before this page opened) → the CPU as it
  // sits now, asleep on HALT after its last frame.
  const smp = m.sample ?? last.sample ?? { frame: m.frame, cycle: m.busy, cpu: m.cpu.getState(), asleep: true };
  const c = smp.cpu, f = c.flags, f2 = c.flags_prime ?? {};
  const h2 = (v) => mono(hex(v ?? 0, 2)), h4 = (v) => mono(hex(v ?? 0));
  const bit = (v) => `<span style="${v ? `color:${C.accent};font-weight:700` : 'opacity:0.4'}">${v ? 1 : 0}</span>`;
  // The source lines around PC (the program's own listing, as the board assembled it).
  const at = listing.findIndex((l) => l.addr === c.pc && l.bytes.length);
  const around = at < 0 ? [] : listing.slice(Math.max(0, at - 3), at + 4);
  const stopped = world.halted ? ' The board is stopped, so this is the last moment it ran.' : '';
  el.innerHTML = `<p style="font-size:13px">${smp.asleep
    ? `The CPU after frame ${smp.frame}, asleep on HALT in <b>${routineAt(routines, c.pc)}</b>.${stopped}`
    : `The CPU caught in the middle of frame ${smp.frame}, at cycle ${smp.cycle} of ${m.frameCycles}, in
      <b>${routineAt(routines, c.pc)}</b>. A new moment every update; after its work each frame it sleeps on HALT
      until the next vblank.${stopped}`}</p>`
    + table(['', 'A', 'F', 'B', 'C', 'D', 'E', 'H', 'L'], [
      ['main', h2(c.a), h2(flagsByte(f)), h2(c.b), h2(c.c), h2(c.d), h2(c.e), h2(c.h), h2(c.l)],
      ["shadow", h2(c.a_prime), h2(flagsByte(f2)), h2(c.b_prime), h2(c.c_prime), h2(c.d_prime), h2(c.e_prime), h2(c.h_prime), h2(c.l_prime)],
    ])
    + table(['PC', 'SP', 'IX', 'IY', 'I', 'R'], [[`<b>${h4(c.pc)}</b>`, h4(c.sp), h4(c.ix), h4(c.iy), h2(c.i), h2(c.r)]])
    + table(['S', 'Z', 'Y', 'H', 'X', 'P/V', 'N', 'C'], [['S', 'Z', 'Y', 'H', 'X', 'P', 'N', 'C'].map((k) => bit(f[k]))])
    + table(['IM', 'IFF1', 'IFF2', 'halted'], [[c.imode, bit(c.iff1), bit(c.iff2), c.halted ? 'yes' : 'no']])
    + `<div class="mono" style="font-size:12px;white-space:pre;overflow-x:auto;background:rgba(43,33,23,0.06);padding:4px">${around.map((l) =>
      `<span style="${l === listing[at] ? `background:rgba(154,42,26,0.2);font-weight:700` : ''}">${hex(l.addr)}  ${escapeHtml(l.source)}</span>`).join('\n') || '(PC outside the listing)'}</div>`;
}

const flagsByte = (f) => (f.S << 7) | (f.Z << 6) | (f.Y << 5) | (f.H << 4) | (f.X << 3) | (f.P << 2) | (f.N << 1) | f.C;
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// Address → the routine (nearest label above it in the listing).
function routineMap(listing) {
  const out = [];
  let name = 'start';
  for (const l of listing) {
    const lab = /^([A-Za-z_]\w*):/.exec(l.source);
    if (lab) name = lab[1];
    if (l.bytes.length) out.push([l.addr, name]);
  }
  out.sort((a, b) => a[0] - b[0]);
  return out;
}
function routineAt(map, pc) {
  let lo = 0, hi = map.length - 1, best = '?';
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (map[mid][0] <= pc) { best = map[mid][1]; lo = mid + 1; } else hi = mid - 1;
  }
  return best;
}
function profile(steps, map) {
  const counts = new Map();
  for (const s of steps) { const r = routineAt(map, s.pc); counts.set(r, (counts.get(r) ?? 0) + 1); }
  return { total: steps.length, top: [...counts].sort((a, b) => b[1] - a[1]).slice(0, 10) };
}
// Until a frame has been traced: the program bytes the CPU read in the last frame (its opcodes, plus a few tables),
// by routine, from the bus log. A stopped board keeps that log, so this always has the last frame that ran.
function busProfile(m, map) {
  const r = m.frameRange(0);
  if (!r) return null;
  const counts = new Map(), N = m.busAddr.length;
  let total = 0;
  for (let i = r.from; i < r.to; i++) {
    const j = i % N, a = m.busAddr[j];
    if (m.busKind[j] || a > MAP.rom[1]) continue; // reads from the ROM only
    const n = routineAt(map, a);
    counts.set(n, (counts.get(n) ?? 0) + 1);
    total++;
  }
  return total ? { total, top: [...counts].sort((a, b) => b[1] - a[1]).slice(0, 10), bytes: true } : null;
}
function drawProfile(el, prof) {
  if (!prof) { el.innerHTML = '<p>(no frame has run since the machine powered on)</p>'; return; }
  const max = prof.top[0]?.[1] ?? 1;
  el.innerHTML = `<p style="font-size:13px">${prof.bytes ? 'Program bytes read in the last frame' : 'Instructions in one recent frame'},
      by routine (${prof.total} in all${!prof.bytes && prof.total >= TRACE_MAX ? '+' : ''}):</p>`
    + table(['routine', prof.bytes ? 'bytes' : 'instr', '%', ''], prof.top.map(([n, k]) => [n, k, Math.round((k / prof.total) * 100),
      `<span class="bar" style="width:${(k / max) * 100}%"></span>`]));
}

function drawHeat(cv, el, m) {
  const cell = 20, dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== 16 * cell * dpr) { cv.width = 16 * cell * dpr; cv.height = 16 * cell * dpr; }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const reads = new Uint32Array(256), writes = new Uint32Array(256), byRegion = {};
  const r = m.frameRange(0);
  if (r) {
    const N = m.busAddr.length;
    for (let i = r.from; i < r.to; i++) {
      const j = i % N, k = m.busKind[j];
      if (k & BUS.io) continue;
      const a = m.busAddr[j], page = a >> 8, reg = region(a);
      byRegion[reg] ??= [0, 0];
      if (k & BUS.write) { writes[page]++; byRegion[reg][1]++; } else { reads[page]++; byRegion[reg][0]++; }
    }
  }
  // Halftone: a dot per page whose size says how busy it was, reads in blue ink, writes in red printed a touch
  // off register, like a two-color job.
  const maxR = Math.max(1, ...reads), maxW = Math.max(1, ...writes);
  ctx.clearRect(0, 0, 16 * cell, 16 * cell);
  ctx.strokeStyle = 'rgba(43,33,23,0.35)';
  ctx.setLineDash([1, 2]);
  ctx.beginPath();
  for (let k = 0; k <= 16; k++) { ctx.moveTo(k * cell + 0.5, 0); ctx.lineTo(k * cell + 0.5, 16 * cell); ctx.moveTo(0, k * cell + 0.5); ctx.lineTo(16 * cell, k * cell + 0.5); }
  ctx.stroke();
  ctx.setLineDash([]);
  const dot = (x, y, f, ink) => { ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(x, y, 1.2 + 6.5 * Math.sqrt(f), 0, Math.PI * 2); ctx.fill(); };
  ctx.globalCompositeOperation = 'multiply';
  for (let p = 0; p < 256; p++) {
    const x = (p % 16) * cell, y = Math.floor(p / 16) * cell;
    if (reads[p]) dot(x + cell * 0.42, y + cell * 0.45, reads[p] / maxR, C.blue);
    if (writes[p]) dot(x + cell * 0.6, y + cell * 0.58, writes[p] / maxW, C.accent);
  }
  ctx.globalCompositeOperation = 'source-over';
  dropout(ctx, cv.width, cv.height);
  el.innerHTML = table(['region', 'reads', 'writes'], Object.entries(byRegion).map(([k, [rd, wr]]) => [k, rd, wr]));
}

function drawBus(el, m) {
  const last = m.recentBus(12).reverse();
  el.innerHTML = table(['', 'addr', 'value', 'region', 'cycle'], last.map((b) => [
    b.write ? '<b>W</b>' : 'R', mono(hex(b.addr, b.io ? 2 : 4)), mono(hex(b.value, 2)), b.region, b.cycle]));
}

function drawSprites(el, m) {
  el.innerHTML = table(['slot', 'code', 'pal', 'x', 'y', 'art'], m.sprites().map((s, i) => {
    const a = s.code ? spriteArt(s.code) : null;
    return [i, s.code, s.palette, s.code ? s.x : '—', s.code ? s.y : '—', a ? (a.text ?? a.key?.split('/')[1] ?? '') : 'empty'];
  }));
}

function drawInput(el, m) {
  // One box per bit; a switch that's active (pressed, or a dip switch on) is inked in.
  const bits = (v, names, activeLow = true) => `<div style="display:flex;gap:2px;margin:4px 0 10px">${[7, 6, 5, 4, 3, 2, 1, 0].map((b) => {
    const on = (v >> b) & 1, n = Object.entries(names).find(([, mask]) => mask === 1 << b)?.[0] ?? '';
    return `<div style="flex:1;border:1px solid ${C.rule};text-align:center;font-size:11px;padding:2px 0;${n && on !== (activeLow ? 1 : 0) ? `background:${C.accent};color:${C.paper}` : ''}">
      <b>${on}</b><br>${n || '&nbsp;'}</div>`;
  }).join('')}</div>`;
  el.innerHTML = `<p style="margin:0">IN0 ${hex(MAP.in0)} = ${hex(m.in0, 2)} (0 = pressed)</p>${bits(m.in0, IN0)}
    <p style="margin:0">IN1 ${hex(MAP.in1)} = ${hex(m.in1, 2)}</p>${bits(m.in1, IN1)}
    <p style="margin:0">DSW ${hex(MAP.dsw)} = ${hex(m.dsw, 2)} (1 = on: ${Object.keys(DSW).join(', ')})</p>${bits(m.dsw, DSW, false)}`;
}
