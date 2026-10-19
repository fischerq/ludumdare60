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
  pac: 0xffde00,      // Max's Pac-Man yellow
  ghosts: { blinky: 0xd32734, pinky: 0xffb8de, inky: 0x00ffde, clyde: 0xffb847 },
  eyeWhite: 0xfdfdf8,  // ghost eyes as Max drew Blinky and Clyde
  pupil: 0x2d93dd,
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
  ghost: 5.05,
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
  lives: 4,
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
  turnWindow: 0.7,     // tiles before or after a junction where a sideways swipe still takes the turn
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
  promptColor: '#ff3cf0', // the "tap the coin door" call to action and the blinking frame around the door
  promptBox: 0x000000,
  counterColor: '#ffd23f', // the coin counter at the top
  // The coin minigame behind the coin door (src/systems/coinmech.js, design/systems/layer-cabinet.md). Art px of
  // the close-up view (180x320, shown at 4x), drawn far right of the cabinet in the scene's world (originX).
  coinMech: {
    originX: 1000, w: 180, h: 320, zoom: 4,
    zoomInTime: 0.4,      // s of zooming from the cabinet into the coin door, and back out
    hand: { x: 36, y: 22 }, // where the coin waits to be flicked in (it bobs)
    handBob: 2,           // art px up and down
    flickMin: 24,         // screen px of swipe that counts as a flick (a tap works too)
    dropTime: 0.25,       // s from the hand into the slot
    // The coin's center along the track (art px): slot, slope, ledge 1, past the reject arm, ledge 2, turn,
    // past the slug magnet, onto the coin switch.
    track: [[36, 66], [72, 86], [86, 86], [132, 116], [146, 116], [154, 128], [62, 182], [42, 202]],
    stops: [2, 4],        // track points where the coin rests on a ledge until a tap rolls it on
    speed: 170,           // art px/s rolling
    coinR: 8,             // the coin is 16x16
    arm: { x: 109, y: 101, zone: 12, period: 1.3, block: 0.45, warn: 0.12 }, // swings across the track; zone: art px either side; block/warn: fractions of the period
    magnet: { x: 108, y: 155, zone: 13, period: 1.5, on: 0.4, warn: 0.15, offset: 0.5 },
    cup: { x: 150, y: 250 },   // the coin return the rejected coin drops into
    rejectTime: 0.6,      // s falling into the coin return
    retryDelay: 0.7,      // s before the coin is back in hand
    switchAt: { x: 40, y: 212 }, // the coin switch the coin presses at the end of the track
    pulseTime: 0.6,       // s for the pulse to run down the wire to the board
    wire: [[30, 212], [8, 212], [8, 320]], // from the switch down to the board (art px)
    doneDelay: 0.4,       // s after the pulse before we zoom back out (CREDIT 1)
    textY: 292,           // center of the hint text at the bottom
    text: {
      hand: 'FLICK THE COIN\nINTO THE SLOT', hold: 'TAP TO ROLL ON', roll: '',
      arm: 'REJECT ARM!\nCOIN RETURNED', magnet: 'SLUG MAGNET!\nCOIN RETURNED', ok: 'COIN OK!\nIN0 COIN BIT',
    },
    textColor: '#ffd23f', failColor: '#ff3030', okColor: '#00ff66',
    colors: {
      back: 0x141418, plate: 0x5c626c, plateDark: 0x3a3e46, rivet: 0x8c929c, rail: 0xc8ccd4, railDark: 0x7a7e88,
      slot: 0x000000, arm: 0xd0d4dc, armDark: 0x6c7078, armWarn: 0xffb000, magnet: 0xb02020, magnetPole: 0xc8ccd4,
      magnetOn: 0xff4040, spark: 0xa0d8ff, switchBody: 0x202020, switchLever: 0xe8e8e8, switchLit: 0x00ff66,
      cup: 0x262626, cupRim: 0x8c929c, wire: 0x7a3a10, wireLit: 0xffe060, coin: 0xffd23f, coinDark: 0xb08a10,
      coinLight: 0xfff4b0, box: 0x1e1e22,
    },
  },
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
// Where the layer buttons sit on every layer: bottom corners, UP left, DOWN right (src/layerButton.js).
export const LAYER_BUTTONS = {
  marginX: 16,           // screen px from the left/right edge
  marginBottom: 24,      // screen px from the bottom edge
};

