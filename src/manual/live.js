// The live page: the machine as it is right now, drawn in ink like a magic map. Everything is read from the
// running machine (registers, memory, the bus log, inputs, the program's RAM), MANUAL.liveHz times a second,
// detailed enough to debug the emulator: ?manual opens it straight away.
import { MANUAL, RULES } from '../config.js';
import { world, onFrame, requestTrace } from '../systems/arcade/world.js';
import { MAP, IN0, IN1, DSW, CELL, tileOffset, region } from '../systems/arcade/memmap.js';
import { BUS } from '../systems/arcade/machine.js';
import { readState } from '../systems/arcade/state.js';
import { W, H, spriteArt } from '../systems/arcade/video.js';

const C = MANUAL.colors;
const hex = (n, d = 4) => n.toString(16).toUpperCase().padStart(d, '0');
const DX = { up: 0, left: -1, down: 0, right: 1 }, DY = { up: -1, left: 0, down: 1, right: 0 };
const GHOST_INK = { blinky: '#b02020', pinky: '#c0508a', inky: '#11807a', clyde: '#c06a10' };
const TRAIL = 40;      // footprints kept per actor
const TRACE_EVERY = 1; // s between profiles of a frame's instructions
const TRACE_MAX = 6000;

export const livePage = {
  title: '10. The live page',
  html: `<p><i>Hold the page still and watch: the ink moves with the machine. Everything below is read from the
    running board, ${MANUAL.liveHz} times a second.</i></p>
    <p><button class="manual-btn live-hold" style="width:100%;font-size:16px">HOLD THE INK</button></p>
    <div class="live-status mono"></div>
    <h2>The map</h2>
    <canvas class="live-map" style="width:100%;image-rendering:auto"></canvas>
    <p class="fig">Walls and dots from video RAM, everyone at their position in work RAM with their last footsteps.
      ✕ marks where each ghost is heading (its target tile).</p>
    <h2>The game state</h2><div class="live-game"></div>
    <h2>The Z80</h2><div class="live-cpu mono"></div>
    <h2>Where the time goes</h2><div class="live-prof"></div>
    <h2>Memory, last frame</h2><canvas class="live-heat" style="width:100%"></canvas>
    <p class="fig">The 64 KB address space in 256-byte pages, row by row from 0x0000: blue = read, red = written.</p>
    <div class="live-regions"></div>
    <h2>The bus, latest cycles</h2><div class="live-bus mono"></div>
    <h2>Sprites</h2><div class="live-sprites"></div>
    <h2>The input wires</h2><div class="live-input"></div>
    <h2>Sound commands</h2><div class="live-sound mono"></div>`,
  mount(body) {
    const q = (s) => body.querySelector(s);
    const map = q('.live-map'), heat = q('.live-heat');
    const st = { hold: false, trails: new Map(), sounds: [], prof: null, lastTrace: 0, routines: null };
    q('.live-hold').onclick = (e) => {
      st.hold = !st.hold;
      e.target.textContent = st.hold ? 'LET THE INK FLOW' : 'HOLD THE INK';
    };
    const offFrame = onFrame((m, sounds) => {
      for (const s of sounds) st.sounds.push(`frame ${s.frame}: ${s.name}`);
      st.sounds.splice(0, Math.max(0, st.sounds.length - 6));
    });
    const tick = () => {
      if (st.hold) return;
      const m = world.machine, S = world.program?.symbols;
      if (!m || !S) { q('.live-status').textContent = 'The machine is still warming up…'; return; }
      st.routines ??= routineMap(world.program.listing);
      const now = performance.now() / 1000;
      if (now - st.lastTrace > TRACE_EVERY && !world.trace && !world.halted && !world.paused) {
        st.lastTrace = now;
        requestTrace(TRACE_MAX, (steps) => { st.prof = profile(steps, st.routines); });
      }
      const g = readState(m, S);
      drawStatus(q('.live-status'), m, g);
      drawMap(map, m, S, g, st);
      drawGame(q('.live-game'), g, m, S);
      drawCpu(q('.live-cpu'), m, world.program.listing);
      drawProfile(q('.live-prof'), st.prof);
      drawHeat(heat, q('.live-regions'), m);
      drawBus(q('.live-bus'), m);
      drawSprites(q('.live-sprites'), m);
      drawInput(q('.live-input'), m);
      q('.live-sound').innerHTML = st.sounds.length ? st.sounds.slice().reverse().join('<br>') : '(none yet)';
    };
    tick();
    const timer = setInterval(tick, 1000 / MANUAL.liveHz);
    return { stop: () => { clearInterval(timer); offFrame(); } };
  },
};

