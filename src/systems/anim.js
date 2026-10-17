// Animation timing shared by the game and the lab: which frame of a looping animation shows after `seconds`
// of playing, when each animation frame is held for `framesPerTick` game frames (src/settings/animation.json).
import { ANIM } from '../config.js';

export const PAC_CYCLE = [0, 1, 2, 3, 2, 1];

export function animFrame(seconds, framesPerTick, length, fps = ANIM.fps) {
  return Math.floor((seconds * fps) / Math.max(1, framesPerTick)) % length;
}

// Same, with the character's number from the settings file.
export const charFrame = (who, seconds, length) => animFrame(seconds, ANIM.characters[who] ?? 10, length);
