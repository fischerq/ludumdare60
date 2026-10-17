// A 3x5 pixel font for hex digits and a few letters, so the memory layers can print bytes in tiny cells.
// No Phaser: draws with fillRect into a 2D canvas.

const GLYPHS = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001',
  5: '111100111001111', 6: '111100111101111', 7: '111001001010010', 8: '111101111101111', 9: '111101111001111',
  A: '010101111101101', B: '110101110101110', C: '111100100100111', D: '110101101101110', E: '111100111100111',
  F: '111100111100100', R: '110101110101101', W: '101101101111101', M: '101111111101101', I: '111010010010111',
  O: '111101101101111', P: '111101111100100', N: '110101101101101', S: '111100111001111', L: '100100100100111',
  ' ': '000000000000000',
};

// Draws str with its top-left at (x, y); k = px per font pixel. Returns the width drawn.
export function tinyText(ctx, str, x, y, k = 1) {
  let cx = x;
  for (const ch of String(str).toUpperCase()) {
    const g = GLYPHS[ch] ?? GLYPHS[' '];
    for (let i = 0; i < 15; i++) if (g[i] === '1') ctx.fillRect(cx + (i % 3) * k, y + Math.floor(i / 3) * k, k, k);
    cx += 4 * k;
  }
  return cx - x;
}

export const hex2 = (v) => v.toString(16).toUpperCase().padStart(2, '0');
