// Deep layer 7, the input wires: fix the joystick, then play. No Phaser. The joystick's base sits on the board
// with its four microswitches; big wires run from them up to IN0's pins under the machine's picture. The four
// wires are cut, their ends lying on the board. Walk onto a loose end to take it (the wire is laid where you
// walk) and carry it to its pin. Until a wire is fixed its switch can't pull its bit low: the machine's Pac-Man
// (played by the bot) can't turn that way, and the switch and pin flash when he wants to. The enemy: noise sparks
// that run along the wires from the switches (a switch blinks red before it fires one). With all four fixed, walk
// onto the stick to grab it: the round starts again with a full maze, the picture grows and your swipes go through the repaired switches into IN0, so you
// play the real game; eat DEEP.input.playDots dots to win. Numbers and the board in DEEP.input.

import { DEEP } from '../../config.js';
import { world, pressStart, setSpeed, setRound, currentRound } from '../arcade/world.js';
import { IN0, DSW } from '../arcade/memmap.js';
import { botDirection } from '../arcade/bot.js';
import { drawPlayfield, W as MW, H as MH } from '../arcade/video.js';
import { readState } from '../arcade/state.js';
import { tinyText } from './font.js';
import { touching } from './chaser.js';
import { STEP } from './walker.js';
import { css, floor, neonBox, neonBlock, HAZARD, HAZARD_GLOW } from './tron.js';

const C = DEEP.input;
const COLS = 11, ROWS = 17, TOP = C.top, B = C.base;
const DIRS = ['up', 'left', 'down', 'right'];   // IN0's bit order
const LABEL = { up: 'UP', left: 'LEFT', right: 'RIGHT', down: 'DOWN' };
const LETTER = { up: 'U', left: 'L', right: 'R', down: 'D' };
const STICK = { x: B.x + 1, y: B.y + 1 };       // the stick in the middle of the base

// Corner points to a list of tiles, one step at a time.
function expand(points) {
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    let [x, y] = out[out.length - 1];
    const [tx, ty] = points[i];
    while (x !== tx || y !== ty) {
      x += Math.sign(tx - x); if (x === tx) y += Math.sign(ty - y);
      out.push([x, y]);
    }
  }
  return out;
}
const ROUTE = Object.fromEntries(DIRS.map((d) => [d, expand(C.wires[d].route)]));
const inBase = (x, y) => x >= B.x && x < B.x + 3 && y >= B.y && y < B.y + 3;
const rand = ([a, b]) => a + Math.random() * (b - a);
const at = (path, s) => {
  const i = Math.max(0, Math.min(path.length - 1, Math.floor(s))), j = Math.min(path.length - 1, i + 1), f = Math.max(0, Math.min(1, s - i));
  return { x: path[i][0] + (path[j][0] - path[i][0]) * f, y: path[i][1] + (path[j][1] - path[i][1]) * f };
};

