// The emulated arcade board (no Phaser): memory, I/O, vblank interrupt, and the raw data the layers read.
// The CPU is passed in (the Z80 constructor from z80.js), so the game, benches and tests drive the same machine.

import { ARCADE } from '../../config.js';
import { MAP, SOUND, region } from './memmap.js';

export const BUS = { write: 1, io: 2 };   // bits of busKind

export function createMachine(Z80, { rom = new Uint8Array(0x4000) } = {}) {
  const N = ARCADE.busLogSize;
  const m = {
    rom: new Uint8Array(0x4000),
    vram: new Uint8Array(0x400),
    cram: new Uint8Array(0x400),
    ram: new Uint8Array(0x400),          // 0x4c00-0x4fff, includes the sprite attributes at the top
    spritePos: new Uint8Array(32),
    in0: 0xff, in1: 0xff, dsw: 0x00,     // inputs are active low: 0xff = nothing pressed
    irqOn: false, irqVector: 0,
    dirty: new Uint8Array(0x800),        // VRAM+CRAM bytes written since clearDirty()
    // Bus log: a ring of the last N accesses, as typed arrays (a frame has thousands, no garbage).
    busAddr: new Uint16Array(N), busVal: new Uint8Array(N), busKind: new Uint8Array(N),
    busCycle: new Uint16Array(N),        // cycle within its frame
    busCount: 0,                         // accesses so far; entry i lives at i % N
    frameBus: new Float64Array(ARCADE.framesKept), // busCount at the start of each recent frame
    sounds: [],                          // sound latch writes not yet taken: { frame, name }
    cycle: 0, frameCycle: 0, frame: 0, halted: false,
    busy: 0,                             // cycles the last frame ran before it HALTed (load = busy / frameCycles)
    hooks: [],                           // fn(addr, value, kind) for every access, e.g. a layer watching writes
  };
  m.rom.set(rom.subarray(0, 0x4000));

  const record = (addr, value, kind) => {
    const i = m.busCount % N;
    m.busAddr[i] = addr; m.busVal[i] = value; m.busKind[i] = kind; m.busCycle[i] = m.frameCycle;
    m.busCount++;
    if (m.hooks.length) for (const h of m.hooks) h(addr, value, kind);
  };

  const read = (addr) => {
    if (addr < 0x4000) return m.rom[addr];
    if (addr < 0x4400) return m.vram[addr - 0x4000];
    if (addr < 0x4800) return m.cram[addr - 0x4400];
    if (addr >= 0x4c00 && addr < 0x5000) return m.ram[addr - 0x4c00];
    if (addr >= 0x5000 && addr < 0x5040) return m.in0;
    if (addr >= 0x5040 && addr < 0x5080) return m.in1;
    if (addr >= 0x5080 && addr < 0x50c0) return m.dsw;
    return 0xff;
  };

  const write = (addr, v) => {
    if (addr < 0x4000) return;                                   // ROM
    if (addr < 0x4400) { m.vram[addr - 0x4000] = v; m.dirty[addr - 0x4000] = 1; }
    else if (addr < 0x4800) { m.cram[addr - 0x4400] = v; m.dirty[addr - 0x4000] = 1; }
    else if (addr >= 0x4c00 && addr < 0x5000) m.ram[addr - 0x4c00] = v;
    else if (addr === MAP.irqEnable) m.irqOn = (v & 1) === 1;
    else if (addr === MAP.soundCmd) { if (SOUND[v]) m.sounds.push({ frame: m.frame, name: SOUND[v] }); }
    else if (addr >= MAP.spritePos[0] && addr <= MAP.spritePos[1]) m.spritePos[addr - MAP.spritePos[0]] = v;
  };

  m.read = read;   // for layers that peek without touching the bus log
  m.cpu = new Z80({
    mem_read: (addr) => { const v = read(addr); record(addr, v, 0); return v; },
    mem_write: (addr, v) => { write(addr, v); record(addr, v, BUS.write); },
    io_read: (port) => { record(port & 0xff, 0xff, BUS.io); return 0xff; },
    io_write: (port, v) => {
      if ((port & 0xff) === MAP.irqVectorPort) m.irqVector = v;
      record(port & 0xff, v, BUS.write | BUS.io);
    },
  });

  // Runs the CPU for one video frame (vblank to vblank): first the interrupt, then instructions until the
  // frame's cycles are used up. The program HALTs when it's done with a frame, and the halted CPU only idles
  // (no bus traffic), so we skip straight to the end of the frame. onStep(m) runs after every instruction.
  const frameCycles = Math.round(ARCADE.clockHz / ARCADE.frameHz);
  m.runFrame = (onStep) => {
    m.frameBus[m.frame % m.frameBus.length] = m.busCount;
    m.frameCycle = 0;
    if (m.irqOn) { m.cpu.interrupt(false, m.irqVector); m.halted = false; }
    while (m.frameCycle < frameCycles) {
      const before = m.busCount;
      m.frameCycle += m.cpu.run_instruction();
      if (onStep) onStep(m);
      if (m.busCount === before) { m.halted = true; break; }
    }
    m.busy = m.halted ? m.frameCycle : frameCycles;
    m.cycle += frameCycles;
    m.frame++;
  };

  m.frameCycles = frameCycles;
  m.clearDirty = () => m.dirty.fill(0);

  // Joystick/buttons as the player (or the bot) holds them; bits are active low like on the real board.
  m.setInput = (port, mask, down) => {
    const key = port === 1 ? 'in1' : 'in0';
    m[key] = down ? m[key] & ~mask : m[key] | mask;
  };
  m.setDip = (mask, on) => { m.dsw = on ? m.dsw | mask : m.dsw & ~mask; };

  // Bus accesses of a recent frame (0 = the frame just run, 1 = the one before, ...), oldest first.
  // Returns index ranges into the typed arrays: { from, to } with entry i at i % N.
  m.frameRange = (ago = 0) => {
    const k = m.frameBus.length;
    if (ago >= Math.min(k, m.frame)) return null;
    const f = m.frame - 1 - ago;
    const from = m.frameBus[f % k];
    const to = ago === 0 ? m.busCount : m.frameBus[(f + 1) % k];
    return { from: Math.max(from, m.busCount - N), to, frame: f };
  };

  // Last n bus accesses as objects, oldest first (for text views; layers should read the arrays).
  m.recentBus = (n = 256) => {
    const out = [];
    for (let i = Math.max(0, m.busCount - n); i < m.busCount; i++) {
      const j = i % N, kind = m.busKind[j];
      out.push({
        addr: m.busAddr[j], value: m.busVal[j], write: !!(kind & BUS.write), io: !!(kind & BUS.io),
        cycle: m.busCycle[j], region: kind & BUS.io ? 'port' : region(m.busAddr[j]),
      });
    }
    return out;
  };

  m.takeSounds = () => m.sounds.splice(0);

  // Sprites as the hardware sees them: code 0 is an empty slot.
  m.sprites = () => Array.from({ length: 8 }, (_, i) => ({
    code: m.ram[0x3f0 + i * 2], palette: m.ram[0x3f1 + i * 2],
    x: (m.spritePos[i * 4] | m.spritePos[i * 4 + 1] << 8) << 16 >> 16,
    y: (m.spritePos[i * 4 + 2] | m.spritePos[i * 4 + 3] << 8) << 16 >> 16,
  }));

  // Everything a layer might draw, in one plain object.
  m.snapshot = () => ({
    frame: m.frame, cycle: m.cycle, cpu: m.cpu.getState(),
    vram: m.vram, cram: m.cram, ram: m.ram, dirty: m.dirty, sprites: m.sprites(),
    in0: m.in0, in1: m.in1, dsw: m.dsw, irqOn: m.irqOn,
  });

  return m;
}
