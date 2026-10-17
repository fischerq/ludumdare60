import { GAME_WIDTH, GAME_HEIGHT, COLORS, HALL, PIXEL, UI, ANIM } from '../config.js';
import { createHall, stepHall, facing, pacPos, actorPos, startChase, endChase, stepGhosts } from '../systems/hall.js';
import { tileKey } from '../systems/tiles.js';
import { PAC_CYCLE, charFrame, animFrame } from '../systems/anim.js';
import { sfx, unlockAudio, setAudioPaused } from '../sound.js';
import { addLayerButton } from '../layerButton.js';

const T = PIXEL.tile;
const ANGLE = { right: 0, down: 90, left: 180, up: 270 };
const KEYS = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down',
};

// Layer 3, zoom out further: the arcade hall, top-down like a Pokémon game. Pac-Man walks the shop one tile per
// step, picks up coins, talks to the ghost visitors, and plays our cabinet (back down to the cabinet layer).
export default class HallScene extends Phaser.Scene {
  constructor() {
    super('Hall');
  }

  init(data) {
    this.fromCabinet = data?.from === 'cabinet';
  }

  create() {
    this.h = createHall();
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
      this.coinSprites.set(k, this.add.image(this.sx(x), this.sy(y), 'coin'));
    }
    this.npcSprites = this.h.npcs.map((n) => ({
      body: this.add.image(this.sx(n.x), this.sy(n.y), 'ghost-0').setDisplaySize(T, T).setTint(COLORS.ghosts[n.name]),
      eyes: this.add.image(this.sx(n.x), this.sy(n.y), 'eyes-up').setDisplaySize(T, T),
      cap: this.add.image(this.sx(n.x), this.sy(n.y), 'visitor-cap').setDisplaySize(T, T),
    }));
    this.pac = this.add.image(0, 0, 'pac-0').setDisplaySize(T, T);

    this.makeUi();
    this.setupInput();
    this.setupPauseOnHide();
    this.updateCamera();
  }

  sx(x) { return this.ox + x * T + T / 2; }
  sy(y) { return this.oy + y * T + T / 2; }

  drawMap() {
    const { rows } = this.h;
    const rug = (x, y) => rows[y]?.[x] === '~';
    const DECOR = { '|': 'wall-face', '^': 'window', '*': 'poster-pac', '+': 'poster-ghost', '@': 'clock' };
    const ON_FLOOR = {
      '=': 'counter', M: 'change-top', m: 'change-bottom', C: 'claw-top', c: 'claw-bottom', Q: 'soda-top',
      q: 'soda-bottom', '%': 'plant', '!': 'bin',
    };
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
    this.closeText(true);
  }

  say(text) {
    sfx.click();
    this.boxText.setText(text);
    const bh = this.boxText.height + 14, by = this.viewH - bh - 4, bw = this.viewW - 8;
    this.boxText.setY(by + 7);
    this.box.clear().fillStyle(0x000000, 0.92).fillRect(4, by, bw, bh).lineStyle(1, 0xffffff, 1).strokeRect(4.5, by + 0.5, bw - 1, bh - 1);
    this.box.setVisible(true);
    this.boxText.setVisible(true);
    this.talking = true;
  }

  closeText(silent) {
    this.box.setVisible(false);
    this.boxText.setVisible(false);
    this.talking = false;
    if (!silent) sfx.click();
    // The angry visitor's line is over: now they all come for Pac-Man.
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
    if (this.mode !== 'walk') return;
    if (this.talking) { this.closeText(); return; }
    const f = facing(this.h);
    const tx = HALL.text;
    if (f.npc && !this.h.chase) {
      if (f.npc.name === HALL.angry) { this.say(tx.angry); this.pendingChase = true; } else this.say(tx[f.npc.name]);
      return;
    }
    if (f.cell.toLowerCase() === 'y') {
      if (this.h.got >= HALL.coinsNeeded) this.goDown();
      else this.say(tx.yNeedCoins.replace('{n}', this.h.got).replace('{need}', HALL.coinsNeeded));
    } else if (HALL.cellText[f.cell]) this.say(tx[HALL.cellText[f.cell]]);
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
    this.children.list.filter((o) => o.scrollFactorX === 0 && o !== this.box && o !== this.boxText && o !== this.coinText)
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
    } else if (this.mode === 'walk' && !this.talking) {
      for (const e of stepHall(this.h, dt, this.held ?? this.keyDir)) {
        if (e.type === 'door') { this.stopChase(HALL.text.escaped, { x: this.h.pac.x, y: this.h.pac.y }); break; }
        sfx.coin();
        this.coinSprites.get(`${e.x},${e.y}`)?.destroy();
        this.say(HALL.text.coin);
      }
      if (!this.talking) {
        for (const e of stepGhosts(this.h, dt)) {
          if (e.type === 'caught') { sfx.frightOff(); sfx.death(); this.stopChase(HALL.text.caught, this.start); }
          if (e.type === 'calm') { sfx.frightOff(); this.say(HALL.text.calm); }
        }
      }
    }

    const p = this.h.pac, pp = pacPos(this.h);
    const frame = p.moving ? PAC_CYCLE[charFrame('pac', (p.steps + p.t) / HALL.walkSpeed, PAC_CYCLE.length)] : 1;
    this.pac.setPosition(Math.round(this.sx(pp.x)), Math.round(this.sy(pp.y))).setTexture(`pac-${frame}`)
      .setDisplaySize(T, T).setAngle(ANGLE[p.dir]);
    this.h.npcs.forEach((n, i) => {
      const s = this.npcSprites[i], np = actorPos(n);
      const x = Math.round(this.sx(np.x)), y = Math.round(this.sy(np.y));
      const skirt = charFrame(n.name, this.t, 2);
      s.body.setTexture(`ghost-${skirt}`).setDisplaySize(T, T).setPosition(x, y);
      s.eyes.setTexture(`eyes-${n.dir}`).setDisplaySize(T, T).setPosition(x, y);
      s.cap.setPosition(x, y);
    });
    for (const [k, s] of this.coinSprites) {
      const y = Number(k.split(',')[1]);
      if (s.active) s.y = this.sy(y) + animFrame(this.t + y * ANIM.effects.coinBob / ANIM.fps, ANIM.effects.coinBob, 2);
    }
    this.coinText.setText(`COINS ${this.h.got}/${HALL.coinsNeeded}`);
    this.updateCamera();
  }
}
