import { GAME_WIDTH, GAME_HEIGHT, COLORS, UI, INPUT, DEEP, LOBBY } from '../config.js';
import { DEEP_LAYERS } from '../systems/layers/index.js';
import { createWalker, steerWalker, stepWalker } from '../systems/layers/walker.js';
import { createSwipe, swipeInput } from '../systems/swipe.js';
import { css } from '../systems/layers/tron.js';
import { world, setDriver, holdDir, onFrame, setSpeed } from '../systems/arcade/world.js';
import { sfx, unlockAudio, setAudioPaused, setBed } from '../sound.js';
import { addLayerButtonAt } from '../layerButton.js';
import { showCallout } from '../callout.js';
import { markWon } from '../progress.js';

const KEYS = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down',
};
const ZOOM = 2;              // screen px per art px, like the maze level
const TOP = 72, BOTTOM = 84; // art px for the title above and the buttons below the play area

// One scene for all the deep layers below the maze: data.layer picks the module from src/systems/layers/.
// Each layer is a different view of the one emulated machine; the scene adds the walking player, swipes,
// the counters and the layer buttons, and draws the layer's world into a canvas every frame.
export default class DeepScene extends Phaser.Scene {
  constructor() {
    super('Deep');
  }

  create(data = {}) {
    this.index = Phaser.Math.Clamp(data.layer ?? 0, 0, DEEP_LAYERS.length - 1);
    this.L = DEEP_LAYERS[this.index];
    this.P = DEEP.style[this.L.id];
    setBed(this.L.id);
    this.machine = world.machine;
    this.S = world.program.symbols;
    this.st = this.L.init({ m: this.machine, S: this.S });
    this.t = 0;
    this.got = 0;      // objectives done (the layer is won at L.goal, 3 to 5)
    this.dots = 0;     // dots eaten (just counted)
    this.hits = 0;
    this.hitT = 0;
    this.glowT = 0;    // Pac-Man glows after a pickup (layers with pac-glow art)
    this.leaving = false;
    this.player = createWalker(this.L.start.x, this.L.start.y);
    this.trail = [];   // light trail: { x, y, t } in tiles, visual only
    this.art = (key) => this.textures.get(key).getSourceImage();
    // The bot plays the maze game while we're down here, unless this layer steers the machine itself.
    setDriver('bot');
    if (this.L.drive) setDriver('player');
    this.sounds = [];   // the machine's sound commands since the last update
    const off = onFrame((m, sounds) => this.sounds.push(...sounds));
    // Down here we play with the signals that make each frame, so the machine runs DEEP.machineSlowdown times slower.
    setSpeed(1 / DEEP.machineSlowdown);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { off(); setDriver('bot'); setSpeed(1); });

    const vw = GAME_WIDTH / ZOOM, vh = GAME_HEIGHT / ZOOM;
    this.cameras.main.setZoom(ZOOM).setOrigin(0, 0).setRoundPixels(true).setBackgroundColor(this.P.bg);
    this.cell = Math.floor(Math.min((vw - 16) / this.L.cols, (vh - TOP - BOTTOM) / this.L.rows));
    const w = this.L.cols * this.cell, h = this.L.rows * this.cell;
    this.ox = Math.floor((vw - w) / 2);
    this.oy = TOP + Math.floor((vh - TOP - BOTTOM - h) / 2);
    const key = `deep-${this.L.id}`;
    this.canvas = this.textures.exists(key) ? this.textures.get(key) : this.textures.createCanvas(key, w, h);
    this.add.image(this.ox, this.oy, key).setOrigin(0);
    // The arena's neon edge, and the light trail above the layer, under Pac-Man.
    this.add.graphics().lineStyle(3, this.P.glow).strokeRect(this.ox - 2.5, this.oy - 2.5, w + 5, h + 5)
      .lineStyle(1, this.P.line).strokeRect(this.ox - 2.5, this.oy - 2.5, w + 5, h + 5);
    this.trailG = this.add.graphics();
    this.pacKey = (i) => `deep/${this.L.id}/pac-${i}`;
    this.glowKey = (i) => `deep/${this.L.id}/pac-glow-${i}`;
    this.hasGlow = this.textures.exists(this.glowKey(0));
    this.pacScale = (this.cell * 1.4) / this.textures.get(this.pacKey(0)).getSourceImage().width;
    this.pac = this.add.image(0, 0, this.pacKey(0)).setScale(this.pacScale);

