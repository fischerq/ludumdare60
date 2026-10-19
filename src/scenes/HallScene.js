import { GAME_WIDTH, GAME_HEIGHT, COLORS, HALL, PIXEL, UI, COINS, ANIM, MINI } from '../config.js';
import { createHall, stepHall, facing, pacPos, actorPos, noticePac, startChase, endChase, stepGhosts, blocked } from '../systems/hall.js';
import { tileKey } from '../systems/tiles.js';
import { PAC_CYCLE, charFrame, animFrame } from '../systems/anim.js';
import { sfx, unlockAudio, setAudioPaused, setBed } from '../sound.js';
import { addLayerButtonAt } from '../layerButton.js';
import { coins, addCoin, coinTaken, loseCoins, spendCoin } from '../wallet.js';
import { openManual } from '../manual/index.js';
import { buildModel, createGlobe3d, grabGlobe3d, dragGlobe3d, releaseGlobe3d, shakeGlobe3d, stepGlobe3d } from '../systems/globe3d.js';
import { createView, renderGlobe, pickGlobe } from '../systems/globeRender.js';

const GLOBE_MODEL = new URL('../settings/globe-model.json', import.meta.url).href;

const T = PIXEL.tile;
const KEYS = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down',
};
// Tiles of the hall's tileset (assets/arcade/) by map character: on the wall, and standing on the floor.
const DECOR = { '|': 'wall-face', '^': 'window', '*': 'poster-pac', '+': 'poster-ghost', '@': 'clock' };
const ON_FLOOR = {
  '=': 'counter', M: 'change-top', m: 'change-bottom', C: 'claw-top', c: 'claw-bottom', Q: 'soda-top',
  q: 'soda-bottom', w: 'snow-globe', '%': 'plant', '!': 'bin', k: 'counter-gurke', j: 'counter-jar', u: 'mini-gurke', s: 'counter-sign', n: 'manual-stack', p: 'manual-pac',
  h: 'rabbit', e: 'urmel-0', l: 'paper', a: 'sweater', x: 'gameboy',
};

// The Urmel figurine's stage (HALL.urmel, arcade/urmel-<n>): kept for the session, like the coins. The first talk
// shows the iceberg it starts as, every later one the next stage.
const urmel = { stage: 0, talked: false };
// The Game Boy Color: the batteries under the plant (picked up once per session) power it for one go.
const gameboy = { batteries: false, used: false };

// The text box portrait for a map character: the owner's own, otherwise the thing's tile (a machine's top half).
function portraitFor(c) {
  if (c === 'O') return 'arcade/portrait-owner';
  if (c === 'D') return tileKey('arcade', 'door');
  if (DECOR[c]) return tileKey('arcade', DECOR[c]);
  if ('RBGVYrbgvy'.includes(c)) return tileKey('arcade', `cab-top-${c.toLowerCase()}`);
  const top = ON_FLOOR[c.toUpperCase()] ?? ON_FLOOR[c];
  return top ? tileKey('arcade', top) : null;
}

// Layer 3, zoom out further: the arcade hall, top-down like a Pokémon game. Pac-Man walks the shop one tile per
// step, picks up coins, talks to the ghost visitors, and plays our cabinet (back down to the cabinet layer).
export default class HallScene extends Phaser.Scene {
  constructor() {
    super('Hall');
  }

  init(data) {
    this.fromCabinet = data?.from === 'cabinet';
    this.wasCaught = !!data?.caught; // the hall starts over after the ghosts caught Pac-Man
    this.fromGame = data?.from === 'game' ? data : null; // back from one of the other machines (MiniGameScene)
    this.fromGameboy = data?.from === 'gameboy'; // the Game Boy just turned off (GameBoyScene)
  }

  preload() {
    if (!this.cache.json.exists('globe-model')) this.load.json('globe-model', GLOBE_MODEL);
  }

