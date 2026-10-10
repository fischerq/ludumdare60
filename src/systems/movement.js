// Touch-follow movement, shared by GameScene and the lab bench (lab/benches/movement.js).
// Pure functions: no Phaser, so a bench can run them deterministically.

// Velocity the player wants this frame: toward the target, slowing down as it gets close.
export function desiredVelocity(x, y, target, p) {
  if (!target) return { x: 0, y: 0 };
  const dx = target.x - x;
  const dy = target.y - y;
  const dist = Math.hypot(dx, dy);
  if (dist <= p.arriveRadius) return { x: 0, y: 0 };
  const speed = Math.min(p.maxSpeed, dist * p.slowdownGain);
  return { x: (dx / dist) * speed, y: (dy / dist) * speed };
}

// Ease the current velocity toward the desired one. Applied once per frame, like the game does.
export function easeVelocity(v, desired, p) {
  return {
    x: v.x + (desired.x - v.x) * p.followLerp,
    y: v.y + (desired.y - v.y) * p.followLerp,
  };
}