    const text = (x, y, s, color = COLORS.text, size = 8) => this.add.text(x, y, s, {
      fontFamily: UI.arcadeFont, fontSize: size, color, align: 'center', resolution: 1,
    }).setOrigin(0.5, 0).setLineSpacing(4);
    // Centered in the space left of the sound button (top-right corner); long subtitles wrap.
    const tw = vw - 68, tx = 8 + tw / 2;
    text(tx, 12, this.L.title, css(this.P.line));
    text(tx, 30, this.L.subtitle, COLORS.textDim).setWordWrapWidth(tw);
    this.counter = text(vw / 2, vh - BOTTOM + 8, '');
    this.info = text(vw / 2, vh - BOTTOM + 22, '', COLORS.textDim);

    // Only up: back out into the board lobby inside the cabinet (each layer is entered from its subsystem there).
    addLayerButtonAt(this, 'up', () => this.go({ from: this.L.id }), { zoom: ZOOM });

    this.setupInput();
    this.setupPauseOnHide();
    // Arriving from the lobby: zoom out of the subsystem.
    const cam = this.cameras.main;
    cam.setZoom(ZOOM * 2.5);
    cam.zoomTo(ZOOM, DEEP.transition * 1000, 'Sine.easeOut');
    cam.fadeIn(DEEP.transition * 1000);
  }

  // Back up to the board lobby (lobby: its scene data), zooming out and fading.
  go(lobby) {
    if (this.leaving) return;
    this.leaving = true;
    const cam = this.cameras.main, ms = DEEP.transition * 1000;
    cam.zoomTo(ZOOM * 0.6, ms, 'Sine.easeIn');
    cam.fadeOut(ms);
    this.time.delayedCall(ms, () => this.scene.start('Lobby', lobby));
  }

  setupInput() {
    const swipes = new Map();
    this.input.on('pointerdown', (p) => {
      unlockAudio();
      const s = createSwipe();
      swipeInput(s, { x: p.x, y: p.y }, INPUT.swipeMin);
      swipes.set(p.id, s);
    });
    this.input.on('pointermove', (p) => {
      const s = swipes.get(p.id);
      if (!p.isDown || !s) return;
      const dir = swipeInput(s, { x: p.x, y: p.y }, INPUT.swipeMin);
      if (dir) steerWalker(this.player, dir);
    });
    this.input.on('pointerup', (p) => swipes.delete(p.id));
    this.input.keyboard?.on('keydown', (e) => {
      unlockAudio();
      if (KEYS[e.code]) steerWalker(this.player, KEYS[e.code]);
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
    });
  }

  update(time, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    this.t += dt;
    const env = { id: this.L.id, P: this.P, m: this.machine, S: this.S, t: this.t, dt, player: this.player, sounds: this.sounds.splice(0), art: this.art };
    const open = (x, y) => this.L.open(this.st, env, x, y);
    if (this.hitT > 0) {
      this.hitT -= dt;
      if (this.hitT <= 0) { Object.assign(this.player, createWalker(this.L.start.x, this.L.start.y)); this.trail = []; this.L.onRespawn?.(this.st, env); }
    } else {
      stepWalker(this.player, (this.L.walkSpeed ?? DEEP.walkSpeed) * dt, open);
      // A layer's update returns 'dot', 'objective', 'bonus', 'pickup' (feedback only), 'hit' or nothing for this frame.
      const r = this.L.update(this.st, env);
      if (r === 'dot') { this.dots++; sfx.dot(); }
      if (r === 'objective') { this.got++; sfx.power(); if (this.got === this.L.goal) this.cleared(); }
      if (r === 'bonus') sfx.ghost();
      if (r === 'pickup') sfx.power();
      if (r === 'dot' || r === 'objective' || r === 'bonus' || r === 'pickup') this.glowT = DEEP.glowTime;
      if (r === 'hit') { this.hits++; this.hitT = DEEP.hitPause; sfx.death(); this.L.onHit?.(this.st, env); }
    }
    if (this.L.drive) holdDir(this.L.drive(this.st, env));

    const ctx = this.canvas.getContext();
    ctx.imageSmoothingEnabled = false;
    this.L.draw(ctx, this.st, env, this.cell);
    this.canvas.refresh();

    const p = this.player, c = this.cell;
    const dir = p.dir ?? 'right';
    this.glowT = Math.max(0, this.glowT - dt);
    const glowing = this.hasGlow && this.glowT > 0, frame = [0, 1, 2, 3, 2, 1][Math.floor(this.t * 12) % 6];
    this.pac.setPosition(Math.round(this.ox + (p.x + 0.5) * c), Math.round(this.oy + (p.y + 0.5) * c))
      .setTexture(glowing ? this.glowKey(frame) : this.pacKey(frame))
      .setScale(this.pacScale * (1 + (glowing ? DEEP.glowPop * (this.glowT / DEEP.glowTime) : 0)))
      .setAngle({ right: 0, down: 90, left: 0, up: 270 }[dir]).setFlipX(dir === 'left')
      .setVisible(this.hitT <= 0 || Math.floor(this.t * 10) % 2 === 0);
    this.drawTrail();
    const count = this.L.counter?.(this.st, env) ?? `GOALS ${Math.min(this.got, this.L.goal)}/${this.L.goal}${this.L.dots === false ? '' : `   DOTS ${this.dots}`}`;
    this.counter.setText(`${count}${this.hits ? `   HITS ${this.hits}` : ''}`);
    this.info.setText(this.L.info?.(this.st, env) ?? '');
  }

  // Tron light trail behind Pac-Man: the path of the last DEEP.trail seconds, fading out. Visual only.
  drawTrail() {
    const p = this.player, last = this.trail[this.trail.length - 1];
    if (last && Math.abs(last.x - p.x) + Math.abs(last.y - p.y) > 1.5) this.trail = []; // warped: start a new trail
    if (!last || last.x !== p.x || last.y !== p.y) this.trail.push({ x: p.x, y: p.y, t: this.t });
    while (this.trail.length && this.t - this.trail[0].t > DEEP.trail) this.trail.shift();
    const g = this.trailG.clear(), c = this.cell, at = (v, o) => Math.round(o + (v + 0.5) * c);
    for (const [width, color] of [[DEEP.trailWidth + 2, this.P.glow], [DEEP.trailWidth, this.P.line]]) {
      for (let i = 1; i < this.trail.length; i++) {
        const a = this.trail[i - 1], b = this.trail[i];
        g.lineStyle(width, color, 1 - (this.t - b.t) / DEEP.trail);
        g.lineBetween(at(a.x, this.ox), at(a.y, this.oy), at(b.x, this.ox), at(b.y, this.oy));
      }
    }
  }

  // Goal reached: the layer is won (src/progress.js), which wakes the next subsystem; back to the lobby.
  cleared() {
    sfx.clear();
    const next = markWon(this.L.id);
    const woke = next ? `\n${LOBBY.names[next]}\nWOKE UP` : '';
    showCallout(this, GAME_WIDTH / ZOOM / 2, this.oy + 40, `LAYER CLEAR!${woke}`, 1);
    this.time.delayedCall(LOBBY.clearDelay * 1000, () => this.go({ from: this.L.id, won: true }));
  }
}
