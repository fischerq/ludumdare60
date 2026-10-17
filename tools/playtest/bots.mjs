// One bot per deep layer: what it walks to (targets) and which tiles it keeps off (blocked, judged for the time it
// would get there). The bots see what a player sees on screen: positions, the beam, the packets, the lit rows,
// never the machine's future. decideDeep() turns that into the direction the bot wants this frame.

import { DEEP, MAZE, SPEED } from '../../src/config.js';
import { CELL, tileOffset } from '../../src/systems/arcade/memmap.js';
import { W, H, SPRITE } from '../../src/systems/arcade/video.js';
import { readState } from '../../src/systems/arcade/state.js';
import { plan, evade, decisionTile, manhattan, STEP } from './plan.mjs';

const PELLETS = MAZE.layout.flatMap((row, y) => [...row].map((ch, x) => (ch === 'o' ? { x, y } : null))).filter(Boolean);
const spritesOf = (m, from, to) => m.sprites().filter((s) => s.code >= from && s.code < to).map((s) => ({ x: s.x / 16 - 0.5, y: s.y / 16 - 0.5 }));
const near = (list, x, y, r) => list.some((p) => Math.abs(p.x - x) + Math.abs(p.y - y) < r);
const ghostSpeed = 10 / DEEP.machineSlowdown; // tiles/s, a little above the machine's ghosts at deep speed

function segDist(px, py, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy;
  const k = l ? Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / l)) : 0;
  return Math.hypot(px - a.x - k * dx, py - a.y - k * dy);
}

// -1 the screen: pellets only while their row glows, never on a lit tile when the beam comes, away from ghosts.
const crt = {
  setup(c) {
    const C = DEEP.crt, L = c.L;
    c.lastPass = (y, T) => {
      const off = (y / H) * (1 - C.vblank) * C.beamPeriod;
      return Math.floor((T - off) / C.beamPeriod) * C.beamPeriod + off;
    };
    c.lit = (x, y) => {
      const i = tileOffset(x, y), v = c.m.vram[i];
      return (PELLETS.some((p) => p.x === x && p.y === y) && !c.st.got.has(i))
        || ((v === CELL.dot || v === CELL.power) && !c.st.eaten.has(i)) || v === CELL.wall || v === CELL.door;
    };
    c.beamNear = (y, T0, T1) => {
      for (let T = T0; T <= T1; T += 0.03) { const b = L.beam(T); if (b !== null && Math.abs(b - (y + 0.5)) < 0.9) return true; }
      return false;
    };
  },
  targets: (c) => PELLETS.filter((p) => !c.st.got.has(tileOffset(p.x, p.y))),
  ready(c, x, y, eta) {
    const T = c.t + eta + 0.05;
    return Math.pow(1 / 3, (T - c.lastPass(y, T)) / DEEP.crt.decay) > DEEP.crt.litAbove + 0.08;
  },
  blocked(c, x, y, eta) {
    if (near(c.ghosts, x, y, 1.6 + eta * ghostSpeed)) return true;
    return c.lit(x, y) && c.beamNear(y, c.t + eta - 0.12, c.t + eta + 0.3);
  },
  frame(c) { c.ghosts = spritesOf(c.m, SPRITE.ghost, SPRITE.eyes); },
};

// -2 signals: grab a color index, carry it to PAL, then to the DAC; sprites and the sound pulse are deadly.
const signals = {
  frame(c) { c.ghosts = spritesOf(c.m, SPRITE.ghost, SPRITE.points); },
  targets(c) {
    const C = DEEP.signals, carry = c.st.carry;
    if (!carry) return [...c.st.sparks].filter(([, s]) => c.t - s.t < C.sparkLife - 0.5).map(([k]) => ({ x: k % W, y: Math.floor(k / W) }));
    const chip = carry.stage === 'index' ? C.palette : C.dac;
    return [[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy]) => ({ x: chip.x + dx, y: chip.y + dy }));
  },
  blocked(c, x, y, eta) {
    if (c.L.inPulse(x, y)) return true;
    return c.ghosts.some((g) => Math.max(Math.abs(g.x - x), Math.abs(g.y - y)) < 1.5 + eta * ghostSpeed);
  },
  score: (c, x, y) => Math.min(9, ...c.ghosts.map((g) => manhattan(g, { x, y }))) - Math.abs(x - 9) * 0.1 - Math.abs(y - 12) * 0.1,
};

