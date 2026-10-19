import { GAME_TITLE, GAME_WIDTH, GAME_HEIGHT, COLORS, CABINET, MAZE, PIXEL, UI, BEST_KEY, LAYERS, COINS } from '../config.js';
import { world, setDriver, insertCoin as coinPulse } from '../systems/arcade/world.js';
import { readState } from '../systems/arcade/state.js';
import { drawScreen, screenSize } from '../systems/screenImage.js';
import { sfx, unlockAudio, setAudioPaused, setBed } from '../sound.js';
import { addLayerButtonAt } from '../layerButton.js';
import { coins, spendCoin } from '../wallet.js';
import { showCallout } from '../callout.js';
import { fxOn } from '../systems/anim.js';
import { createMech, stepMech, tapMech, armState, magnetState, coinPos } from '../systems/coinmech.js';

// Layer 2, zoom out: the arcade cabinet the maze game runs in. Pixel art with faked depth (see CABINET in
// config). Starts zoomed in so the screen looks exactly like the maze level, then pulls back to show the whole
// machine. Nobody plays here: the bot plays on a running game, and when the machine asks for a coin, a coin in
// the door opens the coin minigame (the coin mechanism behind the door); a coin it takes zooms back into a fresh
// game.
export default class CabinetScene extends Phaser.Scene {
  constructor() {
    super('Cabinet');
  }

  init(data) {
    this.fromAbove = data?.from === 'above';
    // From the maze's game over (the INSERT COIN button): open the coin mechanism as soon as the zoom-out ends.
    this.coinNext = !!data?.coin;
  }

  create() {
    setBed('cabinet');
    const C = CABINET;
    // Coming down from the arcade hall: start at the whole cabinet, no zoom from the maze level.
    this.mode = this.fromAbove ? 'insert' : 'intro';
    this.introT = this.fromAbove ? 1 : 0;
    this.t = 0;
    // The screen shows the one emulated machine. Nobody is at the controls while we look at the cabinet from
    // outside: a running game is played on by the bot; a finished one stands halted at GAME OVER until a coin
    // goes in. Without a paid game (attract mode, or the bot's own game since boot) it waits for a coin too.
    this.machine = world.machine;
    this.S = world.program.symbols;
    this.credit = 0;
    setDriver('bot');
    if (!world.paidGame) world.halted = true;
    this.best = 0;
    try { this.best = Number(localStorage.getItem(BEST_KEY)) || 0; } catch (e) { /* private mode */ }

    this.add.rectangle(0, 0, GAME_WIDTH / C.zoom, GAME_HEIGHT / C.zoom, C.colors.room).setOrigin(0);
    this.add.rectangle(0, C.ground, GAME_WIDTH / C.zoom, GAME_HEIGHT / C.zoom - C.ground, C.colors.floor).setOrigin(0);
    this.add.image(0, 0, 'cabinet/machine').setOrigin(0);

    // The game picture, redrawn into a canvas texture every frame.
    const { w, h } = screenSize();
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
    this.add.image(mid - 1, C.panelY - 8, 'cabinet/stick-n').setOrigin(0.5, 27 / 32);

    this.makePrompt();
    this.makeCounter();
    this.makeMech();
    // Down one layer: zoom back into the screen and go on with the machine's game on the maze level.
    this.layerBtn = addLayerButtonAt(this, 'down', () => {
      if (this.mode === 'insert' || this.mode === 'intro') { sfx.frightOff(); this.layerDown({ continue: true }); }
    }, { zoom: CABINET.zoom });
    // Up one layer: the arcade hall this cabinet stands in, where the coins are.
    this.layerUpBtn = addLayerButtonAt(this, 'up', () => this.layerUp(), { zoom: CABINET.zoom });

    this.cam = this.cameras.main.setOrigin(0, 0).setRoundPixels(true);
    this.setIntro(this.introT);
    this.setupInput();
    this.setupPauseOnHide();
  }

