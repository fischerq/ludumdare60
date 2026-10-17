// All tunable constants live here. Tweak these for "feel" changes.

// Working title, still to be changed. Also update index.html <title> and making-of/meta.json.
export const GAME_TITLE = 'Layers of Pac';

export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

export const COLORS = {
  background: 0x000000,
  // Arcade palette, close to the original's.
  wall: 0x2121de,
  door: 0xffb8de,
  mazeFlash: 0xdedede,  // the maze blinks this color when it's cleared
  dot: 0xffb897,
  pac: 0xffff00,
  ghosts: { blinky: 0xff0000, pinky: 0xffb8de, inky: 0x00ffde, clyde: 0xffb847 },
  eyeWhite: 0xdedede,
  pupil: 0x2121de,
  fright: 0x2121de,
  frightFace: 0xffb897,
  frightFlash: 0xdedede,
  frightFlashFace: 0xff0000,
  text: '#ffffff',
  textDim: '#9aa4bf',
  textHud: '#ff2020',
  textReady: '#ffe600',
  link: '#ffb38a',
  // Old touch-follow prototype, still used by the movement lab bench.
  player: 0x4fc3f7,
};

// Touch-follow movement from the pipeline prototype. Only the lab bench uses it now.
export const PLAYER = {
  radius: 36,
  maxSpeed: 700,       // px/s
  arriveRadius: 12,    // stop jittering when this close to the target
  slowdownGain: 6,     // speed = distance * gain near the target, capped at maxSpeed
  followLerp: 0.18,    // 0..1, how quickly velocity catches up to desired velocity
};

// The maze. # wall, . dot, o power pellet, - ghost door, G ghost house, T tunnel (wraps at the edges),
// space = empty floor. Must stay left-right symmetric so it looks right.
export const MAZE = {
  layout: [
    '###################',
    '#........#........#',
    '#o##.###.#.###.##o#',
    '#.##.###.#.###.##.#',
    '#.................#',
    '#.##.#.#####.#.##.#',
    '#.##.#.#####.#.##.#',
    '#....#...#...#....#',
    '####.###.#.###.####',
    '####.#.......#.####',
    '####.#.##-##.#.####',
    'TTTT...#GGG#...TTTT',
    '####.#.#####.#.####',
    '####.#.......#.####',
    '####.#.#####.#.####',
    '#........#........#',
    '#.##.###.#.###.##.#',
    '#o.#...........#.o#',
    '##.#.#.#####.#.#.##',
    '##.#.#.#####.#.#.##',
    '#....#...#...#....#',
    '#.######.#.######.#',
    '#.######.#.######.#',
    '#.................#',
    '###################',
  ],
  top: 80,             // world px from the top of the screen to the maze (room for the score)
  pacStart: { x: 9, y: 17 },
  houseExit: { x: 9, y: 9 },   // tile just above the ghost door
  houseInside: { x: 9, y: 11 },
};

// The game world is in tile pixels: 16 per tile, scaled up with hard pixel edges. 720 / 2 = 360 world px
// across, so the 19-tile maze (304 px) fits with a border. Sprites are shown in a box of 2x2 tiles whatever
// their native size (today's art is 16x16, Max's will be 32x32), like the original's 16 px sprites on 8 px tiles.
export const PIXEL = {
  tile: 16,
  zoom: 2,             // screen px per world px; keep it a whole number so every tile pixel is the same size
  sprite: 32,          // world px a sprite is shown at
  wallLine: [6, 8],    // placeholder wall line: tile pixels at this distance from the floor are lit
};

// Speeds in tiles per second.
export const SPEED = {
  pac: 6.5,
  ghost: 6,
  ghostTunnel: 3,
  ghostFright: 3.5,
  ghostEyes: 15,
  ghostHouse: 3,       // leaving or entering the ghost house
};

export const GHOSTS = [
  // name, start tile, house release delay (s), scatter corner (a target outside the maze, like the original)
  { name: 'blinky', start: { x: 9, y: 9 }, release: 0, corner: { x: 17, y: -3 } },
  { name: 'pinky', start: { x: 9, y: 11 }, release: 1, corner: { x: 1, y: -3 } },
  { name: 'inky', start: { x: 8, y: 11 }, release: 5, corner: { x: 18, y: 26 } },
  { name: 'clyde', start: { x: 10, y: 11 }, release: 9, corner: { x: 0, y: 26 } },
];

export const RULES = {
  lives: 3,
  dotPoints: 10,
  powerPoints: 50,
  ghostPoints: [200, 400, 800, 1600],
  frightTime: 6,           // s
  frightFlashTime: 2,      // s of flashing at the end of fright
  modeSchedule: [7, 20, 7, 20, 5],  // s, alternating scatter/chase, then chase forever
  pinkyAhead: 4,           // tiles ahead of the chomper Pinky aims at
  inkyAhead: 2,
  clydeShyDistance: 8,     // Clyde goes to his corner when closer than this
  hitDistance: 0.6,        // tiles; closer than this counts as touching
  readyTime: 2,            // s of "READY!" before play
  dyingTime: 1.6,          // s of death animation
  ghostEatPause: 0.6,      // s freeze after eating a ghost
  clearTime: 2,            // s of flashing maze after the last dot
};

export const INPUT = {
  swipeMin: 20,        // px of finger travel that counts as a swipe; you can keep swiping without lifting
};

// How forgiving turning is. Tune in the lab: /lab/bench.html?b=maze-controls
export const CONTROL = {
  turnWindow: 0.4,     // tiles before or after a junction where a sideways swipe still takes the turn
  bufferTime: 0.8,     // s a swipe waits for a junction it fits; after that it's dropped
};

export const BEST_KEY = 'ld60.best'; // localStorage key for the high score

export const SOUND = {
  volume: 0.25,
};

export const UI = {
  fontFamily: 'system-ui, -apple-system, sans-serif',
  arcadeFont: '"Press Start 2P", "Courier New", monospace',
  hudSize: 30,
  scoreSize: 56,
  titleSize: 96,
  bodySize: 44,
  linkSize: 32,
  legalSize: 22,
};