// The deep layers below the maze (src/scenes/DeepScene.js, rules in src/systems/layers/). Every one is a view
// of the emulated machine; times are slowed down so a human can play in them.
export const DEEP = {
  walkSpeed: 5,          // tiles per second
  hitPause: 0.8,         // s of flashing after a hit, then back to the start
  transition: 0.35,      // s of zooming between layers
  trail: 1.2,            // s the light trail behind Pac-Man takes to fade (visual only)
  trailWidth: 2,         // art px
  glowTime: 0.6,         // s Pac-Man glows after picking something up (layers with pac-glow art)
  glowPop: 0.2,          // how much bigger Pac-Man is at the start of the glow
  // The Tron look: each layer has its own dark background and neon accent; white and one red are shared.
  // bg: background, grid: the floor grid, line: neon lines of the layer's structures, glow: their dim halo,
  // dot / dot2: the collectibles' two accents, special: the special collectible (power pellet, ...).
  hazard: 0xff2a3a,
  hazardGlow: 0x5a0a14,
  style: {
    crt:     { bg: 0x12040e, grid: 0x2a0c22, line: 0xff3cc8, glow: 0x4a0e3a, dot: 0xff8ae0, dot2: 0xffd0f4, special: 0xffffff },
    signals: { bg: 0x02100f, grid: 0x07302c, line: 0x2af0e0, glow: 0x0a3a36, dot: 0x8afff4, dot2: 0xffe08a, special: 0xffffff },
    ram:     { bg: 0x02101a, grid: 0x0a2c40, line: 0x5ac8ff, glow: 0x0c3048, dot: 0xb0e4ff, dot2: 0xffffff, special: 0xffffff },
    bus:     { bg: 0x140c02, grid: 0x34220a, line: 0xffa82a, glow: 0x4a2e08, dot: 0xffd88a, dot2: 0xffffff, special: 0xffffff },
    cpu:     { bg: 0x02120a, grid: 0x08321a, line: 0x2aff7a, glow: 0x0a3a1c, dot: 0x9affc0, dot2: 0x8ad8ff, special: 0xffffff },
    logic:   { bg: 0x0c0418, grid: 0x220e40, line: 0xa45aff, glow: 0x2a1250, dot: 0xd0b0ff, dot2: 0xffffff, special: 0xffffff },
    input:   { bg: 0x140602, grid: 0x34140a, line: 0xff6a2a, glow: 0x4a1a08, dot: 0xffb08a, dot2: 0xffffff, special: 0xffffff },
  },
  machineSlowdown: 4,    // the machine runs this many times slower in the deep layers than on the maze
  // Levels: clearing a layer's level 1 is its LAYER CLEAR; then it offers NEXT LEVEL, endless. Each layer's
  // `levels.cap` block names the numbers that ramp and their value at capLevel (level 1 plays the layer's own
  // numbers, in between a straight line, past capLevel they stay at the cap). src/systems/layers/levels.js.
  capLevel: 8,           // default level at which the ramp reaches its cap (a layer's levels.capLevel overrides it)
  levelLabel: 'LEVEL',   // HUD corner: LEVEL n
  nextLabel: 'NEXT LEVEL',
  backLabel: 'BACK TO THE BOARD',
  backShort: 'BACK',     // the adder's back choice when it wasn't entered from the board
  choiceButton: { w: 200, h: 30 }, // art px of each choice button after a clear (shown at 2x: 400 x 60 screen px)
  // Hard mode (the lobby's 256 switch on): a deep layer starts at hardLevel instead of 1; clearing it is the hard
  // win, which repairs its strip of level 256 (LEVELS.repairs).
  hardLevel: 4,
  hardLabel: 'HARD',     // marker left of the layer's title
  // Each layer: its own verb and enemy, and goal = the number of objectives (3 to 5) that win it.
  crt: {                 // -1 inside the tube: phosphor triads lit by a raster beam, one pixel at a time
    walkSpeed: 6.5,      // tiles per second here (faster than DEEP.walkSpeed: the beam is the only enemy)
    beamPeriod: 13,      // s for one picture, cell by cell, row by row (the real one takes 16.5 ms)
    vblank: 0.12,        // share of the period with the beam off (vertical blank: it flies back)
    decay: 1.6,          // s for the phosphor to fade to a third
    litAbove: 0.35,      // glow above which a bonus dot can be eaten
    darkFloor: 0.06,     // how much of an unlit triad still shows
    lookAhead: 6,        // cells of the beam's path ahead drawn as a warning
    // Each triad's red, green and blue phosphor (0..1) for what the picture shows there.
    rgb: { wall: [0.15, 0.15, 1], door: [1, 0.7, 0.85], dot: [1, 0.72, 0.6], pac: [1, 1, 0] },
    cornerRadius: 2,     // tiles: the tube's rounded corners can't be walked on
    // The objectives: the monitor's adjustments. Until one is set, the beam paints that fault into the picture.
    // at: the pad's tile on the tube's edge (its name is drawn next to it, inside); done: the status line once set.
    goals: [
      { id: 'vhold', name: 'V-HOLD', at: { x: 0, y: 12 }, done: 'V-HOLD SET:\nTHE PICTURE STOPS ROLLING' },
      { id: 'hhold', name: 'H-HOLD', at: { x: 9, y: 24 }, done: 'H-HOLD SET:\nTHE LINES STOP TEARING' },
      { id: 'conv', name: 'CONVERGE', at: { x: 9, y: 0 }, done: 'BEAMS CONVERGE:\nNO MORE COLOR FRINGES' },
      { id: 'degauss', name: 'DEGAUSS', at: { x: 18, y: 12 }, done: 'DEGAUSSED:\nTHE COLORS ARE PURE AGAIN' },
    ],
    repairFrames: 2,     // pictures a repair holds after the one it was made in (then it breaks again)
    goal: 1,             // one whole picture painted with all four repairs holding
    rollSpeed: 1.2,      // tiles per second the picture rolls without V-HOLD
    tear: 3,             // tiles the rows wobble sideways without H-HOLD
    misconverge: 1,      // tiles the red and blue beams miss green by without CONVERGE
    // Bonus dots (the power pellets, eaten while lit): the beam scans another way for bonusTime s.
    bonusTime: 15,
    bonusModes: ['columns', 'up'], // taken in turn: column by column left to right, row by row bottom to top
    msgTime: 3,          // s an adjustment's message stays in the status line
    labelScale: 2,       // art px per font pixel of the pads' names
    levels: { cap: { beamPeriod: 5.5, bonusTime: 6 } }, // levels: a faster beam, shorter bonus scans
  },
  signals: {             // -2 the video board: a race against the frame timer, tile pixels via the palette to the DAC
    frameTime: 16,       // s on the frame timer (was 12: only 35% at bot noise 0.5); at zero the pixels you carry are dropped and a new tile is fetched
    pixels: 3,           // pixels taken from the fetched tile per delivery
    paletteSize: 8,      // palette entries: the most common colors of the picture, every pixel maps to the nearest
    dropTime: 0.4,       // s delivered pixels take to drop from you into the DAC's slots
    convertTime: 0.6,    // s the DAC shows their red, green and blue levels rising
    sendTime: 0.7,       // s each pixel takes along the video-out wire, one after the other
    sendGap: 0.3,        // s between pixels leaving the DAC
    // . board, - | traces (walkable). Boxes: an uppercase letter is the box's solid frame, the same letter in
    // lowercase is floor inside it (lowercase on the frame is a doorway). V video RAM and F frame timer are solid;
    // T tile fetcher (its inside shows the fetched tile, 2x2 pixels per cell), P palette (its inside shows the
    // entries as 2x2-cell swatches), D the DAC (deliver inside). o video out.
    layout: [
      '...................',
      '.VVVV..TTTTTTTTTT..',
      '.VVVV..TttttttttT..',
      '.VVVV--tttttttttT..',
      '.VVVV..TttttttttT..',
      '.......TttttttttT..',
      '.......TttttttttT..',
      '.......TttttttttT..',
      '.......TttttttttT..',
      '.......TttttttttT..',
      '.......TTTTttTTTT..',
      '...........||......',
      '.FFFFF.PPPPppPPPP..',
      '.FFFFF.PppppppppP..',
      '.FFFFF.PppppppppP..',
      '.FFFFF.PppppppppP..',
      '.FFFFF.PppppppppP..',
      '.......PPPPppPPPP..',
      '...........||......',
      '.........DDddDD....',
      '.........DddddD....',
      '.........DddddDoooo',
      '.........DddddD....',
      '.........DDDDDD....',
      '...................',
    ],
    goal: 4,             // colors delivered
    levels: { cap: { frameTime: 10 } }, // levels: a shorter frame timer (9 s is about one perfect delivery: unwinnable)
  },
  ram: {                 // -3 work RAM, poke the game state: bit lamps flip bits in the real RAM, the write head dashes
    waitTime: 0.8,       // s the write head waits at a variable's left edge (telegraph: its bits glow red)
    dashSpeed: 9,        // bits per second it dashes along the variable's bits, writing
    restTime: 0.25,      // s between two dashes
    msgTime: 2.5,        // s a poke's message stays in the status line
    textScale: 2,        // art px per font pixel of the names and values
    hudScale: 2,         // the same for the score, lives and goals next to the picture
    // The variables, two columns of four (in order), by the program's symbols. kind: byte (the 8 bits of sym + add),
    // hi (the high byte of a 16-bit value: each bit is x256), lo0 (the low byte of a 16-bit value, a poke also
    // clears the high byte: the count can't underflow for good), tile (an actor's 16-bit position in px, the
    // lamps are the tile number, px / 16; a poke that would put the actor off the maze or into a wall is refused).
    vars: [
      { id: 'score', name: 'SCORE', sym: 'SCORE', kind: 'hi' },
      { id: 'lives', name: 'LIVES', sym: 'LIVES_LEFT', kind: 'byte' },
      { id: 'level', name: 'LEVEL', sym: 'LEVEL', kind: 'byte', show: 1 }, // shown +1: 0 is level 1
      { id: 'dots', name: 'DOTS LEFT', sym: 'PELLETS', kind: 'lo0' },
      { id: 'pacX', name: 'PAC X', sym: 'PAC', add: 'A_X', kind: 'tile', axis: 'x' },
      { id: 'pacY', name: 'PAC Y', sym: 'PAC', add: 'A_Y', kind: 'tile', axis: 'y' },
      { id: 'blinkyX', name: 'BLINKY X', sym: 'GHOST0', add: 'A_X', kind: 'tile', axis: 'x', ghost: 0 },
      { id: 'scared', name: 'BLINKY SCARED', sym: 'GHOST0', add: 'A_FRIGHT', kind: 'byte' },
    ],
    // The objectives: each one a change the game shows. min: the variable's value to reach (after a poke of yours).
    goals: [
      { id: 'lives', name: '5 LIVES', var: 'lives', min: 5 },
      { id: 'score', name: 'SCORE 10000+', var: 'score', min: 10000 },
      { id: 'moved', name: 'MOVE BLINKY', var: 'blinkyX' },
      { id: 'scared', name: 'SCARE BLINKY', var: 'scared' },
    ],
    levels: { cap: { waitTime: 0.1, dashSpeed: 12, restTime: 0 } }, // levels: the write head telegraphs less, dashes faster
  },
  bus: {                 // -4 the spatial bus: chip rooms behind decoder doors, packets on the lanes
    cycleTime: 1.1,      // s between bus cycles shown
    packetSpeed: 7,      // tiles per second along the lanes
    readDelay: 1.3,      // s a read's packet waits in the chip before it heads out through the door
    doorHold: 1.6,       // s a door stays open after its chip's cycle ends (so other doors can be open at once)
    doorWarn: 0.6,       // s a door blinks before it closes
    // # wall, . floor, = bus lane (packets run here), C the CPU; chip rooms: interior r a v i, door R A V I
    // (open while the decoder selects that chip): ROM, RAM, VRAM, I/O.
    layout: [
      '##################',
      '#...........#rrrr#',
      '#...........#rrrr#',
      '#.........==Rrrrr#',
      '#.........=.#rrrr#',
      '#.........=.#rrrr#',
      '#.........=.######',
      '#.........=.#aaaa#',
      '#.........=.#aaaa#',
      '#.........==Aaaaa#',
      '#CCC......=.#aaaa#',
      '#CCC......=.#aaaa#',
      '#CCC=======.######',
      '#CCC......=.#vvvv#',
      '#CCC......=.#vvvv#',
      '#.........==Vvvvv#',
      '#.........=.#vvvv#',
      '#.........=.#vvvv#',
      '#.........=.######',
      '#.........=.#iiii#',
      '#.........=.#iiii#',
      '#.........==Iiiii#',
      '#...........#iiii#',
      '#...........#iiii#',
      '#...........######',
      '##################',
    ],
    goal: 4,             // one data byte from each chip room
    levels: { cap: { cycleTime: 0.55, packetSpeed: 13, readDelay: 0.75, doorHold: 0.9 } }, // levels: a busier, faster bus
  },
  cpu: {                 // -5 Game Genie: carry a patch onto a line of the real program; the PC steps through it
    rate: 4.5,           // lines per second the program counter steps while it's in the routine on screen
    awayTime: 0.5,       // s the PC stays out of view between two visits (a CALL out, the rest of the frame)
    arrowTime: 0.7,      // s a branch arrow stays on screen
    trace: 16000,        // instructions recorded from the start of a frame (a busy frame has about 10 000)
    retry: 0.35,         // s between trace requests while the routine doesn't run (e.g. no dot eaten that frame)
    grace: 0.6,          // s after a respawn or a new routine before the PC can hit you
    nextDelay: 1.8,      // s the patched line shows before the next routine comes up
    lines: 12,           // lines of source on screen
    // The four patches, in order: routine, the line to replace (as written in game.asm, label and comment
    // left out), how many lines above it the screen starts, the replacement text and what it writes:
    // word: LD rr,nn with nn = sym * times; nop: NOPs over the instruction.
    patches: [
      { name: 'DOTS WORTH 10X', routine: 'eat', line: 'ld de, DOT_POINTS', above: 1, text: 'LD DE,DOT_POINTS*10', word: { sym: 'DOT_POINTS', times: 10 } },
      { name: 'PAC-MAN 2X FAST', routine: 'move_pac', line: 'ld de, SPD_PAC', above: 6, text: 'LD DE,SPD_PAC*2', word: { sym: 'SPD_PAC', times: 2 } },
      { name: 'GHOSTS HALF SPEED', routine: 'move_ghost', line: 'ld de, SPD_GHOST', above: 7, text: 'LD DE,SPD_GHOST/2', word: { sym: 'SPD_GHOST', times: 0.5 } },
      { name: 'PAC EATS ANY GHOST', routine: 'check_hits', line: 'jr z, .death', above: 11, text: 'NOP  NOP', nop: true },
    ],
    goal: 4,             // patches written
    levels: { cap: { rate: 6, grace: 0.45 } }, // levels: the program counter steps faster, less grace after a hit
  },
  logic: {               // -6 line of sight: crossing a ghost's target vector sends a seeker after you
    vectorWidth: 0.45,   // tiles: how close to a target vector line counts as crossing it
    seekTime: 6,         // s a seeker hunts before it gives up
    seekSpeed: 3.6,      // tiles per second (you walk DEEP.walkSpeed)
    vectorColors: { blinky: 0xff2a3a, pinky: 0xff6a8a, inky: 0xff8a5a, clyde: 0xffb0a0 },
    goal: 4,             // stand on each ghost's target tile
    levels: { cap: { vectorWidth: 2, seekTime: 20, seekSpeed: 6 } }, // levels: wider vectors, faster seekers that hunt longer
  },
  input: {               // -7 fix the joystick, then play: carry the 4 cut wire ends to IN0's pins, then swipe-play
    // The board below the picture (tiles; 11 x 17, the picture and IN0's port take the rows above `top`).
    top: 8,
    base: { x: 4, y: 13 }, // the joystick's 3x3 base (its microswitches are the middles of its edges)
    start: { x: 4, y: 11 },
    // Per direction: its switch (a tile of the base), the IN0 pin it belongs on (on row `top`), the wire's route
    // once repaired, and the cut wire as it lies at the start (from the switch; the last tile is its loose end).
    // Tiles are [x, y]; a route goes straight between its corners.
    wires: {
      up:    { switch: [5, 13], pin: [5, 8],  route: [[5, 13], [5, 8]],                     loose: [[5, 13], [5, 11], [9, 11]] },
      left:  { switch: [4, 14], pin: [2, 8],  route: [[4, 14], [2, 14], [2, 8]],            loose: [[4, 14], [3, 14], [3, 11], [0, 11]] },
      right: { switch: [6, 14], pin: [8, 8],  route: [[6, 14], [8, 14], [8, 8]],            loose: [[6, 14], [7, 14], [7, 15], [9, 15]] },
      down:  { switch: [5, 15], pin: [10, 8], route: [[5, 15], [5, 16], [10, 16], [10, 8]], loose: [[5, 15], [5, 16], [1, 16]] },
    },
    // Noise sparks run along the wires from their switch (a carried wire has none). Each wire fires one every
    // sparkEvery s (random in the range); its switch blinks red sparkWarn s before.
    sparkSpeed: 3,       // tiles per second
    sparkEvery: [3.5, 6],
    sparkWarn: 0.8,
    sparkDelay: 3,       // s of quiet at the start and after a hit
    cutFlash: 0.6,       // s the switch and pin of a cut wire flash when the machine's Pac-Man wants that way
    pictureT: 7,         // px per maze tile of the small picture while you repair
    playT: 14,           // px per maze tile of the big picture while you play (it grows over playGrow s)
    playGrow: 0.6,
    playSpeed: 0.5,      // machine speed while you play (the deep layers run it at 1 / machineSlowdown)
    playDots: 20,        // dots to eat with the repaired stick to win
    goal: 5,             // the 4 wires and the test game
    levels: { cap: { sparkSpeed: 12, sparkEvery: [0.45, 0.9], sparkWarn: 0.15, sparkDelay: 0.4, playSpeed: 1 } }, // levels: more, faster sparks with less warning, a faster test game
  },
};

