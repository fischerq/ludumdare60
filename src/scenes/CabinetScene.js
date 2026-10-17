import { GAME_TITLE, GAME_WIDTH, GAME_HEIGHT, COLORS, CABINET, MAZE, PIXEL, UI, BEST_KEY, LAYERS } from '../config.js';
import { createGame, stepGame, steer } from '../systems/maze.js';
import { drawScreen, screenSize } from '../systems/screenImage.js';
import { sfx, unlockAudio, setAudioPaused } from '../sound.js';
import { addLayerButton } from '../layerButton.js';

const KEYS = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down',
};

// Layer 2, zoom out: the same maze game on the screen of an arcade cabinet, played with its 4-way joystick.
// Pixel art with faked depth (see CABINET in config). Starts zoomed in so the screen looks exactly like the
// maze level, then pulls back to show the whole machine.
export default class CabinetScene extends Phaser.Scene {
  constructor() {
    super('Cabinet');
  }

  init(data) {
    this.fromAbove = data?.from === 'above';
  }

  create() {
    const C = CABINET;
    // Coming down from the arcade hall: start at the whole cabinet, no zoom from the maze level.
    this.mode = this.fromAbove ? 'insert' : 'intro';
    this.introT = this.fromAbove ? 1 : 0;
    this.t = 0;
    this.stickDir = null;
    this.keyDir = null;
    this.g = createGame();
    this.g.phase = 'attract';
    this.best = 0;
    try { this.best = Number(localStorage.getItem(BEST_KEY)) || 0; } catch (e) { /* private mode */ }

    this.add.rectangle(0, 0, GAME_WIDTH / C.zoom, GAME_HEIGHT / C.zoom, C.colors.room).setOrigin(0);
    this.add.rectangle(0, C.ground, GAME_WIDTH / C.zoom, GAME_HEIGHT / C.zoom - C.ground, C.colors.floor).setOrigin(0);
    this.add.image(0, 0, 'cabinet').setOrigin(0);

    // The game picture, redrawn into a canvas texture every frame.
    const { w, h } = screenSize(this.g);
    this.screenTex = this.textures.exists('cab-screen') ? this.textures.get('cab-screen') : this.textures.createCanvas('cab-screen', w, h);
    this.screenPos = { x: C.left + C.panelDepth / 2 + C.bezel.x, y: C.screenTop - C.panelDepth / 2 + C.bezel.y };
    this.add.image(this.screenPos.x, this.screenPos.y, 'cab-screen').setOrigin(0);
    this.art = (key) => {
      const src = this.textures.get(key).getSourceImage();
      src.__key = key;
      return src;
    };
    this.drawGlare(w, h);

    const mid = (C.left + C.right) / 2 + C.marqueeDepth / 2;
    this.add.text(mid, C.marqueeTop - C.marqueeDepth / 2 + 10, GAME_TITLE.toUpperCase(), {
      fontFamily: UI.arcadeFont, fontSize: 8, color: COLORS.textReady, resolution: 1,
    }).setOrigin(0.5, 0);
    this.stick = this.add.image(mid - 1, C.panelY - 8, 'stick-n').setOrigin(0.5, 27 / 32);

    this.prompt = this.add.text(GAME_WIDTH / C.zoom / 2, C.ground - 16, '', {
      fontFamily: UI.arcadeFont, fontSize: 8, color: COLORS.text, resolution: 1,
    }).setOrigin(0.5, 1);
    this.stickGfx = this.add.graphics();
    // Down one layer: zoom back into the screen, to the maze level.
    if (LAYERS.unlocked) {
      this.layerBtn = addLayerButton(this, 8, 8, 'LAYER\nDOWN', () => {
        if (this.mode !== 'outro') { sfx.frightOff(); this.mode = 'outro'; }
      });
      // Up one layer: the arcade hall this cabinet stands in.
      this.layerUpBtn = addLayerButton(this, 360 - 8 - 56, 8, 'LAYER\nUP', () => {
        if (this.mode !== 'outro' && this.mode !== 'gone') { sfx.frightOff(); this.mode = 'gone'; this.scene.start('Hall', { from: 'cabinet' }); }
      });
    }

    this.cam = this.cameras.main.setOrigin(0, 0).setRoundPixels(true);
    this.setIntro(this.introT);
    this.setupInput();
    this.setupPauseOnHide();
  }

  // A faint diagonal light band across the glass, in hard pixel steps.
  drawGlare(w, h) {
    const g = this.add.graphics().fillStyle(0xffffff, CABINET.glare);
    for (let y = 0; y < h; y += 2) {
      const x = Math.round(w * 0.55 - y * 0.6);
      if (x > -30 && x < w) g.fillRect(this.screenPos.x + Math.max(0, x), this.screenPos.y + y, Math.min(26, w - Math.max(0, x)), 2);
    }
  }

  // k: 0 = the screen fills the view exactly like the maze level, 1 = the whole cabinet.
  setIntro(k) {
    const e = 1 - (1 - k) ** 3;
    // At the maze level's zoom, put the picture's maze where the maze level drew its maze.
    // The picture is drawn at CABINET.screenTile px per tile, the maze level at PIXEL.tile, so r converts.
    const r = CABINET.screenTile / PIXEL.tile;
    const startW = GAME_WIDTH / PIXEL.zoom * r, endW = GAME_WIDTH / CABINET.zoom;
    const mazeLeft = Math.floor((startW - 19 * CABINET.screenTile) / 2);
    const startX = this.screenPos.x + 8 - mazeLeft, startY = this.screenPos.y + 40 - MAZE.top * r;
    const viewW = startW + (endW - startW) * e;
    this.cam.setZoom(GAME_WIDTH / viewW);
    this.cam.setScroll(startX * (1 - e), startY * (1 - e));
  }