  create() {
    setBed('hall');
    this.globeUi = null; // the close-up's objects are made again after a restart
    this.h = createHall();
    // Coins picked up on an earlier visit stay gone (they're in the wallet).
    for (const k of [...this.h.coins]) if (coinTaken(k)) this.h.coins.delete(k);
    this.viewW = GAME_WIDTH / HALL.zoom;
    this.viewH = GAME_HEIGHT / HALL.zoom;
    // The room fits the screen: center it.
    this.ox = Math.floor((this.viewW - this.h.w * T) / 2);
    this.oy = Math.floor((this.viewH - this.h.h * T) / 2);
    this.held = null;
    this.keyDir = null;
    this.mode = this.fromCabinet || this.fromGame ? 'intro' : 'walk';
    this.introT = 0;
    this.t = 0;
    this.cam = this.cameras.main.setOrigin(0, 0).setRoundPixels(true).setBackgroundColor(0x000000);

    this.drawMap();
    // Our cabinet: the tile above the start. The camera zooms in and out of it.
    const s = this.h.pac;
    this.start = { x: s.x, y: s.y };
    this.ourCab = { x: this.sx(s.x), y: this.sy(s.y - 1.5) };
    this.zoomAt = this.ourCab; // what the intro zooms out of and the outro into
    this.bumped = false;
    if (this.fromGame) this.backFromGame(this.fromGame);
    if (this.fromGameboy) this.backFromGameboy();

    this.coinSprites = new Map();
    for (const k of this.h.coins) {
      const [x, y] = k.split(',').map(Number);
      this.coinSprites.set(k, this.add.image(this.sx(x), this.sy(y), 'arcade/coin'));
    }
    if (gameboy.batteries) this.h.batteries.clear();
    this.batterySprites = [...this.h.batteries].map((k) => {
      const [x, y] = k.split(',').map(Number);
      return this.add.image(this.sx(x), this.sy(y), 'arcade/batteries');
    });
    // Characters fill one tile, centered on it, like a Pokémon game; lower ones are drawn in front.
    const actor = (key) => this.add.image(0, 0, key);
    this.npcSprites = this.h.npcs.map((n) => actor(`arcade/ghost-${n.name}-down-0`));
    this.pac = actor('arcade/pac-up-0');
    // The shop owner, asleep behind the counter.
    this.owners = [];
    this.h.rows.forEach((row, y) => [...row].forEach((c, x) => { if (c === 'O') this.owners.push({ x, y, s: actor('arcade/owner-sleep-0') }); }));
    // The "!" over each visitor when they recognize Pac-Man.
    this.exclaims = this.h.npcs.map(() => this.add.image(0, 0, 'arcade/exclaim').setVisible(false).setDepth(1e5));
    this.notice = 0; // s left of the "!" before the ghosts speak

    this.makeUi();
    this.children.list.filter((o) => o.scrollFactorX === 0).forEach((o) => o.setDepth(1e6));
    this.setupInput();
    this.setupPauseOnHide();
    this.updateCamera();
    if (this.wasCaught) this.say(HALL.text.caught);
    if (this.afterStart) this.say(this.afterStart);
  }

  sx(x) { return this.ox + x * T + T / 2; }

  // A machine's bottom tile (its lowercase map character) and the middle of the machine, to zoom into.
  machine(c) {
    const y = this.h.rows.findIndex((r) => r.includes(c)), x = this.h.rows[y].indexOf(c);
    return { x, y, at: { x: this.sx(x), y: this.sy(y - 0.5) } };
  }

  // The Game Boy turned off: Pac-Man next to it on the rug.
  backFromGameboy() {
    const y = this.h.rows.findIndex((r) => r.includes('x')), x = this.h.rows[y].indexOf('x');
    const spot = [[0, 1, 'up'], [0, -1, 'down'], [-1, 0, 'right']].map(([dx, dy, dir]) => ({ x: x + dx, y: y + dy, dir }))
      .find((p) => !blocked(this.h, p.x, p.y));
    if (spot) Object.assign(this.h.pac, spot);
    this.afterStart = HALL.text.gameboyOff;
  }