// Bonus layer: the adder (src/scenes/AdderScene.js, rules in src/systems/layers/adder.js). The round counter's +1
// as an 8-bit ripple-carry adder, played like Crossy Road: you are the carry bit and hop up through 8 full-adder
// stages (bit 0 at the bottom), dodging signal pulses on the wires. See design/systems/layer-adder.md.
export const ADDER = {
  bits: 8,               // full-adder stages
  cols: 11,              // tiles across the board
  tile: 32,              // art px per tile (the camera shows art px at 2x)
  hopTime: 0.13,         // s one hop takes
  hitPause: 0.8,         // s of flashing after a hit, then back to the start of the stage
  lanes: [2, 2, 3, 3, 3, 4, 4, 4], // wire lanes per stage, bit 0 first
  speed: [1.4, 3.0],     // tiles per second of a lane's pulses at bit 0 and at bit 7 (in between: linear)
  speedJitter: 0.25,     // each lane's speed is off by up to this share, up or down
  pulse: [1, 3],         // tiles: shortest and longest pulse
  gap: [[3, 6], [2.2, 4.5]], // tiles of free wire between two pulses, min and max: at bit 0, at bit 7
  hitbox: 0.6,           // tiles: the carry bit's width for hits
  startCol: 5,           // column you start each stage in
  camLead: 0.62,         // the camera keeps you at this share of the screen height
  camEase: 8,            // how fast the camera catches up (per s)
  overflowTime: 2.8,     // s of the OVERFLOW moment before the layer ends
  transition: 0.35,      // s of zooming in and out
  // Levels (like the deep layers, DEEP.capLevel): faster, denser lanes up to the cap, then they stay there.
  levels: { cap: { speed: [2.1, 4.2], gap: [[2.4, 4.8], [1.8, 3.6]] } },
  // Tron look like the deep layers (bg, floor grid, neon line and its halo); pulses use DEEP.hazard (deadly).
  style: {
    bg: 0x0c0a02, grid: 0x2a2408, line: 0xffe02a, glow: 0x4a400a,
    wire: 0x6a5a14,      // an idle wire lane
    wall: 0x1c1806,      // the chip between the gates (blocks)
    one: 0xffe02a, zero: 0x2af0e0, // the byte readout: bits still 1, bits flipped to 0
    carry: 0xffffff,     // the carry bit's core
  },
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
    '#^|^*@+^a^#',
    '#%RB.Y.VGu#',
    '#.rb.y.vg.#',
    '#.1.oS..2.#',
    '#.........#',
    '#C.~~~~~.Q#',
    '#c3~~~~~4q#',
    '#h.~~~~~..#',
    '#o.....l.o#',
    '#.O.....!.#',
    '#ksj...oM.#',
    '#..o....m.#',
    '#w....np.e#',
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
    ownerSkin: 0xf0b888, ownerHair: 0x8a8a8a, ownerShirt: 0x4a7a50, ownerApron: 0xe8e0c8, snore: 0xffffff,
    portraitBg: 0x2a2440, exclaim: 0xe02020,
    gurke: 0x3a8a30, gurkeLight: 0x6ab850, gurkeDark: 0x2a6020, gurkeInside: 0xd8e8a0, // the pickles
    jarGlass: 0xc8e0c8, jarLid: 0xc0a040, table: 0x9a6a3a,
    signPaper: 0xf2e6c0, signEdge: 0xb89a60, signInk: 0x3a2a18, // the sign and our yellowed manual
    // The plush rabbit (h), the Urmel figurine on its stand (e), the blue paper (l), the old sweater (a).
    rabbit: 0xe87a8a, rabbitLight: 0xf6b4bc, rabbitDark: 0xb04a5a, rabbitNose: 0xd02840, toyEye: 0x2a1018,
    ice: 0xc8f0ff, iceLight: 0xffffff, iceShade: 0x80b8d8, egg: 0xf4ecd0, eggSpot: 0xc8b890,
    blanket: 0x5a8ad0, blanketCheck: 0xf2c94c, milk: 0xffffff, teat: 0xd09060,
    urmel: 0x7ac0a8, urmelLight: 0xc0ead8, urmelDark: 0x4a8a78, bubble: 0xffffff,
    paper: 0x4a7ae0, paperEdge: 0x3058b0, paperInk: 0xffffff,
    sweater: 0x7a6aa8, sweaterDark: 0x5a4a88, sweaterFuzz: 0x9a8ac0, hanger: 0x8a8a96,
    elsaHair: 0xf4f0d0, elsaDress: 0x8ad0f0, annaHair: 0xb04a20, annaDress: 0x3a7a5a, skin: 0xf0c8a8,
    cabinets: { r: 0xd03030, b: 0x3060d0, g: 0x30a050, v: 0x8040c0, y: 0xf2c200 },
  },
  ghosts: { 1: 'blinky', 2: 'pinky', 3: 'inky', 4: 'clyde' },
  // Reading the ghost poster makes the visitors recognize Pac-Man: a "!" over each of them, one line together,
  // then they chase him with their maze rules until he gets out the door, into our cabinet (needs a coin), gets
  // caught (all coins lost, the hall starts over) or they give up.
  noticeCell: '+',
  noticeTime: 0.9,       // s the "!" shows before the ghosts speak
  choiceLine: 14,        // art px per choice line in the text box (a 56 px tall tap target at 4x)
  portraitSize: 48,      // art px of a text box portrait (arcade/portrait-*.png); tiles are shown 3x to fill it
  // The snow globe (w, bottom left): the hall tile's colors (arcade/snow-globe). The close-up is HALL.globe3d.
  globe: {
    colors: [0xff9ad8, 0xffd23f, 0xffffff, 0x9ad8ff, 0xd0a0ff],
    glass: 0xd6eef8, glassLight: 0xffffff, glassEdge: 0x8ab8d0, snow: 0xf4f8ff,
    base: 0xff7ac0, baseDark: 0xd04a98, rim: 0xffd23f, unicorn: 0xffffff, horn: 0xffd23f,
    rainbow: [0xff4040, 0xff9a30, 0xffe040, 0x50d050, 0x40a0ff, 0xa060e0],
  },
  // The close-up (LOOK CLOSER), in 3D over the dimmed hall (design/systems/layer-arcade.md). The model is
  // src/settings/globe-model.json, the physics src/systems/globe3d.js, the pixel renderer src/systems/globeRender.js.
  // Drag anywhere on it to grab that spot and turn it any way, tap to shake; the heavy base swings it back upright.
  globe3d: {
    view: 152,           // art px square it's drawn into, the glass center in the middle (room for the base turned any way)
    pitch: 0.35,         // rad the camera looks down from above: settled, you see a bit of the top
    light: [-0.5, 0.65, 0.6], // toward the light (world: x right, y up, z toward you)
    bands: [-0.05, 0.55], // brightness where dark turns mid, and mid turns light
    dither: 0.2,         // how far the bands mix at their edges (a 2x2 checker)
    outlineDepth: 2.5,   // px of depth jump that draws a 1 px outline
    highlight: [1.95, 2.55], // rad (0 right, counter-clockwise) where the glass shine arc runs
    substepRate: 120,    // physics steps per second
    weight: 60,          // rad/s² the heavy base pulls it upright with, at a quarter turn
    damp: 3,             // 1/s: how fast the wobble dies down when let go
    dampHeld: 5,         // 1/s: the same while held
    grabSpring: 0.8,     // 1/s² per px: how hard the held spot follows the finger
    grabDamp: 0.05,      // its damping
    keyTorque: 50,       // rad/s² the arrow keys turn it with
    maxSpin: 30,         // rad/s at most
    waterFollow: 1.5,    // 1/s: how fast the water catches up with the glass
    stirRate: 1.5,       // stir per rad/s of lag per s
    stirDecay: 0.7,      // 1/s: how fast the stirred-up water calms down
    jitter: 160,         // px/s² of random kick per unit of stir
    flakes: 340,         // glitter flakes
    glitterColors: 5,    // glitter0..4 rows of the palette
    sink: 6,             // px/s a flake sinks at in still water
    flakeDrag: 3,        // 1/s: how fast a flake takes the water's speed
    tumble: 0.5,         // rad of flash phase per px a flake travels
    hairSink: 6,         // px/s² the mane and tail sag with
    hairDrag: 5,         // 1/s: how fast they take the water's speed
    hairStiff: 10,       // 1/s²: how strongly they keep their combed shape
    tapSpin: 2.5,        // rad/s of random spin a tap gives
    tapSwirl: 6,         // rad/s of random swirl a tap gives the water
    tapStir: 4,          // stir a tap adds
    jolt: 90,            // px/s the globe jumps with on a tap
    joltSpring: 500,     // 1/s² back to its place
    joltDamp: 22,        // 1/s
    // assets/arcade/globe-palette.png: one row per part in this order, columns outline, dark, mid, light.
    palette: {
      body: [0x4a3c68, 0xb4acd4, 0xe2def2, 0xffffff],
      horn: [0x7a4a08, 0xd09a20, 0xffd23f, 0xfff4c0],
      hoof: [0x5a3a58, 0xa080a0, 0xc8a0c0, 0xe8c8e0],
      eye: [0x101018, 0x202030, 0x202030, 0x50507a],
      snow: [0x506880, 0xb8cce0, 0xe0eaf6, 0xffffff],
      base: [0x5a1040, 0xc0408c, 0xff7ac0, 0xffb8e0],
      rim: [0x7a4a08, 0xc89018, 0xffd23f, 0xfff4c0],
      mane0: [0x601010, 0xc02020, 0xff4040, 0xff9090],
      mane1: [0x602e08, 0xc06010, 0xff9a30, 0xffc880],
      mane2: [0x605008, 0xc0a010, 0xffe040, 0xfff0a0],
      mane3: [0x0c440c, 0x309030, 0x50d050, 0xa8f0a8],
      mane4: [0x0c2860, 0x2060c0, 0x40a0ff, 0xa8d4ff],
      mane5: [0x301050, 0x7030a8, 0xa060e0, 0xd4b0ff],
      glitter0: [0x903068, 0x903068, 0xff9ad8, 0xffe8f6],
      glitter1: [0x806010, 0x806010, 0xffd23f, 0xfff8d8],
      glitter2: [0x7888a0, 0x7888a0, 0xe8f0ff, 0xffffff],
      glitter3: [0x305878, 0x305878, 0x9ad8ff, 0xe8f8ff],
      glitter4: [0x584080, 0x584080, 0xd0a0ff, 0xf4e8ff],
      glass: [0x9ac8e0, 0x18303f, 0x1c3448, 0xffffff], // rim, (unused), water, shine
    },
  },
  chase: {
    speed: 3.2,          // tiles per second (Pac-Man walks 4)
    time: 20,            // s until they give up
    headStart: 2,        // s the ghosts wait before they start moving (the poster leaves Pac-Man in a dead end)
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
    '+': 'posterGhost', '@': 'clock', O: 'owner', k: 'gurke', j: 'jar', u: 'miniGurke', s: 'sign', n: 'manuals', p: 'pacManual', w: 'globe',
    h: 'rabbit', e: 'urmel', l: 'paper', a: 'sweater',
  },
  text: {
    blinky: "I'M NOT A GHOST. I'M JUST... VERY PALE.",
    weKnowYou: 'WAIT A MINUTE... WE KNOW YOU!',
    caught: 'CAUGHT! THEY TAKE ALL YOUR COINS AND THROW YOU OUT... YOU SNEAK BACK IN.',
    owner: 'ZZZ... ZZZZZ... *SNORT* ...ZZZ.',
    escaped: 'YOU SLIP OUT THE DOOR. WHEN YOU COME BACK, THEY HAVE CALMED DOWN.',
    calm: 'THE GHOSTS LOST INTEREST. FOR NOW.',
    pinky: 'I ALWAYS TRY TO GET AHEAD OF YOU.',
    inky: 'WHERE I GO DEPENDS ON WHERE THE RED GUY GOES.',
    clyde: 'I LIKE YOU. UNTIL YOU GET TOO CLOSE.',
    // The other cabinets play other famous games of the time (only named in the text, no logos in the art).
    r: 'SPACE INVADERS, 1978. THE FEWER INVADERS ARE LEFT, THE FASTER THEY MOVE. THE MACHINE HAS LESS TO DRAW.',
    b: 'ASTEROIDS, 1979. NO PIXELS AT ALL: THE BEAM DRAWS EVERY ROCK AS LINES. HIGH SCORE: AAA 99990.',
    g: 'DONKEY KONG, 1981. A CARPENTER CALLED JUMPMAN CLIMBS GIRDERS. THE BARRELS NEVER STOP.',
    v: 'GALAXIAN, 1979. OUT OF ORDER: THE COIN SLOT IS JAMMED. THE FIRST GAME WITH EVERY SPRITE IN COLOR.',
    yNeedCoins: 'LAYERS OF PAC. INSERT COIN. YOU HAVE {n} OF {need} COINS.',
    counter: 'THE COUNTER. SCRATCHED, STICKY, LOVED.',
    sign: 'A PAPER SIGN: BACK IN 5 MIN.',
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
    gurke: "THAT'S A... GURKE! SOMEONE TOOK A BITE. I THINK THE OWNER LIKES THEM.",
    jar: 'A JAR OF CORNICHONS. TINY PICKLES, FLOATING.',
    miniGurke: 'THAT JUST REALLY LOOKS LIKE A... MINI-GURKE!',
    globe: "A SNOW GLOBE: A UNICORN IN A SEA OF GLITTER. A NOTE IS TAPED TO THE BOTTOM: 'MY SISTER LOVED THIS ONE AS A KID.'",
    globeLook: 'LOOK CLOSER',
    globeClose: 'CLOSE',
    globeHint: 'DRAG TO TURN IT, TAP IT TO SHAKE. TAP OUTSIDE TO PUT IT DOWN.',
    rabbit: 'A STUFFED RABBIT WITH VERY LONG, FLOPPY ARMS AND LEGS. IT MUST HAVE ESCAPED THE CLAW MACHINE.',
    sweater: 'AN OLD SWEATER WITH ANNA AND ELSA ON IT. WASHED A HUNDRED TIMES, STILL LOVED.',
    paper: 'A BLUE PIECE OF PAPER. IT JUST SAYS: BLAU!',
    paperRare: 'A BLUE PIECE OF PAPER. IT JUST SAYS: GRÜN!',
    manuals: 'A STACK OF MANUALS. WHICH ONE?',
    rippedOut: 'HUH, THIS ONE WAS RIPPED OUT.',
  },
  // The stack of manuals on the table: Galaxian's pages were ripped out (its machine is out of order).
  // Ours lies on its own next to the stack (`pacManual`) and offers READ MORE: the full service manual (src/manual/).
  manuals: [
    { title: 'SPACE INVADERS', text: "SPACE INVADERS OPERATOR'S MANUAL. THE DIP SWITCHES SET 3 TO 6 BASES AND A BONUS BASE AT 1000 OR 1500 POINTS." },
    { title: 'ASTEROIDS', text: 'ASTEROIDS MANUAL. CHAPTER 1: ADJUSTING THE VECTOR MONITOR. CHAPTER 2: PLEASE DO NOT ADJUST THE VECTOR MONITOR.' },
    { title: 'DONKEY KONG', text: 'DONKEY KONG MANUAL. A WHOLE PAGE ON HOW TO CLEAN THE JOYSTICK. SOMEONE SPILLED COLA ON IT.' },
    { title: 'GALAXIAN', ripped: true },
  ],
  paperRareChance: 0.1,  // how often the blue paper says GRÜN! instead of BLAU!
  // The Urmel figurine on its stand (e): each time you talk to it, it shows the next stage (arcade/urmel-<n>),
  // then starts over. It starts as the iceberg.
  urmel: [
    'A FIGURINE ON A STAND: AN ICEBERG. SOMETHING IS FROZEN INSIDE... AN EGG?',
    'THE ICE IS GONE. THE EGG IS TUCKED IN UNDER A LITTLE BLANKET.',
    'THE EGG HATCHED! A SMALL URMEL DRINKS FROM A MILK BOTTLE.',
    "THE URMEL LOOKS RIGHT AT YOU: 'OKOPUSPAPAT!'",
  ],
  pacManual: 'LAYERS OF PAC: SERVICE MANUAL. EVERY LAYER OF THIS MACHINE, FROM THE CABINET DOWN TO THE WIRES.',
  menu: {
    readMore: 'READ MORE',
    close: 'CLOSE',
  },
};

