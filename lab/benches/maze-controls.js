// Bench: swipe controls in the maze. Runs the game's own rules (src/systems/maze.js) and swipe detection
// (src/systems/swipe.js) without ghosts, so only turning is being judged.
import { GAME_WIDTH, MAZE, SPEED, INPUT, CONTROL } from '../../src/config.js';
import { createGame, stepGame, steer, DIRS } from '../../src/systems/maze.js';
import { createSwipe, swipeInput } from '../../src/systems/swipe.js';

const W = MAZE.layout[0].length, H = MAZE.layout.length;
const TILE = GAME_WIDTH / W;
const current = {
  pacSpeed: SPEED.pac, swipeMin: INPUT.swipeMin, turnWindow: CONTROL.turnWindow, bufferTime: CONTROL.bufferTime,
};
const firstBuild = { pacSpeed: 7.5, swipeMin: 30, turnWindow: 0, bufferTime: 5 };
const MARK_LIFE = 1.5; // s a swipe/turn marker stays visible

// A scripted swipe: finger down mid-screen, travels 70 px in 0.1 s, lifts.
const swipesAt = (list) => (t) => {
  for (const { at, dir } of list) {
    const k = (t - at) / 0.1;
    if (k < 0 || k > 1) continue;
    const d = DIRS[dir];
    return { x: 360 + d.x * 70 * k, y: 480 + d.y * 70 * k };
  }
  return null;
};
const cycle = (dirs, every, start = 0.4) => dirs.map((dir, i) => ({ at: start + i * every, dir }));