  setupInput() {
    // Joystick: put a finger down anywhere and push; it clicks into one of four directions.
    this.anchor = null;
    this.input.on('pointerdown', (p, over) => {
      unlockAudio();
      if (this.mode === 'cleared') { this.scene.start('Menu'); return; }
      if (this.mode === 'intro') { this.introT = 1; return; } // tap to skip the zoom-out
      if (this.mode === 'outro' || (this.layerBtn && over.includes(this.layerBtn)) || (this.layerUpBtn && over.includes(this.layerUpBtn))) return;
      const wp = this.cam.getWorldPoint(p.x, p.y);
      const cd = CABINET.coinDoor, pad = 24;
      if (this.mode === 'insert' && wp.x > cd.x - pad && wp.x < cd.x + cd.w + pad && wp.y > cd.y - pad && wp.y < cd.y + cd.h + pad) {
        this.insertCoin();
        return;
      }
      this.anchor = { x: p.x, y: p.y, id: p.id };
    });
    this.input.on('pointermove', (p) => {
      if (!this.anchor || p.id !== this.anchor.id || !p.isDown) return;
      const dx = p.x - this.anchor.x, dy = p.y - this.anchor.y;
      let dir = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) >= CABINET.stickDeadzone) {
        dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      }
      this.setStick(dir);
      this.drawStick(p.x, p.y);
    });
    this.input.on('pointerup', (p) => {
      if (!this.anchor || p.id !== this.anchor.id) return;
      this.anchor = null;
      this.setStick(null);
      this.stickGfx.clear();
    });

    this.input.keyboard?.on('keydown', (e) => {
      unlockAudio();
      if ((e.code === 'Space' || e.code === 'Enter') && this.mode === 'insert') this.insertCoin();
      if ((e.code === 'Space' || e.code === 'Enter') && this.mode === 'cleared') this.scene.start('Menu');
      if (KEYS[e.code]) { this.keyDir = KEYS[e.code]; this.setStick(this.keyDir); }
    });
    this.input.keyboard?.on('keyup', (e) => {
      if (KEYS[e.code] === this.keyDir) { this.keyDir = null; this.setStick(null); }
    });
  }

  setStick(dir) {
    if (dir === this.stickDir) return;
    if (dir) sfx.click();
    this.stickDir = dir;
    this.stick.setTexture(`stick-${dir ?? 'n'}`);
  }

  // Where the finger is: a faint ring around the touch point and a knob, in art pixels.
  drawStick(x, y) {
    const z = this.cam.zoom, a = this.cam.getWorldPoint(this.anchor.x, this.anchor.y);
    const r = 70 / z;
    const kx = a.x + Phaser.Math.Clamp((x - this.anchor.x) / z, -r, r);
    const ky = a.y + Phaser.Math.Clamp((y - this.anchor.y) / z, -r, r);
    this.stickGfx.clear().lineStyle(2, 0xffffff, 0.25).strokeCircle(Math.round(a.x), Math.round(a.y), Math.round(r))
      .fillStyle(CABINET.colors.ball, 0.45).fillCircle(Math.round(kx), Math.round(ky), Math.round(30 / z));
  }

  insertCoin() {
    sfx.coin();
    this.g = createGame();
    this.mode = 'play';
    this.time.delayedCall(300, () => sfx.start());
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

  update(time, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    this.t += dt;

    if (this.mode === 'intro') {
      this.introT += dt / CABINET.introTime;
      this.setIntro(Math.min(1, this.introT));
      if (this.introT >= 1) this.mode = 'insert';
    }
    if (this.mode === 'outro') {
      this.introT -= dt / LAYERS.outroTime;
      this.setIntro(Math.max(0, this.introT));
      if (this.introT <= 0) { this.mode = 'gone'; this.scene.start('Game'); }
    }
    if (this.mode === 'play') {
      // A joystick is held, not swiped: keep steering while it's pushed.
      if (this.stickDir) steer(this.g, this.stickDir);
      for (const e of stepGame(this.g, dt)) this.handle(e);
    }

    const lines = [];
    if (this.mode === 'insert' || this.mode === 'intro') {
      if (this.g.phase === 'over') lines.push({ text: 'GAME OVER', color: '#ff0000', row: 13 });
      else if (Math.floor(this.t * 2) % 2) lines.push({ text: 'INSERT COIN', color: '#00ffde', row: 13 });
      lines.push({ text: 'CREDIT 0', row: 26 });
    }
    if (this.mode === 'cleared') lines.push({ text: 'MAZE CLEAR!', color: '#ffff00', row: 13 });
    drawScreen(this.screenTex.getContext(), this.g, this.art, this.t, lines, this.best);
    this.screenTex.refresh();

    const blink = Math.floor(this.t * 2) % 2 === 0;
    this.prompt.setText(this.mode === 'insert' && blink ? 'TAP THE COIN DOOR' : this.mode === 'cleared' ? 'TAP TO CONTINUE' : '');
  }

  handle(e) {
    switch (e.type) {
      case 'dot': sfx.dot(); break;
      case 'power': sfx.power(); sfx.frightOn(); break;
      case 'frightEnd': sfx.frightOff(); break;
      case 'ghost': sfx.ghost(); break;
      case 'death': sfx.frightOff(); sfx.death(); break;
      case 'clear': sfx.frightOff(); sfx.clear(); break;
      case 'over': this.mode = 'insert'; break;
      case 'cleared': this.mode = 'cleared'; break;
      default: break;
    }
  }
}
