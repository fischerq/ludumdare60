// Memory map of our arcade board (no Phaser). It follows the Namco Pac-Man board (ROM, video RAM, color RAM,
// work RAM, sprites, memory-mapped I/O at 0x5000), but the screen is sized to our 19x25 maze, sprite positions
// are 16-bit world pixels, and sound is a command latch instead of the WSG voice registers.

export const MAP = {
  rom: [0x0000, 0x3fff],     // program ROM
  vram: [0x4000, 0x43ff],    // one cell code per maze tile, 32 bytes per row (19 used), 25 rows + the level shelf row
  cram: [0x4400, 0x47ff],    // one palette index per tile, same layout
  ram: [0x4c00, 0x4fef],     // work RAM (game state, stack at the top)
  spriteAttr: [0x4ff0, 0x4fff], // 8 sprites x (code, palette)
  // 0x5000-0x50ff are I/O: reads and writes mean different things.
  in0: 0x5000,               // read: joystick + coin (active low)
  in1: 0x5040,               // read: start buttons (active low)
  dsw: 0x5080,               // read: dip switches
  irqEnable: 0x5000,         // write: bit 0 enables the vblank interrupt
  soundCmd: 0x5040,          // write: sound command latch (see SOUND)
  spritePos: [0x5060, 0x507f], // write: 8 sprites x (x lo, x hi, y lo, y hi), world px of the sprite center
  watchdog: 0x50c0,
  irqVectorPort: 0x00,       // OUT (0),A sets the low byte of the IM 2 vector
};

// IN0 bits (0 = pressed). Directions use the game's order: up, left, down, right.
export const IN0 = { up: 0x01, left: 0x02, down: 0x04, right: 0x08, coin: 0x20 };
export const IN1 = { start: 0x20 };
// Dip switches (1 = on, read as is).
export const DSW = { demo: 0x01 };   // demo: dying doesn't cost a life (the bot's attract-mode game, the input layer's test game)

// Values the program writes to the sound latch. The host plays them with src/sound.js.
export const SOUND = {
  1: 'dot', 2: 'power', 3: 'frightEnd', 4: 'ghost', 5: 'death', 6: 'clear', 7: 'over', 8: 'cleared',
  9: 'go', 10: 'ready', 11: 'start',
};

export const VRAM_STRIDE = 32;
export const tileOffset = (x, y) => y * VRAM_STRIDE + x;
export const tileAt = (offset) => ({ x: offset % VRAM_STRIDE, y: Math.floor(offset / VRAM_STRIDE) });

// Cell codes in VRAM. The program reads them to know where actors may go, like the original reads tiles.
// Like the original, every code from the wall code up blocks actors: that covers the fruit tiles on the level shelf
// below the maze, and any garbage byte that lands in the maze (the level 256 overflow, see game.asm draw_fruit).
// Lower codes that aren't door or house are floor.
export const CELL = {
  empty: 0x00, dot: 0x01, power: 0x02, door: 0x03, tunnel: 0x04, house: 0x05, wall: 0x10,
  // The level shelf's fruits, one tile each (art maze/fruit-<name>).
  cherry: 0x20, strawberry: 0x21, orange: 0x22, apple: 0x23, melon: 0x24, ship: 0x25, bell: 0x26, key: 0x27,
};
export const FRUITS = ['cherry', 'strawberry', 'orange', 'apple', 'melon', 'ship', 'bell', 'key'];
// What the program itself does with a cell code: true if no actor may enter it.
export const blocksActors = (c) => c >= CELL.wall || c === CELL.door || c === CELL.house;
// The codes the board's graphics ROM has a picture for; anything else is garbage (drawn as noise by video.js).
export const knownCell = (c) => c <= CELL.house || c === CELL.wall || (c >= CELL.cherry && c <= CELL.key);

export function region(addr) {
  for (const [name, r] of Object.entries(MAP)) if (Array.isArray(r) && addr >= r[0] && addr <= r[1]) return name;
  return addr >= 0x5000 && addr <= 0x50ff ? 'io' : 'unmapped';
}
