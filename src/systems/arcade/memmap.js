// Memory map of the Pac-Man arcade board (no Phaser). Source: Chris Lomont's "Pac-Man Emulation Guide";
// the VRAM layout helpers below still need checking against a real frame.

export const MAP = {
  rom: [0x0000, 0x3fff],     // program ROM (ours, not Namco's)
  vram: [0x4000, 0x43ff],    // tile codes, 28x36 visible tiles
  cram: [0x4400, 0x47ff],    // one palette index per tile
  ram: [0x4c00, 0x4fef],     // work RAM (game state, stack at the top)
  spriteAttr: [0x4ff0, 0x4fff], // 8 sprites x (code<<2 | xflip<<1 | yflip, palette)
  // 0x5000-0x50ff are I/O: reads and writes mean different things.
  in0: 0x5000,               // read: joystick 1 + coins (active low)
  in1: 0x5040,               // read: joystick 2 + start buttons (active low)
  dsw: 0x5080,               // read: dip switches
  irqEnable: 0x5000,         // write: bit 0 enables the vblank interrupt
  soundEnable: 0x5001,
  flipScreen: 0x5003,
  sound: [0x5040, 0x505f],   // write: Namco WSG, 3 voices (frequency, volume, waveform)
  spritePos: [0x5060, 0x506f], // write: 8 sprites x (x, y)
  watchdog: 0x50c0,
  irqVectorPort: 0x00,       // OUT (0),A sets the low byte of the IM 2 vector
};

// IN0 bits (0 = pressed). IN1 uses the same low four bits for joystick 2.
export const IN0 = { up: 0x01, left: 0x02, right: 0x04, down: 0x08, rackTest: 0x10, coin1: 0x20, coin2: 0x40, credit: 0x80 };
export const IN1 = { up: 0x01, left: 0x02, right: 0x04, down: 0x08, service: 0x10, start1: 0x20, start2: 0x40, cabinet: 0x80 };

export const SCREEN = { cols: 28, rows: 36 };

// Offset into VRAM/CRAM (0..0x3ff) of the tile at screen column x (0..27), row y (0..35).
// Rows 0-1 and 34-35 are stored row by row, right to left; the playfield in between column by column,
// starting at the top right.
export function tileOffset(x, y) {
  if (y < 2) return 0x3c0 + y * 32 + 29 - x;
  if (y >= 34) return (y - 34) * 32 + 29 - x;
  return 0x40 + (27 - x) * 32 + (y - 2);
}

// Inverse of tileOffset; null for the hidden bytes at the row ends.
export function tileAt(offset) {
  if (offset < 0x40 || offset >= 0x3c0) {
    const base = offset < 0x40 ? 34 : 0;
    const o = offset < 0x40 ? offset : offset - 0x3c0;
    const x = 29 - (o & 31);
    return x < 0 || x > 27 ? null : { x, y: base + (o >> 5) };
  }
  const o = offset - 0x40;
  return { x: 27 - (o >> 5), y: 2 + (o & 31) };
}

export function region(addr) {
  for (const [name, r] of Object.entries(MAP)) if (Array.isArray(r) && addr >= r[0] && addr <= r[1]) return name;
  return addr >= 0x5000 && addr <= 0x50ff ? 'io' : 'unmapped';
}
