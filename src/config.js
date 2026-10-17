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
  top: 40,             // art px from the top of the screen to the maze (room for the score)
  pacStart: { x: 9, y: 17 },
  houseExit: { x: 9, y: 9 },   // tile just above the ghost door
  houseInside: { x: 9, y: 11 },
};

// The maze is drawn at arcade resolution: 8 art px per tile, like the original, scaled up with hard
// pixel edges. 720 / 4 = 180 art px across, so the 19-tile maze (152 px) fits with a border.
export const PIXEL = {
  tile: 8,
  zoom: 4,             // screen px per art px; keep it a whole number so every art pixel is the same size
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

// Layer 2: the cabinet (zoom out). Pixel art like the maze level, faked 3D (oblique view: depth goes up and
// to the right at 45°). Drawn at 2 screen px per art px, half the maze level's 4, so the game picture on the
// cabinet's screen is the maze level shrunk by exactly 2: zooming out is seamless.
export const CABINET = {
  zoom: 2,               // screen px per art px; the view is 360x640 art px
  left: 72, right: 264,  // front face of the cabinet, art px
  ground: 632,
  depth: 64,             // art px of depth; drawn as (+depth/2, -depth/2)
  panelY: 392,           // top of the lower body = front edge of the control panel
  panelDepth: 28,        // how far the screen is set back behind the control panel
  screenTop: 68,         // top of the screen section (at the set-back depth)
  marqueeTop: 40,
  marqueeDepth: 16,
  bezel: { x: 12, y: 13 },
  coinDoor: { x: 140, y: 460, w: 56, h: 76 },
  colors: {
    front: 0xf2c200, side: 0xa88600, top: 0xffe36a, trim: 0x111111, panel: 0x262626,
    door: 0x2c2c2c, slot: 0xff3030, floor: 0x1c1420, room: 0x07070c, ball: 0xd81818,
  },
  glare: 0.07,
  introTime: 2.5,        // s of zooming out from the maze level
  stickDeadzone: 24,     // screen px the finger must move from where it touched before the stick clicks over
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