  // The call to action, right under the coin door: a black box in a loud color with an arrow up to the door,
  // and a blinking frame around the door itself.
  makePrompt() {
    const C = CABINET, cd = C.coinDoor, cx = cd.x + cd.w / 2;
    const col = Phaser.Display.Color.HexStringToColor(C.promptColor).color;
    const bw = 168, bh = 44, by = cd.y + cd.h + 14;
    this.doorFrame = this.add.graphics().lineStyle(2, col, 1).strokeRect(cd.x - 3, cd.y - 3, cd.w + 6, cd.h + 6);
    this.promptBox = this.add.graphics()
      .fillStyle(col, 1).fillTriangle(cx - 7, by, cx + 7, by, cx, by - 9)
      .fillStyle(C.promptBox, 1).fillRect(cx - bw / 2, by, bw, bh)
      .lineStyle(2, col, 1).strokeRect(cx - bw / 2 + 1, by + 1, bw - 2, bh - 2);
    this.prompt = this.add.text(cx, by + bh / 2, '', {
      fontFamily: UI.arcadeFont, fontSize: 16, color: C.promptColor, align: 'center', resolution: 1,
    }).setOrigin(0.5).setLineSpacing(6);
  }

  // Coins held (shared with the hall), top center.
  makeCounter() {
    const x = 180, y = 23;
    this.add.graphics().fillStyle(0x000000, 1).fillRect(x - 40, y - 15, 80, 30);
    this.counterCoin = this.add.image(x - 22, y, 'arcade/coin');
    this.counter = this.add.text(x - 8, y + 1, '', {
      fontFamily: UI.arcadeFont, fontSize: 16, color: CABINET.counterColor, resolution: 1,
    }).setOrigin(0, 0.5);
    this.showCoins();
  }

  showCoins() {
    this.counter.setText(`${coins()}`);
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
    this.input.on('pointerdown', (p, over) => {
      unlockAudio();
      if (this.mode === 'mech') { this.mechDown(p, over); return; }
      if (this.mode === 'intro') { this.introT = 1; return; } // tap to skip the zoom-out
      if (!this.waiting() || over.length) return; // a layer button, or the machine isn't asking for a coin
      const wp = this.cam.getWorldPoint(p.x, p.y);
      const cd = CABINET.coinDoor, pad = 24;
      if (wp.x > cd.x - pad && wp.x < cd.x + cd.w + pad && wp.y > cd.y - pad && wp.y < cd.y + cd.h + pad) this.insertCoin();
    });
    // Flicking the coin into the slot: a swipe (or a tap, let go) while it's in hand.
    this.input.on('pointermove', (p) => {
      if (this.mode !== 'mech' || !this.flickFrom || !p.isDown) return;
      if (Math.hypot(p.x - this.flickFrom.x, p.y - this.flickFrom.y) >= CABINET.coinMech.flickMin) this.mechTap();
    });
    this.input.on('pointerup', () => {
      if (this.mode === 'mech' && this.flickFrom) this.mechTap();
    });
    this.input.keyboard?.on('keydown', (e) => {
      unlockAudio();
      if (e.code !== 'Space' && e.code !== 'Enter') return;
      if (this.mode === 'mech') this.mechTap();
      else if (this.waiting()) this.insertCoin();
    });
  }

  // The machine asks for a coin only when it's halted (game over, or never started); a running game takes none.
  waiting() {
    return this.mode === 'insert' && world.halted;
  }

  // Zoom back into the screen, then the maze level takes over (data goes to GameScene).
  layerDown(data) {
    this.mode = 'outro';
    this.downData = data;
  }

  // Tapping the coin door with a coin in hand opens the coin minigame. The coin is spent only when the coin
  // switch takes it (see mechSwitch); a rejected coin comes back.
  insertCoin() {
    if (coins() < COINS.perGame) {
      sfx.click();
      this.noCoinT = this.t;
      this.needCoins();
      return;
    }
    this.callout?.destroy();
    this.callout = null;
    sfx.click();
    this.zoomDoor(true, () => {
      const P = CABINET.coinMech;
      this.mech = createMech(P, Math.random() * 10);
      this.mechEnd = null;
      this.flickFrom = null;
      this.mechSwitch.setTexture('cabinet/coinmech-switch-up');
      this.mechPulse.setVisible(false);
      this.mode = 'mech';
      this.cam.setZoom(P.zoom).setScroll(P.originX, 0);
      this.cam.fadeIn(150);
    });
  }

  // The camera between the whole cabinet (k 0) and the coin door filling the view (k 1), over zoomInTime; done
  // runs at the end. Coming back out it starts at the door.
  zoomDoor(inward, done) {
    const C = CABINET, cd = C.coinDoor, viewW = cd.w * 1.6, viewH = viewW * GAME_HEIGHT / GAME_WIDTH;
    const door = { x: cd.x + cd.w / 2 - viewW / 2, y: cd.y + cd.h / 2 - viewH / 2 };
    const set = (k) => {
      const e = k * k * (3 - 2 * k), w = GAME_WIDTH / C.zoom + (viewW - GAME_WIDTH / C.zoom) * e;
      this.cam.setZoom(GAME_WIDTH / w).setScroll(door.x * e, door.y * e);
    };
    this.mode = 'zoom';
    set(inward ? 0 : 1);
    if (!inward) this.cam.fadeIn(150);
    this.tweens.addCounter({
      from: inward ? 0 : 1, to: inward ? 1 : 0, duration: C.coinMech.zoomInTime * 1000,
      onUpdate: (tw) => set(tw.getValue()), onComplete: done,
    });
  }

