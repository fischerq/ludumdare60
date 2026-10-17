// Grid planning for the bots: breadth-first search from the player's tile to the nearest goal, skipping tiles
// that will be dangerous by the time the player gets there (eta = steps / speed). Positions in tiles.

export const STEP = { up: [0, -1], left: [-1, 0], down: [0, 1], right: [1, 0] };
const OFFSET = 4; // rows above 0 a layer may use (the CPU layer's page edge is row -1)

// The tile a walker decides from: the next tile center it reaches (its own tile when standing).
export function decisionTile(p) {
  const rx = Math.round(p.x), ry = Math.round(p.y);
  if (!p.dir || (Math.abs(p.x - rx) < 1e-6 && Math.abs(p.y - ry) < 1e-6)) return { x: rx, y: ry };
  const [dx, dy] = STEP[p.dir];
  return { x: dx > 0 ? Math.ceil(p.x) : dx < 0 ? Math.floor(p.x) : rx, y: dy > 0 ? Math.ceil(p.y) : dy < 0 ? Math.floor(p.y) : ry };
}

// First step toward the nearest goal: { dir, dist, goal, path } or null (path: the directions of every step). o: { from, cols, open(x, y), blocked(x, y, eta),
// isGoal(x, y, eta), speed, wrap }. A goal under the player's feet doesn't count (the bot is already there).
export function plan(o) {
  const { from, cols, open, blocked = () => false, isGoal, speed, wrap = false } = o;
  const key = (x, y) => (y + OFFSET) * cols + x;
  const seen = new Map([[key(from.x, from.y), null]]); // tile -> [previous tile, direction taken]
  let queue = [{ x: from.x, y: from.y, first: null }];
  const pathTo = (k) => { const dirs = []; for (let e = seen.get(k); e; e = seen.get(e[0])) dirs.unshift(e[1]); return dirs; };
  for (let depth = 1; queue.length && depth < 2000; depth++) {
    const next = [];
    const eta = depth / speed;
    for (const c of queue) {
      for (const [dir, [dx, dy]] of Object.entries(STEP)) {
        let nx = c.x + dx;
        const ny = c.y + dy;
        if (wrap) nx = (nx + cols) % cols;
        const k = key(nx, ny);
        if (seen.has(k) || !open(nx, ny)) continue;
        seen.set(k, [key(c.x, c.y), dir]);
        if (blocked(nx, ny, eta)) continue;
        const first = c.first ?? dir;
        if (isGoal(nx, ny, eta)) return { dir: first, dist: depth, goal: { x: nx, y: ny }, path: pathTo(k) };
        next.push({ x: nx, y: ny, first });
      }
    }
    queue = next;
  }
  return null;
}

// No safe way to a goal: the best neighbor by score(x, y) (higher is better), safe ones first. canStay: the
// player can stand still (the hall); the deep-layer walker can't, it keeps walking until a wall. Returns a
// direction, or null to stay put.
export function evade(o) {
  const { from, open, blocked = () => false, score, speed, cols, wrap = false, canStay = false } = o;
  let best = canStay && !blocked(from.x, from.y, 0.15) ? { dir: null, s: score(from.x, from.y) + 0.01, safe: true } : null;
  for (const [dir, [dx, dy]] of Object.entries(STEP)) {
    let nx = from.x + dx;
    const ny = from.y + dy;
    if (wrap) nx = (nx + cols) % cols;
    if (!open(nx, ny)) continue;
    const safe = !blocked(nx, ny, 1 / speed), s = score(nx, ny);
    if (!best || (safe && !best.safe) || (safe === best.safe && s > best.s)) best = { dir, s, safe };
  }
  return best?.dir ?? null;
}

export const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
