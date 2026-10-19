// Deep layer 4, the system bus. No Phaser. A spatial bus (DEEP.bus.layout): the Z80 on the left, the bus lanes
// running from it to four chip rooms (ROM, RAM, video RAM, I/O), each behind a door. The address decoder opens
// one door at a time: the door of the chip the current bus cycle addresses (cycles come from a real frame's
// bus log, slowed to one per DEEP.bus.cycleTime). Each cycle sends a packet along the lanes (the enemy): a write
// runs from the CPU into the chip, a read from the chip back to the CPU and drops its 1 bits on the lanes as dots.
// A door stays open DEEP.bus.doorHold s after its chip's cycle and blinks before it closes; a door that closes on
// you is a hit. Packets are only deadly on the lanes, never inside a chip room, so you can wait by the door to get
// out. Objectives: the data byte in each chip room.

import { DEEP } from '../../config.js';
import { BUS } from '../arcade/machine.js';
import { region } from '../arcade/memmap.js';
import { tinyText } from './font.js';
import { css, floor, neonBlock, neonLine, dot } from './tron.js';

const C = DEEP.bus;
const MAP = C.layout;
const ROWS = MAP.length, COLS = MAP[0].length;
const at = (x, y) => (x >= 0 && y >= 0 && x < COLS && y < ROWS ? MAP[y][x] : '#');
const CHIPS = { R: 'rom', A: 'ram', V: 'vram', I: 'io' };
const NAMES = { rom: 'ROM', ram: 'RAM', vram: 'VRAM', io: 'I/O' };
const ROOM = { r: 'rom', a: 'ram', v: 'vram', i: 'io' };
const GROUP = { rom: 'rom', ram: 'ram', spriteAttr: 'ram', vram: 'vram', cram: 'vram', spritePos: 'io', io: 'io' };

// Cells of each chip: its door and its room's center.
const DOORS = {}, CENTERS = {};
for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
  const ch = MAP[y][x];
  if (CHIPS[ch]) DOORS[CHIPS[ch]] = { x, y };
}
for (const [chip, d] of Object.entries(DOORS)) CENTERS[chip] = { x: d.x + 2, y: d.y };
const PORT = (() => {
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (MAP[y][x] === '=' && at(x - 1, y) === 'C') return { x, y };
  return { x: 0, y: 0 };
})();

// Lane path from the CPU's port to a chip's door and one step into its room.
function lanePath(chip) {
  const d = DOORS[chip], from = new Map([[`${PORT.x},${PORT.y}`, null]]), queue = [PORT];
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head];
    if (c.x === d.x && c.y === d.y) {
      const path = [{ x: d.x + 1, y: d.y }];
      for (let k = `${c.x},${c.y}`; k; k = from.get(k)) { const [x, y] = k.split(',').map(Number); path.unshift({ x, y }); }
      return path;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = { x: c.x + dx, y: c.y + dy }, k = `${n.x},${n.y}`, ch = at(n.x, n.y);
      if (from.has(k) || (ch !== '=' && !(n.x === d.x && n.y === d.y))) continue;
      from.set(k, `${c.x},${c.y}`);
      queue.push(n);
    }
  }
  return [PORT];
}
const PATHS = Object.fromEntries(Object.keys(DOORS).map((chip) => [chip, lanePath(chip)]));
const doorOpen = (st, chip, t) => t < (st.openUntil[chip] ?? 0);