  // Back from another machine: zoom out of it, Pac-Man standing in front of it, then the result.
  backFromGame(d) {
    const c = Object.keys(MINI.machines).find((k) => MINI.machines[k] === d.game), m = this.machine(c);
    this.zoomAt = m.at;
    const spot = [[0, 1, 'up'], [-1, 0, 'right'], [1, 0, 'left']].map(([dx, dy, dir]) => ({ x: m.x + dx, y: m.y + dy, dir }))
      .find((p) => !blocked(this.h, p.x, p.y));
    if (spot) Object.assign(this.h.pac, spot);
    const tx = HALL.text, line = d.result === 'win' ? tx.gameWin : d.result === 'lose' ? tx.gameLose : '';
    const text = (line + (d.gurke ? tx.gameGurke : '')).replace('{score}', d.score).trim();
    this.afterIntro = text || null;
  }

  // A character at tile position `at`: fills exactly that one tile (HALL.charSize), like a Pokémon game, whatever the art's size.
  place(s, at) {
    const y = Math.round(this.sy(at.y));
    s.setDisplaySize(HALL.charSize, HALL.charSize).setPosition(Math.round(this.sx(at.x)), y).setDepth(y);
  }
  sy(y) { return this.oy + y * T + T / 2; }

  drawMap() {
    const { rows } = this.h;
    const rug = (x, y) => '~ax'.includes(rows[y]?.[x] ?? '.'); // the sweater and the Game Boy lie on the rug
    rows.forEach((row, y) => [...row].forEach((c, x) => {
      const at = (key) => this.add.image(this.ox + x * T, this.oy + y * T, tileKey('arcade', key)).setOrigin(0);
      if (c === '#') { at('wall-top'); return; }
      if (c === 'D') { at('door'); return; }
      if (DECOR[c]) { at(DECOR[c]); return; }
      at('floor');
      if (rug(x, y)) {
        const v = !rug(x, y - 1) ? 't' : !rug(x, y + 1) ? 'b' : 'm';
        const h = !rug(x - 1, y) ? 'l' : !rug(x + 1, y) ? 'r' : 'c';
        at(`rug-${v}${h}`);
      }
      if (c === '~') return;
      if ('RBGVY'.includes(c)) at(`cab-top-${c.toLowerCase()}`);
      else if ('rbgvy'.includes(c)) at(`cab-bottom-${c}`);
      else if (c === 'e') this.urmelImg = at(`urmel-${urmel.stage}`);
      else if (ON_FLOOR[c]) at(ON_FLOOR[c]);
    }));
  }

  makeUi() {
    const fixed = (o) => o.setScrollFactor(0);
    this.ui = [];
    this.coinText = fixed(this.add.text(6, 14, '', { fontFamily: UI.arcadeFont, fontSize: UI.hudPx / HALL.zoom, color: COLORS.textReady, resolution: HALL.zoom / 2 }));
    this.ui.push(this.coinText);
    this.layerBtn = addLayerButtonAt(this, 'down', () => this.goDown(), { zoom: HALL.zoom, scale: 2 / HALL.zoom, fixed: true });

    // RPG text box at the bottom, just above the layer button, sized to its text: tap to close.
    this.box = fixed(this.add.graphics());
    this.boxText = fixed(this.add.text(11, 0, '', {
      fontFamily: UI.arcadeFont, fontSize: 8, color: COLORS.text, resolution: 1, wordWrap: { width: this.viewW - 22 }, lineSpacing: 4,
    }));
    // Who's talking: a large portrait in a frame sitting on the box's top left edge.
    this.portraitFrame = fixed(this.add.graphics());
    this.portrait = fixed(this.add.image(0, 0, 'arcade/portrait-owner').setOrigin(0));
    // Choices under the text (the manuals): tap one, or arrows + Enter.
    this.choiceTexts = [0, 1, 2, 3, 4].map(() => fixed(this.add.text(11, 0, '', {
      fontFamily: UI.arcadeFont, fontSize: 8, color: COLORS.textReady, resolution: 1,
    })));
    this.closeText(true);
  }

