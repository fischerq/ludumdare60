// The live page: the machine as it is right now, drawn like a magic map. Everything is read from the
// running machine (registers, memory, the bus log, inputs, the program's RAM), MANUAL.liveHz times a second,
// detailed enough to debug the emulator: ?manual opens it straight away.
import { MANUAL } from '../config.js';
import { world, onFrame, requestTrace } from '../systems/arcade/world.js';
import { MAP, IN0, IN1, DSW, CELL, tileOffset, region } from '../systems/arcade/memmap.js';
import { BUS } from '../systems/arcade/machine.js';
import { readState, PHASES } from '../systems/arcade/state.js';
import { W, H, spriteArt } from '../systems/arcade/video.js';

const C = MANUAL.colors;
const hex = (n, d = 4) => n.toString(16).toUpperCase().padStart(d, '0');
const DX = { up: 0, left: -1, down: 0, right: 1 }, DY = { up: -1, left: 0, down: 1, right: 0 };
const GHOST_INK = { blinky: '#b02020', pinky: '#c0508a', inky: '#11807a', clyde: '#c06a10' };
const TRAIL = 8;       // footprints kept per actor
const TRACE_EVERY = 1; // s between profiles of a frame's instructions
const TRACE_MAX = 6000;
const GHOST_NAMES = ['blinky', 'pinky', 'inky', 'clyde'];

