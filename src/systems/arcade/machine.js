// The emulated arcade board (no Phaser): memory, I/O, vblank interrupt, and the state the lower layers read.
// The CPU is passed in (the Z80 constructor from z80.js), so benches and tests can drive the same machine.

import { ARCADE } from '../../config.js';
import { MAP, region } from './memmap.js';

export function createMachine(Z80, { rom = new Uint8Array(0x4000), log = ARCADE.busLogSize } = {}) {
  const m = {
    rom: new Uint8Array(0x4000),
    vram: new Uint8Array(0x400),
    cram: new Uint8Array(0x400),
    ram: new Uint8Array(0x400),          // 0x4c00-0x4fff, includes the sprite attributes at the top
    spritePos: new Uint8Array(16),
    sound: new Uint8Array(32),
    in0: 0xff, in1: 0xff, dsw: 0xc9,     // active low: 0xff = nothing pressed
    irqOn: false, irqVector: 0,
    dirty: new Uint8Array(0x800),        // VRAM+CRAM bytes written since clearDirty()
    bus: new Array(log), busHead: 0,     // ring buffer of { addr, value, write, io, cycle }
    cycle: 0, frame: 0,
    hooks: [],                           // fn(access) for every bus access, e.g. a layer listening for writes
  };
  m.rom.set(rom.subarray(0, 0x4000));

  const record = (addr, value, write, io) => {
    const a = { addr, value, write, io, cycle: m.cycle };
    m.bus[m.busHead] = a;
    m.busHead = (m.busHead + 1) % m.bus.length;
    for (const h of m.hooks) h(a);
  };

  const read = addr => {
    let v = 0xff;
    if (addr < 0x4000) v = m.rom[addr];
    else if (addr < 0x4400) v = m.vram[addr - 0x4000];
    else if (addr < 0x4800) v = m.cram[addr - 0x4400];
    else if (addr >= 0x4c00 && addr < 0x5000) v = m.ram[addr - 0x4c00];
    else if (addr >= 0x5000 && addr < 0x5040) v = m.in0;
    else if (addr >= 0x5040 && addr < 0x5080) v = m.in1;
    else if (addr >= 0x5080 && addr < 0x50c0) v = m.dsw;
    return v;
  };

  const write = (addr, v) => {
    if (addr < 0x4000) return;                                   // ROM
    if (addr < 0x4400) { m.vram[addr - 0x4000] = v; m.dirty[addr - 0x4000] = 1; }
    else if (addr < 0x4800) { m.cram[addr - 0x4400] = v; m.dirty[addr - 0x4000] = 1; }
    else if (addr >= 0x4c00 && addr < 0x5000) m.ram[addr - 0x4c00] = v;
    else if (addr === MAP.irqEnable) m.irqOn = (v & 1) === 1;
    else if (addr >= 0x5040 && addr < 0x5060) m.sound[addr - 0x5040] = v & 0x0f; // WSG registers are 4-bit
    else if (addr >= 0x5060 && addr < 0x5070) m.spritePos[addr - 0x5060] = v;
  };

  m.cpu = new Z80({
    mem_read: addr => { const v = read(addr); record(addr, v, false, false); return v; },
    mem_write: (addr, v) => { write(addr, v); record(addr, v, true, false); },
    io_read: port => { record(port & 0xff, 0xff, false, true); return 0xff; },
    io_write: (port, v) => { if ((port & 0xff) === MAP.irqVectorPort) m.irqVector = v; record(port & 0xff, v, true, true); },
  });

  // Runs the CPU for one video frame, then raises the vblank interrupt (Pac-Man uses the maskable INT in
  // IM 2, not the NMI). onStep(m) runs after every instruction, for layers that watch the CPU step by step.
  m.runFrame = (onStep) => {
    const end = m.cycle + Math.round(ARCADE.clockHz / ARCADE.frameHz);
    while (m.cycle < end) {
      m.cycle += m.cpu.run_instruction();
      if (onStep) onStep(m);
    }
    if (m.irqOn) m.cpu.interrupt(false, m.irqVector); // the core counts its cycles on the next run_instruction
    m.frame++;
  };

  m.clearDirty = () => m.dirty.fill(0);

  // Joystick/buttons as the player presses them; bits are active low like on the real board.
  m.setInput = (port, mask, down) => {
    const key = port === 1 ? 'in1' : 'in0';
    m[key] = down ? m[key] & ~mask : m[key] | mask;
  };

  // Last n bus accesses, oldest first.
  m.recentBus = (n = 256) => {
    const out = [];
    for (let i = n; i > 0; i--) {
      const a = m.bus[(m.busHead - i + m.bus.length) % m.bus.length];
      if (a) out.push({ ...a, region: a.io ? 'port' : region(a.addr) });
    }
    return out;
  };

  // Everything a lower layer might draw, in one plain object.
  m.snapshot = () => ({
    frame: m.frame, cycle: m.cycle,
    cpu: m.cpu.getState(),
    vram: m.vram, cram: m.cram, ram: m.ram, dirty: m.dirty,
    sprites: Array.from({ length: 8 }, (_, i) => ({
      code: m.ram[0x3f0 + i * 2] >> 2, flipX: (m.ram[0x3f0 + i * 2] >> 1) & 1, flipY: m.ram[0x3f0 + i * 2] & 1,
      palette: m.ram[0x3f1 + i * 2], x: m.spritePos[i * 2], y: m.spritePos[i * 2 + 1],
    })),
    voices: [0, 1, 2].map(i => ({ wave: m.sound[0x05 + i * 5], volume: m.sound[0x15 + i * 5] })),
    in0: m.in0, in1: m.in1, irqOn: m.irqOn,
  });

  return m;
}
