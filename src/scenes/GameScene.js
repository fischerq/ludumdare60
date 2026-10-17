import { GAME_WIDTH, GAME_HEIGHT, COLORS, MAZE, PIXEL, RULES, INPUT, UI, BEST_KEY } from '../config.js';
import { createGame, stepGame, steer, DIRS } from '../systems/maze.js';
import { createSwipe, swipeInput } from '../systems/swipe.js';
import { sfx, unlockAudio, setAudioPaused } from '../sound.js';

const T = PIXEL.tile;
const ANGLE = { right: 0, down: 90, left: 180, up: 270 };
const KEYS = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down',
};

// The scene works in tile pixels (16 per tile, 360 across) and the camera scales it up by PIXEL.zoom with
// hard edges, so it looks like an arcade screen. Positions are rounded to whole tile pixels. Sprites are
// scaled to a PIXEL.sprite box whatever their native size.
export default class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    this.g = createGame();
    this.viewW = GAME_WIDTH / PIXEL.zoom;
    this.viewH = GAME_HEIGHT / PIXEL.zoom;
    this.ox = Math.floor((this.viewW - this.g.maze.w * T) / 2);
    this.oy = MAZE.top;
    this.leaving = false;
    this.cameras.main.setOrigin(0, 0).setZoom(PIXEL.zoom).setRoundPixels(true);

    this.mazeImage = this.add.image(this.ox, this.oy, 'maze').setOrigin(0);
    this.makePellets();

    this.pac = this.sprite(0, 0, 'pac-0');
    this.ghostSprites = this.g.ghosts.map((gh) => ({
      body: this.sprite(0, 0, 'ghost-0').setTint(COLORS.ghosts[gh.name]),
      eyes: this.sprite(0, 0, 'eyes-left'),
    }));
    // Black side borders hide actors while they pass through the tunnel, like the arcade screen.
    const mazeW = this.g.maze.w * T;
    this.add.rectangle(0, 0, this.ox, this.viewH, COLORS.background).setOrigin(0);
    this.add.rectangle(this.ox + mazeW, 0, this.viewW - this.ox - mazeW, this.viewH, COLORS.background).setOrigin(0);

    this.makeHud();
    this.setupInput();
    this.setupPauseOnHide();

    sfx.start();
    this.render(0);
  }

  // Tile center in art pixels.
  sx(x) { return Math.round(this.ox + x * T + T / 2); }
  sy(y) { return Math.round(this.oy + y * T + T / 2); }

  sprite(x, y, key) {
    return this.add.image(x, y, key).setScale(PIXEL.sprite / this.textures.get(key).getSourceImage().width);
  }

  // The pixel font at twice its native 8 px, so one font pixel is one sprite pixel of today's 16x16 art.
  text(x, y, str, color) {
    return this.add.text(x, y, str, { fontFamily: UI.arcadeFont, fontSize: 16, color, resolution: 1 });
  }

  makePellets() {
    this.pelletSprites = this.g.pellets.map((row, y) => row.map((kind, x) => {
      if (!kind) return null;
      return this.add.image(this.sx(x), this.sy(y), kind === 1 ? 'dot' : 'power');
    }));
    // Power pellets blink on and off, no fading.
    const power = this.pelletSprites.flat().filter((s) => s && s.texture.key === 'power');
    this.time.addEvent({ delay: 200, loop: true, callback: () => power.forEach((s) => s.active && s.setVisible(!s.visible)) });
  }

  makeHud() {
    this.text(32, 24, '1UP', COLORS.text);
    this.scoreText = this.text(32, 44, '00', COLORS.text);
    let best = 0;
    try { best = Number(localStorage.getItem(BEST_KEY)) || 0; } catch (e) { /* private mode */ }
    this.best = best;
    this.text(this.viewW - 32, 24, 'HIGH SCORE', COLORS.text).setOrigin(1, 0);
    this.bestText = this.text(this.viewW - 32, 44, String(best || '00'), COLORS.text).setOrigin(1, 0);

    const mazeBottom = this.oy + this.g.maze.h * T;
    this.readyText = this.text(this.sx(MAZE.houseExit.x), this.oy + 13 * T + 2, 'READY!', COLORS.textReady)
      .setOrigin(0.5, 0);
    this.hint = this.text(this.viewW / 2, mazeBottom + 88, 'SWIPE TO TURN', COLORS.textDim).setOrigin(0.5, 0);
    this.lifeIcons = [];
    for (let i = 0; i < RULES.lives - 1; i++) {
      this.lifeIcons.push(this.sprite(this.ox + 24 + i * 32, mazeBottom + 24, 'pac-2').setAngle(180));
    }
  }

  setupInput() {
    // Swipe anywhere, in screen pixels of the 720x1280 game.
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
      if (dir) this.turn(dir);
    });
    this.input.on('pointerup', (p) => swipes.delete(p.id));

    // Keyboard bonus for laptops.
    this.input.keyboard?.on('keydown', (e) => {
      unlockAudio();
      if (KEYS[e.code]) this.turn(KEYS[e.code]);
    });
  }

  turn(dir) {
    steer(this.g, dir);
    this.hint.setVisible(false);
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
    const dt = Math.min(delta / 1000, 0.05); // don't jump through walls after a hitch
    for (const e of stepGame(this.g, dt)) this.handle(e);
    this.render(time / 1000);
  }

  handle(e) {
    switch (e.type) {
      case 'dot':
      case 'power':
        this.pelletSprites[e.y][e.x]?.destroy();
        this.pelletSprites[e.y][e.x] = null;
        if (e.type === 'dot') sfx.dot(); else { sfx.power(); sfx.frightOn(); }
        break;
      case 'frightEnd': sfx.frightOff(); break;
      case 'ghost': {
        sfx.ghost();
        const t = this.text(this.sx(e.x), this.sy(e.y) - 8, String(e.points), '#00ffde').setOrigin(0.5, 0);
        this.time.delayedCall(RULES.ghostEatPause * 1000, () => t.destroy());
        break;
      }
      case 'death': sfx.frightOff(); sfx.death(); break;
      case 'clear': sfx.frightOff(); sfx.clear(); break;
      case 'over': this.finish(false); break;
      case 'cleared': this.finish(true); break;
      default: break;
    }
  }

  finish(cleared) {
    if (this.leaving) return;
    this.leaving = true;
    this.time.delayedCall(cleared ? 300 : 1200, () => {
      this.scene.start('GameOver', { score: this.g.score, cleared });
    });
  }

  render(time) {
    const g = this.g;
    const p = g.pac;
    this.scoreText.setText(String(g.score || '00'));
    if (g.score > this.best) this.bestText.setText(String(g.score));
    this.readyText.setVisible(g.phase === 'ready');
    this.lifeIcons.forEach((icon, i) => icon.setVisible(i < g.lives - 1));

    this.pac.setPosition(this.sx(p.x), this.sy(p.y));
    if (g.phase === 'dying') {
      const k = 1 - Math.max(0, g.phaseTime) / RULES.dyingTime;
      this.pac.setTexture(`pac-die-${Math.min(9, Math.floor(k * 12))}`).setVisible(k < 0.85).setAngle(270);
    } else {
      const cycle = [0, 1, 2, 3, 2, 1];
      const frame = g.phase === 'ready' ? 0 : cycle[Math.floor(p.moved * 4) % cycle.length];
      this.pac.setTexture(`pac-${frame}`).setVisible(true).setAngle(ANGLE[p.dir] ?? 0);
    }

    const skirt = Math.floor(time * 6) % 2;
    const flashing = g.fright > 0 && g.fright < RULES.frightFlashTime && Math.floor(time * 6) % 2 === 0;
    const hideGhosts = g.phase === 'dying' || g.phase === 'clearing' || g.phase === 'cleared';
    g.ghosts.forEach((gh, i) => {
      const { body, eyes } = this.ghostSprites[i];
      const x = this.sx(gh.x), y = this.sy(gh.y);
      const eyesOnly = gh.state === 'eyes' || gh.state === 'enter';
      body.setPosition(x, y).setVisible(!hideGhosts && !eyesOnly);
      eyes.setPosition(x, y).setVisible(!hideGhosts && !gh.frightened)
        .setTexture(`eyes-${DIRS[gh.dir] ? gh.dir : 'left'}`);
      if (gh.frightened) body.setTexture(`ghost-${flashing ? 'flash' : 'fright'}-${skirt}`).clearTint();
      else body.setTexture(`ghost-${skirt}`).setTint(COLORS.ghosts[gh.name]);
    });

    if (g.phase === 'clearing') {
      if (Math.floor(time * 5) % 2) this.mazeImage.setTintFill(COLORS.mazeFlash); else this.mazeImage.clearTint();
    }
  }
}
