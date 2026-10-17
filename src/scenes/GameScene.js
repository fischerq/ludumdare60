import { GAME_WIDTH, GAME_HEIGHT, COLORS, MAZE, PIXEL, RULES, INPUT, UI, BEST_KEY, CHEATS } from '../config.js';
import { createSwipe, swipeInput } from '../systems/swipe.js';
import { sfx, unlockAudio, setAudioPaused } from '../sound.js';
import { addLayerButton } from '../layerButton.js';
import { showCallout } from '../callout.js';
import { progress } from '../progress.js';
import { world, onFrame, pressDir, pressStart, setDriver, newGame } from '../systems/arcade/world.js';
import { drawPlayfield, W, H } from '../systems/arcade/video.js';
import { readState, pokePhase } from '../systems/arcade/state.js';

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

  // The maze game runs on the emulated arcade machine (src/systems/arcade/game.asm): this scene shows its
  // picture, reads its RAM for the HUD, plays its sound commands and presses its joystick.
  // data.continue: coming back from another layer, keep playing the machine's current game.
  create(data = {}) {
    this.machine = world.machine;
    this.S = world.program.symbols;
    this.g = readState(this.machine, this.S);
    this.viewW = GAME_WIDTH / PIXEL.zoom;
    this.viewH = GAME_HEIGHT / PIXEL.zoom;
    this.ox = Math.floor((this.viewW - W * T) / 2);
    this.oy = MAZE.top;
    this.leaving = false;
    this.ended = false;
    this.upBtn = this.downBtn = this.soon = null;
    this.cameras.main.setOrigin(0, 0).setZoom(PIXEL.zoom).setRoundPixels(true);

    // The playfield is the arcade machine's picture: its video chip draws VRAM and the sprites into this
    // canvas every frame (and clips the tunnel like the arcade screen).
    this.screen = this.textures.exists('arcade-screen') ? this.textures.get('arcade-screen')
      : this.textures.createCanvas('arcade-screen', W * T, H * T);
    this.add.image(this.ox, this.oy, 'arcade-screen').setOrigin(0);
    this.art = (key) => this.textures.get(key).getSourceImage();

    this.makeHud();
    this.setupInput();
    this.setupPauseOnHide();

    // The player steers while this layer shows; the bot takes over when it closes. Coming back from another
    // layer continues the machine's game (the bot may have played on); otherwise a fresh game.
    setDriver('player');
    if (!data.continue) newGame();
    else if (['attract', 'cleared', 'over'].includes(this.g.phase)) pressStart();
    else if (this.g.fright > 0) sfx.frightOn();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setDriver('bot'));
    const off = onFrame((m, sounds) => sounds.forEach((e) => this.handle(e.name)));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
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

    const mazeBottom = this.oy + H * T;
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
    pressDir(dir);
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

  update(time) {
    this.render(time / 1000);
  }

  // Sound commands the program wrote to the sound latch this frame.
  handle(name) {
    switch (name) {
      case 'start': sfx.start(); break;
      case 'dot': sfx.dot(); break;
      case 'power': sfx.power(); sfx.frightOn(); break;
      case 'frightEnd': sfx.frightOff(); break;
      case 'ghost': sfx.ghost(); break;
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
    pokePhase(this.machine, this.S, won ? 'cleared' : 'over');
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
      this.input.on('pointerdown', (p, over) => { if (!over.length && !this.leaving) this.scene.restart({}); });
      const again = () => { if (!this.leaving) this.scene.restart({}); };
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
    const g = this.g = readState(this.machine, this.S);
    this.scoreText.setText(String(g.score || '00'));
    if (g.score > this.best) this.bestText.setText(String(g.score));
    this.readyText.setVisible(g.phase === 'ready');
    this.lifeIcons.forEach((icon, i) => icon.setVisible(i < g.lives - 1));

    drawPlayfield(this.screen.getContext(), this.machine, this.art);
    this.screen.refresh();
  }
}