export default {
  title: 'Maze swipe controls',
  summary: 'Swipe to steer the chomper through the real maze, no ghosts. Yellow ring: where you swiped. Green: where the turn happened. Red: a swipe that was dropped.',
  doc: 'https://github.com/fischerq/ludumdare60/blob/main/design/systems/arcade-maze.md',
  world: { w: GAME_WIDTH, h: Math.round(TILE * H) },

  params: [
    { key: 'pacSpeed', label: 'Speed (tiles/s)', min: 3, max: 12, step: 0.25 },
    { key: 'swipeMin', label: 'Swipe distance (px)', min: 5, max: 80, step: 1 },
    { key: 'turnWindow', label: 'Turn window (tiles)', min: 0, max: 0.5, step: 0.05 },
    { key: 'bufferTime', label: 'Swipe kept for (s)', min: 0.1, max: 5, step: 0.1 },
  ],

  variants: [
    { name: 'First build', note: 'Exact-center turns, 30 px swipes, 7.5 tiles/s', params: firstBuild, editable: true },
    { name: 'Current', note: 'Numbers from src/config.js; drag the sliders, then copy', params: current, editable: true },
  ],

  scenarios: [
    { id: 'live', name: 'Live: swipe on a panel', live: true, note: 'Swipe on either panel; both chompers get the same swipes. Keep your finger down and swipe again to chain turns.' },
    {
      id: 'steady', name: 'A swipe every 0.6 s', duration: 6,
      note: 'Up, left, up, right, down, right, up, left: which variant takes more of the turns?',
      input: swipesAt(cycle(['up', 'left', 'up', 'right', 'down', 'right', 'up', 'left', 'down'], 0.6)),
    },
    {
      id: 'busy', name: 'Busy thumb (0.3 s)', duration: 5,
      note: 'Swipes come faster than junctions. Shows how stale swipes are dropped or kept.',
      input: swipesAt(cycle(['up', 'right', 'down', 'left', 'up', 'left', 'down', 'right'].flatMap((d) => [d, d]), 0.3)),
    },
  ],

  init(p) {
    const g = createGame(MAZE.layout, { ghosts: false });
    g.phase = 'play';
    return { g, swipe: createSwipe(), t: 0, marks: [], trail: [], pending: null, turns: 0, dropped: 0, delaySum: 0 };
  },

  step(s, p, target, dt) {
    const { g } = s;
    g.tune = { pacSpeed: p.pacSpeed, turnWindow: p.turnWindow, bufferTime: p.bufferTime };
    s.t += dt;
    const dir = swipeInput(s.swipe, target, p.swipeMin);
    // A long swipe fires again every swipeMin px; repeats of the same direction don't count as new swipes.
    if (dir && dir !== s.pending?.dir && dir !== g.pac.dir) {
      if (s.pending) s.dropped += 1; // replaced before it was used
      s.pending = { dir, t: s.t };
      s.marks.push({ x: g.pac.x, y: g.pac.y, kind: 'swipe', t: s.t });
    }
    if (dir) steer(g, dir);
    stepGame(g, dt);
    const pac = g.pac;
    if (s.pending) {
      if (pac.dir === s.pending.dir) {
        s.turns += 1;
        s.delaySum += s.t - s.pending.t;
        s.marks.push({ x: pac.x, y: pac.y, kind: 'turn', t: s.t });
        s.pending = null;
      } else if (!pac.nextDir) {
        s.dropped += 1;
        s.marks.push({ x: pac.x, y: pac.y, kind: 'drop', t: s.t });
        s.pending = null;
      }
    }
    s.marks = s.marks.filter((m) => s.t - m.t < MARK_LIFE);
    s.trail.push({ x: pac.x, y: pac.y });
    if (s.trail.length > 60) s.trail.shift();
  },

  draw(ctx, s, p, target, c) {
    const { g } = s;
    const px = (x) => (x + 0.5) * TILE;
    // Walls as blocks, pellets as dots.
    ctx.fillStyle = '#2121de';
    MAZE.layout.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '#') ctx.fillRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2);
      if (ch === '-') { ctx.fillStyle = '#ffb8de'; ctx.fillRect(x * TILE, y * TILE + TILE * 0.45, TILE, TILE * 0.1); ctx.fillStyle = '#2121de'; }
    }));
    ctx.fillStyle = '#ffb897';
    g.pellets.forEach((row, y) => row.forEach((k, x) => {
      if (!k) return;
      ctx.beginPath(); ctx.arc(px(x), px(y), k === 1 ? 3 : 9, 0, Math.PI * 2); ctx.fill();
    }));
    // Trail of the last second.
    s.trail.forEach((pt, i) => {
      ctx.globalAlpha = (i / s.trail.length) * 0.4;
      ctx.fillStyle = c.accent;
      ctx.beginPath(); ctx.arc(px(pt.x), px(pt.y), 5, 0, Math.PI * 2); ctx.fill();
    });
    // Markers.
    const colors = { swipe: '#ffe600', turn: '#4cff7a', drop: '#ff4040' };
    for (const m of s.marks) {
      ctx.globalAlpha = 1 - (s.t - m.t) / MARK_LIFE;
      ctx.strokeStyle = colors[m.kind]; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(px(m.x), px(m.y), m.kind === 'swipe' ? 22 : 14, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Chomper with its mouth toward its direction; a small arrow shows the queued swipe.
    const pac = g.pac;
    const a = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[pac.dir] ?? 0;
    ctx.fillStyle = '#ffff00';
    ctx.beginPath(); ctx.moveTo(px(pac.x), px(pac.y));
    ctx.arc(px(pac.x), px(pac.y), TILE * 0.7, a + 0.5, a - 0.5 + Math.PI * 2); ctx.fill();
    if (pac.nextDir && pac.nextDir !== pac.dir) {
      const d = DIRS[pac.nextDir];
      ctx.strokeStyle = '#ffe600'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(px(pac.x), px(pac.y)); ctx.lineTo(px(pac.x + d.x * 1.2), px(pac.y + d.y * 1.2)); ctx.stroke();
    }
  },

  readout(s) {
    const avg = s.turns ? Math.round((s.delaySum / s.turns) * 1000) : 0;
    return `turns ${s.turns} · dropped ${s.dropped} · swipe→turn avg ${avg} ms`;
  },

  configSnippet(p) {
    return [
      '// src/config.js',
      `SPEED.pac: ${p.pacSpeed},  // scale SPEED.ghost* by the same factor`,
      `INPUT.swipeMin: ${p.swipeMin},`,
      `CONTROL.turnWindow: ${p.turnWindow},`,
      `CONTROL.bufferTime: ${p.bufferTime},`,
    ].join('\n');
  },
};