// Inside the cabinet: the board lobby (src/scenes/LobbyScene.js), built like the hall. Pac-Man walks on the
// floor of the cabinet, the PCB, and talks to the machine's parts; each subsystem enters its deep layer. Unlocks
// in src/progress.js. 16 px tiles at 4x (assets/board/), characters 32x32 shown one tile big.
// # cabinet wall, . PCB floor, = wiring harness, - copper trace, ~ a ghost's wire to the brain (all walkable).
// M/m the monitor (3x2, top front), K speaker, J joystick (control panel), D coin door, W power supply,
// E edge connector (the harness plugs into the board), S start. On the board stack: V video board, R work RAM,
// B bus, C CPU, L the logic brain with the four ghosts 1-4 (blinky, pinky, inky, clyde) on wires to it.
// A the round counter's adder and Z its 256 switch: plain floor at LOBBY.reserved until every subsystem is won.
// O the four status lamps (left to right = lamp 1..4, src/progress.js lamps()), H the cheat lever under each lamp,
// N the sign next to them, F the film reel (the credits), g mini-gurke (the easter egg).
export const LOBBY = {
  layout: [
    '###########',
    '#.MMM....K#',
    '#.mmm....=#',
    '#..=.....=#',
    '#..=NOOOO=#',
    '#..=.HHHH=#',
    '#..=.....D#',
    '#W.=.SJX.=#',
    '#=.=..=..=#',
    '#===E=====#',
    '#.V--....F#',
    '#...-..1..#',
    '#.R--..~..#',
    '#...-2~L~3#',
    '#.C--..~..#',
    '#...-..4..#',
    '#g..B.....#',
    '###########',
  ],
  solid: '#MmKJDWEVRBCL1234AZXOHNFg',
  pacMouth: [0.14, 0.28, 0.42, 0.56, 0.7, 0.82, 0.94], // rad, half the mouth of board/pac-0..6 (never shut)
  pacIdleFrame: 3,       // board/pac-* frame shown while he stands still
  mechaRate: 2,          // blinks per second of Mecha-Pac's antenna (X, by the joystick: the bot)
  reserved: { adder: { x: 8, y: 16 }, switch: { x: 9, y: 16 } },
  // Map character -> deep layer id (src/systems/layers/). The monitor is all six of its tiles.
  subsystems: { M: 'crt', m: 'crt', V: 'signals', R: 'ram', B: 'bus', C: 'cpu', L: 'logic', J: 'input' },
  ghosts: { 1: 'blinky', 2: 'pinky', 3: 'inky', 4: 'clyde' },
  zoom: 4,               // screen px per art px, like the hall
  walkSpeed: 4,          // tiles per second
  charSize: 16,          // art px a character is shown at (one tile)
  dragDeadzone: 24,      // screen px a finger moves before it counts as walking, not a tap
  tapTime: 350,          // ms; a shorter touch that didn't move is a tap (talk / use)
  choiceLine: 14,        // art px per choice line in the text box (56 px tall tap targets at 4x)
  portraitSize: 48,      // art px of a portrait (board/portrait-*.png); other tiles are shown 3x
  introZoom: 24,         // camera zoom at the start of zooming out of a part (the monitor or a subsystem)
  introTime: 1.2,        // s
  outroTime: 0.8,        // s of zooming into the part you enter
  highlightTime: 2.4,    // s a newly unlocked subsystem blinks lit
  highlightRate: 6,      // blinks per second
  clearDelay: 2.5,       // s the LAYER CLEAR callout shows in a deep layer before going back to the lobby
  colors: {
    pcb: 0x24382c, pcbDark: 0x1f3126,
    copper: 0xb08a50, copperDark: 0x7a5e34,
    pad: 0x101418, padEdge: 0x3a4048,  // a locked subsystem's island (an unlocked one takes its layer's colors)
    wall: 0x1a1210, wallEdge: 0x3a2a20, wallLight: 0x4a382a,
    chip: 0x1c1c22, chipLight: 0x3a3a46, leg: 0xc8c8d0, chipOff: 0x34343a, legOff: 0x7a7a80,
    eye: 0xffffff, pupil: 0x101018, sleep: 0x9aa0b0, cheek: 0xff7aa0,
    brain: 0xff9ac8, brainDark: 0xc0608e, brainOff: 0x8a6a7a, brainOffDark: 0x5a4450,
    monitor: 0x18181c, bezel: 0x2a2a30, tube: 0x3a0c30, tubeLight: 0xff3cc8,
    stick: 0xd02020, panel: 0x2a2a6a, speaker: 0x2a2a2a, grill: 0x707070,
    door: 0x8a8a96, slot: 0xff3020, power: 0x5a5a62, warn: 0xf0d040, edge: 0xd8b040,
    // Mecha-Pac, the bot: a steel Pac-Man with a red visor, rivets and an antenna.
    mecha: 0xa8b0bc, mechaLight: 0xe0e6ee, mechaDark: 0x5a6270, visor: 0x20242c, visorEye: 0xff3020,
    antenna: 0x40ff60, foot: 0x3a4048,
    pacBody: 0x50f088, pacEdge: 0x0c3a1c, pacShine: 0xd8ffe8, // Pac-Man in here: signal green (board/pac-*)
    // The status lamps 1..4 (maze yellow, board green, 256 red, hard mode violet): off glass, lit bulb, glow.
    lamps: [
      { off: 0x4a4420, glass: 0x7a7040, on: 0xffe040, glow: 0x6a5a20 },
      { off: 0x1e4428, glass: 0x3a7048, on: 0x50ff80, glow: 0x2a6a3a },
      { off: 0x4a1c1c, glass: 0x7a3a3a, on: 0xff4a3a, glow: 0x6a2a24 },
      { off: 0x34204a, glass: 0x5a4078, on: 0xc070ff, glow: 0x4a2c6a },
    ],
    paper: 0xe8dcb0, paperDark: 0x8a6a40, scrawl: 0x3a3048, // the sign
    reel: 0xb8bcc4, reelLight: 0xe8ecf0, reelDark: 0x5a5e66, film: 0x2a2018, // the film reel
    gurke: 0x5aa83a, gurkeLight: 0x9ad860, gurkeDark: 0x2e6a22, // mini-gurke
  },
  // Who each subsystem is (its accent is the layer's own DEEP.style line color).
  names: {
    crt: 'THE MONITOR', signals: 'THE VIDEO BOARD', ram: 'THE WORK RAM', bus: 'THE BUS', cpu: 'THE CPU',
    logic: 'THE BRAIN', input: 'THE JOYSTICK',
  },
  text: {
    crt: "I'M THE MONITOR, UP FRONT. A BEAM PAINTS MY PICTURE, ONE DOT AT A TIME.",
    signals: 'VIDEO BOARD. I TURN TILES AND COLORS INTO THE SIGNAL THAT RUNS UP THE HARNESS TO THE MONITOR.',
    ram: 'WORK RAM. I REMEMBER THE GAME: YOUR SCORE, YOUR LIVES, WHERE EVERYONE IS.',
    bus: 'THE BUS. EVERY BYTE BETWEEN THE CPU AND THE CHIPS RIDES ON MY LINES.',
    cpu: 'Z80 CPU. I RUN THE PROGRAM, ONE INSTRUCTION AFTER ANOTHER. THREE MILLION TICKS A SECOND.',
    logic: 'THE BRAIN: THE GAME LOGIC. I TELL THE FOUR GHOSTS WHERE TO GO.',
    input: 'THE JOYSTICK. FOUR SWITCHES ON WIRES DOWN TO THE BOARD. PUSH ME AND A BIT GOES LOW.',
    locked: '{name} IS ASLEEP. ZZZ... WAKE {prev} FIRST.',
    crtLocked: 'THE MONITOR IS ASLEEP. CLEAR THE MAZE FIRST.',
    hard: 'THE 256 SWITCH IS ON: HARD MODE.',
    hardWon: 'BEATEN IN HARD MODE TOO.',
    enterHard: 'ENTER (HARD MODE)',
    won: 'ALL DONE IN THERE.',
    woke: '{name} WOKE UP!',
    allWon: 'EVERY PART OF THE MACHINE IS AWAKE.',
    adderAppears: 'BY THE BUS, THE ADDER LIGHTS UP: THE ROUND COUNTER.',
    enter: 'ENTER',
    notNow: 'NOT NOW',
    speaker: 'THE SPEAKER. THE WAKKA-WAKKA COMES OUT HERE.',
    door: 'THE COIN DOOR. A COIN TRIPS A SWITCH ON THE HARNESS: ONE MORE CREDIT.',
    power: "THE POWER SUPPLY. MAINS IN, 5 VOLTS OUT FOR THE CHIPS. DON'T TOUCH.",
    edge: 'THE EDGE CONNECTOR. THE WHOLE HARNESS PLUGS INTO THE BOARD HERE.',
    wall: 'THE INSIDE OF THE CABINET. DUSTY.',
    blinky: "BLINKY: THE BRAIN SAYS AIM RIGHT AT PAC-MAN'S TILE.",
    pinky: 'PINKY: THE BRAIN SAYS AIM FOUR TILES AHEAD OF HIM.',
    inky: 'INKY: MY TARGET DEPENDS ON WHERE BLINKY IS.',
    clyde: 'CLYDE: CLOSE TO PAC-MAN I RUN TO MY CORNER.',
    adder: "THE ADDER. EVERY CLEARED MAZE I ADD 1 TO THE ROUND COUNTER. IT'S ONLY 8 BITS: 255 IS 11111111.",
    adderWon: 'ADD 1 TO 255 AND THE CARRY FALLS OFF THE END. THE COUNTER WRAPS TO 0.',
    switchStuck: "A SWITCH MARKED 256. IT WON'T BUDGE. THE ADDER NEXT TO IT HOLDS IT DOWN.",
    switchFlipped: 'OVERFLOW! THE 256 SWITCH FLIPPED ON. THE MAZE IS ON LEVEL 256 NOW.',
    switchOn: 'THE 256 SWITCH IS ON: THE MAZE PLAYS LEVEL 256.',
    switchOff: 'THE 256 SWITCH IS OFF: THE MAZE PLAYS FROM LEVEL 1.',
    flipOn: 'FLIP ON',
    flipOff: 'FLIP OFF',
    leave: 'LEAVE IT',
    mecha: "MECHA-PAC: BEEP. BUSY PLAYING. I'M ON THE JOYSTICK WHILE YOU'RE IN HERE. EVERY LIFE I LOSE IS YOURS.",
    mechaOver: 'MECHA-PAC: BEEP... GAME OVER. I LOST YOUR LAST LIFE. A COIN STARTS A NEW GAME.',
    // The status lamps (O) and the cheat lever (H) under each: pulling one flips its lamp's achievement.
    lamps: ['THE MAZE, WON ONCE', 'EVERY PART AWAKE', 'THE 256 SWITCH, UNLOCKED', 'HARD MODE: EVERY PART BEATEN, LEVEL 256 WINNABLE'],
    lamp: 'LAMP {n}: {what}. {state}',
    lampOn: 'IT IS LIT.',
    lampOff: 'IT IS DARK.',
    lever: 'LEVER {n}. A TAG SAYS: TEST ONLY. FLIPS LAMP {n}.',
    leverPulled: 'CLUNK! LAMP {n} IS {state} NOW.',
    leverOn: 'ON',
    leverOff: 'OFF',
    pull: 'PULL IT',
    sign: 'HOW DO YOU TURN THIS ON... HMM, MAYBE I SHOULD RATHER PLAY.',
    reel: 'A FILM REEL. THE CREDITS OF THIS MACHINE.',
    reelEmpty: 'THE REEL IS EMPTY.',
    watch: 'WATCH',
    gurke: 'A TINY PICKLE. MINI-GURKE SAYS HI.',
  },
  // Which text a tile shows when you face it and tap (keys into `text`); subsystems and ghosts are handled apart.
  cellText: { K: 'speaker', D: 'door', W: 'power', E: 'edge', '#': 'wall', N: 'sign', g: 'gurke' },
};