// -3 video RAM: the four pellet bytes; keep out of the row the write head is about to dash along.
const vram = {
  targets: (c) => PELLETS.map((p) => ({ x: p.x, y: p.y })).filter((p) => !c.st.got.has(p.y * 32 + p.x)),
  blocked(c, x, y, eta) {
    const h = c.st.head;
    if (!h) return false;
    const row = Math.floor(h.a / 32), to = h.a % 32, C = DEEP.vram;
    const end = h.t + C.waitTime + to / C.dashSpeed + 0.15;
    return y === row && x <= to + 1 && c.t + eta < end;
  },
};

// -4 the bus: walk into each chip room while its door is open; keep off packets and off a door about to close.
const BUS_MAP = DEEP.bus.layout;
const busAt = (x, y) => BUS_MAP[y]?.[x] ?? '#';
const BUS_CENTERS = {};
for (let y = 0; y < BUS_MAP.length; y++) for (let x = 0; x < BUS_MAP[0].length; x++) {
  const room = { R: 'rom', A: 'ram', V: 'vram', I: 'io' }[BUS_MAP[y][x]];
  if (room) BUS_CENTERS[room] = { x: x + 2, y };
}
const bus = {
  targets: (c) => Object.entries(BUS_CENTERS).filter(([room]) => !c.st.done.has(room)).map(([, p]) => p),
  blocked(c, x, y, eta) {
    const st = c.st, T = c.t + eta;
    if ('RAVI'.includes(busAt(x, y)) && T + 0.3 > st.next) return true;
    for (const p of st.packets) {
      for (const dT of [-0.15, 0, 0.15]) {
        const k = Math.floor((T + dT - p.t) * DEEP.bus.packetSpeed);
        for (let j = k - 1; j <= k + 2; j++) { const q = p.path[j]; if (q && q.x === x && q.y === y) return true; }
      }
    }
    return false;
  },
  relaxedOpen: (c, x, y) => busAt(x, y) !== '#' && busAt(x, y) !== 'C',
};

// -5 the CPU: CALL warps into routines not yet visited, page by page; off the PC's next line, the flag blocks
// and the other warps.
const CPU = DEEP.cpu, CPU_TEXT_ROWS = 27;
const cpu = {
  frame(c) {
    const st = c.st;
    c.mem.dir ??= 'down';
    if (st.page + CPU_TEXT_ROWS >= st.lines.length) c.mem.dir = 'up';
    if (st.page === 0) c.mem.dir = 'down';
  },
  calls(c) {
    const st = c.st, out = [];
    for (let i = st.page; i < Math.min(st.lines.length, st.page + CPU_TEXT_ROWS); i++) {
      const l = st.lines[i];
      if (l.op === 'call' && l.to !== undefined && !st.visited.has(l.target)) out.push({ x: 0, y: i - st.page });
    }
    return out;
  },
  targets(c) {
    const calls = cpu.calls(c);
    if (calls.length) return calls;
    const y = c.mem.dir === 'down' ? CPU_TEXT_ROWS : -1;
    return Array.from({ length: c.L.cols }, (_, x) => ({ x, y }));
  },
  blocked(c, x, y, eta) {
    const st = c.st, line = st.page + y, l = st.lines[line];
    if (x === 0 && l?.op && !(l.op === 'call' && l.to !== undefined && !st.visited.has(l.target))) return true;
    if ((x === CPU.zColumn && line % 3 === 1) || (x === CPU.cColumn && line % 3 === 2)) return true;
    if (st.line !== undefined && ((line === st.line + 1 && eta < 0.45) || (line === st.line && eta < 0.12))) return true;
    return false;
  },
};

// -6 logic: stand on each ghost's target tile; never cross a target line; run from seekers.
const logic = {
  targets: (c) => c.st.vectors.filter((v) => !c.st.done.has(v.name)).map((v) => c.L.target(v)),
  blocked(c, x, y, eta) {
    if (c.st.seekers.some((s) => Math.abs(s.x - x) + Math.abs(s.y - y) < 1.6 + eta * 1.2)) return true;
    if (c.goals.some((g) => g.x === x && g.y === y)) return false;
    return c.st.vectors.some((v) => segDist(x, y, v.from, v.to) < DEEP.logic.vectorWidth + 0.45);
  },
  score: (c, x, y) => Math.min(9, ...c.st.seekers.map((s) => manhattan(s, { x, y }))),
};

