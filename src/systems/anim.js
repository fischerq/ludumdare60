// Animation timing shared by the game and the lab: which frame of a looping animation shows after `seconds`
// of playing, when each animation frame is held for `framesPerTick` game frames (src/settings/animation.json).
import { ANIM } from '../config.js';

export const PAC_CYCLE = [0, 1, 2, 3, 2, 1];

export function animFrame(seconds, framesPerTick, length, fps = ANIM.fps) {
  return Math.floor((seconds * fps) / Math.max(1, framesPerTick)) % length;
}

// Same, with the character's or effect's number from the settings file.
export const charFrame = (who, seconds, length) => animFrame(seconds, ANIM.characters[who] ?? 10, length);
export const fxFrame = (name, seconds, length) => animFrame(seconds, ANIM.effects[name] ?? 10, length);
// Blinks: on for one tick, off for the next.
export const fxOn = (name, seconds) => fxFrame(name, seconds, 2) === 0;
// A one-shot animation (no loop): the frame after `seconds`, or -1 once it has played all `length` frames.
export function fxOnce(name, seconds, length, fps = ANIM.fps) {
  const i = Math.floor((seconds * fps) / Math.max(1, ANIM.effects[name] ?? 10));
  return i < length ? i : -1;
}
// Seconds one tick of an effect lasts, for tweens.
export const fxSeconds = (name) => (ANIM.effects[name] ?? 10) / ANIM.fps;