// The service manual (src/manual/), opened from the booklet on the hall's table: an HTML overlay of old paper.
export const MANUAL = {
  font: '"Courier Prime", "Courier New", monospace',
  heading: '"Special Elite", "Courier New", monospace',
  mono: '"Courier Prime", "Courier New", monospace',
  swipe: 60,             // CSS px a sideways swipe needs to turn the page
  liveHz: 10,            // updates per second of the live page
  // Wear on the paper, different on every page (seeded by the page number): chance of a coffee ring, how many
  // smudges and foxing specks (min, max). The live page stays clean apart from the yellowed edges.
  wear: { ring: 0.3, smudges: [0, 2], specks: [0, 4], seed: 60 },
  // The printed look of figures and live drawings: how far lines wobble (px), the hatching's spacing (px), the share
  // of pixels where the ink didn't take, and the SVG ink filter's grain (fraction eaten) and warp (px).
  print: { wobble: 1.2, hatch: 4, dropout: 0.1, grain: 0.35, warp: 1.6 },
  colors: {
    desk: '#2a1d14', paper: '#efe2bd', paperEdge: '#c9ad74', stain: 'rgba(120, 80, 30, 0.18)',
    smudge: 'rgba(90, 60, 30, 0.12)', ink: '#2b2117', rule: '#8a7550', cover: '#5a3a22',
    accent: '#9a2a1a', blue: '#24477a', green: '#2f6a32',
  },
};

