import { COLORS, MINI, UI, BEST_KEY } from '../config.js';
import { createInvaders, stepInvaders } from '../systems/minigames/invaders.js';
import { createAsteroids, stepAsteroids, shipFrame } from '../systems/minigames/asteroids.js';
import { createKong, stepKong } from '../systems/minigames/kong.js';
import { sfx, unlockAudio, setAudioPaused, setBed } from '../sound.js';
import { addLayerButtonAt } from '../layerButton.js';

const GAMES = {
  invaders: { create: createInvaders, step: stepInvaders },
  asteroids: { create: createAsteroids, step: stepAsteroids },
  kong: { create: createKong, step: stepKong },
};
const KEYS = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down',
};
const SFX = { shoot: 'shoot', hit: 'ghost', boom: 'boom', death: 'death', gurke: 'coin', jump: 'jump' };
const ROCKS = ['big', 'mid', 'small'];
const GURKE = 'arcade/mini-gurke'; // the hall's tile; the pickle sits at (8, 9) of its 16x16

// The hall's other machines, full screen: one level of Space Invaders, Asteroids or Donkey Kong (data.game), rules
// in src/systems/minigames/. Win or lose, the hall comes back in front of the machine; LAYER UP leaves early.
export default class MiniGameScene extends Phaser.Scene {
  constructor() {
    super('Mini');
  }

  init(data) {
    this.id = GAMES[data?.game] ? data.game : 'invaders';
  }

  create() {
    setBed(this.id);
    this.g = GAMES[this.id].create();
    this.cameras.main.setOrigin(0, 0).setZoom(MINI.zoom).setRoundPixels(true).setBackgroundColor(0x000000);
    this.pool = [];
    this.used = 0;
    this.finger = null;
    this.tapped = false;
    this.keys = new Set();
    this.ending = 0;
    this.flash = 0;
    this.gone = false; // the scene object is reused: without this, every game after the first could never leave
    this.anchor = null;
    this.drawStatic();
    const font = (color) => ({ fontFamily: UI.arcadeFont, fontSize: 8, color, resolution: 1 });
    const H = MINI.hud;
    // The HUD at the size every game shares: 6 px at this zoom, drawn at twice the resolution so it stays crisp.
    const hud = (color) => ({ ...font(color), fontSize: UI.hudPx / MINI.zoom, resolution: MINI.zoom / 2 });
    this.add.text(H.oneUpX, H.labelY, '1UP', hud(COLORS.text)).setDepth(10);
    this.scoreText = this.add.text(H.oneUpX, H.scoreY, '', hud(COLORS.text)).setDepth(10);
    this.bestKey = `${BEST_KEY}.${this.id}`;
    this.best = 0;
    try { this.best = Number(localStorage.getItem(this.bestKey)) || 0; } catch (e) { /* private mode */ }
    this.add.text(MINI.w / 2, H.labelY, 'HIGH SCORE', hud(COLORS.text)).setOrigin(0.5, 0).setDepth(10);
    this.bestText = this.add.text(MINI.w / 2, H.scoreY, '', hud(COLORS.text)).setOrigin(0.5, 0).setDepth(10);
    this.lifeIcons = [];
    for (let i = 0; i < this.g.lives - 1; i++) {
      this.lifeIcons.push(this.add.image(H.livesX + i * H.livesStep, H.livesY, MINI.lifeIcon[this.id]).setDepth(10));
    }
    this.banner = this.add.text(MINI.w / 2, MINI.h / 2 - 20, '', { ...font(MINI.colors.text), align: 'center' }).setOrigin(0.5).setDepth(10);
    this.layerBtn = addLayerButtonAt(this, 'up', () => this.leave('left'), { zoom: MINI.zoom, scale: 2 / MINI.zoom });
    this.setupInput();
    this.setupPauseOnHide();
  }

