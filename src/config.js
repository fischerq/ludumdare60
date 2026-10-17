// All tunable constants live here. Tweak these for "feel" changes.

// Working title, still to be changed. Also update index.html <title> and making-of/meta.json.
export const GAME_TITLE = 'mini-gurke';

export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

export const COLORS = {
  background: 0x000000,
  wall: 0x2a3cff,
  door: 0xffb8de,
  dot: 0xffb897,
  pac: 0xffe600,
  ghosts: { blinky: 0xff2020, pinky: 0xffb8ff, inky: 0x00ffff, clyde: 0xffb851 },
  fright: 0x2121ff,
  frightFace: 0xffb897,
  frightFlash: 0xffffff,
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
  tile: 37,            // px per tile; 19 tiles = 703 px wide
  top: 170,            // px from the top of the screen to the maze (room for the score)
  pacStart: { x: 9, y: 17 },
  houseExit: { x: 9, y: 9 },   // tile just above the ghost door
  houseInside: { x: 9, y: 11 },
};

// Speeds in tiles per second.
export const SPEED = {
  pac: 7.5,
  ghost: 7,
  ghostTunnel: 3.5,
  ghostFright: 4,
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
  swipeMin: 30,        // px of finger travel that counts as a swipe; you can keep swiping without lifting
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
