// Smoke test for src/systems/arcade: runs a tiny hand-assembled program on the emulated board.
// node tools/arcade_smoke.mjs  (needs network for the pinned Z80 core)
import { loadZ80 } from '../src/systems/arcade/z80.js';
import { createMachine } from '../src/systems/arcade/machine.js';
import { tileOffset, tileAt } from '../src/systems/arcade/memmap.js';

const rom = new Uint8Array(0x4000);
rom.set([0xf3, 0x31, 0xf0, 0x4f, 0x3e, 0x30, 0xed, 0x47, 0xed, 0x5e, 0xaf, 0xd3, 0x00, // DI, SP, I=0x30, IM 2, OUT (0),0
  0x3e, 0x01, 0x32, 0x00, 0x50, 0xfb,                                                  // enable vblank IRQ, EI
  0x21, 0x00, 0x40, 0x34, 0x18, 0xfa]);                                                // loop: INC (0x4000)
rom.set([0x00, 0x31], 0x3000);                                                         // IM 2 vector -> 0x3100
rom.set([0xf5, 0x3a, 0x00, 0x4c, 0x3c, 0x32, 0x00, 0x4c, 0xf1, 0xfb, 0xed, 0x4d], 0x3100); // ISR: (0x4c00)++

const m = createMachine(await loadZ80(), { rom });
for (let i = 0; i < 10; i++) m.runFrame();
const ok = m.ram[0] === 9 // the 10th IRQ is served at the start of frame 11
   && m.dirty[0] === 1;
for (let y = 0; y < 36; y++) for (let x = 0; x < 28; x++) {
  const t = tileAt(tileOffset(x, y));
  if (t.x !== x || t.y !== y) throw new Error(`tile map mismatch at ${x},${y}`);
}
console.log({ frames: m.frame, isrCount: m.ram[0], vram0: m.vram[0], pc: m.cpu.getState().pc.toString(16), lastBus: m.recentBus(2) });
if (!ok) { console.error('FAIL'); process.exit(1); }
console.log('OK');
