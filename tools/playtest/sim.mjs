// Headless runs of every layer, the way the scenes run them but without Phaser: a fixed 60 Hz step, the one
// emulated machine from src/systems/arcade/world.js, the layer modules, and a bot with a noisy hand.
// Each runner takes a session { t, hand, random } and plays until it wins, loses or hits its time cap;
// the full playthrough strings them together with the outer loop (coins, game over, the hall, going deeper).

import { DEEP, HALL, COINS, PLAYTEST, LEVELS } from '../../src/config.js';
import { world, startWorld, tickWorld, newGame, setDriver, setSpeed, pressDir, holdDir, onFrame, setRound, setRepairs, currentRound } from '../../src/systems/arcade/world.js';
import { setHard } from '../../src/systems/layers/hard.js';
import { ORDER, onChange, isHardWon, setLamp, markMazeWon, markWon, markAdderWon, markHardWon } from '../../src/progress.js';
import { loadProgram } from '../../src/systems/arcade/program.js';
import { readState } from '../../src/systems/arcade/state.js';
import { DEEP_LAYERS } from '../../src/systems/layers/index.js';
import { createWalker, steerWalker, stepWalker } from '../../src/systems/layers/walker.js';
import { createHall, stepHall, stepGhosts, startChase, endChase, blocked as hallBlocked, actorPos } from '../../src/systems/hall.js';
import { spendCoin, addCoin, resetWallet, coins } from '../../src/wallet.js';
import { DEEP_BOTS, decideDeep, mazeBot } from './bots.mjs';
import { plan, evade, manhattan } from './plan.mjs';
import { rng, createHand } from './noise.mjs';
import { runAdder } from './adder.mjs';
import { art } from './canvas.mjs';
import { revertPatches } from '../../src/systems/layers/cpu.js';

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
  revertPatches(); // the CPU layer's ROM patches, so every run starts from the original program
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
// while first, so runs see different machine states. hard: play with the layer's hard numbers, switched in the way
// DeepScene does (src/systems/layers/hard.js). over: other numbers to try, merged over DEEP.<id> for this run only
// (for difficulty levels later).
export function runDeep(s, index, { fresh = true, hard = false, over = null } = {}) {
  const L = DEEP_LAYERS[index], bot = DEEP_BOTS[L.id];
  setHard(L.id, hard);
  const C = DEEP[L.id], saved = over ? Object.fromEntries(Object.keys(over).map((k) => [k, C[k]])) : null;
  if (over) Object.assign(C, over);
  try { return deepRun(s, L, bot, fresh); } finally { if (saved) Object.assign(C, saved); setHard(L.id, false); }
}