export const livePage = {
  title: '10. The live page',
  html: `<p><i>Everything below is read from the running board, ${MANUAL.liveHz} times a second.</i></p>
    <p><button class="manual-btn live-hold" style="width:100%;font-size:16px">FREEZE VIEW</button></p>
    <div class="live-status"></div>
    <h2>The map</h2>
    <canvas class="live-map" style="width:100%;image-rendering:auto"></canvas>
    <p class="fig">Walls and dots from video RAM, everyone at their position in work RAM. ✕ is the tile each ghost
      last aimed for, as the program wrote it (TGT_X, TGT_Y in ghost_target).</p>
    <h2>The game state</h2><div class="live-game"></div>
    <h2>The actors</h2><div class="live-actors"></div>
    <h2>The Z80</h2><div class="live-cpu"></div>
    <h2>Where the time goes</h2><div class="live-prof"></div>
    <h2>Memory, last frame</h2><canvas class="live-heat" style="width:100%"></canvas>
    <p class="fig">The 64 KB address space in 256-byte pages, row by row from 0x0000: blue = read, red = written.</p>
    <div class="live-regions"></div>
    <h2>The bus, latest cycles</h2><div class="live-bus"></div>
    <h2>Sprites</h2><div class="live-sprites"></div>
    <h2>The input wires</h2><div class="live-input"></div>
    <h2>Sound commands</h2><div class="live-sound"></div>`,
  mount(body) {
    const q = (s) => body.querySelector(s);
    const map = q('.live-map'), heat = q('.live-heat');
    const st = { hold: false, trails: new Map(), sounds: [], prof: null, lastTrace: 0, routines: null, targets: [], hooked: null };
    q('.live-hold').onclick = (e) => {
      st.hold = !st.hold;
      e.target.textContent = st.hold ? 'RESUME VIEW' : 'FREEZE VIEW';
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
        requestTrace(TRACE_MAX, (steps) => { st.prof = profile(steps, st.routines); });
      }
      const g = readState(m, S);
      drawStatus(q('.live-status'), m);
      drawMap(map, m, S, g, st);
      drawGame(q('.live-game'), m, S);
      drawActors(q('.live-actors'), g, st.targets);
      drawCpu(q('.live-cpu'), m, world.program.listing, st.routines);
      drawProfile(q('.live-prof'), st.prof);
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
  el.innerHTML = table(['board', 'frame', 'joystick', 'speed', 'CPU busy'], [[
    `<b>${state}</b>`, m.frame, world.driver === 'bot' ? 'autopilot' : 'player', `${world.speed}×`,
    `${m.busy} / ${m.frameCycles} cyc (${Math.round((m.busy / m.frameCycles) * 100)}%)`,
  ]]);
}

// ---- the map ------------------------------------------------------------------------------------------------------
function drawMap(cv, m, S, g, st) {
  const T = 16, dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== W * T * dpr) { cv.width = W * T * dpr; cv.height = H * T * dpr; }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W * T, H * T);
  // Walls as ink hatching, dots as specks, read straight from VRAM.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = m.vram[tileOffset(x, y)];
      if (c >= CELL.wall) {
        ctx.fillStyle = 'rgba(43,33,23,0.75)';
        ctx.fillRect(x * T + 1, y * T + 1, T - 2, T - 2);
      } else if (c === CELL.dot || c === CELL.power) {
        ctx.fillStyle = C.ink;
        ctx.beginPath();
        ctx.arc(x * T + T / 2, y * T + T / 2, c === CELL.power ? 4 : 1.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (c === CELL.door) {
        ctx.fillStyle = C.accent;
        ctx.fillRect(x * T, y * T + T / 2 - 1, T, 2);
      }
    }
  }
  const actors = [{ name: 'pac-man', ink: C.ink, ...g.pac }, ...g.ghosts.map((gh) => ({ ...gh, ink: GHOST_INK[gh.name] }))];
  for (const a of actors) {
    // A few footsteps: where it was on earlier updates, fading.
    const tr = st.trails.get(a.name) ?? [];
    const last = tr[tr.length - 1];
    if (!last || Math.hypot(last.x - a.x, last.y - a.y) > 0.4) tr.push({ x: a.x, y: a.y, dir: a.dir });
    if (tr.length > TRAIL) tr.shift();
    st.trails.set(a.name, tr);
    tr.forEach((p, i) => {
      ctx.globalAlpha = (i / tr.length) * 0.3;
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
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(a.x * T + T / 2, a.y * T + T / 2);
      ctx.lineTo(tg.x * T + T / 2, tg.y * T + T / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 2;
      const cx = tg.x * T + T / 2, cy = tg.y * T + T / 2;
      ctx.beginPath(); ctx.moveTo(cx - 4, cy - 4); ctx.lineTo(cx + 4, cy + 4); ctx.moveTo(cx + 4, cy - 4); ctx.lineTo(cx - 4, cy + 4); ctx.stroke();
      ctx.lineWidth = 1;
    }
    // The name on a little banner, like ink labels on a map.
    const px = a.x * T + T / 2, py = a.y * T + T / 2;
    ctx.fillStyle = a.frightened ? C.blue : a.ink;
    ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
    ctx.font = `bold 10px ${MANUAL.font}`;
    const label = a.name === 'pac-man' ? 'PAC-MAN' : `${a.name.toUpperCase()}${a.frightened ? ' (afraid)' : a.state !== 'active' ? ` (${a.state})` : ''}`;
    const w = ctx.measureText(label).width + 6;
    const lx = Math.max(0, Math.min(W * T - w, px - w / 2)), ly = py - 16 < 0 ? py + 8 : py - 16;
    ctx.fillStyle = 'rgba(239,226,189,0.85)';
    ctx.fillRect(lx, ly, w, 11);
    ctx.strokeStyle = a.ink;
    ctx.strokeRect(lx + 0.5, ly + 0.5, w - 1, 10);
    ctx.fillStyle = a.ink;
    ctx.fillText(label, lx + 3, ly + 9);
  }
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
  const smp = m.sample;
  if (!smp) { el.innerHTML = '<p>(waiting for a frame to run…)</p>'; return; }
  const c = smp.cpu, f = c.flags, f2 = c.flags_prime ?? {};
  const h2 = (v) => mono(hex(v ?? 0, 2)), h4 = (v) => mono(hex(v ?? 0));
  const bit = (v) => `<span style="${v ? `color:${C.accent};font-weight:700` : 'opacity:0.4'}">${v ? 1 : 0}</span>`;
  // The source lines around PC (the program's own listing, as the board assembled it).
  const at = listing.findIndex((l) => l.addr === c.pc && l.bytes.length);
  const around = at < 0 ? [] : listing.slice(Math.max(0, at - 3), at + 4);
  el.innerHTML = `<p style="font-size:13px">The CPU caught in the middle of frame ${smp.frame}, at cycle ${smp.cycle}
      of ${m.frameCycles}, in <b>${routineAt(routines, c.pc)}</b>. A new moment every update; after its work each
      frame it sleeps on HALT until the next vblank.</p>`
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
function drawProfile(el, prof) {
  if (!prof) { el.innerHTML = '<p>(measuring one frame…)</p>'; return; }
  const max = prof.top[0]?.[1] ?? 1;
  el.innerHTML = `<p style="font-size:13px">Instructions in one recent frame, by routine (${prof.total} in all${prof.total >= TRACE_MAX ? '+' : ''}):</p>`
    + table(['routine', 'instr', '%', ''], prof.top.map(([n, k]) => [n, k, Math.round((k / prof.total) * 100),
      `<span style="display:inline-block;height:9px;background:${C.ink};width:${(k / max) * 100}%"></span>`]));
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
  const maxR = Math.max(1, ...reads), maxW = Math.max(1, ...writes);
  ctx.clearRect(0, 0, 16 * cell, 16 * cell);
  for (let p = 0; p < 256; p++) {
    const x = (p % 16) * cell, y = Math.floor(p / 16) * cell;
    ctx.strokeStyle = 'rgba(43,33,23,0.25)';
    ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
    if (reads[p]) { ctx.fillStyle = `rgba(36,71,122,${0.15 + 0.85 * Math.sqrt(reads[p] / maxR)})`; ctx.fillRect(x + 1, y + 1, cell - 2, (cell - 2) / 2); }
    if (writes[p]) { ctx.fillStyle = `rgba(154,42,26,${0.15 + 0.85 * Math.sqrt(writes[p] / maxW)})`; ctx.fillRect(x + 1, y + cell / 2, cell - 2, (cell - 2) / 2); }
  }
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
