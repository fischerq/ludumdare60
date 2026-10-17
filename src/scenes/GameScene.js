import { GAME_WIDTH, COLORS, MAZE, RULES, INPUT, UI, BEST_KEY } from '../config.js';
import { createGame, stepGame, steer, DIRS } from '../systems/maze.js';
import { sfx, unlockAudio, setAudioPaused } from '../sound.js';

const T = MAZE.tile;
const ANGLE = { right: 0, down: 90, left: 180, up: 270 };
const KEYS = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down',
};

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    this.g = createGame();
    this.ox = (GAME_WIDTH - this.g.maze.w * T) / 2;
    this.oy = MAZE.top;
    this.leaving = false;

    this.walls = this.add.graphics();
    this.drawWalls(COLORS.wall);
    this.makePellets();

    this.pac = this.add.image(0, 0, 'pac-0');
    this.ghostSprites = this.g.ghosts.map((gh) => ({
      body: this.add.image(0, 0, 'ghost-0').setTint(COLORS.ghosts[gh.name]),
      eyes: this.add.image(0, 0, 'eyes-left'),
    }));

    this.makeHud();
    this.setupInput();
    this.setupPauseOnHide();

    sfx.start();
    this.render(0);
  }

  // Tile center in screen pixels.
  sx(x) { return this.ox + (x + 0.5) * T; }
  sy(y) { return this.oy + (y + 0.5) * T; }

  // Outline every wall tile edge that faces floor, arcade style, with a soft glow under it.
  drawWalls(color) {
    const { maze } = this.g;
    const wall = (x, y) => y < 0 || y >= maze.h || x < 0 || x >= maze.w || maze.rows[y][x] === '#';
    const g = this.walls.clear();
    const edges = [];
    for (let y = 0; y < maze.h; y++) {
      for (let x = 0; x < maze.w; x++) {
        if (!wall(x, y)) continue;
        const l = this.ox + x * T, t = this.oy + y * T;
        if (!wall(x, y - 1)) edges.push([l, t, l + T, t]);
        if (!wall(x, y + 1)) edges.push([l, t + T, l + T, t + T]);
        if (!wall(x - 1, y)) edges.push([l, t, l, t + T]);
        if (!wall(x + 1, y)) edges.push([l + T, t, l + T, t + T]);
      }
    }
    for (const [w, a] of [[12, 0.15], [4, 1]]) {
      g.lineStyle(w, color, a);
      for (const [x1, y1, x2, y2] of edges) g.lineBetween(x1, y1, x2, y2);
    }
    // Ghost door
    maze.rows.forEach((row, y) => [...row].forEach((c, x) => {
      if (c !== '-') return;
      g.fillStyle(COLORS.door);
      g.fillRect(this.ox + x * T, this.oy + y * T + T * 0.4, T, T * 0.2);
    }));
  }

  makePellets() {
    this.pelletSprites = this.g.pellets.map((row, y) => row.map((kind, x) => {
      if (!kind) return null;
      return this.add.image(this.sx(x), this.sy(y), kind === 1 ? 'dot' : 'power');
    }));
    const power = this.pelletSprites.flat().filter((s) => s && s.texture.key === 'power');
    this.tweens.add({ targets: power, alpha: 0.15, duration: 250, yoyo: true, repeat: -1, hold: 100 });
  }

  makeHud() {
    const style = (color, size = UI.hudSize) => ({ fontFamily: UI.arcadeFont, fontSize: size, color });
    this.add.text(40, 40, '1UP', style(COLORS.text));
    this.scoreText = this.add.text(40, 90, '0', style(COLORS.text));
    let best = 0;
    try { best = Number(localStorage.getItem(BEST_KEY)) || 0; } catch (e) { /* private mode */ }
    this.best = best;
    this.add.text(GAME_WIDTH - 40, 40, 'HIGH SCORE', style(COLORS.text)).setOrigin(1, 0);
    this.bestText = this.add.text(GAME_WIDTH - 40, 90, String(best), style(COLORS.text)).setOrigin(1, 0);

    const mazeBottom = this.oy + this.g.maze.h * T;
    this.readyText = this.add.text(this.sx(MAZE.houseExit.x), this.sy(13), 'READY!', style(COLORS.textReady))
      .setOrigin(0.5);
    this.hint = this.add.text(GAME_WIDTH / 2, mazeBottom + 120, 'SWIPE TO TURN', style(COLORS.textDim, 24))
      .setOrigin(0.5);
    this.lifeIcons = [];
    for (let i = 0; i < RULES.lives - 1; i++) {
      this.lifeIcons.push(this.add.image(60 + i * 60, mazeBottom + 45, 'pac-2').setScale(0.75).setAngle(180));
    }
  }

  setupInput() {
    // Swipe anywhere. Each swipe re-arms from where the finger is, so you can steer without lifting.
    const starts = new Map();
    this.input.on('pointerdown', (p) => {
      unlockAudio();
      starts.set(p.id, { x: p.worldX, y: p.worldY });
    });
    this.input.on('pointermove', (p) => {
      const s = starts.get(p.id);
      if (!p.isDown || !s) return;
      const dx = p.worldX - s.x, dy = p.worldY - s.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < INPUT.swipeMin) return;
      this.turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
      starts.set(p.id, { x: p.worldX, y: p.worldY });
    });
    this.input.on('pointerup', (p) => starts.delete(p.id));

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
        const t = this.add.text(this.sx(e.x), this.sy(e.y), String(e.points), {
          fontFamily: UI.arcadeFont, fontSize: 22, color: '#00ffff',
        }).setOrigin(0.5);
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
    this.scoreText.setText(String(g.score));
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
      const white = Math.floor(time * 5) % 2 === 0;
      if (white !== this.wallsWhite) { this.wallsWhite = white; this.drawWalls(white ? 0xffffff : COLORS.wall); }
    }
  }
}
