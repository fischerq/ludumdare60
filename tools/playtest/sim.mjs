// Headless runs of every layer, the way the scenes run them but without Phaser: a fixed 60 Hz step, the one
// emulated machine from src/systems/arcade/world.js, the layer modules, and a bot with a noisy hand.
// Each runner takes a session { t, hand, random } and plays until it wins, loses or hits its time cap;
// the full playthrough strings them together with the outer loop (coins, game over, the hall, going deeper).

import { DEEP, HALL, COINS, PLAYTEST } from '../../src/config.js';
import { world, startWorld, tickWorld, newGame, setDriver, setSpeed, pressDir, holdDir, onFrame } from '../../src/systems/arcade/world.js';
import { loadProgram } from '../../src/systems/arcade/program.js';
import { readState } from '../../src/systems/arcade/state.js';
import { DEEP_LAYERS } from '../../src/systems/layers/index.js';
import { createWalker, steerWalker, stepWalker } from '../../src/systems/layers/walker.js';
import { createHall, stepHall, stepGhosts, startChase, endChase, blocked as hallBlocked, actorPos } from '../../src/systems/hall.js';
import { spendCoin, addCoin, resetWallet, coins } from '../../src/wallet.js';
import { DEEP_BOTS, decideDeep, mazeBot } from './bots.mjs';
import { plan, evade, manhattan } from './plan.mjs';
import { rng, createHand } from './noise.mjs';

const DT = 1 / 60;

export async function boot() {
  await startWorld(loadProgram);
}

export function session(seed, noise) {
  const random = rng(seed * 2654435761 + 1);
  Math.random = rng(seed * 40503 + 7); // the layers' own randomness (sparks, bus cycles), seeded per run
  return { t: 0, seed, noise, random, hand: createHand(noise, random) };
}

// Power-cycle the machine into a fresh game, all inputs let go.
function freshMachine() {
  Object.assign(world.input, { held: null, pulse: null, pulseFrames: 0, start: 0, coin: 0 });
  Object.assign(world, { halted: false, paused: false, acc: 0, trace: null });
  setSpeed(1);
  newGame();
}

// Time passing without the bot doing anything (transitions, taps): the machine keeps running.
function idle(s, seconds) {
  for (let k = 0; k < seconds / DT; k++) { tickWorld(DT * 1000); s.t += DT; }
}

const reactTime = (s) => s.noise.reaction * (0.5 + s.random());
const tap = (s) => PLAYTEST.readTime + reactTime(s);

// The maze game, played by swipes (the maze layer) or a held stick (the cabinet). Ends at a clear or game over.
export function runMaze(s, { mode = 'swipe', fresh = true } = {}) {
  if (fresh) freshMachine();
  setDriver('player');
  setSpeed(1);
  const m = world.machine, S = world.program.symbols, t0 = s.t;
  let deaths = 0, last = null, result = 'timeout', running = false;
  while (s.t - t0 < PLAYTEST.timeCap.maze) {
    const g = readState(m, S);
    if (g.phase !== last && g.phase === 'dying') deaths++;
    last = g.phase;
    running ||= g.phase === 'ready' || g.phase === 'play'; // RAM still holds the last game until the program boots
    if (!running) { tickWorld(DT * 1000); s.t += DT; continue; }
    if (g.phase === 'cleared') { result = 'win'; break; }
    if (world.halted || g.phase === 'over') { result = 'over'; break; }
    // The bot counts its own reaction time in when it races the ghosts.
    const want = mazeBot(m, S, s.noise.reaction, 0.25);
    const taken = (d) => (mode === 'stick' ? world.input.held === d : g.pac.dir === d || g.pac.next === d);
    for (const d of s.hand.update(s.t, DT, want, taken)) (mode === 'stick' ? holdDir : pressDir)(d);
    tickWorld(DT * 1000);
    s.t += DT;
  }
  const g = readState(m, S);
  return { win: result === 'win', result, time: s.t - t0, deaths, score: g.score, pellets: g.pellets };
}

