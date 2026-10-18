// The manual's pages: { title, html } with figures as inline SVG drawn here, and `mount(body)` for the live page.
// Numbers come from the config and the memory map, so the manual stays true when they're tuned.
import { ARCADE, MAZE, RULES, SPEED, CONTROL, COINS, GAME_TITLE } from '../config.js';
import { MAP, CELL, SOUND, VRAM_STRIDE } from '../systems/arcade/memmap.js';
import { SPRITE, PALETTE } from '../systems/arcade/video.js';
import { livePage } from './live.js';

const hex = (n, d = 4) => `0x${n.toString(16).toUpperCase().padStart(d, '0')}`;
const W = MAZE.layout[0].length, H = MAZE.layout.length;
const cyclesPerFrame = Math.round(ARCADE.clockHz / ARCADE.frameHz);

// ---- figure helpers: ink on paper, a slightly hand-drawn feel from the stroke and the font -----------------------
let figN = 0;
function svg(w, h, body, caption) {
  const id = `ah${figN++}`;
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" font-family="Courier Prime, Courier New, monospace"
    font-size="11" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" fill="currentColor" stroke="none"/></marker></defs>
    ${body.replaceAll('ARROW', `url(#${id})`)}</svg>${caption ? `<p class="fig">${caption}</p>` : ''}`;
}
const t = (x, y, s, o = {}) => `<text x="${x}" y="${y}" fill="currentColor" stroke="none" text-anchor="${o.a ?? 'middle'}"
  font-size="${o.size ?? 11}" ${o.bold ? 'font-weight="700"' : ''} ${o.color ? `style="fill:${o.color}"` : ''}>${s}</text>`;
const box = (x, y, w, h, label, sub, o = {}) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3"
  ${o.fill ? `style="fill:${o.fill}"` : ''} ${o.dash ? 'stroke-dasharray="4 3"' : ''}/>`
  + t(x + w / 2, y + h / 2 + (sub ? -2 : 4), label, { bold: true })
  + (sub ? t(x + w / 2, y + h / 2 + 11, sub, { size: 9 }) : '');
const arrow = (x1, y1, x2, y2, label, o = {}) => `<path d="M${x1} ${y1} L${x2} ${y2}" marker-end="ARROW"/>`
  + (label ? t((x1 + x2) / 2 + (o.dx ?? 0), (y1 + y2) / 2 + (o.dy ?? -4), label, { size: 9 }) : '');
const line = (pts, o = {}) => `<path d="M${pts.map((p) => p.join(' ')).join(' L')}" ${o.dash ? 'stroke-dasharray="3 3"' : ''}
  ${o.color ? `style="stroke:${o.color}"` : ''} ${o.end ? 'marker-end="ARROW"' : ''}/>`;
const table = (head, rows) => `<table><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr>${rows
  .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>`;

// ---- the figures --------------------------------------------------------------------------------------------------
const coverFig = svg(320, 230, `
  <path d="M110 20 L210 20 L230 10 L230 200 L210 214 L110 214 Z"/>
  <path d="M210 20 L210 214"/><path d="M110 20 L130 10 L230 10"/>
  <rect x="122" y="30" width="76" height="22" rx="2"/>${t(160, 45, 'LAYERS', { size: 10, bold: true })}
  <rect x="122" y="60" width="76" height="64" rx="4"/>
  <path d="M132 70 h56 v44 h-56 z" stroke-dasharray="2 2"/>
  <circle cx="146" cy="96" r="6"/><path d="M150 92 l6 4 l-6 4"/>
  <path d="M110 130 L210 130 L210 148 L110 148 Z"/><path d="M150 139 v-8"/><circle cx="150" cy="130" r="3"/>
  <rect x="140" y="160" width="40" height="34" rx="2"/><path d="M152 168 v8 M168 168 v8"/>
  ${t(160, 226, 'Fig. 0 — the upright cabinet, front and side', { size: 9 })}`);

const cabinetFig = svg(340, 260, `
  <path d="M90 14 L200 14 L200 246 L90 246 Z"/>
  <rect x="100" y="22" width="90" height="20"/>${t(145, 36, 'MARQUEE', { size: 9 })}
  <path d="M104 52 L186 52 L180 120 L110 120 Z"/>${t(145, 90, 'CRT', { bold: true })}
  <rect x="96" y="128" width="98" height="18"/>${t(145, 141, 'CONTROL PANEL', { size: 9 })}
  <rect x="120" y="160" width="50" height="26" stroke-dasharray="4 3"/>${t(145, 177, 'BOARD', { size: 9, bold: true })}
  <rect x="122" y="198" width="46" height="36"/>${t(145, 214, 'COIN', { size: 9 })}${t(145, 226, 'DOOR', { size: 9 })}
  ${arrow(80, 86, 104, 86)}${t(76, 82, 'picture tube', { a: 'end', size: 9 })}${t(76, 94, '(see CRT)', { a: 'end', size: 9 })}
  ${arrow(80, 137, 96, 137)}${t(76, 134, 'joystick:', { a: 'end', size: 9 })}${t(76, 145, '4 switches', { a: 'end', size: 9 })}
  ${arrow(260, 173, 170, 173)}${t(264, 166, 'Z80 CPU, ROM,', { a: 'start', size: 9 })}${t(264, 177, 'RAM, video,', { a: 'start', size: 9 })}${t(264, 188, 'sound, I/O', { a: 'start', size: 9 })}
  ${arrow(260, 216, 168, 216)}${t(264, 213, 'coin switch', { a: 'start', size: 9 })}${t(264, 224, '→ IN0 bit 5', { a: 'start', size: 9 })}
  ${line([[170, 186], [230, 186], [230, 240]], { dash: true })}${t(234, 244, 'speaker', { a: 'start', size: 9 })}`,
'Fig. 1 — what sits where inside the cabinet');

const phaseFig = svg(340, 250, `
  ${box(10, 14, 90, 30, 'ATTRACT', 'after reset')}
  ${box(125, 14, 90, 30, 'READY', `${RULES.readyTime} s`)}
  ${box(240, 14, 90, 30, 'PLAY')}
  ${box(240, 104, 90, 30, 'DYING', `${RULES.dyingTime} s`)}
  ${box(125, 104, 90, 30, 'OVER', 'no lives')}
  ${box(240, 194, 90, 30, 'CLEARING', `${RULES.clearTime} s flash`)}
  ${box(125, 194, 90, 30, 'CLEARED')}
  ${arrow(100, 29, 125, 29, 'START')}${arrow(215, 29, 240, 29)}
  ${arrow(285, 44, 285, 104, 'caught', { dx: 24 })}
  ${line([[262, 104], [200, 60], [180, 44]], { end: true })}${t(214, 70, 'lives left', { size: 9 })}
  ${arrow(240, 119, 215, 119)}
  ${arrow(318, 44, 318, 194, 'last dot', { dx: -2, dy: 30 })}
  ${arrow(240, 209, 215, 209)}
  ${line([[125, 209], [60, 209], [60, 70], [150, 44]], { end: true })}${t(56, 140, 'START', { a: 'end', size: 9 })}
  ${line([[125, 119], [80, 119], [80, 66], [140, 44]], { end: true })}${t(84, 112, 'coin', { a: 'start', size: 9 })}`,
'Fig. 2 — the game phases (PHASE in work RAM). A coin always starts a fresh game.');

const rasterFig = svg(340, 200, `
  <rect x="10" y="10" width="200" height="150" rx="14"/>
  ${[0, 1, 2, 3, 4, 5].map((i) => line([[24, 26 + i * 22], [196, 26 + i * 22]], { end: true })).join('')}
  ${[0, 1, 2, 3, 4].map((i) => line([[196, 26 + i * 22], [24, 48 + i * 22]], { dash: true })).join('')}
  ${line([[196, 136], [40, 22]], { dash: true, color: '#9a2a1a' })}
  ${t(10, 178, 'beam: rows left → right, dashed = flyback (dark)', { size: 9, a: 'start' })}
  ${t(10, 192, 'red: vertical blank → the vblank interrupt', { size: 9, color: '#9a2a1a', a: 'start' })}
  ${[0, 1, 2].map((i) => `<rect x="${234 + i * 32}" y="40" width="9" height="60" style="fill:${['#c33', '#3a3', '#36c'][i]}"/>
    <rect x="${244 + i * 32}" y="40" width="9" height="60" style="fill:${['#3a3', '#36c', '#c33'][i]}"/>
    <rect x="${254 + i * 32}" y="40" width="9" height="60" style="fill:${['#36c', '#c33', '#3a3'][i]}"/>`).join('')}
  ${t(280, 120, 'phosphor stripes', { size: 9 })}${t(280, 132, 'behind the shadow mask', { size: 9 })}
  ${t(280, 150, 'one R+G+B triad', { size: 9 })}${t(280, 162, 'per picture pixel', { size: 9 })}`,
'Fig. 3 — raster scan and the phosphor triads');

const videoFig = svg(340, 300, `
  ${box(10, 10, 92, 36, 'VRAM', `cell code ${hex(MAP.vram[0])}`)}
  ${box(10, 70, 92, 36, 'COLOR RAM', `palette ${hex(MAP.cram[0])}`)}
  ${box(130, 10, 92, 36, 'TILE FETCH', 'graphics ROM')}
  ${box(130, 70, 92, 36, 'PALETTE', 'color PROM')}
  ${box(248, 70, 82, 36, 'DAC', '→ R G B')}
  ${box(10, 150, 92, 36, 'SPRITE ATTR', `code ${hex(MAP.spriteAttr[0])}`)}
  ${box(10, 200, 92, 36, 'SPRITE POS', `x,y ${hex(MAP.spritePos[0])}`)}
  ${box(130, 170, 92, 36, 'LINE BUFFER', '8 sprites')}
  ${box(248, 240, 82, 36, 'SOUND', `latch ${hex(MAP.soundCmd)}`)}
  ${arrow(102, 28, 130, 28)}${arrow(176, 46, 176, 70, 'pixels', { dx: 22 })}${arrow(102, 88, 130, 88, 'index')}
  ${arrow(222, 88, 248, 88)}${arrow(102, 168, 130, 182)}${arrow(102, 218, 130, 196)}
  ${line([[222, 188], [236, 188], [236, 106], [222, 100]], { end: true })}
  ${arrow(289, 106, 289, 140)}${t(289, 152, 'to the CRT', { size: 9 })}
  ${t(112, 262, 'sprites drawn over the tiles,', { size: 9, a: 'start' })}${t(112, 274, 'slot 0 on top', { size: 9, a: 'start' })}`,
'Fig. 4 — from bytes in memory to light: the video board');

const vramFig = (() => {
  const rows = ['##########', '#....#....', '#o##.#.##.', '#.........'];
  const code = { '#': CELL.wall, '.': CELL.dot, o: CELL.power };
  let cells = '';
  rows.forEach((r, y) => [...r].forEach((c, x) => {
    const hi = x === 1 && y === 2;
    cells += `<rect x="${10 + x * 32}" y="${30 + y * 26}" width="32" height="26" ${hi ? 'style="fill:rgba(154,42,26,0.15)"' : ''}/>`
      + t(26 + x * 32, 47 + y * 26, hex(code[c], 2).slice(2), { size: 10, bold: hi });
  }));
  return svg(340, 190, `${cells}
    ${[0, 1, 2, 3].map((y) => t(6, 47 + y * 26, `${y}`, { a: 'end', size: 9 })).join('')}
    ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((x) => t(26 + x * 32, 24, `${x}`, { size: 9 })).join('')}
    ${t(170, 158, `address = ${hex(MAP.vram[0])} + y × ${VRAM_STRIDE} + x`, { bold: true })}
    ${t(170, 176, `tile (1,2) holds ${hex(CELL.power, 2)}, a power pellet, at ${hex(MAP.vram[0] + 2 * VRAM_STRIDE + 1)}`, { size: 9 })}`,
  'Fig. 5 — the top left corner of the maze in VRAM (hex cell codes)');
})();

const busFig = (() => {
  // Not to scale: the small regions get room for their names.
  const parts = [['ROM', 0x0000, 70], ['VRAM', 0x4000, 26], ['COLOR', 0x4400, 26], ['unused', 0x4800, 22],
    ['RAM', 0x4c00, 26], ['I/O', 0x5000, 26], ['not decoded', 0x5100, 64]];
  const y0 = 20, h = parts.reduce((a, p) => a + p[2], 0);
  let top = y0;
  return svg(340, 300, `${parts.map(([n, a, ht]) => {
    top += ht;
    return `<rect x="70" y="${top - ht}" width="70" height="${ht}" ${n === 'not decoded' || n === 'unused' ? 'stroke-dasharray="3 3"' : ''}/>`
      + t(150, top - ht / 2 + 4, n, { a: 'start', size: 10, bold: n !== 'not decoded' && n !== 'unused' })
      + t(64, top - ht + 8, hex(a), { a: 'end', size: 9 });
  }).join('')}
    ${t(64, y0 + h, '0xFFFF', { a: 'end', size: 9 })}
    ${box(230, 30, 100, 40, 'Z80', 'A0-15 D0-7')}
    ${arrow(230, 50, 142, 50, 'address')}
    ${box(230, 120, 100, 54, 'DECODER', 'top address bits')}
    ${t(280, 192, 'picks one chip:', { size: 9 })}${t(280, 204, 'its chip-select', { size: 9 })}${t(280, 216, 'line goes low', { size: 9 })}
    ${arrow(280, 70, 280, 120)}${line([[230, 147], [142, 150]], { end: true })}`,
  'Fig. 6 — the memory map (not to scale): one 64 KB address space, the decoder picks the chip');
})();

const timingFig = svg(340, 150, `
  ${t(6, 26, 'ADDR', { a: 'start', size: 9 })}<path d="M50 14 L70 14 L76 30 L230 30 L236 14 L330 14 M50 30 L70 30 L76 14 L230 14 L236 30 L330 30"/>
  ${t(150, 26, 'address', { size: 9 })}
  ${t(6, 58, 'MREQ', { a: 'start', size: 9 })}<path d="M50 46 L90 46 L90 62 L214 62 L214 46 L330 46"/>
  ${t(6, 88, 'RD/WR', { a: 'start', size: 9 })}<path d="M50 76 L100 76 L100 92 L210 92 L210 76 L330 76"/>
  ${t(6, 120, 'DATA', { a: 'start', size: 9 })}<path d="M50 116 L150 116 M150 108 L156 116 L150 124 M156 116 L200 108 L206 116 L200 124 L156 116"/>
  <path d="M150 108 L200 108 M150 124 L200 124"/><path d="M206 116 L330 116"/>${t(178, 119, 'byte', { size: 9 })}
  ${t(170, 144, 'low = active. A read latches the byte at the end; a write puts it out first.', { size: 9 })}`,
'Fig. 7 — one memory cycle on the bus');

const registerFig = svg(340, 170, `
  ${[['A', 'F'], ['B', 'C'], ['D', 'E'], ['H', 'L']].map(([a, b], i) => `
    <rect x="${14 + i * 80}" y="14" width="34" height="26"/><rect x="${48 + i * 80}" y="14" width="34" height="26"/>
    ${t(31 + i * 80, 32, a, { bold: true })}${t(65 + i * 80, 32, b, { bold: true })}`).join('')}
  ${[['IX', 'index'], ['IY', 'index'], ['SP', 'stack'], ['PC', 'next instr.']].map(([n, s], i) => `
    <rect x="${14 + i * 80}" y="56" width="68" height="26"/>${t(48 + i * 80, 70, n, { bold: true })}${t(48 + i * 80, 96, s, { size: 9 })}`).join('')}
  ${t(14, 128, 'F, the flags:', { a: 'start', size: 10, bold: true })}
  ${['S', 'Z', '–', 'H', '–', 'P/V', 'N', 'C'].map((f, i) => `<rect x="${110 + i * 28}" y="114" width="28" height="22"/>${t(124 + i * 28, 129, f, { size: 10 })}`).join('')}
  ${t(170, 156, 'bit 7 … 0. Z: result was zero. C: carry / borrow. S: sign.', { size: 9 })}`,
'Fig. 8 — the Z80 registers');

const loopFig = svg(340, 230, `
  ${box(120, 8, 100, 30, 'reset', 'set up, IM 2')}
  ${box(120, 64, 100, 30, 'main: HALT', 'CPU sleeps')}
  ${box(120, 120, 100, 30, 'vblank', 'EI · RETI')}
  ${box(120, 176, 100, 30, 'call frame', 'one game frame')}
  ${arrow(170, 38, 170, 64)}${arrow(170, 94, 170, 120, 'INT', { dx: 18 })}${arrow(170, 150, 170, 176)}
  ${line([[220, 191], [270, 191], [270, 79], [222, 79]], { end: true })}${t(276, 140, 'JR main', { a: 'start', size: 9 })}
  ${t(12, 120, 'Vector:', { a: 'start', size: 9, bold: true })}${t(12, 133, `I × 256 + byte`, { a: 'start', size: 9 })}
  ${t(12, 146, 'from OUT (0),A', { a: 'start', size: 9 })}${t(12, 159, '→ VECTORS → vblank', { a: 'start', size: 9 })}`,
'Fig. 9 — the main loop: one game frame per video frame');

const targetFig = (() => {
  const g = 22, ox = 20, oy = 14, cx = (x) => ox + x * g + g / 2, cy = (y) => oy + y * g + g / 2;
  const grid = Array.from({ length: 9 }, (_, y) => Array.from({ length: 13 }, (_, x) => `<rect x="${ox + x * g}" y="${oy + y * g}" width="${g}" height="${g}" stroke-width="0.4"/>`).join('')).join('');
  const pac = [5, 6], blinky = [2, 2], pink = [5, 2], inkyA = [5, 4], inkyT = [8, 6];
  return svg(340, 250, `${grid}
    <circle cx="${cx(pac[0])}" cy="${cy(pac[1])}" r="8" style="fill:#e8c400"/>${t(cx(pac[0]) + 12, cy(pac[1]) + 18, 'PAC ↑', { size: 9, a: 'start' })}
    <circle cx="${cx(blinky[0])}" cy="${cy(blinky[1])}" r="8" style="fill:#c33"/>${t(cx(blinky[0]), cy(blinky[1]) - 12, 'BLINKY', { size: 9 })}
    ${line([[cx(blinky[0]), cy(blinky[1])], [cx(pac[0]), cy(pac[1])]], { color: '#c33', end: true })}
    <rect x="${cx(pink[0]) - 9}" y="${cy(pink[1]) - 9}" width="18" height="18" style="stroke:#d6a;stroke-width:2.5"/>${t(cx(pink[0]) + 14, cy(pink[1]) + 4, `PINKY: ${RULES.pinkyAhead} ahead`, { size: 9, a: 'start' })}
    ${line([[cx(blinky[0]), cy(blinky[1])], [cx(inkyA[0]), cy(inkyA[1])], [cx(inkyT[0]), cy(inkyT[1])]], { dash: true, color: '#088' })}
    <rect x="${cx(inkyT[0]) - 9}" y="${cy(inkyT[1]) - 9}" width="18" height="18" style="stroke:#088;stroke-width:2.5"/>${t(cx(inkyT[0]) + 12, cy(inkyT[1]) + 22, 'INKY: Blinky → 2 ahead, doubled', { size: 9 })}
    <circle cx="${cx(pac[0])}" cy="${cy(pac[1])}" r="${g * 4}" stroke-dasharray="4 4" style="stroke:#c70"/>${t(cx(pac[0]) - 60, oy + 8 * g + 16, `CLYDE: chases, but closer than ${RULES.clydeShyDistance} tiles → his corner`, { size: 9, a: 'start' })}`,
  'Fig. 10 — chase targets. The ghost turns toward its target at every tile center (circle not to scale).');
})();

// ---- the pages ----------------------------------------------------------------------------------------------------
const toc = [
  ['The cabinet', 2], ['The maze game', 3], ['Inside the CRT', 4], ['The video board', 5], ['Video RAM', 6],
  ['The system bus', 7], ['The CPU (Z80)', 8], ['The game logic', 9], ['The live page', 10],
];

export const pages = [
  {
    title: `${GAME_TITLE} — Service Manual`,
    html: `${coverFig}
      <p style="text-align:center"><b>Upright video game · Model LP-60</b><br>Operator's and service manual</p>
      <p>This machine is a complete small computer. Every layer of it is described on its own page, from the cabinet
      you stand in front of down to the game logic in its memory. The last page shows the machine as it is right now.</p>
      <p style="font-size:13px">Keep this manual with the machine. Do not open the cabinet while it is switched on.
      The picture tube keeps a dangerous charge after power-off.</p>`,
  },
  {
    title: 'Contents',
    html: `<div class="toc">${toc.map(([n, p], i) => `<a data-goto="${p}">${i + 1}. ${n} <span style="float:right">p. ${p + 1}</span></a>`).join('')}</div>
      <p style="margin-top:16px">Each page goes one layer deeper. Tap a line to go there; swipe sideways or use the
      arrows to turn pages.</p>`,
  },
  {
    title: '1. The cabinet',
    html: `${cabinetFig}
      <p>The cabinet is the box around the computer: a <b>picture tube</b> (CRT) behind the glass, the <b>control panel</b>
      with the joystick and START button, the <b>coin door</b>, a speaker, and the <b>logic board</b> that runs the game.</p>
      <h2>Coins and credits</h2>
      <p>A coin rolls past a <b>coin switch</b>, which closes for a moment: bit 5 of input port IN0 (${hex(MAP.in0)}) goes low.
      The program compares the switch with the last frame (COIN_LAST) and starts a fresh game on the edge. One coin
      buys one game of ${RULES.lives} lives (COINS.perGame = ${COINS.perGame}).</p>
      <p>After GAME OVER this machine stops running frames until a coin goes in: the picture stands still with
      INSERT COIN. While nobody holds the joystick, an <b>autopilot</b> plays on through the very same input port,
      and a dip switch (DEMO) makes its deaths free.</p>
      <h2>Controls</h2>
      <p>The joystick is four switches, one per direction; pushing it closes one or two of them. START is one more switch on IN1.</p>`,
  },
  {
    title: '2. The maze game',
    html: `<p>What the player sees: a maze of ${W}×${H} tiles, dots, ${MAZE.layout.join('').split('o').length - 1} power pellets, Pac-Man and four ghosts.
      Everything here is computed by the program on the board, once per video frame (${ARCADE.frameHz} per second).</p>
      ${phaseFig}
      <h2>Scoring and lives</h2>
      ${table(['Thing', 'Points'], [['dot', RULES.dotPoints], ['power pellet', RULES.powerPoints], ['ghosts in one fright', RULES.ghostPoints.join(' / ')]])}
      <p>${RULES.lives} lives per coin. Eating every dot clears the maze.</p>
      <h2>Movement</h2>
      <p>Positions are kept in <b>world pixels</b>, 16 per tile; a tile's center is at a multiple of 16. Speeds are in
      tiles per second (Pac-Man ${SPEED.pac}, ghosts ${SPEED.ghost}, ${SPEED.ghostTunnel} in the tunnel, ${SPEED.ghostFright} frightened, eyes ${SPEED.ghostEyes})
      and become a whole number of pixels per frame plus a fraction that carries over (A_FRAC), so speeds between whole
      pixels come out exactly over time. The side tunnel wraps around.</p>
      <p>A turn the player asks for waits up to ${CONTROL.bufferTime} s (A_AGE) and is taken within ${CONTROL.turnWindow} tiles
      of a junction: Pac-Man is pulled onto the corner. Reversing is instant.</p>
      <h2>Fright</h2>
      <p>A power pellet frightens the ghosts for ${RULES.frightTime} s (flashing for the last ${RULES.frightFlashTime}): they
      turn around, slow down and pick random turns. Eaten ghosts go home as eyes; the game freezes ${RULES.ghostEatPause} s
      to show the points.</p>`,
  },
  {
    title: '3. Inside the CRT',
    html: `${rasterFig}
      <p>The picture tube has no memory. An electron <b>beam</b> sweeps the screen row by row, left to right, and its
      strength at each point sets how brightly the phosphor glows. The phosphor fades within milliseconds, so the board
      has to repaint the whole picture ${ARCADE.frameHz} times a second.</p>
      <h2>Flyback and blanking</h2>
      <p>At the end of each row the beam is switched off and flies back to the left (<b>horizontal blank</b>). After
      the last row it flies back to the top (<b>vertical blank</b>, vblank). The video board raises the CPU's interrupt
      at every vblank: that is the heartbeat of the whole game. The program draws during the picture time and does its
      work once per frame.</p>
      <h2>Color</h2>
      <p>A color tube has three beams, red, green and blue. A <b>shadow mask</b> (a perforated metal sheet) lets each
      beam hit only its own phosphor stripes, so every pixel is a <b>triad</b> of three tiny lights mixed by the eye.</p>`,
  },
  {
    title: '4. The video board',
    html: `${videoFig}
      <p>The video hardware reads memory on its own, in step with the beam, and turns bytes into a signal. The CPU
      never draws pixels: it only writes codes.</p>
      <h2>Tiles</h2>
      <p>The playfield is a grid of ${W}×${H} tiles. For each tile the <b>tile fetcher</b> reads its cell code from VRAM and the
      tile's pixels from the <b>graphics ROM</b>, and its palette index from color RAM. The <b>palette PROM</b> turns
      index and pixel into a color, the <b>DAC</b> into voltages for the three beams.</p>
      ${table(['Palette', 'Meaning'], Object.entries(PALETTE).map(([k, v]) => [k, v === null ? 'black: not drawn (pellets blinking)' : v === 'art' ? "the art's own colors" : `#${v.toString(16).padStart(6, '0')}`]))}
      <h2>Sprites</h2>
      <p>Eight <b>hardware sprites</b> float over the tiles: Pac-Man, four ghosts, points. Each has a code and a palette
      in RAM at ${hex(MAP.spriteAttr[0])} (2 bytes per sprite) and a position in the I/O registers at ${hex(MAP.spritePos[0])}
      (x low, x high, y low, y high: world pixels of its center). Before each row the board copies the sprites on that
      row into a <b>line buffer</b>.</p>
      ${table(['Sprite codes', 'Art'], [[`${SPRITE.pac}–${SPRITE.pac + 31}`, 'Pac-Man: 8 per direction, 7 chomp frames'], [`${SPRITE.pacDie}–${SPRITE.pacDie + 9}`, 'Pac-Man dying'],
        [`${SPRITE.ghost}–${SPRITE.ghost + 31}`, 'ghosts: 8 each, 2 per direction'], [`${SPRITE.fright}, ${SPRITE.flash}`, 'frightened, flashing'], [`${SPRITE.eyes}+`, 'eyes'], [`${SPRITE.points}+`, 'points 200…1600']])}
      <h2>Sound</h2>
      <p>The program writes a number into the sound latch at ${hex(MAP.soundCmd)}; the sound circuit plays it.</p>
      ${table(['Value', 'Sound'], Object.entries(SOUND).map(([k, v]) => [k, v]))}`,
  },
  {
    title: '5. Video RAM',
    html: `${vramFig}
      <p><b>VRAM</b> (${hex(MAP.vram[0])}–${hex(MAP.vram[1])}) holds one byte per tile: what is there. Rows are ${VRAM_STRIDE} bytes apart,
      of which ${W} are used, so the last ${VRAM_STRIDE - W} bytes of each row are spare. <b>Color RAM</b> (${hex(MAP.cram[0])}–${hex(MAP.cram[1])})
      has the same layout and holds each tile's palette.</p>
      ${table(['Cell code', 'Meaning'], Object.entries(CELL).map(([k, v]) => [hex(v, 2), k + (k === 'wall' ? ' (and up: the wall pieces)' : '')]))}
      <p>The program reads these codes too: to know where actors may go and what Pac-Man is eating, exactly like the
      original. Eating a dot is one write: the dot's byte becomes ${hex(CELL.empty, 2)}. Blinking power pellets are color RAM
      flipping between palette 0 and 1.</p>`,
  },
  {
    title: '6. The system bus',
    html: `${busFig}
      <p>The CPU talks to everything over one <b>bus</b>: 16 address lines (A0–A15, 64 KB), 8 data lines (D0–D7) and
      a few control lines: MREQ (memory request), IORQ (I/O request), RD and WR.</p>
      ${timingFig}
      <h2>The address decoder</h2>
      <p>Only one chip may answer. The <b>decoder</b> looks at the top address bits and enables just that chip. The
      Z80's 16 KB of program <b>ROM</b> sits at the bottom, then video RAM, color RAM, work <b>RAM</b> and the I/O area.</p>
      <h2>Memory-mapped I/O</h2>
      <p>The joystick and the hardware registers look like memory, but reads and writes mean different things:</p>
      ${table(['Address', 'Read', 'Write'], [[hex(MAP.in0), 'IN0: joystick, coin', 'interrupt enable (bit 0)'], [hex(MAP.in1), 'IN1: START', 'sound latch'],
        [hex(MAP.dsw), 'dip switches', '—'], [`${hex(MAP.spritePos[0])}–${hex(MAP.spritePos[1])}`, '—', 'sprite positions'], [hex(MAP.watchdog), '—', 'watchdog']])}
      <p>One real I/O port exists: <code>OUT (0),A</code> sets the byte the board puts on the bus when it interrupts.
      A frame has many thousands of bus cycles: instruction fetches from ROM, RAM reads and writes, VRAM and sprite updates.</p>`,
  },
  {
    title: '7. The CPU (Z80)',
    html: `${registerFig}
      <p>A Zilog <b>Z80</b> at ${(ARCADE.clockHz / 1e6).toFixed(3)} MHz: ${cyclesPerFrame.toLocaleString('en')} clock cycles per video frame. It fetches an
      instruction from the address in PC, decodes it, executes it, and moves on; one instruction takes 4 to 23 cycles.</p>
      <h2>Registers and flags</h2>
      <p>A is the accumulator (arithmetic happens there). BC, DE, HL pair up as 16-bit registers, HL usually holding an
      address. IX points at the actor being worked on (32-byte records, see <i>The game logic</i>). SP is the
      <b>stack</b> pointer: CALL pushes the return address, RET pops it. The flags record the last result and steer the
      conditional jumps (JR Z, CALL NC …).</p>
      ${loopFig}
      <h2>Interrupts</h2>
      <p>The program runs in <b>interrupt mode 2</b>: on vblank the CPU reads a 16-bit handler address from the table at
      I × 256 + (the byte set with OUT (0),A). Our handler only re-enables interrupts and returns; HALT wakes up and the
      main loop runs <code>frame</code>. A frame uses up to about 80% of its cycles; the rest is spent asleep in HALT.</p>
      <h2>The program</h2>
      <p>About 1 500 lines of Z80 assembly (<code>game.asm</code>), assembled into the 16 KB ROM when the machine powers on.
      Constants in it (speeds, timings, the maze) come from the game's settings, so the ROM matches them.</p>`,
  },
  {
    title: '8. The game logic',
    html: `<p>The rules live in work RAM (${hex(MAP.ram[0])}–${hex(MAP.ram[1])}) and the routines that change it once a frame:</p>
      <p class="mono" style="font-size:13px">frame: FRAME+1 · blink · tick_flash · read_input · coin? · by PHASE → move Pac-Man, ghosts,
      update_modes, check_hits · sprites</p>
      ${table(['Variable', 'Meaning'], [['FRAME', 'frames since reset'], ['PHASE / PHASE_T', 'game phase, frames left in it'], ['SCORE, LIVES_LEFT', 'score (16 bit), lives'],
        ['PELLETS', 'dots and pellets left'], ['FRIGHT, COMBO', 'fright frames left, ghosts eaten in it'], ['MODE_I / MODE_T', 'scatter/chase step (even = scatter), frames left'],
        ['RNG', 'random byte for frightened turns'], ['TGT_X, TGT_Y', 'target tile of the ghost being moved']])}
      <h2>The actors</h2>
      <p>Pac-Man and the four ghosts each have a 32-byte record from ${hex(MAP.ram[0] + 0x40)}: X and Y (words, world pixels), DIR,
      FRAC (sub-pixel speed), STATE (house, exit, active, eyes, enter), FRIGHT, RELEASE (frames until leaving the house),
      the scatter corner, Pac-Man's wanted direction NEXT and its AGE, and animation timers.</p>
      ${targetFig}
      <h2>How a ghost decides</h2>
      <p>Only at a tile center. It lists the open directions (walls from VRAM), never the way back, and takes the one whose
      next tile is closest to its target (squared distance; ties go up, left, down, right). In <b>scatter</b> the target
      is the ghost's own corner outside the maze; in <b>chase</b> it is as in Fig. 10. The modes alternate
      ${RULES.modeSchedule.join(' / ')} s, then chase forever; every change of mode turns the ghosts around. Frightened
      ghosts pick at random; eyes target the house door.</p>
      <h2>Collisions</h2>
      <p>check_hits compares positions: closer than ${RULES.hitDistance} tiles is a touch. A frightened ghost is eaten, any
      other ghost costs a life.</p>`,
  },
  livePage,
];