export const BEST_KEY = 'ld60.best'; // localStorage key for the high score

export const SOUND = {
  volume: 0.25,
};

// Background sound, one bed per layer (design/systems/audio.md). Everything is synthesized like the tech of the
// time: the machine's layers use wavetable voices like Pac-Man's Namco sound chip (32 steps of 4 bits, written
// as hex below), the hall radio plays 80s FM synth-pop (two operators, like a DX7) through a small speaker.
// Patterns: one token per 16th step, '.' a rest, numbers are semitones above the bed's root (MIDI note), '0,3,7'
// plays a chord, drums are k (kick), s (snare), h (hat). Tracks loop on their own length, so they can drift.
const RADIO_SONG = {
  bpm: 112, root: 45, // A minor: Am F C G, one chord a bar
  tracks: [
    { synth: 'fm', ratio: 1, index: 2.5, decay: 0.12, sustain: 0.2, vol: 0.5, notes:
      '0 . 0 . 12 . 0 . 0 . 0 . 12 . 0 . -4 . -4 . 8 . -4 . -4 . -4 . 8 . -4 . ' +
      '3 . 3 . 15 . 3 . 3 . 3 . 15 . 3 . -2 . -2 . 10 . -2 . -2 . -2 . 10 . -2 .' },
    { synth: 'fm', ratio: 14, index: 0.6, decay: 0.5, sustain: 0.15, len: 3, vol: 0.18, oct: 12, notes:
      '12,15,19 . . . . . 12,15,19 . . . 12,15,19 . . . . . 8,12,15 . . . . . 8,12,15 . . . 8,12,15 . . . . . ' +
      '15,19,22 . . . . . 15,19,22 . . . 15,19,22 . . . . . 10,14,17 . . . . . 10,14,17 . . . 10,14,17 . . . . .' },
    { synth: 'fm', ratio: 2, index: 1.2, decay: 0.3, sustain: 0.4, len: 2, vol: 0.22, oct: 12, notes:
      '24 . . 27 . 24 . 22 . . 19 . . . . . 20 . . 24 . 27 . . 29 . 27 . 24 . . . ' +
      '27 . . 31 . 27 . 24 . . 22 . . . . . 22 . 24 . 26 . . 24 . . 22 . 19 . . .' },
    { synth: 'drum', vol: 0.5, notes: 'k . h . s . h . k . k h s . h h' },
  ],
};

