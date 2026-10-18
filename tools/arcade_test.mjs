// Tests for src/systems/arcade (no browser): node tools/arcade_test.mjs  (needs network for the pinned Z80 core)
import { loadZ80 } from '../src/systems/arcade/z80.js';
import { createMachine } from '../src/systems/arcade/machine.js';
import { spriteArt, layoutFromVram, SPRITE } from '../src/systems/arcade/video.js';
import { CELL, tileOffset } from '../src/systems/arcade/memmap.js';
import { MAZE } from '../src/config.js';
import { assemble } from '../src/systems/arcade/asm.js';
import { loadProgram } from '../src/systems/arcade/program.js';
import { readState } from '../src/systems/arcade/state.js';
import { botDirection } from '../src/systems/arcade/bot.js';
import { DSW } from '../src/systems/arcade/memmap.js';
import { IN0, IN1 } from '../src/systems/arcade/memmap.js';
import { createGame, stepGame, steer } from '../src/systems/maze.js';
import { ARCADE, RULES } from '../src/config.js';

let failed = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${info}`); if (!ok) failed++; };
const Z80 = await loadZ80();

{ // Hand-assembled: IM 2 vblank interrupt, a counter in the ISR, a VRAM write and a sound command, then HALT.
  const rom = new Uint8Array(0x4000);
  rom.set([0xf3, 0x31, 0xf0, 0x4f, 0x3e, 0x30, 0xed, 0x47, 0xed, 0x5e, 0xaf, 0xd3, 0x00, // DI, SP, I=0x30, IM 2, OUT (0),0
    0x3e, 0x01, 0x32, 0x00, 0x50, 0xfb,                                                  // enable vblank IRQ, EI
    0x21, 0x00, 0x40, 0x34, 0x3e, 0x01, 0x32, 0x40, 0x50, 0x76, 0x18, 0xf4]);            // loop: INC (0x4000), sound 1, HALT
  rom.set([0x00, 0x31], 0x3000);                                                         // IM 2 vector -> 0x3100
  rom.set([0xf5, 0x3a, 0x00, 0x4c, 0x3c, 0x32, 0x00, 0x4c, 0xf1, 0xfb, 0xed, 0x4d], 0x3100); // ISR: (0x4c00)++
  const m = createMachine(Z80, { rom });
  for (let i = 0; i < 10; i++) m.runFrame();
  check('vblank interrupt every frame', m.ram[0] === 9, `isr=${m.ram[0]}`); // frame 1 has no IRQ yet
  check('main loop once per frame', m.vram[0] === 10, `vram0=${m.vram[0]}`);
  check('halt skips the idle frame', m.halted && m.frameRange(0).to - m.frameRange(0).from < 100);
  check('sound latch', m.takeSounds().length === 10);
  check('dirty bits', m.dirty[0] === 1 && m.dirty[1] === 0);
}

{ // Video chip decoding
  check('sprite codes', spriteArt(SPRITE.pac + 1 * 8 + 5).key === 'maze/pac-5' && spriteArt(SPRITE.pac + 8).flipX
    && spriteArt(SPRITE.ghost + 2 * 8 + 3 * 2 + 1).key === 'maze/ghost-inky-right-1'
    && spriteArt(SPRITE.points + 3).text === '1600' && spriteArt(0) === null);
  const vram = new Uint8Array(0x400);
  const code = { '#': CELL.wall, '-': CELL.door, T: CELL.tunnel, G: CELL.house, '.': CELL.dot, o: CELL.power };
  MAZE.layout.forEach((r, y) => [...r].forEach((c, x) => { vram[tileOffset(x, y)] = code[c] ?? CELL.empty; }));
  check('walls read back from VRAM', layoutFromVram(vram).join() === MAZE.layout.join().replace(/o/g, '.'));
}

{ // Assembler: a few encodings against the Zilog tables, labels, locals, jumps
  const enc = (src) => [...assemble(src).memory.subarray(0, 4)].map((b) => b.toString(16).padStart(2, '0')).join('');
  check('asm encodings', enc('ld a,(ix+3)') === 'dd7e0300' && enc('set 3,(iy+2)') === 'fdcb02de' && enc("ex af,af'") === '08000000'
    && enc('ld de,(0x4c00)') === 'ed5b004c' && enc('jp m,0x10') === 'fa100000' && enc('sbc hl,de') === 'ed520000');
  const r = assemble('a: ld b,3\n.l: djnz .l\n jr a\nb:\n.l: jr .l\n ld a, high(b) + 1');
  check('asm labels and jumps', !r.errors.length && enc('x: jr x') === '18fe0000' && r.symbols['b.l'] === 6, JSON.stringify(r.errors));
  check('asm errors', assemble('ld q,1').errors.length === 1 && assemble('jr far\n ds 300\nfar: nop').errors.length === 1);
}

{ // The program: boots, draws the maze into VRAM, blinks the power pellets
  const prog = await loadProgram();
  const m = createMachine(Z80, { rom: prog.rom });
  for (let i = 0; i < 5; i++) m.runFrame();
  check('maze in VRAM', layoutFromVram(m.vram).join() === MAZE.layout.join().replace(/o/g, '.'));
  const p = tileOffset(1, 2), before = m.cram[p];
  for (let i = 0; i < 12; i++) m.runFrame();
  check('power pellets blink', m.vram[p] === CELL.power && m.cram[p] !== before, `${before} -> ${m.cram[p]}`);
  check('program halts each frame', m.halted, `${m.frameRange(0).to - m.frameRange(0).from} accesses`);
}

{ // The Z80 rules against maze.js: same swipes at the same frames, same tiles visited, same score
  const prog = await loadProgram();
  const m = createMachine(Z80, { rom: prog.rom });
  for (let i = 0; i < 3; i++) m.runFrame();
  m.setInput(1, IN1.start, true); m.runFrame(); m.setInput(1, IN1.start, false);
  const g = createGame();
  const script = { 130: 'left', 190: 'up', 260: 'left', 330: 'down', 420: 'right', 470: 'down', 560: 'left', 650: 'up', 760: 'right', 900: 'down', 1000: 'left' };
  const pathM = [[], [], [], [], []], pathJ = [[], [], [], [], []];
  const visit = (arr, t) => { if (arr.at(-1) !== t) arr.push(t); };
  let overruns = 0, busy = 0;
  for (let f = 0; f < 1300; f++) {
    for (const k of ['up', 'left', 'down', 'right']) m.setInput(0, IN0[k], k === script[f]);
    if (script[f]) steer(g, script[f]);
    m.runFrame();
    if (!m.halted) overruns++;
    busy = Math.max(busy, m.busy);
    stepGame(g, 1 / ARCADE.frameHz);
    const st = readState(m, prog.symbols);
    [st.pac, ...st.ghosts].forEach((a, i) => visit(pathM[i], `${Math.round(a.x) % 19},${Math.round(a.y)}`));
    [g.pac, ...g.ghosts].forEach((a, i) => visit(pathJ[i], `${((Math.round(a.x) % 19) + 19) % 19},${Math.round(a.y)}`));
  }
  const same = (i) => pathJ[i].every((t, k) => pathM[i][k] === t);
  check('pac-man moves like maze.js', same(0), `${pathM[0].length} tiles`);
  check('ghosts move like maze.js', [1, 2, 3, 4].every(same), pathM.slice(1).map((p) => p.length).join('/'));
  check('same score', readState(m, prog.symbols).score === g.score, `${readState(m, prog.symbols).score} vs ${g.score}`);
  check('every frame fits the frame budget', overruns === 0, `peak ${Math.round((busy / m.frameCycles) * 100)}%`);
}

{ // The bot plays a demo game: it eats, and its deaths don't cost lives
  const prog = await loadProgram(), S = prog.symbols;
  const m = createMachine(Z80, { rom: prog.rom });
  m.setDip(DSW.demo, true);
  for (let i = 0; i < 3; i++) m.runFrame();
  m.setInput(1, IN1.start, true); m.runFrame(); m.setInput(1, IN1.start, false);
  const deaths = [];
  for (let f = 0; f < 3600; f++) {
    const d = botDirection(m, S);
    for (const k of ['up', 'left', 'down', 'right']) m.setInput(0, IN0[k], k === d);
    m.runFrame();
    for (const e of m.takeSounds()) if (e.name === 'death') deaths.push(f);
  }
  const st = readState(m, S);
  check('bot eats pellets', st.pellets < 120, `${199 - st.pellets} eaten in 60 s, score ${st.score}, ${deaths.length} deaths`);
  check('demo play keeps the lives', st.lives === RULES.lives);
}

{ // Levels: a clear starts the next round with the counter one up; level 256 overflows the fruit shelf loop.
  const prog = await loadProgram();
  const S = prog.symbols, PH = (name) => ['attract', 'ready', 'play', 'dying', 'clearing', 'cleared', 'over'].indexOf(name);
  const start = (m) => { m.setInput(1, IN1.start, true); m.runFrame(); m.setInput(1, IN1.start, false); m.runFrame(); };
  const onLevel = (counter) => {
    const m = createMachine(Z80, { rom: prog.rom });
    for (let i = 0; i < 3; i++) m.runFrame();
    start(m);
    m.ram[S.SCORE - 0x4c00] = 0x34;
    m.ram[S.LEVEL - 0x4c00] = (counter - 1) & 0xff;
    m.ram[S.PHASE - 0x4c00] = PH('cleared');
    start(m);
    return m;
  };
  const shelf = (m) => [...m.vram.subarray(tileOffset(0, MAZE.layout.length), tileOffset(19, MAZE.layout.length))];
  const m2 = onLevel(1);
  check('next round counts the level up', m2.read(S.LEVEL) === 1 && readState(m2, S).phase === 'ready' && m2.read(S.SCORE) === 0x34
    && readState(m2, S).pellets === MAZE.layout.join('').replace(/[^.o]/g, '').length, `level byte ${m2.read(S.LEVEL)}`);
  check('level 2 shelf: strawberry, cherry', shelf(m2).slice(17).join() === [CELL.strawberry, CELL.cherry].join());
  check('maze refilled', layoutFromVram(m2.vram).join() === MAZE.layout.join().replace(/o/g, '.'));
  const m9 = onLevel(8);
  check('level 9 shows 7 fruits', shelf(m9).filter((c) => c).length === 7);
  const k = onLevel(255);
  let right = 0, left = 0, dots = 0;
  MAZE.layout.forEach((row, y) => [...row].forEach((ch, x) => {
    const c = k.vram[tileOffset(x, y)];
    const was = { '#': CELL.wall, '-': CELL.door, T: CELL.tunnel, G: CELL.house, '.': CELL.dot, o: CELL.power }[ch] ?? CELL.empty;
    if (c !== was) { if (x > 9) right++; else left++; }
    if (c === CELL.dot || c === CELL.power) dots++;
  }));
  check('level 256 garbles the right half only', k.read(S.LEVEL) === 255 && right > 150 && left === 0, `right ${right} left ${left}`);
  check('level 256 can\'t be cleared', dots < readState(k, S).pellets, `${dots} dots on screen, ${readState(k, S).pellets} to go`);
}

if (failed) { console.error(`${failed} failed`); process.exit(1); }
console.log('all ok');