  // Show `text` in the box; `portrait` is a texture key (a 48x48 portrait or a 16x16 tile, shown 3x) or none.
  // `choices`: [{ label, act }] listed under the text; picking one closes the box and runs `act`.
  say(text, portrait = null, choices = null) {
    sfx.click();
    this.boxText.setText(text);
    this.choices = choices;
    this.choiceIdx = 0;
    const L = HALL.choiceLine, n = choices?.length ?? 0;
    const bh = this.boxText.height + 14 + n * L, by = this.layerBtn.y - bh - 2, bw = this.viewW - 8;
    this.boxText.setY(by + 7);
    this.choiceTexts.forEach((t, i) => t.setVisible(i < n).setY(by + 7 + this.boxText.height + 4 + i * L + (L - 8) / 2));
    this.choiceTop = by + 7 + this.boxText.height + 4;
    this.showChoices();
    this.box.clear().fillStyle(0x000000, 0.92).fillRect(4, by, bw, bh).lineStyle(1, 0xffffff, 1).strokeRect(4.5, by + 0.5, bw - 1, bh - 1);
    this.box.setVisible(true);
    this.boxText.setVisible(true);
    const P = HALL.portraitSize, px = 4, py = by - P - 3;
    this.portraitFrame.clear().fillStyle(0x000000, 1).fillRect(px, py - 1, P + 4, P + 4)
      .lineStyle(1, 0xffffff, 1).strokeRect(px + 0.5, py - 0.5, P + 3, P + 3);
    if (portrait) this.portrait.setTexture(portrait).setDisplaySize(P, P).setPosition(px + 2, py + 1);
    this.portraitFrame.setVisible(!!portrait);
    this.portrait.setVisible(!!portrait);
    this.talking = true;
  }

  showChoices() {
    this.choices?.forEach((c, i) => this.choiceTexts[i].setText(`${i === this.choiceIdx ? '>' : ' '} ${c.label}`));
  }

  // A tap at screen y (or the keyboard's pick when y is null) on a choice: run it.
  pickChoice(y) {
    const i = y == null ? this.choiceIdx : Math.floor((y / HALL.zoom - this.choiceTop) / HALL.choiceLine);
    const c = this.choices[i];
    if (!c) return;
    this.closeText();
    c.act?.();
  }

  closeText(silent) {
    this.choices = null;
    this.choiceTexts.forEach((t) => t.setVisible(false));
    this.box.setVisible(false);
    this.boxText.setVisible(false);
    this.portraitFrame.setVisible(false);
    this.portrait.setVisible(false);
    this.talking = false;
    if (!silent) sfx.click();
    // Pac-Man read the ghost poster: the visitors look up and recognize him.
    if (this.pendingNotice) {
      this.pendingNotice = false;
      noticePac(this.h);
      this.notice = HALL.noticeTime;
      sfx.alert();
    }
    // The ghosts' line is over: now they all come for Pac-Man.
    if (this.pendingChase) {
      this.pendingChase = false;
      startChase(this.h);
      sfx.frightOn();
    }
  }

  // The chase ends: everyone back to their machine; Pac-Man at `at`.
  stopChase(text, at) {
    endChase(this.h);
    sfx.frightOff();
    if (at) Object.assign(this.h.pac, { x: at.x, y: at.y, dir: 'up', moving: false, t: 0 });
    this.say(text);
  }

