import { GAME_WIDTH, GAME_HEIGHT, COLORS, UI, INPUT, DEEP, CHEATS } from '../config.js';
import { DEEP_LAYERS } from '../systems/layers/index.js';
import { createWalker, steerWalker, stepWalker } from '../systems/layers/walker.js';
import { createSwipe, swipeInput } from '../systems/swipe.js';
import { css } from '../systems/layers/tron.js';
import { world, setDriver, holdDir, onFrame } from '../systems/arcade/world.js';
import { sfx, unlockAudio, setAudioPaused } from '../sound.js';
import { addLayerButton } from '../layerButton.js';
import { showCallout } from '../callout.js';
import { progress } from '../progress.js';

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
    this.machine = world.machine;
    this.S = world.program.symbols;
    this.st = this.L.init({ m: this.machine, S: this.S });
    this.t = 0;
    this.got = 0;
    this.hits = 0;
    this.hitT = 0;
    this.leaving = false;
    this.player = createWalker(this.L.start.x, this.L.start.y);
    this.trail = [];   // light trail: { x, y, t } in tiles, visual only
    this.art = (key) => this.textures.get(key).getSourceImage();
    // The bot plays the maze game while we're down here, unless this layer steers the machine itself.
    setDriver('bot');
    if (this.L.drive) setDriver('player');
    this.sounds = [];   // the machine's sound commands since the last update
    const off = onFrame((m, sounds) => this.sounds.push(...sounds));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { off(); setDriver('bot'); });

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
    this.pac = this.add.image(0, 0, this.pacKey(0)).setScale((this.cell * 1.4) / this.textures.get(this.pacKey(0)).getSourceImage().width);

    const text = (x, y, s, color = COLORS.text, size = 8) => this.add.text(x, y, s, {
      fontFamily: UI.arcadeFont, fontSize: size, color, align: 'center', resolution: 1,
    }).setOrigin(0.5, 0).setLineSpacing(4);
    text(vw / 2, 12, `LAYER -${this.index + 1}: ${this.L.title}`, css(this.P.line));
    text(vw / 2, 30, this.L.subtitle, COLORS.textDim);
    this.counter = text(vw / 2, vh - BOTTOM + 8, '');

    const by = vh - 42;
    addLayerButton(this, 8, by, 'LAYER\nUP', () => this.go(this.index === 0 ? 'Game' : this.index - 1, 'up'));
    this.addDown = () => {
      if (this.downBtn || this.index >= DEEP_LAYERS.length - 1) return;
      this.downBtn = addLayerButton(this, vw - 64, by, 'LAYER\nDOWN', () => this.go(this.index + 1, 'down'));
    };
    if (CHEATS.enabled || (progress.depth ?? 0) > this.index) this.addDown();

    this.setupInput();
    this.setupPauseOnHide();
    // Arriving: zoom out of the layer above (or in from the layer below).
    const cam = this.cameras.main;
    cam.setZoom(ZOOM * (data.from === 'down' ? 0.6 : 2.5));
    cam.zoomTo(ZOOM, DEEP.transition * 1000, 'Sine.easeOut');
    cam.fadeIn(DEEP.transition * 1000);
  }

  go(target, way) {
    if (this.leaving) return;
    this.leaving = true;
    const cam = this.cameras.main, ms = DEEP.transition * 1000;
    cam.zoomTo(ZOOM * (way === 'down' ? 2.5 : 0.6), ms, 'Sine.easeIn');
    cam.fadeOut(ms);
    this.time.delayedCall(ms, () => {
      if (target === 'Game') this.scene.start('Game', { continue: true });
      else this.scene.start('Deep', { layer: target, from: way === 'down' ? 'up' : 'down' });
    });
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
      if (this.hitT <= 0) { Object.assign(this.player, createWalker(this.L.start.x, this.L.start.y)); this.trail = []; }
    } else {
      stepWalker(this.player, DEEP.walkSpeed * dt, open);
      const r = this.L.update(this.st, env);
      if (r === 'collect') { this.got++; sfx.dot(); if (this.got === this.L.goal) this.cleared(); }
      if (r === 'hit') { this.hits++; this.hitT = DEEP.hitPause; sfx.death(); }
    }
    if (this.L.drive) holdDir(this.L.drive(this.st, env));

    const ctx = this.canvas.getContext();
    ctx.imageSmoothingEnabled = false;
    this.L.draw(ctx, this.st, env, this.cell);
    this.canvas.refresh();

    const p = this.player, c = this.cell;
    const dir = p.dir ?? 'right';
    this.pac.setPosition(Math.round(this.ox + (p.x + 0.5) * c), Math.round(this.oy + (p.y + 0.5) * c))
      .setTexture(this.pacKey([0, 1, 2, 3, 2, 1][Math.floor(this.t * 12) % 6]))
      .setAngle({ right: 0, down: 90, left: 0, up: 270 }[dir]).setFlipX(dir === 'left')
      .setVisible(this.hitT <= 0 || Math.floor(this.t * 10) % 2 === 0);
    this.drawTrail();
    this.counter.setText(`${Math.min(this.got, this.L.goal)}/${this.L.goal}${this.hits ? `   HITS ${this.hits}` : ''}`);
  }

  // Tron light trail behind Pac-Man: the path of the last DEEP.trail seconds, fading out. Visual only.
  drawTrail() {
    const p = this.player, last = this.trail[this.trail.length - 1];
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

  // Goal reached: the next layer down opens.
  cleared() {
    progress.depth = Math.max(progress.depth ?? 0, this.index + 1);
    sfx.clear();
    const last = this.index >= DEEP_LAYERS.length - 1;
    const c = showCallout(this, GAME_WIDTH / ZOOM / 2, this.oy + 40, last ? 'LAYER CLEAR!\nYOU REACHED\nTHE BOTTOM' : 'LAYER CLEAR!\nGO DEEPER?', 1);
    this.time.delayedCall(2500, () => c.destroy());
    this.addDown();
  }
}