export const MUSIC = {
  volume: 0.55,      // all beds, relative to the sound effects
  fade: 0.6,         // s, crossfade when the layer changes
  lookahead: 0.12,   // s of notes scheduled ahead
  waves: {           // 32 samples, 0 to f
    sine: '89acdeefffeedca98653211000112356',
    organ: '8aceffedcbaa99888776655432100135',
    tri: '0123456789abcdeffedcba9876543210',
    saw: '00112233445566778899aabbccddeeff',
    pulse: 'ffffffff000000000000000000000000',
    square: 'ffffffffffffffff0000000000000000',
  },
  beds: {
    // The start screen: an upbeat tune on the machine's wavetable chip (our own melody, not the Pac-Man one).
    // C major, a chord a bar: C F C G | F G Am C.
    menu: {
      bpm: 132, root: 60, vol: 0.8,
      tracks: [
        { wave: 'pulse', len: 1.6, vol: 0.2, notes:
          '12 . 7 . 9 . 12 . 14 . 12 . 9 . 7 . 9 . . 7 9 . 12 . 7 . . . . . . . ' +
          '12 . 7 . 9 . 12 . 16 . 14 . 12 . 9 . 14 . . 11 14 . 19 . 14 . . . . . . . ' +
          '9 . 12 . 17 . 16 . 14 . 12 . 9 . 12 . 11 . . 9 7 . 9 . 11 . . . 7 . . . ' +
          '9 . 12 . 16 . 12 . 9 . 12 . 14 . 16 . 19 . 17 . 16 . 14 . 12 . . . . . . .' },
        { wave: 'tri', vol: 0.4, oct: -24, notes: [0, 5, 0, 7, 5, 7, 9, 0].map((r) => `${r} . ${r + 12} . `.repeat(4)).join('') },
        { wave: 'organ', vol: 0.07, oct: 12, notes: [[0, 4, 7], [5, 9, 12], [0, 4, 7], [7, 11, 14], [5, 9, 12], [7, 11, 14], [9, 12, 16], [0, 4, 7]]
          .map((c) => `${c[0]} ${c[1]} ${c[2]} ${c[1]} `.repeat(4)).join('') },
      ],
      textures: [{ type: 'ticks', every: 4, freq: 7000, vol: 0.04 }],
    },
    // Quiet arcade: the radio behind the counter, now and then a bleep from one of the machines.
    hall: {
      ...RADIO_SONG, vol: 0.9,
      filter: { type: 'bandpass', freq: 1400, q: 0.6 }, // the radio's small speaker
      textures: [
        { type: 'noise', filter: 'highpass', freq: 4000, vol: 0.012 },
        { type: 'blips', chance: 0.025, lo: 72, hi: 96, len: 1, wave: 'square', vol: 0.05, lp: 2500 },
      ],
    },
    // In front of the machine: its mains hum and fan, the radio muffled behind you.
    cabinet: {
      ...RADIO_SONG, vol: 0.45,
      filter: { type: 'lowpass', freq: 500, q: 0.5 },
      textures: [
        { type: 'tone', wave: 'saw', freq: 50, vol: 0.05 },
        { type: 'noise', filter: 'lowpass', freq: 350, vol: 0.12 },
      ],
    },
    // The board lobby inside the cabinet: the transformer's hum breathing slowly, a clock ticking once a second,
    // a low drone and the game's bleeps muffled through the board. Calm enough to read text boxes over.
    lobby: {
      bpm: 60, root: 43, vol: 0.8, // G, one step = a quarter second
      tracks: [
        { wave: 'tri', len: 30, vol: 0.16, notes: '0' + ' .'.repeat(31) + ' -2' + ' .'.repeat(31) },
        { wave: 'sine', len: 6, vol: 0.05, oct: 12, notes: '. . . . . . . . 7 . . . . . . . . . . . . . . . 10 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .' },
      ],
      textures: [
        { type: 'tone', wave: 'sine', freq: 50, vol: 0.07 },
        { type: 'tone', wave: 'tri', freq: 100, vol: 0.025, lfo: { rate: 0.13, depth: 0.6 } }, // transformer buzz, breathing
        { type: 'noise', filter: 'bandpass', freq: 180, vol: 0.03 },
        { type: 'ticks', every: 4, freq: 2500, vol: 0.025 },
        { type: 'blips', chance: 0.03, lo: 64, hi: 88, len: 1, wave: 'square', vol: 0.04, lp: 700 },
      ],
    },
    // The original has no music: just the siren, a little higher and faster every stage of dots eaten.
    maze: {
      textures: [
        { type: 'siren', wave: 'sine', vol: 0.14, stages: [
          { lo: 380, hi: 700, period: 0.42 }, { lo: 430, hi: 780, period: 0.39 }, { lo: 480, hi: 860, period: 0.36 },
          { lo: 540, hi: 950, period: 0.33 }, { lo: 600, hi: 1050, period: 0.30 },
        ] },
      ],
    },
    // The deep layers: the machine's own sound chip playing Tron. Each layer its own key, tempo and texture.
    crt: {
      bpm: 90, root: 50, // D: slow and wide, the tube's flyback whine and high-voltage buzz
      tracks: [
        { wave: 'tri', len: 14, vol: 0.4, oct: -12, notes: '0 . . . . . . . . . . . . . . . -2 . . . . . . . . . . . . . . .' },
        { wave: 'organ', len: 2, vol: 0.12, oct: 12, notes: '0 . 7 . 12 . 7 . 3 . 10 . 15 . 10 .' },
      ],
      textures: [
        { type: 'tone', wave: 'sine', freq: 15734, vol: 0.006 },
        { type: 'tone', wave: 'saw', freq: 50, vol: 0.03 },
      ],
    },
    signals: {
      bpm: 120, root: 48, // C: the video board's pixel clock ticking under a pulsing bass
      tracks: [
        { wave: 'pulse', vol: 0.3, oct: -12, notes: '0 . 0 . 0 . 0 . -5 . -5 . -2 . -2 .' },
        { wave: 'saw', vol: 0.1, oct: 12, notes: '0 3 7 3 0 3 7 10' },
      ],
      textures: [{ type: 'ticks', every: 1, freq: 9000, vol: 0.05 }],
    },
    ram: {
      bpm: 100, root: 45, // A: slow organ steps over the memory's refresh pulse
      tracks: [
        { wave: 'square', vol: 0.22, oct: -12, notes: '0 . . 0 . . 0 . -4 . . -4 . . -4 .' },
        { wave: 'organ', len: 3, vol: 0.16, oct: 12, notes: '0 . . . 7 . . . 5 . . . 3 . . . 0 . . . 7 . . . 10 . . . 8 . . .' },
      ],
      textures: [{ type: 'blips', every: 4, lo: 96, hi: 96, len: 0.5, wave: 'sine', vol: 0.04 }],
    },
    bus: {
      bpm: 132, root: 52, // E: driving bass, data chattering across the bus
      tracks: [
        { wave: 'saw', vol: 0.3, oct: -12, notes: '0 0 . 0 0 . 0 . 3 3 . 3 5 . 3 .' },
      ],
      textures: [{ type: 'blips', chance: 0.35, lo: 76, hi: 100, len: 1, wave: 'pulse', vol: 0.05 }],
    },
    cpu: {
      bpm: 144, root: 49, // C#: a fast arpeggio on the clock
      tracks: [
        { wave: 'tri', len: 6, vol: 0.4, oct: -12, notes: '0 . . . . . . . -4 . . . -2 . . .' },
        { wave: 'pulse', vol: 0.12, oct: 12, notes: '0 7 12 15 12 7 0 7 3 10 15 19 15 10 3 10' },
      ],
      textures: [{ type: 'ticks', every: 2, freq: 6000, vol: 0.06 }],
    },
    logic: {
      bpm: 108, root: 47, // B: a step sequencer walking its rules
      tracks: [
        { wave: 'square', len: 2, vol: 0.2, oct: -12, notes: '0 . . . 0 . . . 0 . . . 0 . . .' },
        { wave: 'organ', vol: 0.16, notes: '0 . 3 . 7 . 3 . 0 . 5 . 8 . 5 .' },
      ],
      textures: [{ type: 'blips', every: 8, lo: 83, hi: 83, len: 0.5, wave: 'sine', vol: 0.05 }],
    },
    input: {
      bpm: 80, root: 40, // E: low and tense, the wires hum and the switches click
      tracks: [
        { wave: 'saw', len: 14, vol: 0.3, notes: '0 . . . . . . . . . . . . . . . 1 . . . . . . . . . . . . . . .' },
        { wave: 'tri', len: 6, vol: 0.2, oct: 12, notes: '. . . . 12 . . . . . . . . . . . . . . . 13 . . . . . . . . . . .' },
      ],
      textures: [
        { type: 'tone', wave: 'tri', freq: 50, vol: 0.12 },
        { type: 'ticks', chance: 0.06, freq: 3000, vol: 0.12 },
      ],
    },
  },
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
  // Start screen cast: game frames (at 60 per second) each animation frame is shown. Slower than in the maze,
  // where Pac-Man's chomp runs at animation.json speed only while he moves.
  menuPacAnim: 3, // the chomp has 12 steps (7 frames there and back), so 3 keeps the old 6 with 6 steps
  menuGhostAnim: 15,
};