  // The coin mechanism, built once far right in the world; the camera moves there for the minigame.
  makeMech() {
    const P = CABINET.coinMech, ox = P.originX, at = (x, y) => [ox + x, y];
    this.add.image(ox, 0, 'cabinet/coinmech-bg').setOrigin(0);
    this.mechSwitch = this.add.image(...at(P.switchAt.x, P.switchAt.y), 'cabinet/coinmech-switch-up');
    this.mechCoin = this.add.image(...at(P.hand.x, P.hand.y), 'cabinet/coinmech-coin-0');
    this.mechArm = this.add.image(...at(P.arm.x, P.arm.y), 'cabinet/coinmech-arm-in');
    this.mechMagnet = this.add.image(...at(P.magnet.x, P.magnet.y - 26), 'cabinet/coinmech-magnet-off');
    this.mechPulse = this.add.image(...at(...P.wire[0]), 'cabinet/coinmech-pulse').setVisible(false);
    this.mechText = this.add.text(...at(P.w / 2, P.textY), '', {
      fontFamily: UI.arcadeFont, fontSize: 8, color: P.textColor, align: 'center', resolution: 1,
    }).setOrigin(0.5).setLineSpacing(6);
    // Back out without a coin going in (the coin stays in hand): a big box top right.
    const bx = ox + P.w - 86, by = 6, bw = 40, bh = 20; // left of the page's sound button
    this.add.graphics().fillStyle(0x000000, 1).fillRect(bx, by, bw, bh).lineStyle(1, 0xffffff, 1).strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    this.add.text(bx + bw / 2, by + bh / 2 + 1, 'BACK', { fontFamily: UI.arcadeFont, fontSize: 8, color: '#ffffff', resolution: 1 }).setOrigin(0.5);
    this.add.zone(bx - 4, by - 4, bw + 8, bh + 8).setOrigin(0).setInteractive().on('pointerdown', () => {
      if (this.mode === 'mech' && ['hand', 'hold', 'returned'].includes(this.mech.phase)) this.closeMech(false);
    });
  }

  mechDown(p, over) {
    if (over.length) return; // the back button
    if (this.mech.phase === 'hand') this.flickFrom = { x: p.x, y: p.y };
    else this.mechTap();
  }

  mechTap() {
    this.flickFrom = null;
    const ev = tapMech(this.mech, CABINET.coinMech);
    if (ev) sfx.click();
  }

  // Back out to the whole cabinet: with the coin taken (CREDIT 1, then the zoom into a fresh game) or not.
  closeMech(paid) {
    this.cam.setScroll(0, 0);
    this.zoomDoor(false, () => {
      this.setIntro(1);
      if (!paid) { this.mode = 'insert'; return; }
      this.mode = 'coin';
      this.credit = 1;
      this.showCoins();
      this.tweens.add({ targets: this.counter, scale: 1.4, duration: 90, yoyo: true });
      // The coin is paid here, so the maze level starts its game without taking another.
      this.time.delayedCall(COINS.startDelay * 1000, () => this.layerDown({ coined: true }));
    });
  }

  // The coin pressed the coin switch: it's spent, and a pulse runs down the wire to the board (IN0's COIN bit).
  mechSwitched() {
    const P = CABINET.coinMech;
    if (!spendCoin()) { this.closeMech(false); return; }
    sfx.coin();
    // The real coin bit: the program sees IN0's COIN go low and starts a fresh game itself (new_game in
    // game.asm). No power cycle, so whatever the deep layers changed in the machine stays.
    coinPulse();
    world.paidGame = true;
    this.mechSwitch.setTexture('cabinet/coinmech-switch-down');
    const pts = P.wire.map(([x, y]) => ({ x: P.originX + x, y }));
    const lens = pts.slice(1).map((q, i) => Math.hypot(q.x - pts[i].x, q.y - pts[i].y)), total = lens.reduce((a, b) => a + b, 0);
    this.mechPulse.setPosition(pts[0].x, pts[0].y).setVisible(true);
    this.tweens.addCounter({
      from: 0, to: total, duration: P.pulseTime * 1000,
      onUpdate: (tw) => {
        let d = tw.getValue(), i = 0;
        while (i < lens.length - 1 && d > lens[i]) d -= lens[i++];
        const k = Math.min(1, d / lens[i]);
        this.mechPulse.setPosition(Math.round(pts[i].x + (pts[i + 1].x - pts[i].x) * k), Math.round(pts[i].y + (pts[i + 1].y - pts[i].y) * k));
      },
      onComplete: () => { this.mechPulse.setVisible(false); this.time.delayedCall(P.doneDelay * 1000, () => this.closeMech(true)); },
    });
  }