// One deep layer (index into DEEP_LAYERS), as DeepScene runs it: the machine runs DEEP.machineSlowdown times slower
// and the in-game bot plays the maze unless the layer steers it. fresh: start a new game and let it run a seeded
// while first, so runs see different machine states.
export function runDeep(s, index, { fresh = true } = {}) {
  const L = DEEP_LAYERS[index], bot = DEEP_BOTS[L.id];
  if (fresh) {
    freshMachine();
    setDriver('bot');
    idle(s, s.random() * PLAYTEST.warmup);
    s.t = 0;
  }
  setDriver(L.drive ? 'player' : 'bot');
  setSpeed(1 / DEEP.machineSlowdown);
  const m = world.machine, S = world.program.symbols, t0 = s.t;
  const sounds = [];
  const off = onFrame((mm, snd) => sounds.push(...snd));
  const st = L.init({ m, S });
  const player = createWalker(L.start.x, L.start.y);
  const c = { L, st, m, S, player, mem: {} };
  bot.setup?.(c);
  let t = 0, got = 0, dots = 0, hits = 0, hitT = 0, result = 'timeout';
  while (t < PLAYTEST.timeCap.deep) {
    tickWorld(DT * 1000);
    t += DT;
    s.t += DT;
    const env = { id: L.id, P: DEEP.style[L.id], m, S, t, dt: DT, player, sounds: sounds.splice(0), art: null };
    const open = (x, y) => L.open(st, env, x, y);
    if (hitT > 0) {
      hitT -= DT;
      if (hitT <= 0) { Object.assign(player, createWalker(L.start.x, L.start.y)); L.onRespawn?.(st, env); }
    } else {
      Object.assign(c, { env, t });
      const want = decideDeep(bot, c);
      for (const d of s.hand.update(t, DT, want, (dd) => player.next === dd || player.dir === dd)) steerWalker(player, d);
      stepWalker(player, DEEP.walkSpeed * DT, open);
      const r = L.update(st, env);
      if (r === 'dot') dots++;
      if (r === 'objective' && ++got >= L.goal) { result = 'win'; break; }
      if (r === 'hit') { hits++; hitT = DEEP.hitPause; L.onHit?.(st, env); }
    }
    if (L.drive) holdDir(L.drive(st, env));
    if (world.halted) { result = 'over'; break; }
  }
  off();
  setDriver('bot');
  setSpeed(1);
  return { win: result === 'win', result, time: s.t - t0, hits, goals: got, dots };
}

// The arcade hall. 'coins': pick up every coin left, then walk to our cabinet and tap it. 'chase': talk to the
// angry visitor, then get out the door before the ghosts catch you (or outlast them). A text box stops Pac-Man
// until it's tapped away. h: a hall to keep between visits (coins stay taken); default a fresh one.
export function runHall(s, { scenario = 'coins', h = null } = {}) {
  h ??= createHall();
  Object.assign(h.pac, { x: 5, y: 4, dir: 'up', moving: false, t: 0 }); // in front of our cabinet
  const t0 = s.t;
  let held = null, modal = 0, stage = scenario === 'coins' ? 'coins' : 'talk', result = 'timeout', got = 0;
  const open = (x, y) => !hallBlocked(h, x, y) || (h.chase && h.rows[y]?.[x] === 'D');
  const say = () => { modal = tap(s); };
  while (s.t - t0 < PLAYTEST.timeCap.hall) {
    s.t += DT;
    if (modal > 0) {
      modal -= DT;
      if (modal <= 0 && stage === 'angry') { startChase(h); stage = 'escape'; }
      continue;
    }
    const p = h.pac, from = { x: p.x, y: p.y };
    // What the bot wants: a direction to walk, 'stop', or to face something and tap.
    let want = 'stop', faceTo = null;
    if (stage === 'coins') {
      const coinsLeft = [...h.coins].map((k) => { const [x, y] = k.split(',').map(Number); return { x, y }; });
      const goals = coinsLeft.length ? coinsLeft : [{ x: 5, y: 4 }];
      if (!coinsLeft.length && from.x === 5 && from.y === 4) faceTo = 'up';
      else want = plan({ from, cols: h.w, open, speed: HALL.walkSpeed, isGoal: (x, y) => goals.some((g) => g.x === x && g.y === y) })?.dir ?? 'stop';
    } else if (stage === 'talk') {
      const angry = h.npcs.find((n) => n.name === HALL.angry);
      const side = [['up', 0, 1], ['down', 0, -1], ['left', 1, 0], ['right', -1, 0]].find(([, dx, dy]) => from.x === angry.x + dx && from.y === angry.y + dy);
      if (side) faceTo = side[0];
      else want = plan({ from, cols: h.w, open, speed: HALL.walkSpeed, isGoal: (x, y) => manhattan({ x, y }, angry) === 1 })?.dir ?? 'stop';
    } else {
      const ghosts = h.npcs.map(actorPos);
      const danger = (x, y, eta) => ghosts.some((g) => manhattan(g, { x, y }) < 1.4 + eta * HALL.chase.speed);
      const door = (x, y) => h.rows[y]?.[x] === 'D';
      want = plan({ from, cols: h.w, open, blocked: danger, speed: HALL.walkSpeed, isGoal: door })?.dir
        ?? evade({ from, cols: h.w, open, blocked: danger, speed: HALL.walkSpeed, canStay: true, score: (x, y) => Math.min(...ghosts.map((g) => manhattan(g, { x, y }))) }) ?? 'stop';
    }
    // Holding a stick with slow hands: let go while still walking onto the tile, then turn to face.
    if (faceTo) want = p.moving ? 'stop' : faceTo;
    for (const d of s.hand.update(s.t, DT, want, (dd) => (dd === 'stop' ? held === null : held === dd))) held = d === 'stop' ? null : d;
    // Facing the thing and standing still: tap it.
    if (faceTo && held === faceTo && !p.moving && p.dir === faceTo) {
      held = null;
      say();
      if (stage === 'coins') { result = 'win'; break; }
      if (stage === 'talk') stage = 'angry';
      continue;
    }
    for (const e of stepHall(h, DT, held)) {
      if (e.type === 'door') { result = 'win'; endChase(h); break; }
      if (e.type === 'coin') { got++; addCoin(`${e.x},${e.y}`); say(); }
    }
    if (result === 'win') break;
    for (const e of stepGhosts(h, DT)) {
      if (e.type === 'caught') { result = 'caught'; endChase(h); }
      if (e.type === 'calm') result = 'win';
    }
    if (result !== 'timeout') break;
  }
  return { win: result === 'win', result, time: s.t - t0, coins: got, h };
}

