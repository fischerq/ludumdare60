// The Game Boy's rival fight, no Phaser: your mini-Gurke against BLUE's, one move each per turn, you first.
// A turn returns its steps: { text, hp: { mine, enemy } } so the scene shows each line with the HP bars as they
// were at that moment.

import { GB } from '../../config.js';

export function createBattle(mine, enemy, rand = Math.random) {
  const hp = GB.battle.hp;
  return { rand, mine: { kind: mine, hp, max: hp }, enemy: { kind: enemy, hp, max: hp }, over: null };
}

const fill = (t, o) => t.replace(/\{(\w+)\}/g, (m, k) => o[k] ?? m);
const effect = (from, to) => (GB.strong[from] === to ? 2 : GB.strong[to] === from ? 0.5 : 1);

// One attack: { move: 'tackle' | 'type' | 'sour' }. Pushes its lines onto `steps`.
function attack(b, who, move, steps) {
  const T = GB.text, B = GB.battle, me = b[who], foe = b[who === 'mine' ? 'enemy' : 'mine'];
  const name = GB.mons[me.kind].name, whoText = who === 'mine' ? name : fill(T.enemyWho, { name });
  const snap = (text) => steps.push({ text, hp: { mine: b.mine.hp, enemy: b.enemy.hp } });
  if (move === 'sour') { snap(fill(T.sour, { name })); return; }
  const typed = move === 'type';
  const eff = typed ? effect(me.kind, foe.kind) : 1;
  const power = typed ? B.typeMove : B.tackle;
  const dmg = Math.max(1, Math.round(power * eff * (1 - B.spread / 2 + B.spread * b.rand())));
  foe.hp = Math.max(0, foe.hp - dmg);
  snap(fill(T.used, { who: whoText, move: typed ? GB.mons[me.kind].move : T.tackle }));
  if (eff > 1) snap(T.super);
  if (eff < 1) snap(T.weak);
  if (foe.hp <= 0) {
    const foeName = GB.mons[foe.kind].name;
    snap(fill(T.fainted, { who: who === 'mine' ? fill(T.enemyWho, { name: foeName }) : foeName }));
    b.over = who === 'mine' ? 'win' : 'lose';
  }
}

// Your move ('tackle' or 'type'), then BLUE's if his mini-Gurke is still standing.
export function playTurn(b, move) {
  const steps = [];
  attack(b, 'mine', move, steps);
  if (!b.over) {
    const r = b.rand(), R = GB.battle.rival;
    attack(b, 'enemy', r < R.tackle ? 'tackle' : r < R.tackle + R.typeMove ? 'type' : 'sour', steps);
  }
  return steps;
}