  // Tap (at screen y, null from the keyboard): pick a choice or close the text box, or use whatever Pac-Man faces.
  interact(y = null) {
    if (this.mode !== 'walk' || this.notice > 0) return;
    if (this.talking && this.choices) { this.pickChoice(y); return; }
    if (this.talking) { this.closeText(); return; }
    const f = facing(this.h);
    const tx = HALL.text;
    if (f.npc && !this.h.chase) { this.say(tx[f.npc.name], `arcade/portrait-${f.npc.name}`); return; }
    const portrait = portraitFor(f.cell);
    const lc = f.cell.toLowerCase();
    if (lc === 'y') {
      if (coins() >= COINS.perGame) this.say(tx.pac, portrait, [{ label: tx.play.replace('{need}', COINS.perGame), act: () => this.goDown() }, { label: tx.notNow }]);
      else this.say(tx.yNeedCoins.replace('{n}', coins()).replace('{need}', COINS.perGame), portrait);
    } else if (MINI.machines[lc] || lc === MINI.broken) {
      this.useMachine(lc, portrait);
    } else if (HALL.cellText[f.cell] === 'manuals') {
      this.say(tx.manuals, portrait, [
        ...HALL.manuals.map((m) => ({ label: m.title, act: () => this.say(m.ripped ? tx.rippedOut : m.text, portrait) })),
        { label: HALL.menu.close },
      ]);
    } else if (HALL.cellText[f.cell] === 'globe') {
      this.say(tx.globe, portrait, [{ label: tx.globeLook, act: () => this.openGlobe() }, { label: tx.globeClose }]);
    } else if (HALL.cellText[f.cell] === 'urmel') {
      if (urmel.talked) urmel.stage = (urmel.stage + 1) % HALL.urmel.length;
      urmel.talked = true;
      const key = tileKey('arcade', `urmel-${urmel.stage}`);
      this.urmelImg.setTexture(key);
      this.say(HALL.urmel[urmel.stage], key);
    } else if (HALL.cellText[f.cell] === 'gameboy') {
      if (gameboy.used) this.say(tx.gameboyDead, portrait);
      else if (!gameboy.batteries) this.say(tx.gameboy, portrait);
      else {
        const on = () => { gameboy.used = true; sfx.click(); this.mode = 'gone'; this.scene.start('GameBoy'); };
        this.say(tx.gameboyPower, portrait, [{ label: tx.gameboyOn, act: on }, { label: tx.gameboyLeave }]);
      }
    } else if (HALL.cellText[f.cell] === 'paper') {
      this.say(Math.random() < HALL.paperRareChance ? tx.paperRare : tx.paper, portrait);
    } else if (HALL.cellText[f.cell] === 'pacManual') {
      this.readPacManual(portrait);
    } else if (HALL.cellText[f.cell]) {
      this.say(tx[HALL.cellText[f.cell]], portrait);
      // The ghost poster: the visitors look at it, then at Pac-Man...
      if (f.cell === HALL.noticeCell && !this.h.chase) this.pendingNotice = true;
    }
  }

  // One of the other machines: its line, then PLAY for a coin (Galaxian just eats it).
  useMachine(c, portrait) {
    const tx = HALL.text;
    if (coins() < COINS.perGame) { this.say(tx[c] + tx.needCoin, portrait); return; }
    const play = () => {
      if (!spendCoin()) return;
      sfx.coin();
      if (c === MINI.broken) { this.cam.flash(120, 255, 255, 255); this.say(tx.vBroken, portrait); return; }
      this.goDown({ scene: 'Mini', data: { game: MINI.machines[c] }, at: this.machine(c).at });
    };
    this.say(tx[c], portrait, [{ label: tx.play.replace('{need}', COINS.perGame), act: play }, { label: tx.notNow }]);
  }

  // Our manual offers READ MORE: the full service manual over the game, the hall paused under it.
  readPacManual(portrait) {
    const read = () => {
      this.scene.pause();
      openManual(() => this.scene.resume());
    };
    this.say(HALL.pacManual, portrait, [{ label: HALL.menu.readMore, act: read }, { label: HALL.menu.close }]);
  }

  // The snow globe up close, over the dimmed hall, in 3D: grab it anywhere and turn it, tap to shake, the heavy base
  // rights it. Tap outside to put it down.
  openGlobe() {
    const V = HALL.globe3d, fixed = (o) => o.setScrollFactor(0).setDepth(2e6);
    if (!this.globeUi) {
      const x = Math.round(this.viewW / 2), y = Math.round(this.viewH / 2 - 12);
      const dim = fixed(this.add.graphics()).fillStyle(0x000000, 0.85).fillRect(0, 0, this.viewW, this.viewH);
      if (!this.textures.exists('globe-3d')) this.textures.createCanvas('globe-3d', V.view, V.view);
      const img3d = fixed(this.add.image(x, y, 'globe-3d'));
      const below = y + V.view / 2 + 2;
      const hint = fixed(this.add.text(this.viewW / 2, below, HALL.text.globeHint, {
        fontFamily: UI.arcadeFont, fontSize: 8, color: COLORS.textDim, resolution: 1, align: 'center',
        wordWrap: { width: this.viewW - 24 }, lineSpacing: 4,
      }).setOrigin(0.5, 0));
      this.globeUi = { x, y, all: [dim, img3d, hint] };
      this.globeView = createView(V, this.globePalette(), this.texturePixels('arcade/globe-note'));
      this.globeModel = buildModel(this.cache.json.get('globe-model'));
    }
    this.globeUi.all.forEach((o) => o.setVisible(true));
    this.globe3 = createGlobe3d(this.globeModel);
    this.globeDrag = null;
    this.globeKeys = new Set();
    this.mode = 'globe';
    shakeGlobe3d(this.globe3);
    sfx.glitter();
  }

