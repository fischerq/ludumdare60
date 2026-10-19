// Builds the board's program: assembles game.asm with constants taken from src/config.js (speeds, timers,
// the maze), so tuning the game stays a one-line edit in config. No Phaser.

import { ARCADE, MAZE, SPEED, GHOSTS, RULES, CONTROL, ANIM, LEVELS } from '../../config.js';
import { assemble } from './asm.js';
import { CELL, SOUND, MAP, IN0, IN1, DSW, VRAM_STRIDE } from './memmap.js';
import { SPRITE } from './video.js';

const T = 16; // world px per tile: the program keeps positions in world px
const frames = (s) => Math.round(s * ARCADE.frameHz);
const speed = (tilesPerSecond) => Math.round((tilesPerSecond * T * 256) / ARCADE.frameHz); // 8.8 px per frame

export function configSymbols() {
  const s = {
    VRAM: MAP.vram[0], CRAM: MAP.cram[0], RAM: MAP.ram[0], STACK_TOP: MAP.spriteAttr[0],
    SPRITE_ATTR: MAP.spriteAttr[0], SPRITE_POS: MAP.spritePos[0], IN0_PORT: MAP.in0, IN1_PORT: MAP.in1,
    DSW_PORT: MAP.dsw, IRQ_ENABLE: MAP.irqEnable, SOUND_CMD: MAP.soundCmd, WATCHDOG: MAP.watchdog,
    VRAM_STRIDE, MAZE_W: MAZE.layout[0].length, MAZE_H: MAZE.layout.length, TILE: T,
    MAZE_PX_W: MAZE.layout[0].length * T,
    PAC_START_X: MAZE.pacStart.x * T, PAC_START_Y: MAZE.pacStart.y * T,
    HOUSE_EXIT_X: MAZE.houseExit.x, HOUSE_EXIT_Y: MAZE.houseExit.y,
    HOUSE_IN_X: MAZE.houseInside.x, HOUSE_IN_Y: MAZE.houseInside.y,
    SPD_PAC: speed(SPEED.pac), SPD_GHOST: speed(SPEED.ghost), SPD_TUNNEL: speed(SPEED.ghostTunnel),
    SPD_FRIGHT: speed(SPEED.ghostFright), SPD_EYES: speed(SPEED.ghostEyes), SPD_HOUSE: speed(SPEED.ghostHouse),
    SPD_ENTER: speed(SPEED.ghostEyes * 0.5),
    LIVES: RULES.lives, DOT_POINTS: RULES.dotPoints, POWER_POINTS: RULES.powerPoints,
    FRIGHT_FRAMES: frames(RULES.frightTime), FLASH_FRAMES: frames(RULES.frightFlashTime),
    READY_FRAMES: frames(RULES.readyTime), DYING_FRAMES: frames(RULES.dyingTime),
    DIE_STEP: Math.max(1, Math.round(frames(RULES.dyingTime) / 12)),
    EAT_PAUSE_FRAMES: frames(RULES.ghostEatPause), CLEAR_FRAMES: frames(RULES.clearTime),
    PINKY_AHEAD: RULES.pinkyAhead, INKY_AHEAD: RULES.inkyAhead, CLYDE_SHY2: RULES.clydeShyDistance ** 2,
    HIT_PX: Math.floor(RULES.hitDistance * T), TURN_WINDOW_PX: Math.round(CONTROL.turnWindow * T),
    BUFFER_FRAMES: frames(CONTROL.bufferTime),
    IN_UP: IN0.up, IN_LEFT: IN0.left, IN_DOWN: IN0.down, IN_RIGHT: IN0.right, IN_COIN: IN0.coin,
    IN_START: IN1.start, DSW_DEMO: DSW.demo, SHELF_COLS: LEVELS.shelfCols,
    PELLET_COUNT: MAZE.layout.join('').replace(/[^.o]/g, '').length,
    // Animation speeds from src/settings/animation.json, in frames per animation frame (read at assembly).
    ANIM_PAC: ANIM.characters.pac ?? 2, ANIM_DEATH: ANIM.effects.pacDeath ?? 8,
    ANIM_BLINK: ANIM.effects.powerPellet ?? 12, ANIM_FLASH: ANIM.effects.frightFlash ?? 10,
    ANIM_CLEAR: ANIM.effects.mazeClear ?? 12,
  };
  for (const [k, v] of Object.entries(CELL)) s[`CELL_${k.toUpperCase()}`] = v;
  for (const [k, v] of Object.entries(SPRITE)) s[`SPR_${k.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`] = v;
  for (const [v, name] of Object.entries(SOUND)) s[`SND_${name.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`] = Number(v);
  return s;
}