// -7 input wires: stand on the switch that steers the machine's Pac-Man toward a corner it hasn't reached;
// keep away from the spark.
const PADS = { up: { x: 5, y: 10 }, left: { x: 2, y: 12 }, right: { x: 8, y: 12 }, down: { x: 5, y: 14 } };
const MAZE_CORNERS = [{ name: 'TL', x: 0, y: 0 }, { name: 'TR', x: W - 1, y: 0 }, { name: 'BL', x: 0, y: H - 1 }, { name: 'BR', x: W - 1, y: H - 1 }];
const input = {
  frame(c) {
    const g = readState(c.m, c.S);
    if (g.phase !== 'play') return;
    const left = MAZE_CORNERS.filter((k) => !c.st.corners.has(k.name));
    // The player stands on a switch, so a change of direction takes a walk to another one: about a second.
    const d = mazeRace(c.m, g, (x, y) => left.some((k) => Math.max(Math.abs(x - k.x), Math.abs(y - k.y)) <= DEEP.input.corner - 1), 1 / DEEP.machineSlowdown, 0.3);
    if (d) c.mem.pad = d;
  },
  dwell: true,
  targets(c) {
    const p = PADS[c.mem.pad ?? 'left'];
    return [[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy }));
  },
  blocked(c, x, y, eta) {
    if (c.t < c.st.sparkFrom - 1) return false;
    return Math.abs(c.st.spark.x - x) + Math.abs(c.st.spark.y - y) < 1.5 + eta * DEEP.input.sparkSpeed;
  },
};

// The machine's maze, as the bot in src/systems/arcade/bot.js sees it: first step toward a goal tile, around
// hunting ghosts.
// The machine's maze game as a race: a tile is safe when Pac-Man (after the player's reaction time) gets there
// a safety margin before any hunting ghost could. Ghost times come from a breadth-first search out of every hunter.
// Returns the direction to swipe toward the nearest safe goal, or, with none, toward the tile with the most time to
// spare. react and safety in seconds of machine time.
function mazeRace(m, g, isGoal, react, safety) {
  const wall = (x, y) => {
    if (y < 0 || y >= H) return true;
    return m.vram[tileOffset(((x % W) + W) % W, y)] === CELL.wall;
  };
  const pacOpen = (x, y) => {
    if (wall(x, y)) return false;
    const v = m.vram[tileOffset(((x % W) + W) % W, y)];
    return v !== CELL.door && v !== CELL.house;
  };
  const ghostT = new Float32Array(W * H).fill(1e9);
  const hunters = g.ghosts.filter((gh) => !gh.frightened && (gh.state === 'active' || gh.state === 'exit'));
  let queue = hunters.map((gh) => ({ x: ((Math.round(gh.x) % W) + W) % W, y: Math.round(gh.y) }));
  for (const q of queue) ghostT[q.y * W + q.x] = 0;
  for (let depth = 1; queue.length; depth++) {
    const next = [];
    for (const c of queue) for (const [dx, dy] of Object.values(STEP)) {
      const nx = (c.x + dx + W) % W, ny = c.y + dy;
      if (wall(nx, ny) || ghostT[ny * W + nx] <= depth / SPEED.ghost) continue;
      ghostT[ny * W + nx] = depth / SPEED.ghost;
      next.push({ x: nx, y: ny });
    }
    queue = next;
  }
  // Where Pac-Man will be when the swipe lands: straight on for the reaction time, up to a wall or a junction.
  let from = { x: ((Math.round(g.pac.x) % W) + W) % W, y: Math.round(g.pac.y) }, lead = 0;
  const step = STEP[g.pac.dir];
  for (let k = 1; step && k <= Math.round(react * SPEED.pac); k++) {
    const nx = (from.x + step[0] + W) % W, ny = from.y + step[1];
    if (!pacOpen(nx, ny) || ghostT[ny * W + nx] < k / SPEED.pac + safety) break;
    from = { x: nx, y: ny };
    lead = k / SPEED.pac;
    if (Object.values(STEP).filter(([sx, sy]) => pacOpen(from.x + sx, from.y + sy)).length > 2) break;
  }
  const spare = (x, y, eta) => ghostT[y * W + x] - (Math.max(react, lead) + eta);
  const base = { from, cols: W, open: pacOpen, wrap: true, speed: SPEED.pac };
  const r = plan({ ...base, isGoal, blocked: (x, y, eta) => spare(x, y, eta) < safety });
  if (r) return r.dir;
  // No safe goal: head for the reachable tile with the most time to spare.
  let best = null;
  plan({ ...base, blocked: (x, y, eta) => spare(x, y, eta) < 0, isGoal: (x, y, eta) => {
    const v = spare(x, y, eta);
    if (!best || v > best.v) best = { x, y, v };
    return false;
  } });
  if (!best) return null;
  return plan({ ...base, isGoal: (x, y) => x === best.x && y === best.y })?.dir ?? null;
}