  // A loaded texture's pixels as ImageData.
  texturePixels(key) {
    const src = this.textures.get(key).getSourceImage(), c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(src, 0, 0);
    return ctx.getImageData(0, 0, c.width, c.height);
  }

  // The palette PNG's colors, by part (rows in the order of HALL.globe3d.palette).
  globePalette() {
    const { data: d, width } = this.texturePixels('arcade/globe-palette'), rows = Object.keys(HALL.globe3d.palette);
    return Object.fromEntries(rows.map((k, y) => [k, [0, 1, 2, 3].map((x) => {
      const i = (y * width + x) * 4;
      return (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    })]));
  }

  closeGlobe() {
    this.globeUi.all.forEach((o) => o.setVisible(false));
    this.mode = 'walk';
    sfx.click();
  }

  // Screen point p in art px from the close-up's center.
  globeLocal(p) {
    return { x: p.x / HALL.zoom - this.globeUi.x, y: p.y / HALL.zoom - this.globeUi.y };
  }

  // The world point of the 3D globe under screen point p, or null.
  globePick(p) {
    const a = this.globeLocal(p), V = this.globeView;
    return pickGlobe(V, this.globe3, a.x + V.W / 2, a.y + V.W / 2);
  }

  stepGlobeView(dt) {
    const g = this.globe3, k = this.globeKeys, T3 = HALL.globe3d.keyTorque;
    // Arrow keys tip it: left/right roll it, up/down tip it toward you or away.
    g.torque = [(k.has('down') ? 1 : 0) - (k.has('up') ? 1 : 0), 0, (k.has('left') ? 1 : 0) - (k.has('right') ? 1 : 0)].map((v) => v * T3);
    stepGlobe3d(g, dt);
    const tex = this.textures.get('globe-3d');
    tex.getContext().putImageData(renderGlobe(this.globeView, g), 0, 0);
    tex.refresh();
  }

  // A finger down on the close-up: grab the 3D globe where it landed.
  globeDown(p) {
    this.globeDrag = { id: p.id, moved: false, at: this.time.now };
    const pt = this.globePick(p);
    if (pt) grabGlobe3d(this.globe3, pt);
  }

  globeMove(p) {
    const gd = this.globeDrag;
    if (!gd || p.id !== gd.id || !p.isDown) return;
    if (!gd.moved && Math.abs(p.x - p.downX) + Math.abs(p.y - p.downY) >= HALL.dragDeadzone) { gd.moved = true; sfx.glitter(); }
    const a = this.globeLocal(p), j = this.globe3.jolt;
    dragGlobe3d(this.globe3, a.x - j.x, -(a.y - j.y));
  }

  globeUp(p) {
    const gd = this.globeDrag;
    if (!gd || p.id !== gd.id) return;
    this.globeDrag = null;
    const grabbed = !!this.globe3.grab;
    releaseGlobe3d(this.globe3);
    if (gd.moved || this.time.now - gd.at >= HALL.tapTime) return;
    if (grabbed) {
      shakeGlobe3d(this.globe3);
      sfx.glitter();
    } else this.closeGlobe();
  }

  // Zoom into a machine and play it: ours by default (the cabinet layer), or one of the others.
  goDown(to = { scene: 'Cabinet', data: { from: 'above' }, at: this.ourCab }) {
    if (this.mode === 'outro') return;
    this.closeText(true);
    this.outro = to;
    this.zoomAt = to.at;
    this.mode = 'outro';
    this.introT = 1;
  }

  setupInput() {
    // Hold a finger down and drag to keep walking; a short tap talks or uses.
    this.anchor = null;
    this.input.on('pointerdown', (p, over) => {
      unlockAudio();
      if (this.mode === 'globe') { this.globeDown(p); return; }
      if (this.mode === 'intro') { this.introT = 1; return; } // tap to skip the zoom-out
      if (over.includes(this.layerBtn)) return;
      this.anchor = { x: p.x, y: p.y, id: p.id, at: this.time.now, moved: false };
    });
    this.input.on('pointermove', (p) => {
      if (this.mode === 'globe') { this.globeMove(p); return; }
      const a = this.anchor;
      if (!a || p.id !== a.id || !p.isDown) return;
      const dx = p.x - a.x, dy = p.y - a.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < HALL.dragDeadzone) { this.held = null; return; }
      a.moved = true;
      if (this.choices) return; // a choice is waiting: no walking away from it
      if (this.talking) this.closeText();
      this.held = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    });
    this.input.on('pointerup', (p) => {
      if (this.mode === 'globe') { this.globeUp(p); return; }
      const a = this.anchor;
      if (!a || p.id !== a.id) return;
      this.anchor = null;
      this.held = null;
      if (!a.moved && this.time.now - a.at < HALL.tapTime) this.interact(p.y);
    });

    this.input.keyboard?.on('keydown', (e) => {
      unlockAudio();
      if (this.mode === 'globe') {
        if (e.code === 'Space') { shakeGlobe3d(this.globe3); sfx.glitter(); }
        if (e.code === 'Enter' || e.code === 'Escape') this.closeGlobe();
        if (KEYS[e.code]) this.globeKeys.add(KEYS[e.code]);
        return;
      }
      if (e.code === 'Space' || e.code === 'Enter') this.interact();
      if (this.choices && (KEYS[e.code] === 'up' || KEYS[e.code] === 'down')) {
        const n = this.choices.length;
        this.choiceIdx = (this.choiceIdx + (KEYS[e.code] === 'up' ? n - 1 : 1)) % n;
        this.showChoices();
        return;
      }
      if (this.choices) return;
      if (KEYS[e.code]) { this.keyDir = KEYS[e.code]; if (this.talking) this.closeText(); }
    });
    this.input.keyboard?.on('keyup', (e) => {
      if (KEYS[e.code] === this.keyDir) this.keyDir = null;
      this.globeKeys?.delete(KEYS[e.code]);
    });
  }

