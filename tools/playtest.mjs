// Playtest bots: a bot plays every layer (and the whole game with its outer loop) with a noise model that makes it
// play like a human thumb, swept from no noise to sloppy. Measures win rate and time to solve per layer and level.
// See design/systems/playtest.md; the lab page /lab/playtest.html charts the results file.
//
//   node tools/playtest.mjs                       every layer + the full playthrough, PLAYTEST.runs runs per level
//   node tools/playtest.mjs --quick               PLAYTEST.quickRuns runs per level
//   node tools/playtest.mjs --layers maze,crt     only these (names: maze cabinet hall hall-chase crt signals ram
//                                                 bus cpu logic input playthrough)
//   node tools/playtest.mjs --noise 0,0.5,1       noise levels (default PLAYTEST.levels)
//   node tools/playtest.mjs --levels [n]          the game levels of the deep layers and the adder: every level 1..n
//                                                 (default DEEP.capLevel) at each noise level (default
//                                                 PLAYTEST.levelNoise), win rate per level and the highest level
//                                                 reached in a row; results in lab/playtest/levels.json.
//                                                 --from k: start at level k (for tuning the cap: --levels 8 --from 8)
//   node tools/playtest.mjs --knob reaction       sweep one knob only: reaction, slip, lapse (default all)
//   node tools/playtest.mjs --runs 50 --seed 7    run count and base seed (run i uses seed + i at every level)
//   node tools/playtest.mjs --out FILE            results file (default lab/playtest/results.json); --no-save
//   node tools/playtest.mjs --verbose             one line per run
//   node tools/playtest.mjs --set SPEED.ghost=5   try config values (comma-separated) without editing config.js
//   node tools/playtest.mjs --hard                the deep layers at DEEP.hardLevel (as with the 256 switch on);
//                                                 default layers: the seven deep ones, results in
//                                                 lab/playtest/results-hard.json
// Needs network once for the pinned Z80 core (like tools/arcade_test.mjs).

import './playtest/env.mjs';
import { writeFile } from 'node:fs/promises';
import * as CONFIG from '../src/config.js';
const { PLAYTEST } = CONFIG;
import { boot, session, runLayer, LAYERS } from './playtest/sim.mjs';
import { noiseAt } from './playtest/noise.mjs';

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : dflt; };
const flag = (name) => args.includes(`--${name}`);

const hard = flag('hard');
const DEEP_IDS = LAYERS.filter((l) => CONFIG.DEEP[l]);
const gameLevels = flag('levels') ? Number(/^\d+$/.test(opt('levels', '')) ? opt('levels') : CONFIG.DEEP.capLevel) : 0;
const fromLevel = Number(opt('from', 1)); // --levels: first level played (the reached count assumes 1)
const LEVELED = LAYERS.filter((l) => CONFIG.DEEP[l] || l === 'adder');
const layers = opt('layers', (gameLevels ? LEVELED : hard ? DEEP_IDS : [...LAYERS, 'playthrough']).join(',')).split(',');
const levels = opt('noise', (gameLevels ? PLAYTEST.levelNoise : PLAYTEST.levels).join(',')).split(',').map(Number);
const knob = opt('knob', 'all');
const runs = Number(opt('runs', flag('quick') ? PLAYTEST.quickRuns : PLAYTEST.runs));
const seed = Number(opt('seed', 1));
const out = opt('out', gameLevels ? 'lab/playtest/levels.json' : hard ? 'lab/playtest/results-hard.json' : 'lab/playtest/results.json');

const unknown = layers.filter((l) => l !== 'playthrough' && !LAYERS.includes(l));
if (hard && layers.some((l) => !DEEP_IDS.includes(l))) { console.error(`--hard: deep layers only (${DEEP_IDS.join(' ')})`); process.exit(1); }
if (gameLevels && layers.some((l) => !LEVELED.includes(l))) { console.error(`--levels: ${LEVELED.join(' ')} only`); process.exit(1); }
if (unknown.length) { console.error(`unknown layer(s): ${unknown.join(', ')}; known: ${LAYERS.join(' ')} playthrough`); process.exit(1); }

const quantile = (xs, q) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), i = (s.length - 1) * q, lo = Math.floor(i);
  return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo);
};
const round = (v, d = 1) => (v === null || v === undefined ? null : +v.toFixed(d));
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// --set SPEED.ghost=5,DEEP.bus.cycleTime=1.4: try config values without editing src/config.js (before the
// program is assembled, so maze numbers count too).
// Values may be JSON arrays (DEEP.input.levels.cap.sparkEvery=[2,3]); commas inside brackets don't split.
const splitTop = (str) => { const out = ['']; let d = 0; for (const ch of str) { d += ch === '[' ? 1 : ch === ']' ? -1 : 0; if (ch === ',' && !d) out.push(''); else out[out.length - 1] += ch; } return out; };
const sets = opt('set', '') ? splitTop(opt('set', '')) : [];
for (const kv of sets) {
  const [path, v] = kv.split('='), keys = path.split('.'), last = keys.pop();
  const obj = keys.reduce((o, k) => o?.[k], CONFIG);
  if (!obj || !(last in obj)) { console.error(`--set: no config value ${path}`); process.exit(1); }
  obj[last] = JSON.parse(v);
}
await boot();
const started = Date.now();
if (gameLevels) await levelSweep();
const report = { generated: new Date().toISOString().slice(0, 10), knob, runs, seed, levels, set: sets, hard, layers: {} };