// The maze game: like the in-game bot (nearest pellet, frightened ghosts, around hunters), but racing the ghosts
// with its reaction time counted in.
export function mazeBot(m, S, react, safety) {
  const g = readState(m, S);
  if (g.phase !== 'play') return null;
  const prey = g.ghosts.filter((gh) => gh.frightened && gh.state === 'active');
  return mazeRace(m, g, (x, y) => {
    const v = m.vram[tileOffset(x, y)];
    return v === CELL.dot || v === CELL.power || near(prey, x, y, 0.6);
  }, react, safety);
}

export const DEEP_BOTS = { crt, signals, vram, bus, cpu, logic, input };

// Walking distance to the nearest goal from every tile (breadth-first out of the goals), for scoring.
function distanceField(goals, open) {
  const d = new Map(goals.map((g) => [`${g.x},${g.y}`, 0]));
  let queue = goals;
  for (let k = 1; queue.length && k < 400; k++) {
    const next = [];
    for (const c of queue) for (const [dx, dy] of Object.values(STEP)) {
      const x = c.x + dx, y = c.y + dy, key = `${x},${y}`;
      if (d.has(key) || !open(x, y)) continue;
      d.set(key, k);
      next.push({ x, y });
    }
    queue = next;
  }
  return (x, y) => d.get(`${x},${y}`) ?? 999;
}

// The direction the bot wants this frame. c: { L, st, env, m, S, t, player, mem }.
export function decideDeep(bot, c) {
  bot.frame?.(c);
  const from = decisionTile(c.player);
  const goals = bot.targets(c);
  c.goals = goals;
  const open = (x, y) => c.L.open(c.st, c.env, x, y);
  const roomy = bot.relaxedOpen ? (x, y) => bot.relaxedOpen(c, x, y) : open; // doors that may open count as open
  const blocked = (x, y, eta) => bot.blocked?.(c, x, y, eta) ?? false;
  const isGoalTile = (x, y) => goals.some((g) => g.x === x && g.y === y);
  const isGoal = (x, y, eta) => isGoalTile(x, y) && (!bot.ready || bot.ready(c, x, y, eta));
  const base = { from, cols: c.L.cols, speed: DEEP.walkSpeed };
  const dist = distanceField(goals, roomy);
  const toward = (x, y) => -Math.min(99, dist(x, y)) + (bot.score?.(c, x, y) ?? 0) * 0.5;
  // Already on a goal it has to hold (a switch): step to another goal tile next to it.
  if (bot.dwell && isGoalTile(from.x, from.y)) {
    return evade({ ...base, open, blocked, score: (x, y) => (isGoalTile(x, y) ? 10 : 0) + toward(x, y) });
  }
  // On the way onto a goal tile: keep going (the decision tile is the one it's walking onto).
  const p = c.player;
  if (p.dir && (p.x !== from.x || p.y !== from.y) && isGoal(from.x, from.y, 0.1)) return p.dir;
  const r = plan({ ...base, open, blocked, isGoal });
  if (r) return r.dir;
  // No safe way all the way: take the plain way as long as its next tile is safe now. Walking into a closed door
  // just stands there until it opens.
  const q = plan({ ...base, open: roomy, isGoal: isGoalTile });
  if (q && !blocked(from.x, from.y, 0.15)) {
    const [dx, dy] = STEP[q.dir];
    if (!open(from.x + dx, from.y + dy) || !blocked(from.x + dx, from.y + dy, 1 / DEEP.walkSpeed)) return q.dir;
  }
  return evade({ ...base, open, blocked, score: toward });
}