  setupPauseOnHide() {
    const onHidden = () => { setAudioPaused(true); this.scene.pause(); };
    const onVisible = () => { setAudioPaused(false); this.scene.resume(); };
    this.game.events.on(Phaser.Core.Events.HIDDEN, onHidden);
    this.game.events.on(Phaser.Core.Events.VISIBLE, onVisible);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.HIDDEN, onHidden);
      this.game.events.off(Phaser.Core.Events.VISIBLE, onVisible);
      sfx.frightOff();
    });
  }

  // Follow Pac-Man; during the intro/outro, zoom between our cabinet (filling the view) and the normal view.
  updateCamera() {
    const pp = pacPos(this.h);
    // The room fits the screen, so the normal view is fixed; only taller rooms would scroll with Pac-Man.
    const mapH = this.h.h * T;
    const follow = {
      x: this.viewW / 2,
      y: mapH <= this.viewH ? this.viewH / 2 : Phaser.Math.Clamp(this.sy(pp.y), this.viewH / 2, this.oy + mapH - this.viewH / 2),
    };
    let zoom = HALL.zoom, center = follow;
    if (this.mode === 'intro' || this.mode === 'outro') {
      const e = 1 - (1 - Math.min(1, this.introT)) ** 3;
      zoom = HALL.introZoom * (HALL.zoom / HALL.introZoom) ** e; // even zoom speed on a log scale
      center = { x: this.zoomAt.x + (follow.x - this.zoomAt.x) * e, y: this.zoomAt.y + (follow.y - this.zoomAt.y) * e };
    }
    this.cam.setZoom(zoom);
    this.cam.setScroll(center.x - GAME_WIDTH / zoom / 2, center.y - GAME_HEIGHT / zoom / 2);
    // Screen-fixed UI would scale with the zoom; show it only at the normal zoom.
    const showUi = this.mode === 'walk';
    this.coinText.setVisible(showUi);
    const textBox = [this.box, this.boxText, this.coinText, this.portraitFrame, this.portrait, ...this.choiceTexts, ...(this.globeUi?.all ?? [])];
    this.children.list.filter((o) => o.scrollFactorX === 0 && !textBox.includes(o))
      .forEach((o) => o.setVisible(showUi));
  }

  update(time, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    this.t += dt;

    if (this.mode === 'intro') {
      this.introT += dt / HALL.introTime;
      if (this.introT >= 1) { this.mode = 'walk'; if (this.afterIntro) { this.say(this.afterIntro); this.afterIntro = null; } }
    } else if (this.mode === 'outro') {
      this.introT -= dt / HALL.outroTime;
      if (this.introT <= 0) { this.mode = 'gone'; this.scene.start(this.outro.scene, this.outro.data); return; }
    } else if (this.mode === 'globe') {
      this.stepGlobeView(dt);
    } else if (this.mode === 'walk' && this.notice > 0) {
      // The "!" is up: everyone freezes, then the ghosts say it together.
      this.notice -= dt;
      if (this.notice <= 0) { this.say(HALL.text.weKnowYou, 'arcade/portrait-ghosts'); this.pendingChase = true; }
    } else if (this.mode === 'walk' && !this.talking) {
      if (!(this.held ?? this.keyDir) || this.h.pac.moving) this.bumped = false;
      for (const e of stepHall(this.h, dt, this.held ?? this.keyDir)) {
        // Walking into our cabinet: straight down a layer with a coin, otherwise say so (once per push).
        if (e.type === 'bump') {
          if (e.cell.toLowerCase() !== 'y' || this.bumped) continue;
          this.bumped = true;
          if (coins() >= COINS.perGame) this.goDown();
          else this.say(HALL.text.yNeedCoins.replace('{n}', coins()).replace('{need}', COINS.perGame), portraitFor('y'));
          break;
        }
        if (e.type === 'batteries') {
          sfx.coin();
          gameboy.batteries = true;
          this.batterySprites.forEach((b) => b.destroy());
          this.say(HALL.text.batteries);
          break;
        }
        if (e.type === 'door') { this.stopChase(HALL.text.escaped, { x: this.h.pac.x, y: this.h.pac.y }); break; }
        sfx.coin();
        addCoin(`${e.x},${e.y}`);
        this.coinSprites.get(`${e.x},${e.y}`)?.destroy();
        this.say(HALL.text.coin);
      }
      if (!this.talking) {
        for (const e of stepGhosts(this.h, dt)) {
          // Caught: they take every coin and the hall starts over (floor coins back, everyone in place).
          if (e.type === 'caught') { sfx.frightOff(); sfx.death(); loseCoins(); this.mode = 'gone'; this.scene.restart({ caught: true }); return; }
          if (e.type === 'calm') { sfx.frightOff(); this.say(HALL.text.calm); }
        }
      }
    }

    const p = this.h.pac, pp = pacPos(this.h);
    // Pac-Man's art has right, up and down; left is the right one mirrored.
    const frame = p.moving ? charFrame('pac', (p.steps + p.t) / HALL.walkSpeed, 2) : 0;
    this.place(this.pac.setTexture(`arcade/pac-${p.dir === 'left' ? 'right' : p.dir}-${frame}`).setFlipX(p.dir === 'left'), pp);
    this.h.npcs.forEach((n, i) => this.place(this.npcSprites[i].setTexture(`arcade/ghost-${n.name}-${n.dir}-${charFrame(n.name, this.t, 2)}`), actorPos(n)));
    this.h.npcs.forEach((n, i) => {
      const at = actorPos(n);
      this.exclaims[i].setVisible(this.notice > 0).setPosition(Math.round(this.sx(at.x)), Math.round(this.sy(at.y - 1)));
    });
    for (const o of this.owners) this.place(o.s.setTexture(`arcade/owner-sleep-${charFrame('owner', this.t, 2)}`), o);
    for (const [k, s] of this.coinSprites) {
      const y = Number(k.split(',')[1]);
      if (s.active) s.y = this.sy(y) + animFrame(this.t + y * ANIM.effects.coinBob / ANIM.fps, ANIM.effects.coinBob, 2);
    }
    this.coinText.setText(`COINS ${coins()}`);
    this.updateCamera();
  }
}