  updateMech(dt) {
    const P = CABINET.coinMech, m = this.mech;
    for (const ev of stepMech(m, dt, P)) {
      if (ev === 'switch') this.mechSwitched();
      else if (ev.startsWith('reject')) { sfx.alert(); this.cam.shake(120, 0.004); }
    }
    const c = coinPos(m, P);
    this.mechCoin.setPosition(P.originX + Math.round(c.x), Math.round(c.y))
      .setTexture(`cabinet/coinmech-coin-${Math.floor(m.s / 6) % 2}`);
    this.mechArm.setTexture(`cabinet/coinmech-arm-${armState(m, P)}`);
    this.mechMagnet.setTexture(`cabinet/coinmech-magnet-${magnetState(m, P)}`);
    const T = P.text, failed = m.phase === 'reject' || m.phase === 'returned';
    const text = failed ? T[m.fail] : m.phase === 'switch' ? T.ok : m.phase === 'hand' ? T.hand : m.phase === 'hold' ? T.hold : T.roll;
    this.mechText.setText(text).setColor(failed ? P.failColor : m.phase === 'switch' ? P.okColor : P.textColor);
  }

  layerUp() {
    if (this.mode === 'insert' || this.mode === 'intro') { sfx.frightOff(); this.mode = 'gone'; this.scene.start('Hall', { from: 'cabinet' }); }
  }

  // Out of coins: point the player up to the arcade hall, where the coins are.
  needCoins() {
    this.callout ??= showCallout(this, this.screenPos.x + 84, this.screenPos.y + 100, 'NEED COINS?', 1,
      { label: 'LAYER UP', onTap: () => this.layerUp() });
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
      if (this.introT >= 1) {
        this.mode = 'insert';
        if (this.coinNext && this.waiting()) this.insertCoin();
        this.coinNext = false;
      }
    }
    if (this.mode === 'mech') this.updateMech(dt);
    if (this.mode === 'outro') {
      this.introT -= dt / LAYERS.outroTime;
      this.setIntro(Math.max(0, this.introT));
      if (this.introT <= 0) { this.mode = 'gone'; this.scene.start('Game', this.downData); }
    }

    // A halted machine waits for a coin; once one drops in it shows the credit until we're back in the maze.
    const lines = [];
    if (world.halted && (this.mode !== 'outro' || this.credit)) {
      // With a credit in, the credit line is enough (the halted picture may already show READY!).
      if (!this.credit && readState(this.machine, this.S).phase === 'over') lines.push({ text: 'GAME OVER', color: '#ff0000', row: 13, box: true });
      else if (!this.credit) lines.push({ text: fxOn('insertCoin', this.t) ? '' : 'INSERT COIN', color: '#00ffde', row: 13, box: true });
      lines.push({ text: `CREDIT ${this.credit}`, row: 26 });
    }
    drawScreen(this.screenTex.getContext(), this.machine, this.S, this.art, lines, this.best);
    this.screenTex.refresh();

    const insert = this.waiting(), broke = coins() < COINS.perGame;
    if (insert && broke) this.needCoins();
    this.prompt.setText(broke ? 'NO COINS\nLAYER UP' : 'TAP THE\nCOIN DOOR');
    // Shake the prompt a moment when the door is tapped with no coins.
    const shake = this.noCoinT !== undefined && this.t - this.noCoinT < 0.3;
    this.prompt.setX((CABINET.coinDoor.x + CABINET.coinDoor.w / 2) + (shake ? Math.round(Math.sin(this.t * 60) * 3) : 0));
    this.prompt.setVisible(insert);
    this.promptBox.setVisible(insert);
    this.doorFrame.setVisible(insert && !broke && Math.floor(this.t * 3) % 2 === 0);
  }

}
