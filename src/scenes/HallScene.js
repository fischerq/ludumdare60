import { GAME_WIDTH, GAME_HEIGHT, COLORS, HALL, PIXEL, UI, COINS, ANIM } from '../config.js';
import { createHall, stepHall, facing, pacPos, actorPos, noticePac, startChase, endChase, stepGhosts } from '../systems/hall.js';
import { tileKey } from '../systems/tiles.js';
import { PAC_CYCLE, charFrame, animFrame } from '../systems/anim.js';
import { sfx, unlockAudio, setAudioPaused } from '../sound.js';
import { addLayerButton } from '../layerButton.js';
import { coins, addCoin, coinTaken, loseCoins } from '../wallet.js';

const T = PIXEL.tile;
const KEYS = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down',
};
// Tiles of the hall's tileset (assets/arcade/) by map character: on the wall, and standing on the floor.
const DECOR = { '|': 'wall-face', '^': 'window', '*': 'poster-pac', '+': 'poster-ghost', '@': 'clock' };
const ON_FLOOR = {
  '=': 'counter', M: 'change-top', m: 'change-bottom', C: 'claw-top', c: 'claw-bottom', Q: 'soda-top',
  q: 'soda-bottom', '%': 'plant', '!': 'bin',
};

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
  }

  create() {
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
    this.mode = this.fromCabinet ? 'intro' : 'walk';
    this.introT = 0;
    this.t = 0;
    this.cam = this.cameras.main.setOrigin(0, 0).setRoundPixels(true).setBackgroundColor(0x000000);

    this.drawMap();
    // Our cabinet: the tile above the start. The camera zooms in and out of it.
    const s = this.h.pac;
    this.start = { x: s.x, y: s.y };
    this.ourCab = { x: this.sx(s.x), y: this.sy(s.y - 1.5) };

    this.coinSprites = new Map();
    for (const k of this.h.coins) {
      const [x, y] = k.split(',').map(Number);
      this.coinSprites.set(k, this.add.image(this.sx(x), this.sy(y), 'arcade/coin'));
    }
    // Characters fill one tile, centered on it, like a Pokémon game; lower ones are drawn in front.
    const actor = (key) => this.add.image(0, 0, key);
    this.npcSprites = this.h.npcs.map((n) => actor(`arcade/ghost-${n.name}-up-0`));
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
  }

  sx(x) { return this.ox + x * T + T / 2; }

  // A character at tile position `at`: fills exactly that one tile (HALL.charSize), like a Pokémon game, whatever the art's size.
  place(s, at) {
    const y = Math.round(this.sy(at.y));
    s.setDisplaySize(HALL.charSize, HALL.charSize).setPosition(Math.round(this.sx(at.x)), y).setDepth(y);
  }
  sy(y) { return this.oy + y * T + T / 2; }

  drawMap() {
    const { rows } = this.h;
    const rug = (x, y) => rows[y]?.[x] === '~';
    rows.forEach((row, y) => [...row].forEach((c, x) => {
      const at = (key) => this.add.image(this.ox + x * T, this.oy + y * T, tileKey('arcade', key)).setOrigin(0);
      if (c === '#') { at('wall-top'); return; }
      if (c === 'D') { at('door'); return; }
      if (DECOR[c]) { at(DECOR[c]); return; }
      at('floor');
      if (c === '~') {
        const v = !rug(x, y - 1) ? 't' : !rug(x, y + 1) ? 'b' : 'm';
        const h = !rug(x - 1, y) ? 'l' : !rug(x + 1, y) ? 'r' : 'c';
        at(`rug-${v}${h}`);
      } else if ('RBGVY'.includes(c)) at(`cab-top-${c.toLowerCase()}`);
      else if ('rbgvy'.includes(c)) at(`cab-bottom-${c}`);
      else if (ON_FLOOR[c]) at(ON_FLOOR[c]);
    }));
  }

  makeUi() {
    const fixed = (o) => o.setScrollFactor(0);
    this.ui = [];
    this.coinText = fixed(this.add.text(6, 14, '', { fontFamily: UI.arcadeFont, fontSize: 8, color: COLORS.textReady, resolution: 1 }));
    this.ui.push(this.coinText);
    this.layerBtn = addLayerButton(this, this.viewW - 4 - 56, 4, 'LAYER\nDOWN', () => this.goDown(), 1, true);

    // RPG text box at the bottom, sized to its text: tap to close.
    this.box = fixed(this.add.graphics());
    this.boxText = fixed(this.add.text(11, 0, '', {
      fontFamily: UI.arcadeFont, fontSize: 8, color: COLORS.text, resolution: 1, wordWrap: { width: this.viewW - 22 }, lineSpacing: 4,
    }));
    // Who's talking: a large portrait in a frame sitting on the box's top left edge.
    this.portraitFrame = fixed(this.add.graphics());
    this.portrait = fixed(this.add.image(0, 0, 'arcade/portrait-owner').setOrigin(0));
    this.closeText(true);
  }

  // Show `text` in the box; `portrait` is a texture key (a 48x48 portrait or a 16x16 tile, shown 3x) or none.
  say(text, portrait = null) {
    sfx.click();
    this.boxText.setText(text);
    const bh = this.boxText.height + 14, by = this.viewH - bh - 4, bw = this.viewW - 8;
    this.boxText.setY(by + 7);
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

  closeText(silent) {
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

  // Tap: close the text box, or use whatever Pac-Man faces.
  interact() {
    if (this.mode !== 'walk' || this.notice > 0) return;
    if (this.talking) { this.closeText(); return; }
    const f = facing(this.h);
    const tx = HALL.text;
    if (f.npc && !this.h.chase) { this.say(tx[f.npc.name], `arcade/portrait-${f.npc.name}`); return; }
    const portrait = portraitFor(f.cell);
    if (f.cell.toLowerCase() === 'y') {
      if (coins() >= COINS.perGame) this.goDown();
      else this.say(tx.yNeedCoins.replace('{n}', coins()).replace('{need}', COINS.perGame), portrait);
    } else if (HALL.cellText[f.cell]) {
      this.say(tx[HALL.cellText[f.cell]], portrait);
      // The ghost poster: the visitors look at it, then at Pac-Man...
      if (f.cell === HALL.noticeCell && !this.h.chase) this.pendingNotice = true;
    }
  }

  goDown() {
    if (this.mode === 'outro') return;
    this.closeText(true);
    this.mode = 'outro';
    this.introT = 1;
  }

  setupInput() {
    // Hold a finger down and drag to keep walking; a short tap talks or uses.
    this.anchor = null;
    this.input.on('pointerdown', (p, over) => {
      unlockAudio();
      if (this.mode === 'intro') { this.introT = 1; return; } // tap to skip the zoom-out
      if (over.includes(this.layerBtn)) return;
      this.anchor = { x: p.x, y: p.y, id: p.id, at: this.time.now, moved: false };
    });
    this.input.on('pointermove', (p) => {
      const a = this.anchor;
      if (!a || p.id !== a.id || !p.isDown) return;
      const dx = p.x - a.x, dy = p.y - a.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < HALL.dragDeadzone) { this.held = null; return; }
      a.moved = true;
      if (this.talking) this.closeText();
      this.held = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    });
    this.input.on('pointerup', (p) => {
      const a = this.anchor;
      if (!a || p.id !== a.id) return;
      this.anchor = null;
      this.held = null;
      if (!a.moved && this.time.now - a.at < HALL.tapTime) this.interact();
    });

    this.input.keyboard?.on('keydown', (e) => {
      unlockAudio();
      if (e.code === 'Space' || e.code === 'Enter') this.interact();
      if (KEYS[e.code]) { this.keyDir = KEYS[e.code]; if (this.talking) this.closeText(); }
    });
    this.input.keyboard?.on('keyup', (e) => { if (KEYS[e.code] === this.keyDir) this.keyDir = null; });
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
      center = { x: this.ourCab.x + (follow.x - this.ourCab.x) * e, y: this.ourCab.y + (follow.y - this.ourCab.y) * e };
    }
    this.cam.setZoom(zoom);
    this.cam.setScroll(center.x - GAME_WIDTH / zoom / 2, center.y - GAME_HEIGHT / zoom / 2);
    // Screen-fixed UI would scale with the zoom; show it only at the normal zoom.
    const showUi = this.mode === 'walk';
    this.coinText.setVisible(showUi);
    const textBox = [this.box, this.boxText, this.coinText, this.portraitFrame, this.portrait];
    this.children.list.filter((o) => o.scrollFactorX === 0 && !textBox.includes(o))
      .forEach((o) => o.setVisible(showUi));
  }

  update(time, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    this.t += dt;

    if (this.mode === 'intro') {
      this.introT += dt / HALL.introTime;
      if (this.introT >= 1) this.mode = 'walk';
    } else if (this.mode === 'outro') {
      this.introT -= dt / HALL.outroTime;
      if (this.introT <= 0) { this.mode = 'gone'; this.scene.start('Cabinet', { from: 'above' }); return; }
    } else if (this.mode === 'walk' && this.notice > 0) {
      // The "!" is up: everyone freezes, then the ghosts say it together.
      this.notice -= dt;
      if (this.notice <= 0) { this.say(HALL.text.weKnowYou, 'arcade/portrait-ghosts'); this.pendingChase = true; }
    } else if (this.mode === 'walk' && !this.talking) {
      for (const e of stepHall(this.h, dt, this.held ?? this.keyDir)) {
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