function drawStatus(el, m, g) {
  const load = Math.round((m.busy / m.frameCycles) * 100);
  const state = world.halted ? 'STANDING STILL (waiting for a coin)' : world.paused ? 'PAUSED' : 'RUNNING';
  el.innerHTML = `<b>${state}</b> · frame ${m.frame} · ${g.phase.toUpperCase()}<br>
    at the joystick: <b>${world.driver === 'bot' ? 'the autopilot' : 'the player'}</b> · speed ${world.speed}× · CPU busy ${load}% of the last frame`;
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
    // Footsteps: where it was on earlier updates, fading.
    const tr = st.trails.get(a.name) ?? [];
    const last = tr[tr.length - 1];
    if (!last || Math.hypot(last.x - a.x, last.y - a.y) > 0.4) tr.push({ x: a.x, y: a.y, dir: a.dir });
    if (tr.length > TRAIL) tr.shift();
    st.trails.set(a.name, tr);
    tr.forEach((p, i) => {
      ctx.globalAlpha = (i / tr.length) * 0.6;
      ctx.fillStyle = a.ink;
      const side = i % 2 ? 2.5 : -2.5, ox = (DY[p.dir] ?? 0) * side, oy = (DX[p.dir] ?? 0) * side;
      ctx.beginPath();
      ctx.ellipse(p.x * T + T / 2 + ox, p.y * T + T / 2 + oy, 1.6, 2.4, Math.atan2(DY[p.dir] ?? 1, DX[p.dir] ?? 0) + Math.PI / 2, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    // Targets: where the rules send each ghost.
    const tg = a.name !== 'pac-man' ? target(a, g, S) : null;
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

// The tile a ghost is heading for, with the program's rules (game.asm, ghost_target).
function target(gh, g, S) {
  if (gh.state === 'eyes') return { x: S.HOUSE_EXIT_X, y: S.HOUSE_EXIT_Y };
  if (gh.state !== 'active' || gh.frightened) return null;
  if (!g.chase) return gh.corner;
  const p = { x: Math.floor(g.pac.x), y: Math.floor(g.pac.y) }, d = g.pac.dir ?? 'up';
  const ahead = (n) => ({ x: p.x + DX[d] * n, y: p.y + DY[d] * n });
  if (gh.name === 'blinky') return p;
  if (gh.name === 'pinky') return ahead(RULES.pinkyAhead);
  if (gh.name === 'inky') {
    const a = ahead(RULES.inkyAhead), b = g.ghosts[0];
    return { x: 2 * a.x - Math.floor(b.x), y: 2 * a.y - Math.floor(b.y) };
  }
  const dx = Math.floor(gh.x) - p.x, dy = Math.floor(gh.y) - p.y;
  return dx * dx + dy * dy > RULES.clydeShyDistance ** 2 ? p : gh.corner;
}

// ---- the panels ---------------------------------------------------------------------------------------------------
const table = (head, rows) => `<table><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr>${rows
  .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>`;

function drawGame(el, g, m, S) {
  const secs = (frames) => (frames / 60.6).toFixed(1);
  const modeT = m.read(S.MODE_T) | (m.read(S.MODE_T + 1) << 8);
  const phaseT = m.read(S.PHASE_T) | (m.read(S.PHASE_T + 1) << 8);
  el.innerHTML = table(['', ''], [
    ['phase', `${g.phase} (${phaseT ? `${secs(phaseT)} s left` : 'until something happens'})`],
    ['score · lives · dots left', `${g.score} · ${g.lives} · ${g.pellets}`],
    ['mode', `${g.chase ? 'CHASE' : 'SCATTER'} (step ${g.modeIndex}${modeT ? `, ${secs(modeT)} s left` : ', forever'})`],
    ['fright', g.fright ? `${secs(g.fright)} s left` : '—'],
  ]) + table(['who', 'tile', 'dir', 'state'], [
    ['Pac-Man', `${g.pac.x.toFixed(2)}, ${g.pac.y.toFixed(2)}`, `${g.pac.dir ?? '—'}${g.pac.next ? ` → ${g.pac.next}` : ''}`, '—'],
    ...g.ghosts.map((gh) => [gh.name, `${gh.x.toFixed(2)}, ${gh.y.toFixed(2)}`, gh.dir ?? '—', `${gh.state}${gh.frightened ? ', afraid' : ''}`]),
  ]);
}

function drawCpu(el, m, listing) {
  const c = m.cpu.getState();
  const r16 = (a, b) => hex((a << 8) | b);
  const f = c.flags;
  const flag = (k, n = k) => `<span style="${f[k] ? `color:${C.accent};font-weight:700` : 'opacity:0.35'}">${n}</span>`;
  // The source lines around PC (the program's own listing, as the board assembled it).
  const at = listing.findIndex((l) => l.addr === c.pc && l.bytes.length);
  const around = at < 0 ? [] : listing.slice(Math.max(0, at - 3), at + 4);
  el.innerHTML = table(['AF', 'BC', 'DE', 'HL'], [[r16(c.a, flagsByte(f)), r16(c.b, c.c), r16(c.d, c.e), r16(c.h, c.l)]])
    + table(['IX', 'IY', 'SP', 'PC'], [[hex(c.ix), hex(c.iy), hex(c.sp), `<b>${hex(c.pc)}</b>`]])
    + `<p>flags ${flag('S')} ${flag('Z')} ${flag('H')} ${flag('P', 'P/V')} ${flag('N')} ${flag('C')} ·
      I ${hex(c.i, 2)} · IM ${c.imode} · interrupts ${c.iff1 ? 'on' : 'off'} · ${c.halted ? 'HALTED (asleep until vblank)' : 'running'}</p>`
    + `<div style="font-size:12px;white-space:pre;overflow-x:auto;background:rgba(43,33,23,0.06);padding:4px">${around.map((l) =>
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
    + prof.top.map(([n, k]) => `<div class="mono" style="font-size:13px;display:flex;gap:6px;align-items:center">
      <span style="width:110px;overflow:hidden">${n}</span><span style="flex:1"><span style="display:inline-block;height:9px;background:${C.ink};width:${(k / max) * 100}%"></span></span>
      <span style="width:44px;text-align:right">${k}</span></div>`).join('');
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
  el.innerHTML = `<div style="font-size:12px;white-space:pre">${last.map((b) =>
    `${b.write ? '<b>W</b>' : 'R'} ${hex(b.addr)} ${b.write ? '←' : '→'} ${hex(b.value, 2)}  ${b.region.padEnd(10)} cycle ${b.cycle}`).join('\n')}</div>`;
}

function drawSprites(el, m) {
  el.innerHTML = table(['slot', 'code', 'pal', 'x, y', 'art'], m.sprites().map((s, i) => {
    const a = s.code ? spriteArt(s.code) : null;
    return [i, s.code, s.palette, s.code ? `${s.x}, ${s.y}` : '—', a ? (a.text ?? a.key?.split('/')[1] ?? '') : 'empty'];
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