// Credits / final screen, classic arcade staff roll. See design/systems/credits.md.
export const CREDITS = {
  // The roll, top to bottom. kind: title | heading | role | name | note | thanks | emoji | gap. Pixel font only draws ASCII, so the
  // emoji line is its own text object in the system font (emoji: true).
  lines: [
    { kind: 'title', text: GAME_TITLE.toUpperCase() },
    { kind: 'gap' },
    { kind: 'heading', text: 'STAFF' },
    { kind: 'gap' },
    { kind: 'role', text: 'PROMPTS' },
    { kind: 'name', text: 'QUIRIN "ZERA"' },
    { kind: 'gap' },
    { kind: 'role', text: 'GRAPHICS' },
    { kind: 'name', text: 'MAX "SADARENKO"' },
    { kind: 'gap' },
    { kind: 'role', text: 'CODE' },
    { kind: 'name', text: 'CLAUDE' },
    { kind: 'note', text: 'BY ANTHROPIC\nVIA CLAUDE CODE' },
    { kind: 'gap' },
    { kind: 'gap' },
    { kind: 'heading', text: 'SPECIAL THANKS' },
    { kind: 'gap' },
    { kind: 'thanks', text: "ZERA'S WIFE\nAND KIDS" },
    { kind: 'emoji', text: '\u{1F401}\u{1F426}' }, // mouse, bird
  ],
  // Held on screen when the roll has passed.
  endTitle: 'THE END',
  endLine: 'THANK YOU\nFOR PLAYING',
  endPrompt: 'TAP TO CONTINUE',
  back: 'BACK',
  style: {
    title: { size: 44, color: '#ffe600' },
    heading: { size: 36, color: '#ff2020' },
    role: { size: 28, color: '#00ffde' },
    name: { size: 32, color: '#ffffff' },
    note: { size: 20, color: '#9aa4bf' },
    thanks: { size: 28, color: '#ffb8de' },
    emoji: { size: 72 },
    end: { size: 60, color: '#ffe600' },
    endLine: { size: 32, color: '#ffffff' },
    prompt: { size: 26, color: '#9aa4bf' },
    back: { size: 28, color: '#9aa4bf' },
  },
  lineGap: 28,        // px between lines
  emptyGap: 40,       // height of a gap line
  rollSpeed: 70,      // px per second
  fastSpeed: 420,     // px per second while the screen is held (or SPACE)
  endY: 520,          // where THE END settles (it rolls in with the rest)
  endGap: 760,        // px between the last credit and THE END, so the roll has left the screen when it stops
  holdBeforeLeave: 1, // s after THE END settles before a tap leaves
  promptBlink: 0.6,   // s per fade of TAP TO CONTINUE
  bed: 'menu',        // sound bed (null for silence)
  // The intermission chase across the bottom: Pac-Man runs left with the ghosts behind, then chases them back
  // frightened. Reuses the maze textures.
  chase: {
    y: 1205,
    band: 150,         // px tall black strip along the bottom the chase runs in; the roll appears above it
    size: 64,          // screen px per character, like the menu cast
    speed: 160,        // px per second
    ghostGap: 70,      // px between runners
    pacLead: 110,      // px between Pac-Man and the first ghost
    pacAnim: 3,        // game frames per animation frame (like UI.menuPacAnim)
    ghostAnim: 15,
  },
  // Big tap area for BACK, top left.
  backPos: { x: 90, y: 70 },
  backPad: 34,
};

// The start screen (src/scenes/MenuScene.js): the cabinet's machine (Max's assets/cabinet/machine.png) standing on
// a big layer cake (assets/menu/cake.png), both shown 1:1, with the attract show on the machine's screen.
// Same oblique view as the cabinet: depth goes up and to the right at 45°.
export const MENU = {
  titleY: 150,            // below the sound button
  machineX: 192,          // screen px of the machine texture's top-left corner
  machineY: 196,
  // The machine's picture, inside the bezel (texture px, see CABINET: screen at panelDepth plus the bezel).
  screen: { x: 98, y: 67, w: 168, h: 264 },
  castY: 120,             // texture px inside the screen: the row Pac-Man and the ghosts run along
  castSpeed: 40,          // screen px per s
  castGap: 34,            // screen px between the runners
  dotGap: 16,             // screen px; the screen shows the maze at half its size, so this is one tile
  promptY: 210,           // texture px inside the screen: TAP TO START
  promptSize: 24,
  cakeX: 50,              // screen px of the cake texture's top-left corner
  cakeY: 778,
  cake: {
    w: 560,               // front face, art px
    depth: 80,            // drawn as (+depth/2, -depth/2)
    rim: 24,              // plate rim beyond the cake on each side
    // Top to bottom, outside in like the game's layers: the hall's frosting, the cabinet, the maze, the board,
    // the deep layers. Fillings between them.
    layers: [
      { name: 'frosting', h: 26, front: 0xfff4e0, side: 0xe0cfb4 },
      { name: 'cabinet', h: 64, front: 0xf2c200, side: 0xa88600 },
      { name: 'filling', h: 10, front: 0xffb8de, side: 0xd88fb8 },
      { name: 'maze', h: 64, front: 0x05051a, side: 0x020210, line: 0x2121de, dot: 0xffb897 },
      { name: 'filling', h: 10, front: 0xffb8de, side: 0xd88fb8 },
      { name: 'board', h: 64, front: 0x24382c, side: 0x17241c, line: 0xd8a83a },
      { name: 'filling', h: 10, front: 0xffb8de, side: 0xd88fb8 },
      { name: 'deep', h: 56, front: 0x3a3448, side: 0x25212e, line: 0x6a6280 },
    ],
    top: 0xfffaf0,        // the frosting's top surface
    drip: 0xfff4e0,       // frosting running down over the cabinet layer
    sprinkles: [0xd32734, 0x00ffde, 0xffb847, 0x2121de, 0xffde00],
    plate: 0xd8dce6, plateSide: 0x9aa0b0,
  },
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

// Levels and the level 256 glitch (design/systems/arcade-maze.md, "Levels and the kill screen"). The round counter is a
// byte in the machine's work RAM; the fruit shelf under the maze shows one fruit per level, drawn by game.asm.
export const LEVELS = {
  shelfCols: 9,          // shelf width in tiles, right-aligned under the maze (cols 10..18, the right half)
  param: 'level',        // ?level=256 starts the maze on that level (1..256), for testing
  // Level 256's garbage half (the shelf's columns, every maze row) splits into this many strips, top to bottom, one
  // per deep layer in DEEP_LAYERS order (crt at the top). A layer won in hard mode repairs its strip; with all of
  // them the level is clean and can be cleared (the program's `repair`, game.asm).
  repairs: 7,
  beatenText: 'LEVEL 256\nCLEAR!',  // callout when the repaired level 256 is cleared, before the credits roll
  creditsDelay: 2.5,     // s from that callout to the credits
  // Fruit tile colors (art maze/fruit-<name>, drawn in BootScene).
  colors: {
    red: 0xff2020, darkRed: 0xa00010, green: 0x30c030, brown: 0xa06030, white: 0xffffff, orange: 0xffa020,
    melon: 0x40d060, melonDark: 0x107020, yellow: 0xffe040, blue: 0x3060ff, cyan: 0x40e0ff, grey: 0xc0c0c0,
  },
};

// Animation speeds (characters and effects), in game frames per animation frame. Lives in a JSON file so the lab can
// export it: tune at /lab/bench.html?b=animation, download, save over src/settings/animation.json.
// These defaults are only used if the file can't be loaded.
const ANIM_FALLBACK = {
  fps: 60,
  characters: { pac: 7, blinky: 10, pinky: 10, inky: 10, clyde: 10, owner: 40 }, // owner: the hall's sleeping shop owner
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

// Playtest bots (tools/playtest.mjs, design/systems/playtest.md): a bot plays each layer, a noise model makes it play
// like a sloppy human thumb, and a sweep measures win rate and time to solve per noise level.
export const PLAYTEST = {
  levels: [0, 0.25, 0.5, 0.75, 1], // noise levels swept; 0 is the bare bot, 1 is a sloppy player
  runs: 20,              // seeded runs per layer and level (--quick: quickRuns)
  levelNoise: [0.25, 0.5], // noise levels of the game-level sweep (--levels)
  quickRuns: 5,
  // Noise at level 1; every knob scales linearly with the level.
  noise: {
    reaction: 0.45,      // s from deciding on a direction to the swipe landing (jittered +-50%)
    drop: 0.2,           // share of swipes that don't register
    wrong: 0.12,         // share of swipes that go 90 degrees off
    lapseRate: 0.15,     // attention lapses per second: the bot stops reacting for a moment
    lapseTime: 0.7,      // s one lapse lasts
  },
  readTime: 0.6,         // s to read a text box before tapping it away (hall), added at every level
  timeCap: { maze: 240, deep: 180, hall: 90, playthrough: 3600 }, // s of game time before a run counts as lost
  warmup: 20,            // s at most the machine plays before a deep-layer run starts (seeded), so runs differ
};
