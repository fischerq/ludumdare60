// Reads the game's state out of the machine's work RAM (no Phaser), using the addresses the assembler gave
// the program's variables. For the HUD, the bot and the game-logic layer. Reads don't touch the bus log.

export const PHASES = ['attract', 'ready', 'play', 'dying', 'clearing', 'cleared', 'over'];
export const GHOST_STATES = ['house', 'exit', 'active', 'eyes', 'enter'];
export const DIRS = ['up', 'left', 'down', 'right'];

export function readState(m, S) {
  const r8 = (a) => m.read(a), r16 = (a) => m.read(a) | (m.read(a + 1) << 8);
  const s8 = (a) => (r8(a) << 24) >> 24;
  const actor = (i) => {
    const a = S.ACTORS + i * 32;
    return {
      x: r16(a) / 16, y: r16(a + 2) / 16, dir: DIRS[r8(a + 4)] ?? null,
      state: GHOST_STATES[r8(a + 6)], frightened: r8(a + 7) === 1,
      corner: { x: s8(a + 10), y: s8(a + 11) }, next: DIRS[r8(a + 12)] ?? null,
    };
  };
  const ghosts = ['blinky', 'pinky', 'inky', 'clyde'].map((name, i) => ({ name, ...actor(i + 1) }));
  return {
    phase: PHASES[r8(S.PHASE)] ?? 'attract', score: r16(S.SCORE), lives: r8(S.LIVES_LEFT),
    pellets: r16(S.PELLETS), fright: r16(S.FRIGHT), modeIndex: r8(S.MODE_I), chase: (r8(S.MODE_I) & 1) === 1,
    frame: r16(S.FRAME), pac: actor(0), ghosts,
  };
}
