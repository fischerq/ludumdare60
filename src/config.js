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
// across, so the 19-tile maze (304 px) fits with a border. Sprites are 32x32 and shown in a box of 2x2 tiles
// whatever their native size, like the original's 16 px sprites on 8 px tiles.
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

// Layer 2: the cabinet (zoom out). Pixel art like the maze level, faked 3D (oblique view: depth goes up and
// to the right at 45°). Drawn at 2 screen px per art px; the game picture on the cabinet's screen uses 8 px
// tiles (the maze level's are 16), so it is the maze level shrunk by exactly 2: zooming out is seamless.
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
  screenTile: 8,          // art px per maze tile in the picture on the cabinet's screen (arcade resolution)
  coinDoor: { x: 140, y: 460, w: 56, h: 76 },
  colors: {
    front: 0xf2c200, side: 0xa88600, top: 0xffe36a, trim: 0x111111, panel: 0x262626,
    door: 0x2c2c2c, slot: 0xff3030, floor: 0x1c1420, room: 0x07070c, ball: 0xd81818,
  },
  glare: 0.07,
  introTime: 2.5,        // s of zooming out from the maze level
  stickDeadzone: 24,     // screen px the finger must move from where it touched before the stick clicks over
  promptColor: '#ff3cf0', // the "tap the coin door" call to action and the blinking frame around the door
  promptBox: 0x000000,
  counterColor: '#ffd23f', // the coin counter at the top
};

// Coins Pac-Man holds, shared by every layer (src/wallet.js): found in the arcade hall, one per game in the cabinet.
export const COINS = {
  start: 1,              // coins held when the page loads
  perGame: 1,            // coins one game in the cabinet costs
  flyTime: 0.6,          // s the coin takes from the counter into the cabinet's coin slot
  startDelay: 0.5,       // s from the coin dropping in to the game starting
};

// Moving between layers with the layer buttons. Layers unlock through the outer game loop (src/progress.js).
export const LAYERS = {
  outroTime: 1.2,        // s of zooming back in from the cabinet to the maze level
};

// Cheat buttons at the bottom of the maze and cabinet layers that fire the win/lose events, for testing the
// unlocks. Turn off for the release.
// The deep layers below the maze (src/scenes/DeepScene.js, rules in src/systems/layers/). Every one is a view
// of the emulated machine; times are slowed down so a human can play in them.
export const DEEP = {
  walkSpeed: 5,          // tiles per second
  hitPause: 0.8,         // s of flashing after a hit, then back to the start
  transition: 0.35,      // s of zooming between layers
  crt: {
    beamPeriod: 3.2,     // s for one picture (the real one takes 16.5 ms)
    vblank: 0.22,        // share of the period with the beam off (vertical blank: safe to cross)
    decay: 0.9,          // s for the phosphor to fade to a third
    litAbove: 0.35,      // glow above which a dot can be eaten
    goal: 25,
  },
  signals: {
    rowTime: 0.12,       // s for the tile fetcher to read one row of tiles
    sparkLife: 1.6,      // s a fetched color index waits to be picked up
    waveTime: 1.4,       // s a sound wave takes to roll up the screen
    waveRows: { power: 3, ghost: 2, death: 4, frightEnd: 2, clear: 4, start: 2 }, // how thick each sound's wave is
    goal: 30,
  },
  vram: {
    writeTime: 0.5,      // s the CPU's write head hovers over the next address before it writes
    queue: 3,            // writes waiting at most; older ones are skipped
    readTime: 2.5,       // s for the video chip's read sweep over all rows
    goal: 20,
  },
  bus: {
    rate: 5,             // bus cycles shown per second (the real bus does about a million)
    goal: 40,
  },
  cpu: {
    rate: 4,             // instructions per second (the real CPU does about 800 000)
    trace: 400,          // instructions recorded from the start of a frame
    goal: 25,
  },
};

export const CHEATS = {
  enabled: true,
};

