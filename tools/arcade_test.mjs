// Tests for src/systems/arcade (no browser): node tools/arcade_test.mjs  (needs network for the pinned Z80 core)
import { loadZ80 } from '../src/systems/arcade/z80.js';
import { createMachine } from '../src/systems/arcade/machine.js';
import { spriteArt, layoutFromVram, SPRITE } from '../src/systems/arcade/video.js';
import { CELL, tileOffset } from '../src/systems/arcade/memmap.js';
import { MAZE } from '../src/config.js';
import { assemble } from '../src/systems/arcade/asm.js';
import { loadProgram } from '../src/systems/arcade/program.js';

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
  check('sprite codes', spriteArt(SPRITE.pac + 1 * 4 + 2).key === 'maze/pac-2' && spriteArt(SPRITE.pac + 4).flipX
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

if (failed) { console.error(`${failed} failed`); process.exit(1); }
console.log('all ok');
