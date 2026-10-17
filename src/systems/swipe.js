// Swipe detection with no Phaser, shared by the game and the lab bench.
// Each swipe re-arms from where the finger is, so you can keep steering without lifting.

export function createSwipe() {
  return { anchor: null };
}

// Feed finger positions (null when no finger is down). Returns 'up' | 'down' | 'left' | 'right' or null.
export function swipeInput(s, pt, minDist) {
  if (!pt) { s.anchor = null; return null; }
  if (!s.anchor) { s.anchor = { x: pt.x, y: pt.y }; return null; }
  const dx = pt.x - s.anchor.x, dy = pt.y - s.anchor.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < minDist) return null;
  s.anchor = { x: pt.x, y: pt.y };
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}