export default {
  id: 'bus',
  title: 'THE SYSTEM BUS',
  subtitle: 'GET THE DATA FROM EVERY CHIP ROOM\nDOORS OPEN WHEN THEIR CHIP IS ADDRESSED',
  cols: COLS, rows: ROWS,
  start: { x: 5, y: 20 },
  get goal() { return C.goal; }, // read live: levels can change it (levels.js)

  init() {
    return { next: 0, selected: null, cycle: null, packets: [], drops: new Map(), done: new Set(), openUntil: {}, wasOpen: new Set() };
  },

  open(st, env, x, y) {
    const ch = at(x, y);
    if (ch === '#' || ch === 'C') return false;
    return CHIPS[ch] ? doorOpen(st, CHIPS[ch], env.t) : true;
  },

  info(st) {
    const c = st.cycle;
    if (!c) return 'WAITING FOR A BUS CYCLE';
    return `${c.write ? 'WRITE' : 'READ'} ${c.addr.toString(16).toUpperCase().padStart(4, '0')}: ${NAMES[c.chip]} SELECTED`;
  },

  // A random bus cycle of the latest frame: first a chip at random among those the frame touched, then one of its cycles.
  pick(m) {
    const r = m.frameRange(0);
    if (!r) return null;
    const N = m.busAddr.length, groups = {};
    for (let i = r.from; i < r.to; i++) {
      const j = i % N, kind = m.busKind[j], addr = m.busAddr[j];
      const chip = kind & BUS.io ? 'io' : GROUP[region(addr)] ?? (addr >= 0x5000 && addr <= 0x50ff ? 'io' : null);
      if (chip) (groups[chip] ??= []).push({ addr, value: m.busVal[j], write: !!(kind & BUS.write), chip });
    }
    const chips = Object.keys(groups);
    if (!chips.length) return null;
    const list = groups[chips[Math.floor(Math.random() * chips.length)]];
    return list[Math.floor(Math.random() * list.length)];
  },

  update(st, env) {
    const { m, t, player } = env;
    const px = Math.round(player.x), py = Math.round(player.y);
    if (t >= st.next) {
      st.next = t + C.cycleTime;
      const c = this.pick(m);
      if (c) {
        // The decoder selects the chip: its door opens for this cycle and doorHold s more.
        st.cycle = c;
        st.selected = c.chip;
        st.openUntil[c.chip] = t + C.cycleTime + C.doorHold;
        const path = c.write ? PATHS[c.chip] : [...PATHS[c.chip]].reverse();
        // A read leaves the chip only after its access time, so there's a moment to slip in through the open door.
        st.packets.push({ path, t: c.write ? t : t + C.readDelay, value: c.value, write: c.write });
      }
    }
    // A door closing on you is a hit.
    for (const [chip, d] of Object.entries(DOORS)) {
      const open = doorOpen(st, chip, t);
      if (!open && st.wasOpen.delete(chip) && d.x === px && d.y === py) return 'hit';
      if (open) st.wasOpen.add(chip);
    }
    // Packets run along the lanes; a read drops its 1 bits on its lane when it reaches the CPU.
    for (const p of st.packets) {
      const k = (t - p.t) * C.packetSpeed;
      p.pos = k;
      if (k >= p.path.length - 1 && !p.over) {
        p.over = true;
        if (!p.write) {
          const bits = Math.min(3, [...p.value.toString(2)].filter((b) => b === '1').length);
          for (let b = 0; b < bits; b++) {
            const c = p.path[1 + Math.floor(Math.random() * (p.path.length - 3))];
            if (c) st.drops.set(`${c.x},${c.y}`, t);
          }
        }
      }
      for (const back of [0, 1]) {
        const c = p.path[Math.floor(k) - back];
        if (!p.over && c && !ROOM[at(c.x, c.y)] && Math.abs(player.x - c.x) + Math.abs(player.y - c.y) < 0.8) return 'hit';
      }
    }
    st.packets = st.packets.filter((p) => !p.over);
    const room = ROOM[at(px, py)];
    if (room && !st.done.has(room) && px === CENTERS[room].x && py === CENTERS[room].y) { st.done.add(room); return 'objective'; }
    if (st.drops.delete(`${px},${py}`)) return 'dot';
    return null;
  },

  draw(ctx, st, env, S) {
    const { P, t } = env;
    floor(ctx, P, COLS, ROWS, S);
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const ch = MAP[y][x];
        if (ch === '#') { ctx.fillStyle = css(P.glow); ctx.fillRect(x * S, y * S, S, S); }
        else if (ch === 'C') { ctx.fillStyle = css(P.glow); ctx.fillRect(x * S, y * S, S, S); }
        else if (ROOM[ch]) { ctx.fillStyle = css(P.grid); ctx.fillRect(x * S + 1, y * S + 1, S - 1, S - 1); }
        else if (ch === '=') {
          // Lanes: a neon line through the cell toward its lane neighbours.
          const c = Math.floor(S / 2);
          for (const [dx, dy] of [[1, 0], [0, 1]]) {
            const n = at(x + dx, y + dy);
            if (n === '=' || CHIPS[n]) neonLine(ctx, x * S + c, y * S + c, (x + dx) * S + c, (y + dy) * S + c, P.line, P.glow);
          }
        }
      }
    }
    // The CPU block.
    const cpu = { x: 1, y: PORT.y - 2 };
    ctx.fillStyle = css(P.line);
    const k = DEEP.labelScale;
    tinyText(ctx, 'Z80', cpu.x * S + Math.floor((3 * S - 11 * k) / 2), PORT.y * S + Math.floor((S - 5 * k) / 2), k);
    // Doors: open (a gap) while the decoder selects their chip; room labels and their data byte.
    for (const [chip, d] of Object.entries(DOORS)) {
      const open = doorOpen(st, chip, t), left = (st.openUntil[chip] ?? 0) - t;
      // Closing soon: the door flickers shut.
      const closing = open && left < C.doorWarn && Math.floor(t * 8) % 2 === 0;
      if (!open || closing) {
        ctx.globalAlpha = closing ? 0.5 : 1;
        neonBlock(ctx, d.x * S + 1, d.y * S, S - 2, S, P.line, P.glow);
        ctx.globalAlpha = 1;
      } else { ctx.fillStyle = css(0xffffff, 0.15 + 0.1 * Math.sin(t * 10)); ctx.fillRect(d.x * S, d.y * S, S, S); }
      ctx.fillStyle = css(open ? 0xffffff : P.dot);
      tinyText(ctx, NAMES[chip], (d.x + 1) * S + 2, (d.y - 2) * S + 2, k);
      if (!st.done.has(chip)) dot(ctx, env, 'special', CENTERS[chip].x, CENTERS[chip].y, S);
    }
    for (const k of st.drops.keys()) { const [x, y] = k.split(',').map(Number); dot(ctx, env, 'dot', x, y, S); }
    for (const p of st.packets) {
      if (t < p.t) {
        // A read still waiting in its chip: a faint pulse by the door shows it's about to come out.
        const c = p.path[0];
        ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t * 12);
        neonBlock(ctx, c.x * S + 3, c.y * S + 3, S - 6, S - 6, DEEP.hazard, DEEP.hazardGlow);
        ctx.globalAlpha = 1;
        continue;
      }
      for (const back of [2, 1, 0]) {
        const c = p.path[Math.floor(p.pos) - back];
        if (!c) continue;
        ctx.globalAlpha = 1 - back * 0.3;
        neonBlock(ctx, c.x * S + 2, c.y * S + 2, S - 4, S - 4, DEEP.hazard, back ? DEEP.hazardGlow : 0xffffff);
      }
      ctx.globalAlpha = 1;
    }
  },
};