function deepRun(s, L, bot, fresh) {
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
    const env = { id: L.id, P: DEEP.style[L.id], m, S, t, dt: DT, player, sounds: sounds.splice(0), art };
    const open = (x, y) => L.open(st, env, x, y);
    if (hitT > 0) {
      hitT -= DT;
      if (hitT <= 0) { Object.assign(player, createWalker(L.start.x, L.start.y)); L.onRespawn?.(st, env); }
    } else {
      Object.assign(c, { env, t });
      const want = decideDeep(bot, c);
      for (const d of s.hand.update(s.t, DT, want, (dd) => player.next === dd || player.dir === dd)) steerWalker(player, d); // session time: the hand's clock runs on across layers
      stepWalker(player, (L.walkSpeed ?? DEEP.walkSpeed) * DT, open);
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

// The arcade hall. 'coins': pick up every coin left, then walk to our cabinet and tap it. 'chase': read the
// ghost poster (the ghosts show "!", then speak), then get out the door before the ghosts catch you (or outlast them). A text box stops Pac-Man
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
      if (modal <= 0 && stage === 'noticed') { startChase(h); stage = 'escape'; }
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
      // Stand under the ghost poster and face it.
      const y = h.rows.findIndex((r) => r.includes(HALL.noticeCell)), poster = { x: h.rows[y].indexOf(HALL.noticeCell), y };
      if (from.x === poster.x && from.y === poster.y + 1) faceTo = 'up';
      else want = plan({ from, cols: h.w, open, speed: HALL.walkSpeed, isGoal: (x, yy) => x === poster.x && yy === poster.y + 1 })?.dir ?? 'stop';
    } else {
      const ghosts = h.npcs.map(actorPos);
      const danger = (x, y, eta) => ghosts.some((g) => manhattan(g, { x, y }) < 1.4 + Math.max(0, eta - h.chase.wait) * HALL.chase.speed); // they stand still during the head start
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
      // Read the poster, wait out the "!", read the ghosts' line.
      if (stage === 'talk') { stage = 'noticed'; modal += HALL.noticeTime + tap(s); }
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

// The level 256 repairs follow the hard-mode wins, wired as in src/main.js.
let wired = false;
function wireRepairs() {
  if (wired) return;
  wired = true;
  onChange(() => setRepairs(ORDER.reduce((mask, id, k) => (isHardWon(id) ? mask | (1 << k) : mask), 0)));
}

// The whole game with its outer loop, from the menu's first coin to the credits:
//   maze      play the maze until it's cleared (a game over costs a coin; out of coins, go up through the cabinet
//             to the hall, collect coins, play on in the cabinet). Lamp 1 wakes the monitor.
//   deep      the seven deep layers in lobby order. A game over in the input layer halts the machine: go back up
//             to the maze for a coin, then all the way back down.
//   adder     the bonus layer; winning it turns the 256 switch on.
//   hard      the seven deep layers again with their hard numbers; each win repairs its strip of level 256.
//   256       up to the maze, now on level 256 (a coin per game, the hall when out), until it's cleared: the end.
// Every move between layers costs its transition time, every text box its reading time. Segments are named after
// what's played (maze, cabinet, hall, the layer ids, adder, <id>-hard, maze-256, cabinet-256).
// o.over: { <id>: numbers, '<id>-hard': numbers } merged over DEEP.<id> for that layer's runs (difficulty levels).
export function runPlaythrough(s, o = {}) {
  wireRepairs();
  setLamp(0, false); // a new session: nothing won, level 256 unrepaired
  resetWallet();
  const cap = PLAYTEST.timeCap.playthrough;
  const log = { mazeGames: 0, cabinetGames: 0, hallVisits: 0, coinsFound: 0, deaths: 0, deep: [], segments: [], reached: 'maze' };
  const seg = (name, r) => { log.segments.push({ name, time: +r.time.toFixed(1), result: r.result }); return r; };
  const fail = (result) => ({ win: false, result, time: s.t, ...log });
  let where = 'maze', hall = null, round = 1;

  // Start a fresh game wherever we are (on the current round); false when there are no coins left anywhere.
  // On level 256 the round is set after the reset frame: run a few frames so the last game's RAM is gone.
  const fresh = () => { freshMachine(); if (round > 1) { setRound(round); idle(s, 0.1); } };
  const newGameSomewhere = () => {
    if (spendCoin()) { idle(s, where === 'cabinet' ? COINS.flyTime + COINS.startDelay : tap(s)); fresh(); return true; }
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
    fresh();
    return true;
  };

  // The maze (or the cabinet) until a clear; null when cleared, else the failure.
  const clearMaze = (first) => {
    const tag = round > 1 ? `-${round}` : '';
    for (;;) {
      if (s.t > cap) return 'timeout';
      if (first) { first = false; if (!spendCoin()) return 'out of coins'; fresh(); }
      else if (!newGameSomewhere()) return 'out of coins';
      if (where === 'maze') log.mazeGames++; else log.cabinetGames++;
      const r = seg(where + tag, runMaze(s, { mode: where === 'cabinet' ? 'stick' : 'swipe', fresh: false }));
      log.deaths += r.deaths;
      if (r.win && currentRound() === round) return null;
      idle(s, tap(s));
    }
  };

  // The seven deep layers, normal or hard; null when all are won, else the failure.
  const deepRound = (hard) => {
    for (let i = 0; i < DEEP_LAYERS.length; i++) {
      const id = DEEP_LAYERS[i].id, name = hard ? `${id}-hard` : id;
      log.reached = name;
      const r = seg(name, runDeep(s, i, { fresh: false, hard, over: o.over?.[name] ?? null }));
      log.deep.push({ id: name, time: +r.time.toFixed(1), hits: r.hits, result: r.result });
      if (r.result === 'over') {
        // The machine stopped: up to the maze (or the hall) for a new game, then all the way back down.
        idle(s, DEEP.transition * (i + 1));
        where = 'maze';
        if (!newGameSomewhere()) return 'out of coins';
        setDriver('bot');
        idle(s, DEEP.transition * (i + 1) + (where === 'cabinet' ? DEEP.transition : 0));
        i--;
        continue;
      }
      if (!r.win) return `stuck in ${name}`;
      if (s.t > cap) return 'timeout';
      if (hard) markHardWon(id); else markWon(id);
      idle(s, tap(s) + DEEP.transition);
    }
    return null;
  };

  let f = clearMaze(true);
  if (f) return fail(f);
  markMazeWon();
  idle(s, tap(s) + DEEP.transition * (where === 'cabinet' ? 2 : 1));

  if ((f = deepRound(false))) return fail(f);

  // The bonus layer, from the lobby; its win flips the 256 switch on.
  log.reached = 'adder';
  const a = seg('adder', runAdder(s));
  if (!a.win) return fail('stuck in adder');
  markAdderWon();
  idle(s, tap(s) + DEEP.transition);

  if ((f = deepRound(true))) return fail(f);

  // Up to the maze, which now plays level 256 (repaired by the hard wins).
  log.reached = 'maze-256';
  round = 256;
  where = 'maze';
  idle(s, tap(s) + DEEP.transition);
  if ((f = clearMaze(false))) return fail(`${f} at 256`);
  idle(s, LEVELS.creditsDelay);
  log.reached = 'credits';
  return { win: true, result: 'win', time: s.t, coinsLeft: coins(), ...log };
}

export const LAYERS = ['maze', 'cabinet', 'hall', 'hall-chase', ...DEEP_LAYERS.map((L) => L.id), 'adder'];

// One run of a layer by name. o.hard: deep layers with their hard numbers; o.over: { <id>: numbers } merged over
// DEEP.<id> for the run.
export function runLayer(name, s, o = {}) {
  if (name === 'maze') return runMaze(s, { mode: 'swipe' });
  if (name === 'cabinet') return runMaze(s, { mode: 'stick' });
  if (name === 'hall') return runHall(s, { scenario: 'coins' });
  if (name === 'hall-chase') return runHall(s, { scenario: 'chase' });
  if (name === 'playthrough') return runPlaythrough(s, o);
  if (name === 'adder') return runAdder(s);
  return runDeep(s, DEEP_LAYERS.findIndex((L) => L.id === name), { hard: !!o.hard, over: o.over?.[name] ?? null });
}
