// Bench: touch-follow movement. Runs the game's own movement code (src/systems/movement.js)
// with the numbers from src/config.js, next to an editable proposal.
import { GAME_WIDTH, GAME_HEIGHT, PLAYER } from '../../src/config.js';
import { desiredVelocity, easeVelocity } from '../../src/systems/movement.js';

const TUNABLE = ['maxSpeed', 'followLerp', 'arriveRadius', 'slowdownGain'];
const current = Object.fromEntries(TUNABLE.map((k) => [k, PLAYER[k]]));
const TRAIL_STEPS = 60; // one second at 60 Hz

// Finger paths in game coordinates (720x1280). null means no finger on the screen.
const held = (from, to, fn) => (t) => (t >= from && t < to ? fn(t - from) : undefined);
const firstOf = (...parts) => (t) => {
  for (const p of parts) { const v = p(t); if (v !== undefined) return v; }
  return null;
};

export default {
  title: 'Touch-follow movement',
  summary: 'The same finger path drives every panel. Trails show the last second; the line links the player to the finger.',
  doc: 'https://github.com/fischerq/ludumdare60/blob/main/design/systems/movement.md',
  world: { w: GAME_WIDTH, h: GAME_HEIGHT },

  params: [
    { key: 'maxSpeed', label: 'Max speed (px/s)', min: 200, max: 1600, step: 10 },
    { key: 'followLerp', label: 'Follow lerp', min: 0.02, max: 1, step: 0.01 },
    { key: 'arriveRadius', label: 'Arrive radius (px)', min: 0, max: 60, step: 1 },
    { key: 'slowdownGain', label: 'Slowdown gain', min: 1, max: 20, step: 0.5 },
  ],

  variants: [
    { name: 'Current', note: 'Numbers from src/config.js', params: current },
    { name: 'Proposed', note: 'Drag the sliders, then copy the result', params: current, editable: true },
  ],

  scenarios: [
    {
      id: 'taps', name: 'Tap and hold far away', duration: 4.5,
      note: 'Hold top right, let go, then hold bottom left: top speed, arrival, coasting.',
      input: firstOf(held(0.2, 1.8, () => ({ x: 600, y: 180 })), held(2.4, 4.0, () => ({ x: 120, y: 1120 }))),
    },
    {
      id: 'zigzag', name: 'Zigzag drag', duration: 4,
      note: 'Finger sweeps side to side while moving up, like dodging.',
      input: firstOf(held(0, 4, (t) => ({ x: 360 + 260 * Math.sin(t * Math.PI * 1.5), y: 1100 - t * 200 }))),
    },
    {
      id: 'circle', name: 'Circle drag', duration: 4,
      note: 'Finger circles at about one turn per second: how far does the player cut the corner?',
      input: firstOf(held(0, 4, (t) => ({ x: 360 + 220 * Math.cos(t * 6.3), y: 700 + 220 * Math.sin(t * 6.3) }))),
    },
    {
      id: 'flicks', name: 'Short flicks', duration: 4,
      note: 'Quick taps left and right of the player, 0.25 s each.',
      input: (t) => {
        const k = Math.floor(t / 0.5);
        if (t - k * 0.5 > 0.25) return null;
        return { x: k % 2 ? 200 : 520, y: 900 };
      },
    },
    { id: 'live', name: 'Live: drag on a panel', live: true, note: 'Touch or drag on any panel; every variant follows the same finger.' },
  ],

  init() {
    return { x: GAME_WIDTH / 2, y: GAME_HEIGHT * 0.7, v: { x: 0, y: 0 }, trail: [], lagSum: 0, lagN: 0, lagMax: 0 };
  },

  step(s, p, target, dt) {
    s.v = easeVelocity(s.v, desiredVelocity(s.x, s.y, target, p), p);
    s.x += s.v.x * dt;
    s.y += s.v.y * dt;
    // Same as setCollideWorldBounds in the game: stop at the edge.
    const r = PLAYER.radius;
    if (s.x < r || s.x > GAME_WIDTH - r) { s.x = Math.min(GAME_WIDTH - r, Math.max(r, s.x)); s.v.x = 0; }
    if (s.y < r || s.y > GAME_HEIGHT - r) { s.y = Math.min(GAME_HEIGHT - r, Math.max(r, s.y)); s.v.y = 0; }
    s.trail.push({ x: s.x, y: s.y });
    if (s.trail.length > TRAIL_STEPS) s.trail.shift();
    if (target) {
      const lag = Math.hypot(target.x - s.x, target.y - s.y);
      s.lagSum += lag; s.lagN += 1; s.lagMax = Math.max(s.lagMax, lag);
    }
  },

  draw(ctx, s, p, target, c) {
    // Grid every 120 px for scale.
    ctx.strokeStyle = c.line; ctx.lineWidth = 2;
    for (let x = 120; x < GAME_WIDTH; x += 120) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, GAME_HEIGHT); ctx.stroke(); }
    for (let y = 120; y < GAME_HEIGHT; y += 120) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(GAME_WIDTH, y); ctx.stroke(); }

    // Trail, fading out.
    s.trail.forEach((pt, i) => {
      ctx.globalAlpha = (i / s.trail.length) * 0.5;
      ctx.fillStyle = c.accent;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    if (target) {
      ctx.strokeStyle = c.muted; ctx.lineWidth = 3; ctx.setLineDash([12, 10]);
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(target.x, target.y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(target.x, target.y, 44, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(target.x, target.y, Math.max(2, p.arriveRadius), 0, Math.PI * 2); ctx.stroke();
    }

    ctx.fillStyle = '#4fc3f7';
    ctx.beginPath(); ctx.arc(s.x, s.y, PLAYER.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(s.x, s.y, PLAYER.radius - 2, 0, Math.PI * 2); ctx.stroke();
  },

  readout(s) {
    const speed = Math.hypot(s.v.x, s.v.y);
    const avg = s.lagN ? s.lagSum / s.lagN : 0;
    return `speed ${Math.round(speed)} px/s · lag avg ${Math.round(avg)} px, max ${Math.round(s.lagMax)} px`;
  },

  configSnippet(p) {
    return [
      '// src/config.js, inside PLAYER:',
      `maxSpeed: ${p.maxSpeed},`,
      `arriveRadius: ${p.arriveRadius},`,
      `slowdownGain: ${p.slowdownGain},`,
      `followLerp: ${p.followLerp},`,
    ].join('\n');
  },
};
