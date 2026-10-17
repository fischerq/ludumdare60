// Maze-chomper rules with no Phaser, so the game scene, lab benches and later layers run the same code.
// Positions are in tiles: an actor at whole-number (x, y) sits on that tile's center.

import { MAZE, SPEED, GHOSTS, RULES } from '../config.js';

export const DIRS = {
  up: { x: 0, y: -1 }, left: { x: -1, y: 0 }, down: { x: 0, y: 1 }, right: { x: 1, y: 0 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };
const ORDER = ['up', 'left', 'down', 'right']; // the original's tie-break order
const EPS = 1e-6;

export function cellAt(maze, x, y) {
  x = Math.round(x); y = Math.round(y);
  if (y < 0 || y >= maze.h) return '#';
  return maze.rows[y][((x % maze.w) + maze.w) % maze.w];
}

const pacCanEnter = (maze) => (x, y) => !'#-G'.includes(cellAt(maze, x, y));
const ghostCanEnter = pacCanEnter;

export function createGame(layout = MAZE.layout) {
  const maze = { rows: layout, w: layout[0].length, h: layout.length };
  // pellets[y][x]: 0 none, 1 dot, 2 power pellet
  const pellets = layout.map((r) => [...r].map((c) => (c === '.' ? 1 : c === 'o' ? 2 : 0)));
  const left = pellets.flat().filter(Boolean).length;
  const g = {
    maze, pellets, pelletsLeft: left, pelletsTotal: left,
    score: 0, lives: RULES.lives,
    phase: 'ready', phaseTime: RULES.readyTime,
    freeze: 0, fright: 0, ghostCombo: 0,
    modeIndex: 0, modeTime: RULES.modeSchedule[0], elapsed: 0,
    pac: null, ghosts: [],
  };
  resetActors(g);
  return g;
}

function resetActors(g) {
  g.pac = { ...MAZE.pacStart, dir: 'left', nextDir: null, moved: 0 };
  g.ghosts = GHOSTS.map((d) => ({
    name: d.name, corner: d.corner, x: d.start.x, y: d.start.y, dir: 'left',
    state: d.release === 0 && d.start.y === MAZE.houseExit.y ? 'active' : 'house',
    release: d.release, frightened: false,
  }));
  g.fright = 0;
  g.freeze = 0;
}

export const isChase = (g) => g.modeIndex % 2 === 1;

// Turn the chomper. Reversing works at once; other turns wait until they fit.
export function steer(g, dir) {
  g.pac.nextDir = dir;
}

// Advance the game by dt seconds. Returns events for sound and effects.
export function stepGame(g, dt) {
  const events = [];
  if (g.phase === 'over' || g.phase === 'cleared') return events;

  if (g.phase !== 'play') {
    g.phaseTime -= dt;
    if (g.phaseTime > 0) return events;
    if (g.phase === 'ready') { g.phase = 'play'; events.push({ type: 'go' }); }
    else if (g.phase === 'dying') {
      g.lives -= 1;
      if (g.lives <= 0) { g.phase = 'over'; events.push({ type: 'over' }); }
      else { resetActors(g); g.phase = 'ready'; g.phaseTime = RULES.readyTime; events.push({ type: 'ready' }); }
    } else if (g.phase === 'clearing') { g.phase = 'cleared'; events.push({ type: 'cleared' }); }
    return events;
  }

  if (g.freeze > 0) { g.freeze -= dt; return events; }
  g.elapsed += dt;

  updateModes(g, dt, events);
  movePac(g, dt, events);
  if (g.phase !== 'play') return events;
  checkHits(g, events);
  if (g.phase !== 'play' || g.freeze > 0) return events;
  for (const gh of g.ghosts) moveGhost(g, gh, dt);
  checkHits(g, events);
  return events;
}

function updateModes(g, dt, events) {
  if (g.fright > 0) {
    g.fright -= dt;
    if (g.fright <= 0) {
      g.ghosts.forEach((gh) => { gh.frightened = false; });
      events.push({ type: 'frightEnd' });
    }
    return; // the scatter/chase clock stops while ghosts are frightened
  }
  if (g.modeIndex < RULES.modeSchedule.length) {
    g.modeTime -= dt;
    if (g.modeTime <= 0) {
      g.modeIndex += 1;
      g.modeTime = RULES.modeSchedule[g.modeIndex] ?? Infinity;
      reverseGhosts(g);
    }
  }
}

function reverseGhosts(g) {
  for (const gh of g.ghosts) if (gh.state === 'active') gh.dir = OPPOSITE[gh.dir];
}

function movePac(g, dt, events) {
  const p = g.pac;
  const canEnter = pacCanEnter(g.maze);
  if (p.nextDir && p.nextDir === OPPOSITE[p.dir]) p.dir = p.nextDir;
  const before = { x: p.x, y: p.y };
  advance(p, SPEED.pac * dt, g.maze, canEnter, (a) => {
    if (a.nextDir && canEnter(a.x + DIRS[a.nextDir].x, a.y + DIRS[a.nextDir].y)) a.dir = a.nextDir;
    eatAt(g, a.x, a.y, events);
  });
  const step = Math.abs(p.x - before.x) + Math.abs(p.y - before.y);
  if (step < 1) p.moved += step; // skip the jump when wrapping through the tunnel
  // Eat as soon as the chomper is mostly on a tile, not only at its exact center.
  eatAt(g, Math.round(p.x), Math.round(p.y), events);
}

function eatAt(g, x, y, events) {
  x = ((Math.round(x) % g.maze.w) + g.maze.w) % g.maze.w;
  y = Math.round(y);
  const kind = g.pellets[y]?.[x];
  if (!kind) return;
  g.pellets[y][x] = 0;
  g.pelletsLeft -= 1;
  if (kind === 1) {
    g.score += RULES.dotPoints;
    events.push({ type: 'dot', x, y });
  } else {
    g.score += RULES.powerPoints;
    g.fright = RULES.frightTime;
    g.ghostCombo = 0;
    for (const gh of g.ghosts) {
      if (gh.state === 'eyes' || gh.state === 'enter') continue;
      gh.frightened = true;
      if (gh.state === 'active') gh.dir = OPPOSITE[gh.dir];
    }
    events.push({ type: 'power', x, y });
  }
  if (g.pelletsLeft === 0) {
    g.phase = 'clearing';
    g.phaseTime = RULES.clearTime;
    events.push({ type: 'clear' });
  }
}

function moveGhost(g, gh, dt) {
  const { houseExit, houseInside } = MAZE;
  if (gh.state === 'house') {
    gh.release -= dt;
    if (gh.release <= 0) gh.state = 'exit';
    return;
  }
  if (gh.state === 'exit') {
    if (moveStraight(gh, SPEED.ghostHouse * dt, houseExit)) { gh.state = 'active'; gh.dir = 'left'; }
    return;
  }
  if (gh.state === 'enter') {
    if (moveStraight(gh, SPEED.ghostEyes * 0.5 * dt, houseInside)) { gh.state = 'exit'; gh.frightened = false; }
    return;
  }
  let speed = SPEED.ghost;
  if (gh.state === 'eyes') speed = SPEED.ghostEyes;
  else if (gh.frightened) speed = SPEED.ghostFright;
  if (gh.state !== 'eyes' && cellAt(g.maze, gh.x, gh.y) === 'T') speed = Math.min(speed, SPEED.ghostTunnel);

  const canEnter = ghostCanEnter(g.maze);
  advance(gh, speed * dt, g.maze, canEnter, (a) => {
    if (a.state === 'eyes' && a.x === houseExit.x && a.y === houseExit.y) { a.state = 'enter'; a.dir = null; return; }
    a.dir = chooseDir(g, a, canEnter);
  });
}

// Pick the next direction at a tile center: never reverse, head for the target (random when frightened).
function chooseDir(g, gh, canEnter) {
  let options = ORDER.filter((d) => d !== OPPOSITE[gh.dir] && canEnter(gh.x + DIRS[d].x, gh.y + DIRS[d].y));
  if (!options.length) options = ORDER.filter((d) => canEnter(gh.x + DIRS[d].x, gh.y + DIRS[d].y));
  if (!options.length) return null;
  if (gh.frightened && gh.state === 'active') return options[Math.floor(Math.random() * options.length)];
  const t = ghostTarget(g, gh);
  let best = options[0], bestD = Infinity;
  for (const d of options) {
    const dx = gh.x + DIRS[d].x - t.x, dy = gh.y + DIRS[d].y - t.y;
    const dist = dx * dx + dy * dy;
    if (dist < bestD - EPS) { best = d; bestD = dist; }
  }
  return best;
}

export function ghostTarget(g, gh) {
  if (gh.state === 'eyes') return MAZE.houseExit;
  if (!isChase(g)) return gh.corner;
  const p = { x: Math.round(g.pac.x), y: Math.round(g.pac.y) };
  const pd = DIRS[g.pac.dir] ?? { x: 0, y: 0 };
  switch (gh.name) {
    case 'pinky': return { x: p.x + pd.x * RULES.pinkyAhead, y: p.y + pd.y * RULES.pinkyAhead };
    case 'inky': {
      const b = g.ghosts.find((o) => o.name === 'blinky') ?? gh;
      const a = { x: p.x + pd.x * RULES.inkyAhead, y: p.y + pd.y * RULES.inkyAhead };
      return { x: 2 * a.x - Math.round(b.x), y: 2 * a.y - Math.round(b.y) };
    }
    case 'clyde': {
      const far = Math.hypot(gh.x - p.x, gh.y - p.y) > RULES.clydeShyDistance;
      return far ? p : gh.corner;
    }
    default: return p;
  }
}

function checkHits(g, events) {
  const p = g.pac;
  for (const gh of g.ghosts) {
    if (gh.state !== 'active' && gh.state !== 'exit') continue;
    let dx = Math.abs(gh.x - p.x);
    dx = Math.min(dx, g.maze.w - dx);
    if (dx + Math.abs(gh.y - p.y) > RULES.hitDistance) continue;
    if (gh.frightened) {
      const points = RULES.ghostPoints[Math.min(g.ghostCombo, RULES.ghostPoints.length - 1)];
      g.ghostCombo += 1;
      g.score += points;
      gh.frightened = false;
      gh.state = 'eyes';
      // Eyes navigate the maze from the nearest tile center.
      gh.x = Math.round(gh.x); gh.y = Math.round(gh.y);
      g.freeze = RULES.ghostEatPause;
      events.push({ type: 'ghost', x: gh.x, y: gh.y, points, name: gh.name });
      return;
    }
    g.phase = 'dying';
    g.phaseTime = RULES.dyingTime;
    events.push({ type: 'death' });
    return;
  }
}

// Move an actor dist tiles along the maze. onCenter runs at every tile center and may change a.dir.
function advance(a, dist, maze, canEnter, onCenter) {
  let guard = 0;
  while (dist > EPS && guard++ < 50) {
    const atCenter = Math.abs(a.x - Math.round(a.x)) < EPS && Math.abs(a.y - Math.round(a.y)) < EPS;
    if (atCenter) {
      a.x = Math.round(a.x); a.y = Math.round(a.y);
      onCenter(a);
      if (!a.dir || !canEnter(a.x + DIRS[a.dir].x, a.y + DIRS[a.dir].y)) return;
    }
    const d = DIRS[a.dir];
    const pos = d.x ? a.x : a.y;
    const frac = pos - Math.floor(pos);
    const toCenter = frac < EPS ? 1 : (d.x + d.y > 0 ? 1 - frac : frac);
    const step = Math.min(dist, toCenter);
    a.x += d.x * step;
    a.y += d.y * step;
    dist -= step;
    if (step >= toCenter - EPS) { a.x = Math.round(a.x); a.y = Math.round(a.y); }
    if (a.x < -0.5) a.x += maze.w;
    if (a.x > maze.w - 0.5) a.x -= maze.w;
  }
}

// Move straight toward a tile, ignoring walls (ghost house only): first sideways, then up or down.
function moveStraight(a, dist, to) {
  if (Math.abs(a.x - to.x) > EPS) {
    const s = Math.min(dist, Math.abs(to.x - a.x));
    a.dir = to.x > a.x ? 'right' : 'left';
    a.x += Math.sign(to.x - a.x) * s;
    dist -= s;
  }
  if (dist > EPS && Math.abs(a.y - to.y) > EPS) {
    const s = Math.min(dist, Math.abs(to.y - a.y));
    a.dir = to.y > a.y ? 'down' : 'up';
    a.y += Math.sign(to.y - a.y) * s;
  }
  const done = Math.abs(a.x - to.x) < EPS && Math.abs(a.y - to.y) < EPS;
  if (done) { a.x = to.x; a.y = to.y; }
  return done;
}