  // What doesn't move: the cannon's ground line, the girders and ladders.
  drawStatic() {
    if (this.id === 'invaders') {
      this.add.graphics().fillStyle(MINI.art.cannon, 1).fillRect(0, MINI.invaders.cannonY + 6, MINI.w, 1);
    }
    if (this.id === 'kong') {
      const K = MINI.kong;
      K.ladders.forEach((l) => {
        for (let y = K.floors[l.from + 1] + 8; y < K.floors[l.from]; y += 8) this.add.image(l.x, y, 'games/kong-ladder').setOrigin(0.5, 0);
      });
      K.floors.forEach((y) => { for (let x = K.left; x < K.right; x += 8) this.add.image(x, y, 'games/kong-girder').setOrigin(0); });
      const top = K.floors[K.floors.length - 1];
      // Left of her, not above: the top-right corner is the sound button's.
      this.add.text(K.ladyX - K.helpGap, top - 10, 'HELP!', { fontFamily: UI.arcadeFont, fontSize: 8, color: '#ffffff', resolution: 1 }).setOrigin(1, 0.5);
    }
  }

  // The next sprite from the pool, at whole pixels.
  spr(key, x, y, ox = 0.5, oy = 0.5, flip = false) {
    let s = this.pool[this.used];
    if (!s) { s = this.add.image(0, 0, key).setDepth(5); this.pool.push(s); }
    this.used += 1;
    return s.setTexture(key).setOrigin(ox, oy).setPosition(Math.round(x), Math.round(y)).setFlipX(flip).setVisible(true);
  }

  setupInput() {
    this.input.on('pointerdown', (p, over) => {
      unlockAudio();
      if (over.includes(this.layerBtn)) return;
      // A second finger while the first one is down: a tap (jump, fire).
      if (this.anchor && this.anchor.id !== p.id) { this.tapped = true; return; }
      this.anchor = { x: p.x, y: p.y, id: p.id, at: this.time.now, moved: false };
      this.finger = { x: p.x / MINI.zoom, y: p.y / MINI.zoom };
      this.drag = null;
    });
    this.input.on('pointermove', (p) => {
      const a = this.anchor;
      if (!a || p.id !== a.id || !p.isDown) return;
      this.finger = { x: p.x / MINI.zoom, y: p.y / MINI.zoom };
      const dx = p.x - a.x, dy = p.y - a.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < MINI.dragDeadzone) return;
      a.moved = true;
      this.drag = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    });
    this.input.on('pointerup', (p) => {
      const a = this.anchor;
      if (!a || p.id !== a.id) return;
      if (!a.moved && this.time.now - a.at < MINI.tapTime) this.tapped = true;
      this.anchor = null;
      this.finger = null;
      this.drag = null;
    });
    this.input.keyboard?.on('keydown', (e) => {
      unlockAudio();
      if (KEYS[e.code]) this.keys.add(KEYS[e.code]);
      if (e.code === 'Space' || e.code === 'Enter') this.tapped = true;
      if (e.code === 'Escape') this.leave('left');
    });
    this.input.keyboard?.on('keyup', (e) => this.keys.delete(KEYS[e.code]));
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

  // Touch and keys, as each game wants them.
  readInput() {
    const k = this.keys, axis = (a, b) => (k.has(b) ? 1 : 0) - (k.has(a) ? 1 : 0);
    const held = this.anchor && (this.anchor.moved || this.time.now - this.anchor.at >= MINI.tapTime);
    const keyDir = ['up', 'down', 'left', 'right'].find((d) => k.has(d)) ?? null;
    if (this.id === 'invaders') return { x: this.finger?.x ?? null, move: axis('left', 'right') };
    if (this.id === 'asteroids') return { aim: held ? this.finger : null, fire: this.tapped, turn: axis('left', 'right'), thrust: k.has('up') };
    return { dir: this.drag ?? keyDir, jump: this.tapped };
  }

  leave(result) {
    if (this.gone) return;
    this.gone = true;
    sfx.click();
    try { localStorage.setItem(this.bestKey, String(Math.max(this.g.score, this.best))); } catch (e) { /* private mode */ }
    this.scene.start('Hall', { from: 'game', game: this.id, result, score: this.g.score, gurke: this.g.gurke });
  }