// Tables generated from config, appended to the source so they show up in the listing like hand-written data.
export function generatedSource() {
  const code = { '#': CELL.wall, '-': CELL.door, T: CELL.tunnel, G: CELL.house, '.': CELL.dot, o: CELL.power };
  const lines = ['', '; ---- generated from src/config.js ----', 'MAZE_ROM:'];
  for (const row of MAZE.layout) {
    lines.push(`        db ${[...row].map((c) => `0x${(code[c] ?? CELL.empty).toString(16).padStart(2, '0')}`).join(',')} ; ${row}`);
  }
  const power = [];
  MAZE.layout.forEach((row, y) => [...row].forEach((c, x) => { if (c === 'o') power.push(MAP.cram[0] + y * VRAM_STRIDE + x); }));
  lines.push(`POWER_CELLS:       ; color RAM address of each power pellet`, `        dw ${power.join(', ')}`);
  lines.push(`POWER_COUNT equ ${power.length}`);
  // Level 256's repairs: the garbage half (the shelf's columns, every maze row) in LEVELS.repairs strips, top to
  // bottom, one per bit of REPAIRS. Each entry: the strip's first cell in MAZE_ROM and in video RAM, its rows.
  const H = MAZE.layout.length, W = MAZE.layout[0].length, x0 = W - LEVELS.shelfCols, n = LEVELS.repairs;
  lines.push('REPAIR_TABLE:      ; level 256 strips: source in MAZE_ROM, video RAM address (words), rows');
  for (let k = 0; k < n; k++) {
    const r0 = Math.floor((k * H) / n), r1 = Math.floor(((k + 1) * H) / n);
    lines.push(`        dw MAZE_ROM+${r0 * W + x0}, ${MAP.vram[0] + r0 * VRAM_STRIDE + x0}`, `        db ${r1 - r0} ; rows ${r0}..${r1 - 1}`);
  }
  lines.push(`REPAIR_COUNT equ ${n}`, `REPAIR_ALL equ ${(1 << n) - 1}`);
  const t = (v) => Math.round(v);
  lines.push('GHOST_INIT:        ; start x px, start y px, release frames (words), corner x, corner y (tiles), skirt anim');
  for (const g of GHOSTS) {
    lines.push(`        dw ${t(g.start.x * T)}, ${t(g.start.y * T)}, ${frames(g.release)}`);
    lines.push(`        db ${g.corner.x}, ${g.corner.y}, ${ANIM.characters[g.name] ?? 10} ; ${g.name}`);
  }
  lines.push('MODE_TIMES:        ; scatter/chase schedule in frames, 0 = forever');
  lines.push(`        dw ${[...RULES.modeSchedule.map(frames), 0].join(', ')}`);
  lines.push('GHOST_POINTS:      ; score for eating 1st..4th ghost');
  lines.push(`        dw ${RULES.ghostPoints.join(', ')}`);
  return lines.join('\n');
}

export function buildProgram(source) {
  const r = assemble(source + generatedSource(), configSymbols());
  if (r.errors.length) throw new Error(`game.asm: ${r.errors.map((e) => `line ${e.line}: ${e.message}`).join('; ')}`);
  return { ...r, source };
}

async function readText(url) {
  if (typeof window === 'undefined') {
    const { readFile } = await import('node:fs/promises');
    return readFile(url, 'utf8');
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`game.asm: HTTP ${res.status}`);
  return res.text();
}

export async function loadProgram() {
  return buildProgram(await readText(new URL('./game.asm', import.meta.url)));
}
