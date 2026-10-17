import { GAME_WIDTH, GAME_HEIGHT, COLORS, MAZE, PIXEL, RULES, INPUT, UI, BEST_KEY, CHEATS } from '../config.js';
import { createGame, stepGame, steer } from '../systems/maze.js';
import { createSwipe, swipeInput } from '../systems/swipe.js';
import { sfx, unlockAudio, setAudioPaused } from '../sound.js';
import { addLayerButton } from '../layerButton.js';
import { showCallout } from '../callout.js';
import { progress } from '../progress.js';
import { world } from '../systems/arcade/world.js';
import { drawPlayfield } from '../systems/arcade/video.js';
import { writeShadow } from '../systems/arcade/shadow.js';

const T = PIXEL.tile;
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
    this.ended = false;
    this.upBtn = this.downBtn = this.soon = null;
    this.cameras.main.setOrigin(0, 0).setZoom(PIXEL.zoom).setRoundPixels(true);

    // The playfield is the arcade machine's picture: its video chip draws VRAM and the sprites into this
    // canvas every frame (and clips the tunnel like the arcade screen).
    this.machine = world.machine;
    this.screen = this.textures.exists('arcade-screen') ? this.textures.get('arcade-screen')
      : this.textures.createCanvas('arcade-screen', this.g.maze.w * T, this.g.maze.h * T);
    this.add.image(this.ox, this.oy, 'arcade-screen').setOrigin(0);
    this.art = (key) => this.textures.get(key).getSourceImage();

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
    this.mazeBottom = mazeBottom;
    this.addLayerButtons();
    if (CHEATS.enabled) {
      addLayerButton(this, 32, this.viewH - 38, 'CHEAT\nWIN', () => this.cheat(true));
      addLayerButton(this, 32 + 64, this.viewH - 38, 'CHEAT\nLOSE', () => this.cheat(false));
    }
    this.lifeIcons = [];
    for (let i = 0; i < RULES.lives - 1; i++) {
      this.lifeIcons.push(this.sprite(this.ox + 24 + i * 32, mazeBottom + 24, 'maze/life'));
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

  // The layer buttons the player has unlocked so far (they appear as soon as a layer unlocks).
  addLayerButtons() {
    const y = this.mazeBottom + 8, upX = this.viewW - 24 - 112;
    if (progress.cabinet && !this.upBtn) {
      // Up one layer: zoom out to the cabinet.
      this.upBtn = addLayerButton(this, upX, y, 'LAYER\nUP', () => this.leave('Cabinet'), 2);
    }
    if (progress.deeper && !this.downBtn) {
      // Down one layer: into the screen. Not built yet.
      this.downBtn = addLayerButton(this, upX - 116, y, 'LAYER\nDOWN', () => {
        if (this.soon) return;
        this.soon = showCallout(this, this.viewW / 2, this.oy + 6 * T, 'INSIDE THE SCREEN:\nCOMING SOON');
        this.time.delayedCall(1500, () => { this.soon.destroy(); this.soon = null; });
      }, 2);
    }
  }

  leave(scene) {
    if (this.leaving) return;
    this.leaving = true;
    this.scene.start(scene);
  }

  // Cheat buttons: end the round as if the maze was cleared or the last life lost.
  cheat(won) {
    if (this.ended) return;
    sfx.frightOff();
    this.g.phase = won ? 'cleared' : 'over';
    this.finish(won);
  }

  // The round is over. The outer game loop: the first win unlocks the layer below, the first loss the cabinet
  // above ("insert coin"). Either way the player stays on the maze; tap to play again.
  finish(cleared) {
    if (this.ended) return;
    this.ended = true;
    this.saveBest();
    let text = cleared ? 'MAZE CLEAR!' : 'GAME OVER';
    if (cleared && !progress.deeper) { progress.deeper = true; text += '\n\nWANT TO GO\nDEEPER?'; }
    if (!cleared && !progress.cabinet) { progress.cabinet = true; text += '\n\nINSERT COIN'; }
    this.addLayerButtons();
    showCallout(this, this.viewW / 2, this.oy + 12 * T, `${text}\n\nTAP TO PLAY AGAIN`);
    // Short delay so the swipe that ended the round doesn't restart it at once.
    this.time.delayedCall(600, () => {
      this.input.on('pointerdown', (p, over) => { if (!over.length && !this.leaving) this.scene.restart(); });
      const again = () => { if (!this.leaving) this.scene.restart(); };
      this.input.keyboard?.once('keydown-SPACE', again);
      this.input.keyboard?.once('keydown-ENTER', again);
    });
  }

  saveBest() {
    try {
      localStorage.setItem(BEST_KEY, String(Math.max(this.g.score, Number(localStorage.getItem(BEST_KEY)) || 0)));
    } catch (e) { /* private mode */ }
  }

  render(time) {
    const g = this.g;
    this.scoreText.setText(String(g.score || '00'));
    if (g.score > this.best) this.bestText.setText(String(g.score));
    this.readyText.setVisible(g.phase === 'ready');
    this.lifeIcons.forEach((icon, i) => icon.setVisible(i < g.lives - 1));

    // Shadow mode: the JS rules write their state into the machine, the machine's video chip draws it.
    writeShadow(this.machine, g, time);
    drawPlayfield(this.screen.getContext(), this.machine, this.art);
    this.screen.refresh();
  }
}