// The whole game with its outer loop, from the menu's first coin to the bottom layer: play the maze until it's
// cleared (a game over costs a coin; out of coins, go up through the cabinet to the hall, collect coins, play on
// in the cabinet), then go down and clear every deep layer. A game over in the input layer halts the machine:
// go back up to the maze for a coin. Every move between layers costs its transition time.
export function runPlaythrough(s) {
  resetWallet();
  const cap = PLAYTEST.timeCap.playthrough;
  const log = { mazeGames: 0, cabinetGames: 0, hallVisits: 0, coinsFound: 0, deaths: 0, deep: [], segments: [] };
  const seg = (name, r) => { log.segments.push({ name, time: +r.time.toFixed(1), result: r.result }); return r; };
  let where = 'maze', hall = null;

  // Start a fresh game wherever we are; false when there are no coins left anywhere.
  const newGameSomewhere = () => {
    if (spendCoin()) { idle(s, where === 'cabinet' ? COINS.flyTime + COINS.startDelay : tap(s)); freshMachine(); return true; }
    // Out of coins: up to the cabinet and the hall, collect what's left, back into our cabinet.
    idle(s, (where === 'maze' ? DEEP.transition : 0) + HALL.introTime);
    log.hallVisits++;
    const r = seg('hall', runHall(s, { scenario: 'coins', h: hall }));
    hall = r.h;
    log.coinsFound += r.coins;
    idle(s, HALL.outroTime);
    where = 'cabinet';
    if (!spendCoin()) return false;
    idle(s, COINS.flyTime + COINS.startDelay);
    freshMachine();
    return true;
  };

  let first = true, cleared = false;
  while (!cleared && s.t < cap) {
    if (first) { spendCoin(); freshMachine(); first = false; }
    else if (!newGameSomewhere()) return { win: false, result: 'out of coins', time: s.t, ...log };
    if (where === 'maze') log.mazeGames++; else log.cabinetGames++;
    const r = seg(where, runMaze(s, { mode: where === 'cabinet' ? 'stick' : 'swipe', fresh: false }));
    log.deaths += r.deaths;
    cleared = r.win;
    if (!cleared) idle(s, tap(s));
  }
  if (!cleared) return { win: false, result: 'timeout', time: s.t, ...log };
  idle(s, tap(s) + DEEP.transition * (where === 'cabinet' ? 2 : 1));

  for (let i = 0; i < DEEP_LAYERS.length; i++) {
    const r = seg(DEEP_LAYERS[i].id, runDeep(s, i, { fresh: false }));
    log.deep.push({ id: DEEP_LAYERS[i].id, time: +r.time.toFixed(1), hits: r.hits, result: r.result });
    if (r.result === 'over') {
      // The machine stopped: up to the maze (or the hall) for a new game, then all the way back down.
      idle(s, DEEP.transition * (i + 1));
      where = 'maze';
      if (!newGameSomewhere()) return { win: false, result: 'out of coins', time: s.t, ...log };
      setDriver('bot');
      idle(s, DEEP.transition * (i + 1) + (where === 'cabinet' ? DEEP.transition : 0));
      i--;
      continue;
    }
    if (!r.win || s.t > cap) return { win: false, result: `stuck in ${DEEP_LAYERS[i].id}`, time: s.t, ...log };
    idle(s, tap(s) + DEEP.transition);
  }
  return { win: true, result: 'win', time: s.t, coinsLeft: coins(), ...log };
}

export const LAYERS = ['maze', 'cabinet', 'hall', 'hall-chase', ...DEEP_LAYERS.map((L) => L.id)];

// One run of a layer by name.
export function runLayer(name, s) {
  if (name === 'maze') return runMaze(s, { mode: 'swipe' });
  if (name === 'cabinet') return runMaze(s, { mode: 'stick' });
  if (name === 'hall') return runHall(s, { scenario: 'coins' });
  if (name === 'hall-chase') return runHall(s, { scenario: 'chase' });
  if (name === 'playthrough') return runPlaythrough(s);
  return runDeep(s, DEEP_LAYERS.findIndex((L) => L.id === name));
}