export default {
  id: 'input',
  title: 'THE INPUT WIRES',
  subtitle: 'CARRY THE 4 CUT WIRES TO THEIR PINS\nTHEN PLAY WITH THE STICK',
  cols: COLS, rows: ROWS,
  start: C.start,
  get goal() { return C.goal; }, // read live: hard mode can change it (hard.js)
  dots: false,
  TOP, STICK, ROUTE, DIRS,   // for the playtest bot

  init() {
    return {
      phase: 'repair',   // 'repair' the wires, 'grab' the stick, 'play' the game
      wires: Object.fromEntries(DIRS.map((d, i) => [d, { fixed: false, path: expand(C.wires[d].loose), next: C.sparkDelay + i * 0.9 + rand([0, 1]) }])),
      carry: null,       // the direction whose loose end you carry
      sparks: [],        // { dir, s (tiles along path), path }
      held: null,        // the direction held on the machine
      cut: null, cutT: -99, // the cut direction Pac-Man last wanted, and when
      playFrom: 0, eaten: 0,
    };
  },

  area(x, y) {
    return x >= 0 && x < COLS && y >= TOP && y < ROWS;
  },

  open(st, env, x, y) {
    if (st.phase === 'play') return false;   // your hand is on the stick: swipes go to the machine
    return this.area(x, y) && (st.phase === 'grab' || !inBase(x, y));
  },

  fixed(st) {
    return DIRS.filter((d) => st.wires[d].fixed).length;
  },

  counter(st) {
    const w = `WIRES ${this.fixed(st)}/4`;
    return st.phase === 'play' ? `${w}   DOTS ${st.eaten}/${C.playDots}` : w;
  },

  info(st, env) {
    if (st.phase === 'play') return st.eaten ? `EAT ${C.playDots - st.eaten} MORE DOTS` : 'SWIPE TO PLAY! EAT THE DOTS';
    if (st.phase === 'grab') return 'ALL WIRES WORK: GRAB THE STICK';
    if (st.carry) return `TAKE THE ${LABEL[st.carry]} WIRE TO PIN ${LETTER[st.carry]}`;
    if (env.t - st.cutT < C.cutFlash) return `PAC-MAN CAN'T GO ${LABEL[st.cut]}: WIRE CUT`;
    return 'PICK UP A LOOSE WIRE END';
  },

  // Grab the stick: park on it, swipes from now on are the stick's direction.
  park(st, player) {
    Object.assign(player, { x: STICK.x, y: STICK.y, dir: null, next: null });
  },

  onHit(st, env) {
    // A spark got you: you drop the wire end where you are; a moment of quiet.
    st.carry = null;
    st.sparks = [];
    for (const d of DIRS) st.wires[d].next = Math.max(st.wires[d].next, env.t + C.sparkDelay);
  },

  onRespawn(st, env) {
    if (st.phase === 'play') this.park(st, env.player);
  },

  // The joystick direction this layer holds on the machine.
  drive(st) {
    return st.held;
  },

  update(st, env) {
    const { m, S: syms, t, dt, player, sounds } = env;
    // The board keeps the game going for you: deaths don't cost lives (demo switch), START is pressed for you.
    m.setDip(DSW.demo, true);
    if (world.halted) world.halted = false;
    const g = readState(m, syms);
    if ((g.phase === 'attract' || g.phase === 'cleared' || g.phase === 'over') && !world.input.start) pressStart();

    if (st.phase === 'play') {
      setSpeed(C.playSpeed);
      if (player.next) { st.held = player.next; player.dir = player.next; }
      if (sounds.some((e) => e.name === 'death')) return 'hit';
      // Dots count from your first swipe on (before it, Pac-Man only runs on by himself).
      if (st.held && g.phase === 'play' && sounds.some((e) => e.name === 'dot' || e.name === 'power')) {
        st.eaten = Math.min(C.playDots, st.eaten + 1);
        return st.eaten === C.playDots ? 'objective' : 'dot';
      }
      return null;
    }

    // The bot plays the machine's game, through the switches whose wires work.
    const want = botDirection(m, syms);
    st.held = want && st.wires[want].fixed ? want : null;
    if (want && !st.wires[want].fixed) { st.cut = want; st.cutT = t; }

    const px = Math.round(player.x), py = Math.round(player.y);
    if (st.phase === 'grab') {
      if (px === STICK.x && py === STICK.y && player.x === px && player.y === py) {
        st.phase = 'play';
        st.playFrom = t;
        st.held = null;
        this.park(st, player);
        // A full maze for your test game: the bot (with the CPU's patches, very fast) has eaten most of it by now.
        setRound(currentRound());
        return 'pickup';
      }
      return null;
    }

    // Carrying: the wire is laid where you walk (walking back along it pulls it in); its pin fixes it.
    if (st.carry) {
      const w = st.wires[st.carry], path = w.path, last = path[path.length - 1];
      if (last[0] !== px || last[1] !== py) {
        const i = path.findIndex(([x, y]) => x === px && y === py);
        if (i > 0) path.length = i + 1; else path.push([px, py]);
      }
      const [qx, qy] = C.wires[st.carry].pin;
      if (px === qx && py === qy) {
        w.fixed = true;
        w.path = ROUTE[st.carry];
        w.next = t + rand(C.sparkEvery);
        st.carry = null;
        if (this.fixed(st) === 4) { st.phase = 'grab'; st.sparks = []; }
        return 'objective';
      }
    } else {
      for (const d of DIRS) {
        const w = st.wires[d], end = w.path[w.path.length - 1];
        if (!w.fixed && end[0] === px && end[1] === py) {
          st.carry = d;
          st.sparks = st.sparks.filter((s) => s.dir !== d);
          return 'pickup';
        }
      }
    }

    // Noise sparks: each wire fires one from its switch now and then (none on the wire you carry).
    for (const d of DIRS) {
      const w = st.wires[d];
      if (st.carry === d) { w.next = Math.max(w.next, t + C.sparkWarn); continue; }
      if (t >= w.next) { st.sparks.push({ dir: d, s: 0, path: w.path.slice() }); w.next = t + rand(C.sparkEvery); }
    }
    for (const sp of st.sparks) sp.s += C.sparkSpeed * dt;
    st.sparks = st.sparks.filter((sp) => sp.s <= sp.path.length - 1 + 0.3);
    if (st.sparks.some((sp) => touching(at(sp.path, sp.s), player))) return 'hit';
    return null;
  },

  draw(ctx, st, env, S) {
    const { m, S: syms, t, P } = env;
    const g = readState(m, syms);
    floor(ctx, P, COLS, ROWS, S);
    const play = st.phase === 'play';
    const grow = play ? Math.min(1, (t - st.playFrom) / C.playGrow) : 0;
    ctx.fillStyle = css(P.bg);
    ctx.fillRect(0, 0, COLS * S, TOP * S);
    const cx = (x) => x * S + S / 2;
    const blink = (hz) => Math.floor(t * hz) % 2 === 0;
    const low = (d) => !(m.in0 & IN0[d]);

    // The wires: fixed ones along their routes (white while their switch is closed), cut ones where they lie.
    for (const d of DIRS) {
      const w = st.wires[d], pts = w.path.map(([x, y]) => [cx(x), cx(y)]);
      if (st.carry === d) pts.push([Math.round((env.player.x + 0.5) * S), Math.round((env.player.y + 0.5) * S)]);
      if (w.fixed) wire(ctx, pts, 4, low(d) ? 0xffffff : P.line, low(d) ? P.line : P.glow);
      else wire(ctx, pts, 2, st.carry === d ? P.dot : P.line, P.glow);
    }

    // The joystick: a round base plate, the stick, a microswitch on each side.
    const bx = B.x * S + 3, by = B.y * S + 3, bw = 3 * S - 6;
    neonBlock(ctx, bx, by, bw, bw, P.line, P.bg);
    neonBox(ctx, bx + 6, by + 6, bw - 12, bw - 12, P.glow, P.bg);
    const [kx, ky] = STEP[st.held] ?? [0, 0];
    const sx0 = cx(STICK.x), sy0 = cx(STICK.y), k = 9;
    ctx.fillStyle = css(P.glow);
    ctx.fillRect(sx0 - 3 + Math.min(0, kx * k), sy0 - 3 + Math.min(0, ky * k), 7 + Math.abs(kx * k), 7 + Math.abs(ky * k));
    const knob = st.phase === 'grab' && blink(3) ? 0xffffff : P.dot;
    ctx.fillStyle = css(knob);
    ctx.fillRect(sx0 - 7 + kx * k, sy0 - 7 + ky * k, 15, 15);
    ctx.fillStyle = css(P.bg);
    ctx.fillRect(sx0 - 3 + kx * k, sy0 - 3 + ky * k, 7, 7);
    for (const d of DIRS) {
      const [x, y] = C.wires[d].switch, w = st.wires[d];
      const warn = st.phase === 'repair' && st.carry !== d && w.next - t < C.sparkWarn && blink(8);
      const cutNow = !w.fixed && t - st.cutT < C.cutFlash && st.cut === d;
      const color = warn || (cutNow && blink(6)) ? HAZARD : low(d) ? '#ffffff' : css(w.fixed ? P.line : P.glow);
      ctx.fillStyle = color;
      const hx = d === 'left' || d === 'right', sw = hx ? 6 : 14, sh = hx ? 14 : 6;
      const ox = d === 'left' ? 4 : d === 'right' ? S - 10 : (S - 14) / 2, oy = d === 'up' ? 4 : d === 'down' ? S - 10 : (S - 14) / 2;
      ctx.fillRect(x * S + ox, y * S + oy, sw, sh);
    }

    // IN0's pins on the port, each with its bit (1 = open, 0 = its switch pulls it low).
    for (const d of play ? [] : DIRS) {
      const [x, y] = C.wires[d].pin, w = st.wires[d];
      const want = st.carry === d && blink(4);
      const cutNow = !w.fixed && t - st.cutT < C.cutFlash && st.cut === d && blink(6);
      const line = want ? 0xffffff : w.fixed ? (low(d) ? 0xffffff : P.line) : P.glow;
      neonBox(ctx, x * S + 3, y * S + 3, S - 6, S - 6, line, w.fixed ? P.glow : P.bg);
      ctx.fillStyle = cutNow ? HAZARD : css(w.fixed ? P.dot : P.line);
      tinyText(ctx, LETTER[d], cx(x) - 3, y * S + 9, 2);
      // The lead up into the port connector, and the bit the CPU reads there.
      ctx.fillStyle = css(w.fixed ? P.line : P.glow);
      ctx.fillRect(cx(x) - 1, TOP * S - 10, 3, 10);
      ctx.fillStyle = low(d) ? '#ffffff' : css(P.dot);
      tinyText(ctx, low(d) ? '0' : '1', cx(x) - 3, TOP * S - 34, 2);
    }

    // The loose wire ends: a plug with its letter.
    for (const d of DIRS) {
      const w = st.wires[d];
      if (w.fixed || st.carry === d || play) continue;
      const [x, y] = w.path[w.path.length - 1];
      const on = blink(2);
      neonBlock(ctx, x * S + 5, y * S + 5, S - 10, S - 10, on ? 0xffffff : P.dot, P.glow);
      ctx.fillStyle = css(on ? 0xffffff : P.dot);
      tinyText(ctx, LETTER[d], cx(x) - 3, y * S + 9, 2);
    }

    // The noise sparks: jagged stars.
    for (const sp of st.sparks) {
      const p = at(sp.path, sp.s), x = Math.round((p.x + 0.5) * S), y = Math.round((p.y + 0.5) * S), r = 6 + (Math.floor(t * 14) % 3);
      ctx.fillStyle = HAZARD_GLOW;
      ctx.fillRect(x - r - 1, y - 2, 2 * r + 3, 5);
      ctx.fillRect(x - 2, y - r - 1, 5, 2 * r + 3);
      ctx.fillStyle = HAZARD;
      ctx.fillRect(x - r, y - 1, 2 * r + 1, 3);
      ctx.fillRect(x - 1, y - r, 3, 2 * r + 1);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 2, y - 2, 5, 5);
    }

    // The port connector under the picture, and the machine's picture (it grows while you play).
    ctx.fillStyle = css(P.bg);
    const T = Math.round(C.pictureT + (C.playT - C.pictureT) * grow);
    const pw = MW * T, ph = MH * T, ox = Math.floor((COLS * S - pw) / 2), oy = 4;
    if (!play) {
      neonBlock(ctx, 4, TOP * S - 16, COLS * S - 8, 7, P.line, P.glow);
      ctx.fillStyle = css(P.dot);
      tinyText(ctx, 'IN0', 6, TOP * S - 34, 2);
    }
    ctx.fillStyle = css(P.bg);
    ctx.fillRect(ox - 2, oy - 2, pw + 4, ph + 4);
    drawPlayfield(ctx, m, env.art, { T, ox, oy });
    neonBox(ctx, ox - 2, oy - 2, pw + 4, ph + 4, P.line, P.glow);
    // A cut direction Pac-Man wants: a red arrow from him that way, crossed out.
    if (!play && st.cut && t - st.cutT < C.cutFlash && g.phase === 'play') {
      const [dx, dy] = STEP[st.cut];
      const px = Math.round(ox + (g.pac.x + 0.5) * T), py = Math.round(oy + (g.pac.y + 0.5) * T), L = 3 * T;
      ctx.fillStyle = HAZARD;
      ctx.fillRect(Math.min(px, px + dx * L) - (dy ? 1 : 0), Math.min(py, py + dy * L) - (dx ? 1 : 0), dx ? L : 3, dy ? L : 3);
      const ex = px + dx * L, ey = py + dy * L;
      for (let i = -4; i <= 4; i++) { ctx.fillRect(ex + i - 1, ey + i - 1, 3, 3); ctx.fillRect(ex + i - 1, ey - i - 1, 3, 3); }
    }

    // Beside the picture: IN0 and IN1 as the CPU reads them, the score and the game's phase.
    if (!play) {
      const bits = (v) => v.toString(2).padStart(8, '0');
      ctx.fillStyle = css(P.dot);
      tinyText(ctx, 'IN0', 6, 10, 2);
      tinyText(ctx, bits(m.in0).slice(0, 4), 6, 26, 2);
      tinyText(ctx, bits(m.in0).slice(4), 6, 40, 2);
      tinyText(ctx, 'IN1', 6, 64, 2);
      tinyText(ctx, bits(m.in1).slice(0, 4), 6, 80, 2);
      tinyText(ctx, bits(m.in1).slice(4), 6, 94, 2);
      const rx = ox + pw + 8;
      tinyText(ctx, 'SCORE', rx, 10, 2);
      tinyText(ctx, String(g.score), rx, 26, 2);
      ctx.fillStyle = css(P.line);
      tinyText(ctx, g.phase === 'play' ? 'BOT' : g.phase.toUpperCase(), rx, 50, 2);
      if (g.phase === 'play') tinyText(ctx, 'PLAYS', rx, 64, 2);
    } else {
      const y = oy + ph + 8, bits = m.in0.toString(2).padStart(8, '0');
      ctx.fillStyle = css(P.dot);
      tinyText(ctx, 'IN0', 6, y, 2);
      tinyText(ctx, bits, 6, y + 14, 2);
      tinyText(ctx, 'SCORE', COLS * S - 46, y, 2);
      tinyText(ctx, String(g.score), COLS * S - 6 - String(g.score).length * 8, y + 14, 2);
    }
  },
};

// A thick neon wire through points (axis-aligned steps), with its halo.
function wire(ctx, pts, w, line, glow) {
  for (const [width, color] of [[w + 2, glow], [w, line]]) {
    ctx.fillStyle = css(color);
    const h = Math.floor(width / 2);
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      ctx.fillRect(Math.min(x0, x1) - h, Math.min(y0, y1) - h, Math.abs(x1 - x0) + width, Math.abs(y1 - y0) + width);
    }
  }
}