for (const layer of layers) {
  const rows = [];
  for (const level of levels) {
    const noise = noiseAt(level, knob);
    const results = [];
    for (let i = 0; i < runs; i++) {
      const s = session(seed + i, noise);
      const r = runLayer(layer, s, { hard });
      r.swipesPerSec = r.time > 0 ? s.hand.swipes / r.time : 0;
      r.slips = s.hand.slips;
      results.push(r);
      if (flag('verbose')) console.log(`${layer} level ${level} run ${i}: ${r.result} in ${r.time.toFixed(1)} s`, r.hits ?? r.deaths ?? '');
    }
    const wins = results.filter((r) => r.win), times = wins.map((r) => r.time);
    const tally = {};
    for (const r of results) tally[r.result] = (tally[r.result] ?? 0) + 1;
    const row = {
      level, winRate: round(wins.length / runs, 2),
      time: { p25: round(quantile(times, 0.25)), median: round(quantile(times, 0.5)), p75: round(quantile(times, 0.75)) },
      hits: round(mean(results.map((r) => r.hits ?? r.deaths ?? 0)), 2),
      swipesPerSec: round(mean(results.map((r) => r.swipesPerSec)), 2),
      results: tally,
    };
    if (layer === 'playthrough') {
      row.coinsFound = round(mean(results.map((r) => r.coinsFound)), 2);
      row.hallVisits = round(mean(results.map((r) => r.hallVisits)), 2);
      row.mazeGames = round(mean(results.map((r) => r.mazeGames + r.cabinetGames)), 2);
      const seg = {};
      for (const r of results) for (const g of r.segments) (seg[g.name] ??= []).push(g.time);
      row.segmentTime = Object.fromEntries(Object.entries(seg).map(([k, v]) => [k, round(quantile(v, 0.5))]));
      // How far runs got: the segment each run ended in (credits for a win).
      row.reached = {};
      for (const r of results) row.reached[r.reached] = (row.reached[r.reached] ?? 0) + 1;
    }
    rows.push(row);
  }
  report.layers[layer] = rows;
  const line = rows.map((r) => `${String(r.level).padEnd(4)} win ${String(Math.round(r.winRate * 100)).padStart(3)}%  t ${String(r.time.median ?? '-').padStart(6)} s  hits ${r.hits}`).join('\n   ');
  console.log(`${layer}\n   ${line}`);
}
report.seconds = Math.round((Date.now() - started) / 1000);
console.log(`done in ${report.seconds} s`);
if (!flag('no-save')) {
  await writeFile(out, `${JSON.stringify(report, null, 1)}\n`);
  console.log(`wrote ${out}`);
}
process.exit(0);

// --levels: per layer and noise level, levels 1..gameLevels with that level's numbers (run i uses seed + i at every
// level). reached: per run, the levels won in a row from level 1 (the endless run a player would have).
async function levelSweep() {
  const rep = { generated: new Date().toISOString().slice(0, 10), knob, runs, seed, noise: levels, maxLevel: gameLevels, set: sets, layers: {} };
  for (const layer of layers) {
    const C = layer === 'adder' ? CONFIG.ADDER : CONFIG.DEEP[layer];
    const entry = { capLevel: C.levels?.capLevel ?? CONFIG.DEEP.capLevel, noise: [] };
    for (const level of levels) {
      const noise = noiseAt(level, knob), lost = Array(runs).fill(null), rows = [];
      for (let n = fromLevel; n <= gameLevels; n++) {
        const res = [];
        for (let i = 0; i < runs; i++) {
          const r = runLayer(layer, session(seed + i, noise), { level: n });
          res.push(r);
          if (!r.win && lost[i] === null) lost[i] = n;
          if (flag('verbose')) console.log(`${layer} noise ${level} level ${n} run ${i}: ${r.result} in ${r.time.toFixed(1)} s`);
        }
        const wins = res.filter((r) => r.win);
        rows.push({ level: n, winRate: round(wins.length / runs, 2), time: round(quantile(wins.map((r) => r.time), 0.5)), hits: round(mean(res.map((r) => r.hits ?? 0)), 2) });
      }
      const reached = lost.map((n) => (n === null ? gameLevels : n - 1)); // from level fromLevel on
      entry.noise.push({ noise: level, levels: rows, reached: { median: round(quantile(reached, 0.5)), max: Math.max(...reached) } });
      console.log(`${layer} noise ${level}: ${rows.map((r) => `L${r.level} ${Math.round(r.winRate * 100)}%`).join('  ')}   reached median ${round(quantile(reached, 0.5))}`);
    }
    rep.layers[layer] = entry;
  }
  rep.seconds = Math.round((Date.now() - started) / 1000);
  console.log(`done in ${rep.seconds} s`);
  if (!flag('no-save')) { await writeFile(out, `${JSON.stringify(rep, null, 1)}\n`); console.log(`wrote ${out}`); }
  process.exit(0);
}
