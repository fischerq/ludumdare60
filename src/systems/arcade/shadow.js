// Shadow mode (temporary, until the rules run in Z80 code): the JS maze game (maze.js) decides what happens,
// and this writes its state into the machine the way the program will: eaten pellets cleared in VRAM, the
// maze flash in color RAM, Pac-Man and the ghosts in the sprite registers. These are host writes, not bus
// traffic. No Phaser.

import { RULES } from '../../config.js';
import { CELL, tileOffset } from './memmap.js';
import { SPRITE, DIR_NAMES } from './video.js';

const DIR = Object.fromEntries(DIR_NAMES.map((d, i) => [d, i]));
const GHOST_PAL = { blinky: 3, pinky: 4, inky: 5, clyde: 6 };
const CYCLE = [0, 1, 2, 3, 2, 1];

function setSprite(m, i, code, palette, x, y) {
  m.ram[0x3f0 + i * 2] = code;
  m.ram[0x3f1 + i * 2] = palette;
  const px = Math.round(x * 16 + 8) & 0xffff, py = Math.round(y * 16 + 8) & 0xffff;
  m.spritePos.set([px & 0xff, px >> 8, py & 0xff, py >> 8], i * 4);
}

export function writeShadow(m, g, time) {
  g.pellets.forEach((row, y) => row.forEach((k, x) => {
    const i = tileOffset(x, y);
    if (!k && (m.vram[i] === CELL.dot || m.vram[i] === CELL.power)) { m.vram[i] = CELL.empty; m.dirty[i] = 1; }
  }));
  const wallPal = g.phase === 'clearing' && Math.floor(time * 5) % 2 ? 2 : 1;
  for (let i = 0; i < 0x400; i++) if (m.vram[i] === CELL.wall) m.cram[i] = wallPal;

  const p = g.pac;
  let code;
  if (g.phase === 'dying') {
    const k = 1 - Math.max(0, g.phaseTime) / RULES.dyingTime;
    code = k < 0.85 ? SPRITE.pacDie + Math.min(9, Math.floor(k * 12)) : 0;
  } else {
    const frame = g.phase === 'ready' ? 0 : CYCLE[Math.floor(p.moved * 4) % CYCLE.length];
    code = SPRITE.pac + (DIR[p.dir] ?? 1) * 4 + frame;
  }
  setSprite(m, 0, code, 1, p.x, p.y);

  const skirt = Math.floor(time * 6) % 2;
  const flashing = g.fright > 0 && g.fright < RULES.frightFlashTime && Math.floor(time * 6) % 2 === 0;
  const hide = g.phase === 'dying' || g.phase === 'clearing' || g.phase === 'cleared';
  for (let i = 1; i < 8; i++) setSprite(m, i, 0, 0, 0, 0);
  g.ghosts.forEach((gh, i) => {
    const d = DIR[gh.dir] ?? 1;
    let c;
    if (hide) c = 0;
    else if (gh.state === 'eyes' || gh.state === 'enter') c = SPRITE.eyes + d;
    else if (gh.frightened) c = (flashing ? SPRITE.flash : SPRITE.fright) + skirt;
    else c = SPRITE.ghost + d * 2 + skirt;
    setSprite(m, 1 + i, c, GHOST_PAL[gh.name], gh.x, gh.y);
  });
}