  update(time, delta) {
    const dt = Math.min(delta / 1000, 0.05), g = this.g;
    if (this.ending > 0) {
      this.ending -= dt;
      if (this.ending <= 0) this.leave(g.over);
    } else {
      const had = g.gurke;
      for (const e of GAMES[this.id].step(g, dt, this.readInput())) sfx[SFX[e]]?.();
      if (g.gurke && !had) this.flash = 1.5;
      if (g.over) {
        this.ending = MINI.endTime;
        if (g.over === 'win') sfx.clear();
        this.banner.setText(g.over === 'win' ? 'YOU WIN!' : 'GAME OVER').setColor(g.over === 'win' ? MINI.colors.win : MINI.colors.lose);
      }
    }
    this.tapped = false;
    this.flash = Math.max(0, this.flash - dt);
    if (!this.ending) this.banner.setText(this.flash > 0 ? 'MINI-GURKE!' : '').setColor(MINI.colors.gurke);

    this.used = 0;
    this[`draw_${this.id}`](g);
    for (let i = this.used; i < this.pool.length; i++) this.pool[i].setVisible(false);
    this.scoreText.setText(String(g.score || '00'));
    this.bestText.setText(String(Math.max(g.score, this.best) || '00'));
    this.lifeIcons.forEach((icon, i) => icon.setVisible(i < g.lives - 1));
  }

  draw_invaders(g) {
    const I = MINI.invaders;
    for (const a of g.aliens) if (a.alive) this.spr(`games/inv-${a.kind}-${g.frame}`, a.x, a.y, 0, 0);
    for (const b of g.booms) this.spr('games/inv-boom', b.x, b.y, 0, 0);
    if (g.cannon.dead > 0) this.spr('games/inv-boom', g.cannon.x, I.cannonY - 4, 0.5, 0);
    else this.spr('games/inv-cannon', g.cannon.x, I.cannonY - 4, 0.5, 0);
    if (g.shot) this.spr('games/inv-shot', g.shot.x, g.shot.y, 0.5, 0);
    for (const b of g.bombs) this.spr('games/inv-bomb', b.x, b.y, 0.5, 0);
    if (g.ufo) this.spr(GURKE, g.ufo.x, g.ufo.y, 0.5, 9 / 16);
  }

  draw_asteroids(g) {
    for (const r of g.rocks) this.spr(`games/ast-rock-${ROCKS[r.size]}`, r.x, r.y);
    for (const s of g.shots) this.spr('games/ast-shot', s.x, s.y);
    for (const b of g.booms) this.spr('games/inv-boom', b.x, b.y);
    if (g.gurkeOut) this.spr(GURKE, g.gurkeOut.x, g.gurkeOut.y, 0.5, 9 / 16);
    const s = g.ship;
    if (s.inv <= 0 || Math.floor(s.inv * 8) % 2 === 0) this.spr(`games/ast-ship-${s.thrust ? 'thrust-' : ''}${shipFrame(s.a)}`, s.x, s.y);
  }

  draw_kong(g) {
    const K = MINI.kong, top = K.floors[K.floors.length - 1], m = g.man;
    this.spr(`games/kong-ape-${g.throwing > 0 ? 1 : 0}`, K.kongX, top, 0.5, 1);
    this.spr('games/kong-lady', K.ladyX, top, 0.5, 1);
    if (!g.gurke) this.spr(GURKE, K.gurkeX, K.floors[K.gurkeFloor], 0.5, 11 / 16);
    for (const b of g.barrels) this.spr(`games/kong-barrel-${Math.floor(b.spin) % 2}`, b.x, b.y - 5);
    const key = m.dead > 0 ? 'dead' : m.climb ? `climb-${Math.floor(m.walk * 6) % 2}` : m.air ? 'jump' : `walk-${Math.floor(m.walk * 8) % 2}`;
    this.spr(`games/kong-man-${key}`, m.x, m.y, 0.5, 1, !m.climb && m.dir < 0);
  }
}