// Layer 3: the arcade hall (zoom out further). A small, cozy room seen top-down like a Pokémon game: Pac-Man
// walks one tile per step. 16 px tiles shown at 4x, characters 32x32 art shown one tile big; the room fits one screen.
// # wall (dark trim), back wall row: | wallpaper, ^ window, * Pac-Man poster, + ghost poster, @ clock.
// . floor, ~ rug, o coin, S start (in front of our cabinet), 1-4 ghost visitors (blinky, pinky, inky, clyde).
// 1x2-tile machines, upper-case on top, lower-case below: cabinets R red, B blue, G green, V violet, Y yellow
// (ours); C/c claw machine, Q/q soda machine, M/m change machine. = counter, % plant, ! bin, D door.
export const HALL = {
  layout: [
    '###########',
    '#^|^*@+^|^#',
    '#%RB.Y.VG%#',
    '#.rb.y.vg.#',
    '#.1.oS..2.#',
    '#.........#',
    '#C.~~~~~.Q#',
    '#c3~~~~~4q#',
    '#..~~~~~..#',
    '#o.......o#',
    '#.......!.#',
    '#====..oM.#',
    '#..o....m.#',
    '#.........#',
    '#####D#####',
  ],
  zoom: 4,               // screen px per art px in the hall (the other layers use 2): cozier, bigger characters
  walkSpeed: 4,          // tiles per second
  charSize: 16,          // art px a character is shown at: one tile (the 32x32 art is scaled down)
  dragDeadzone: 24,      // screen px a finger moves before it counts as walking, not a tap
  tapTime: 350,          // ms; a touch shorter than this that didn't move is a tap (talk / use)
  introZoom: 24,         // camera zoom at the start of the zoom-out from the cabinet (the small cabinet fills the view)
  introTime: 1.6,        // s
  outroTime: 0.9,        // s of zooming back into our cabinet
  colors: {
    floor: 0xb07a45, floorLine: 0x8a5a30, floorLight: 0xc48a52,
    wallTop: 0x3a2418, wallpaper: 0xf0dfb4, wallStripe: 0xe2c994, baseboard: 0x7a4a2a,
    rug: 0xb83a3a, rugBorder: 0xf2c94c, rugDark: 0x8a2a2a,
    counter: 0x7a4a2a, counterTop: 0xc89058, change: 0x8a8a96, door: 0x6a4020, mat: 0x5a7a3a,
    plantPot: 0xb0603a, leaf: 0x3a9a48, leafLight: 0x6ac860, coin: 0xffd23f, cap: 0x2040c0, sky: 0x8ad0ff,
    shoe: 0xc03020, pacFace: 0x3a2a10, // Pac-Man's shoes and face in the hall
    cabinets: { r: 0xd03030, b: 0x3060d0, g: 0x30a050, v: 0x8040c0, y: 0xf2c200 },
  },
  ghosts: { 1: 'blinky', 2: 'pinky', 3: 'inky', 4: 'clyde' },
  // Talking to the angry one makes all visitors chase Pac-Man with their maze rules, until he gets out the door,
  // into our cabinet (needs the coins), gets caught, or they give up.
  angry: 'blinky',
  chase: {
    speed: 3.2,          // tiles per second (Pac-Man walks 4)
    time: 20,            // s until they give up
    headStart: 1,        // s the ghosts wait before they start moving
    pinkyAhead: 2,       // tiles; the maze values scaled down for a small room
    inkyAhead: 1,
    clydeShy: 3,
    clydeCorner: { x: 0, y: 15 },
    catchDistance: 0.6,  // tiles
  },
  // Which text a tile shows when you face it and tap (keys into `text`).
  cellText: {
    R: 'r', r: 'r', B: 'b', b: 'b', G: 'g', g: 'g', V: 'v', v: 'v', '=': 'counter', M: 'change', m: 'change',
    D: 'door', '%': 'plant', '!': 'bin', C: 'claw', c: 'claw', Q: 'soda', q: 'soda', '^': 'door', '*': 'posterPac',
    '+': 'posterGhost', '@': 'clock',
  },
  text: {
    blinky: "I'M NOT A GHOST. I'M JUST... VERY PALE.",
    angry: 'WHAT DID YOU SAY?! GET HIM, GUYS!',
    caught: 'CAUGHT! THEY THROW YOU OUT... YOU SNEAK BACK IN.',
    escaped: 'YOU SLIP OUT THE DOOR. WHEN YOU COME BACK, THEY HAVE CALMED DOWN.',
    calm: 'THE GHOSTS LOST INTEREST. FOR NOW.',
    pinky: 'I ALWAYS TRY TO GET AHEAD OF YOU.',
    inky: 'WHERE I GO DEPENDS ON WHERE THE RED GUY GOES.',
    clyde: 'I LIKE YOU. UNTIL YOU GET TOO CLOSE.',
    r: 'OUT OF ORDER.',
    b: 'HIGH SCORE: AAA 999990. NOBODY BEATS AAA.',
    g: 'THE SCREEN IS BURNED IN. YOU CAN STILL SEE A MAZE.',
    v: 'IT ONLY TAKES TOKENS FROM A DIFFERENT ARCADE.',
    yNeedCoins: 'LAYERS OF PAC. INSERT COIN. YOU HAVE {n} OF {need} COINS.',
    counter: 'THE OWNER IS ASLEEP. A SIGN SAYS: BACK IN 5 MIN.',
    change: "CHANGE MACHINE. IT'S EMPTY. COINS MUST BE ON THE FLOOR SOMEWHERE.",
    door: "IT'S RAINING OUTSIDE. BETTER STAY IN.",
    plant: 'A PLANT. SOMEONE WATERS IT EVERY DAY.',
    bin: 'FULL OF TICKETS AND GUM WRAPPERS.',
    claw: 'THE CLAW NEVER GRABS ANYTHING. EVERYONE KNOWS.',
    soda: 'OUT OF CHERRY COLA. AGAIN.',
    posterPac: "A POSTER: PAC-MAN, 1980. 'EAT ALL THE DOTS!'",
    posterGhost: 'A POSTER OF FOUR GHOSTS. THEY LOOK FAMILIAR.',
    clock: "THE CLOCK SAYS IT'S ALMOST CLOSING TIME.",
    coin: 'FOUND A COIN!',
  },
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

// Emulated arcade machine (Pac-Man-style hardware) that the lower layers read from. See design/systems/emulator.md.
export const ARCADE = {
  // MIT Z80 core by Molly Howell, pinned to a commit. A classic script (global Z80), loaded by src/systems/arcade/z80.js.
  z80Url: 'https://cdn.jsdelivr.net/gh/DrGoldfire/Z80.js@2207d7c6a8b42246ea12efbf9dba8b2adf010437/Z80.js',
  clockHz: 3072000,     // Z80 clock
  frameHz: 60.606,      // vblank rate; one interrupt per frame
  busLogSize: 1 << 17,  // bus accesses kept for the lower layers (a power of two; a frame has ~10 000)
  framesKept: 8,        // frames the recorder can replay
  maxFramesPerTick: 4,  // after a hitch, catch up at most this many frames at once
};

// Animation speeds (characters and effects), in game frames per animation frame. Lives in a JSON file so the lab can
// export it: tune at /lab/bench.html?b=animation, download, save over src/settings/animation.json.
// These defaults are only used if the file can't be loaded.
const ANIM_FALLBACK = {
  fps: 60,
  characters: { pac: 2, blinky: 10, pinky: 10, inky: 10, clyde: 10 },
  effects: { pacDeath: 8, powerPellet: 12, frightFlash: 10, mazeClear: 12, coinBob: 20, insertCoin: 30, tapPrompt: 30 },
};
const ANIM_URL = new URL('./settings/animation.json', import.meta.url);

// A broken file (e.g. a trailing comma) is reported in the console instead of silently using the defaults.
let animWarned = '';
const animWarn = (msg) => { if (msg !== animWarned) console.warn(msg); animWarned = msg; };
async function fetchAnim() {
  let res;
  try { res = await fetch(ANIM_URL, { cache: 'no-store' }); } catch (e) { return null; } // offline or file://
  if (!res.ok) { animWarn(`animation.json: HTTP ${res.status}, ignoring it`); return null; }
  try { const f = JSON.parse(await res.text()); animWarned = ''; return f; } catch (e) {
    animWarn(`animation.json is not valid JSON (${e.message}), ignoring it`);
    return null;
  }
}

const animFile = await fetchAnim();
export const ANIM = {
  fps: animFile?.fps ?? ANIM_FALLBACK.fps,
  characters: { ...ANIM_FALLBACK.characters, ...animFile?.characters },
  effects: { ...ANIM_FALLBACK.effects, ...animFile?.effects },
};
console.info(animFile ? 'animation.json loaded' : 'animation.json not loaded, using the defaults', ANIM);

// Hot reload: fetch the file again and swap the numbers in place (the game calls this when the tab comes back).
export async function reloadAnim() {
  const f = await fetchAnim();
  if (!f) return;
  const before = JSON.stringify(ANIM);
  if (f.fps) ANIM.fps = f.fps;
  Object.assign(ANIM.characters, f.characters);
  Object.assign(ANIM.effects, f.effects);
  if (JSON.stringify(ANIM) !== before) console.info('animation.json reloaded', ANIM);
}
