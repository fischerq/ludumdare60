// All tunable constants live here. Tweak these for "feel" changes.

// Working title, still to be changed. Also update index.html <title> and making-of/meta.json.
export const GAME_TITLE = 'mini-gurke';
export const EVENT = 'Ludum Dare 60';

export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

export const COLORS = {
  background: 0x1d2333,
  player: 0x4fc3f7,
  coin: 0xffd54f,
  hazard: 0xef5350,
  text: '#ffffff',
  textDim: '#9aa4bf',
};

export const PLAYER = {
  radius: 36,
  maxSpeed: 700,       // px/s
  arriveRadius: 12,    // stop jittering when this close to the target
  followLerp: 0.18,    // 0..1, how quickly velocity catches up to desired velocity
};

export const KEYBOARD = {
  speed: 600,          // px/s when using arrows/WASD
};

export const COIN = {
  radius: 22,
  points: 1,
  maxOnScreen: 3,
  margin: 80,          // keep spawns away from the edges
};

export const HAZARD = {
  radius: 30,
  spawnEveryMs: 2500,
  minSpeed: 150,
  maxSpeed: 320,
  speedUpPerPoint: 8,  // extra speed per point scored
};

export const UI = {
  fontFamily: 'system-ui, -apple-system, sans-serif',
  scoreSize: 56,
  titleSize: 96,
  bodySize: 44,
};
