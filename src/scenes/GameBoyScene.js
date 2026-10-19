import { GB, UI } from '../config.js';
import { createHall, stepHall, facing, pacPos, actorPos } from '../systems/hall.js';
import { createBattle, playTurn } from '../systems/gameboy/battle.js';
import { charFrame } from '../systems/anim.js';
import { sfx, unlockAudio, setAudioPaused, setBed } from '../sound.js';

const T = 16;
const KEYS = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down',
};
const TILES = { w: 'wall', b: 'shelf', D: 'mat', 1: 'table-ball', 2: 'table-ball', 3: 'table-ball' };
const fill = (t, o) => t.replace(/\{(\w+)\}/g, (m, k) => o[k] ?? m);

// The Game Boy Color from the hall's rug, playing the start of Pokemon Red our way: in PROF. DILL's lab, pick one
// of three mini-Gurken from the table, BLUE takes the one that beats it and fights you; then walk out the door and
// the batteries die. The Game Boy fills the screen; its D-pad and A/B are the controls (design/systems/layer-arcade.md).
export default class GameBoyScene extends Phaser.Scene {
  constructor() {
    super('GameBoy');
  }

  create() {
    setBed('gbLab');
    const S = GB.screen;
    this.cameras.main.setOrigin(0, 0).setZoom(GB.zoom).setRoundPixels(true).setBackgroundColor(0x000000);
    this.add.image(0, 0, 'gameboy/body').setOrigin(0);
    const label = (x, y, t) => this.add.text(x, y, t, { fontFamily: UI.arcadeFont, fontSize: 8, color: GB.colors.label, resolution: 1 }).setOrigin(0.5);
    label(GB.a.x, GB.a.y + 17, 'A');
    label(GB.b.x, GB.b.y + 17, 'B');

    this.h = createHall(GB.layout, { solid: GB.solid, speed: GB.walkSpeed, ghosts: GB.npcs });
    this.h.pac.dir = 'up';
    this.mode = 'lab';
    this.chosen = null;   // your mini-Gurke's kind
    this.rivalKind = null;
    this.done = false;    // the fight is over: the door lets you out
    this.held = null;
    this.keyDir = null;
    this.t = 0;

    // The lab: tiles, then the people.
    this.tiles = {};
    this.h.rows.forEach((row, y) => [...row].forEach((c, x) => {
      this.add.image(S.x + x * T, S.y + y * T, 'gameboy/floor').setOrigin(0);
      if (TILES[c]) this.tiles[c] = this.add.image(S.x + x * T, S.y + y * T, `gameboy/${TILES[c]}`).setOrigin(0);
    }));
    this.npcSprites = this.h.npcs.map((n) => this.add.image(0, 0, `gameboy/${n.name}-down`).setOrigin(0));
    this.red = this.add.image(0, 0, 'gameboy/red-up-0').setOrigin(0);
    this.popup = this.add.image(S.x + S.w / 2, S.y + 44, 'gameboy/mon-grass-front').setVisible(false);

    this.makeBattle();
    this.makeBox();
    this.off = this.add.graphics().fillStyle(GB.colors.screenOff, 1).fillRect(S.x, S.y, S.w, S.h).setAlpha(0).setDepth(20);
    this.setupInput();
    this.setupPauseOnHide();
    this.talk(GB.text.intro);
  }

  // The fight's screen over the lab: both mini-Gurken, names and HP bars.
  makeBattle() {
    const S = GB.screen, font = { fontFamily: UI.arcadeFont, fontSize: 8, color: GB.colors.text, resolution: 1 };
    const bg = this.add.graphics().fillStyle(0xf8f8f8, 1).fillRect(S.x, S.y, S.w, S.h);
    this.enemyImg = this.add.image(S.x + 122, S.y + 34, 'gameboy/mon-fire-front');
    this.mineImg = this.add.image(S.x + 34, S.y + 78, 'gameboy/mon-grass-back');
    this.enemyName = this.add.text(S.x + 6, S.y + 6, '', font);
    this.mineName = this.add.text(S.x + 72, S.y + 56, '', font);
    this.mineHp = this.add.text(S.x + 96, S.y + 78, '', font);
    this.bars = this.add.graphics();
    this.battleUi = [bg, this.enemyImg, this.mineImg, this.enemyName, this.mineName, this.mineHp, this.bars];
    this.battleUi.forEach((o) => o.setDepth(5).setVisible(false));
  }

  drawBars() {
    const S = GB.screen, C = GB.colors, bar = (x, y, hp, max) => {
      const w = 56, f = hp / max;
      this.bars.fillStyle(C.boxEdge, 1).fillRect(x - 1, y - 1, w + 2, 5).fillStyle(C.hpBack, 1).fillRect(x, y, w, 3)
        .fillStyle(f > 0.5 ? C.hp : f > 0.2 ? C.hpLow : C.hpCrit, 1).fillRect(x, y, Math.round(w * f), 3);
    };
    this.bars.clear();
    bar(S.x + 14, S.y + 18, this.shown.enemy, this.b.enemy.max);
    bar(S.x + 92, S.y + 70, this.shown.mine, this.b.mine.max);
    this.mineHp.setText(`${this.shown.mine}/${this.b.mine.max}`);
  }

  // The text box at the bottom of the screen, sized to its text, with choices under it.
  makeBox() {
    const S = GB.screen, font = { fontFamily: UI.arcadeFont, fontSize: 8, color: GB.colors.text, resolution: 1, lineSpacing: 4 };
    this.box = this.add.graphics().setDepth(10);
    this.boxText = this.add.text(S.x + 8, 0, '', { ...font, wordWrap: { width: S.w - 16 } }).setDepth(10);
    this.choiceTexts = [0, 1, 2].map(() => this.add.text(S.x + 8, 0, '', font).setDepth(10));
    this.queue = [];
    this.closeBox();
  }

  show(text, choices = null, cancel = null) {
    const S = GB.screen, L = 12, n = choices?.length ?? 0;
    this.boxText.setText(text);
    const th = text ? this.boxText.height + 2 : 0, bh = th + n * L + 10, by = S.y + S.h - bh;
    this.boxText.setY(by + 5);
    this.choices = choices;
    this.cancel = cancel;
    this.choiceIdx = 0;
    this.choiceTop = by + 5 + th;
    this.choiceTexts.forEach((t, i) => t.setVisible(i < n).setY(this.choiceTop + i * L));
    this.showChoices();
    this.box.clear().fillStyle(GB.colors.boxEdge, 1).fillRect(S.x, by, S.w, bh).fillStyle(GB.colors.box, 1).fillRect(S.x + 2, by + 2, S.w - 4, bh - 4);
    [this.box, this.boxText].forEach((o) => o.setVisible(true));
    this.open = true;
  }

  showChoices() {
    this.choices?.forEach((c, i) => this.choiceTexts[i].setText(`${i === this.choiceIdx ? '>' : ' '}${c.label}`));
  }

  closeBox() {
    [this.box, this.boxText, ...this.choiceTexts].forEach((o) => o.setVisible(false));
    this.open = false;
    this.choices = null;
  }

  // Lines one after another (A or a tap for the next), then `done`. A line can be { text, hp } (the fight).
  talk(lines, done = null) {
    this.queue = [...lines];
    this.onDone = done;
    this.next();
  }

  next() {
    const line = this.queue.shift();
    if (line == null) {
      this.closeBox();
      const d = this.onDone;
      this.onDone = null;
      d?.();
      return;
    }
    if (line.hp) this.shown = { ...line.hp };
    this.show(line.text ?? line);
  }

  ask(text, choices, cancel = null) {
    this.queue = [];
    this.onDone = null;
    this.show(text, choices, cancel);
  }

  pick(i) {
    const c = this.choices?.[i];
    if (!c) return;
    sfx.click();
    this.closeBox();
    c.act();
  }

  // A: next line, pick the choice, or use what RED faces.
  pressA() {
    if (this.mode === 'off') return;
    if (this.open) { if (this.choices) this.pick(this.choiceIdx); else { sfx.click(); this.next(); } return; }
    if (this.mode !== 'lab' || this.h.pac.moving) return;
    const f = facing(this.h), T2 = GB.text;
    if (f.npc?.name === 'prof') this.talk([this.done ? T2.profAfter : T2.prof]);
    else if (f.npc?.name === 'rival') this.talk([this.done ? T2.rivalAfter : T2.rival]);
    else if (GB.balls[f.cell]) this.ball(f.cell);
  }

  pressB() {
    if (!this.open) return;
    if (!this.choices) { sfx.click(); this.next(); } else if (this.cancel != null) this.pick(this.cancel);
  }

  ball(cell) {
    const kind = GB.balls[cell], T2 = GB.text, mon = GB.mons[kind];
    if (this.chosen) { this.talk([this.tiles[cell].visible ? T2.last : T2.taken]); return; }
    this.popup.setTexture(`gameboy/mon-${kind}-front`).setVisible(true);
    const no = () => this.popup.setVisible(false);
    this.ask(fill(T2.ask, mon), [{ label: T2.yes, act: () => { no(); this.choose(cell, kind); } }, { label: T2.no, act: no }], 1);
  }

  // You take this one; BLUE takes the one that beats it and wants to fight.
  choose(cell, kind) {
    const T2 = GB.text;
    this.chosen = kind;
    this.rivalKind = GB.counter[kind];
    this.tiles[cell].setVisible(false);
    sfx.coin();
    const rivalCell = Object.keys(GB.balls).find((k) => GB.balls[k] === this.rivalKind);
    this.talk([fill(T2.got, GB.mons[kind])], () => {
      this.tiles[rivalCell].setVisible(false);
      this.talk(T2.rivalTakes.map((t) => fill(t, GB.mons[this.rivalKind])), () => this.startBattle());
    });
  }

  startBattle() {
    setBed('gbBattle');
    this.mode = 'battle';
    this.b = createBattle(this.chosen, this.rivalKind);
    this.shown = { mine: this.b.mine.hp, enemy: this.b.enemy.hp };
    this.enemyImg.setTexture(`gameboy/mon-${this.rivalKind}-front`);
    this.mineImg.setTexture(`gameboy/mon-${this.chosen}-back`);
    this.enemyName.setText(GB.mons[this.rivalKind].name);
    this.mineName.setText(GB.mons[this.chosen].name);
    this.battleUi.forEach((o) => o.setVisible(true));
    const names = { enemy: GB.mons[this.rivalKind].name, mine: GB.mons[this.chosen].name };
    this.talk(GB.text.battleStart.map((t) => fill(t, names)), () => this.menu());
  }

  menu() {
    const T2 = GB.text;
    this.ask(fill(T2.what, { mine: GB.mons[this.chosen].name }), [
      { label: T2.fight, act: () => this.moves() },
      { label: T2.run, act: () => this.talk([T2.noRun], () => this.menu()) },
    ]);
  }

  moves() {
    const T2 = GB.text;
    this.ask('', [
      { label: T2.tackle, act: () => this.turn('tackle') },
      { label: GB.mons[this.chosen].move, act: () => this.turn('type') },
      { label: T2.back, act: () => this.menu() },
    ], 2);
  }

  turn(move) {
    const steps = playTurn(this.b, move);
    if (steps.some((s) => s.hp.enemy < this.shown.enemy || s.hp.mine < this.shown.mine)) sfx.boom();
    this.talk(steps, () => (this.b.over ? this.endBattle() : this.menu()));
  }

  // Win or lose, back to the lab: the professor heals your mini-Gurke and the door lets you out.
  endBattle() {
    const T2 = GB.text, win = this.b.over === 'win';
    if (win) sfx.clear(); else sfx.death();
    this.talk(win ? T2.win : T2.lose, () => {
      this.battleUi.forEach((o) => o.setVisible(false));
      setBed('gbLab');
      this.mode = 'lab';
      this.done = true;
      this.talk([T2.healed]);
    });
  }

  // Into the door mat: not before the fight; after it, the screen fades out and the Game Boy is dead again.
  door() {
    if (!this.done) { this.talk([GB.text.wait]); return; }
    this.mode = 'off';
    setBed(null);
    this.tweens.add({ targets: this.off, alpha: 1, duration: GB.fade * 1000, onComplete: () => this.time.delayedCall(400, () => this.scene.start('Hall', { from: 'gameboy' })) });
  }

  setupInput() {
    const art = (p) => ({ x: p.x / GB.zoom, y: p.y / GB.zoom });
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const padDir = (a) => {
      const d = GB.dpad, dx = a.x - d.x, dy = a.y - d.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < d.dead) return null;
      return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    };
    this.input.on('pointerdown', (p) => {
      unlockAudio();
      const a = art(p), S = GB.screen;
      if (dist(a, GB.dpad) < GB.dpad.r) {
        this.padId = p.id;
        this.held = padDir(a);
        this.padPress(this.held);
      } else if (dist(a, GB.a) < GB.a.r) this.pressA();
      else if (dist(a, GB.b) < GB.b.r) this.pressB();
      else if (a.x >= S.x && a.x < S.x + S.w && a.y >= S.y && a.y < S.y + S.h && this.open) {
        // A tap on the screen: pick the choice under the finger, or go on.
        if (this.choices) { const i = Math.floor((a.y - this.choiceTop) / 12); if (i >= 0 && i < this.choices.length) this.pick(i); } else this.pressA();
      }
    });
    this.input.on('pointermove', (p) => {
      if (p.id !== this.padId || !p.isDown) return;
      const d = padDir(art(p));
      if (d !== this.held) { this.held = d; this.padPress(d); }
    });
    this.input.on('pointerup', (p) => { if (p.id === this.padId) { this.padId = null; this.held = null; } });
    this.input.keyboard?.on('keydown', (e) => {
      unlockAudio();
      if (e.code === 'Space' || e.code === 'Enter') this.pressA();
      if (e.code === 'KeyX' || e.code === 'Escape' || e.code === 'Backspace') this.pressB();
      if (KEYS[e.code] && !e.repeat) { this.keyDir = KEYS[e.code]; this.padPress(this.keyDir); }
    });
    this.input.keyboard?.on('keyup', (e) => { if (KEYS[e.code] === this.keyDir) this.keyDir = null; });
  }

  // Up/down move through the choices.
  padPress(dir) {
    if (!this.choices || (dir !== 'up' && dir !== 'down')) return;
    const n = this.choices.length;
    this.choiceIdx = (this.choiceIdx + (dir === 'up' ? n - 1 : 1)) % n;
    this.showChoices();
    sfx.click();
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
    const dt = Math.min(delta / 1000, 0.05), S = GB.screen;
    this.t += dt;
    if (this.mode === 'lab' && !this.open) {
      for (const e of stepHall(this.h, dt, this.held ?? this.keyDir)) {
        if (e.type === 'bump' && e.cell === 'D') { this.door(); break; }
      }
    }
    const p = this.h.pac, pp = pacPos(this.h);
    const f = p.moving ? charFrame('pac', (p.steps + p.t) / GB.walkSpeed, 2) : 0;
    this.red.setTexture(`gameboy/red-${p.dir === 'left' ? 'right' : p.dir}-${f}`).setFlipX(p.dir === 'left')
      .setPosition(Math.round(S.x + pp.x * T), Math.round(S.y + pp.y * T));
    this.h.npcs.forEach((n, i) => { const a = actorPos(n); this.npcSprites[i].setPosition(S.x + a.x * T, S.y + a.y * T); });
    if (this.mode === 'battle' && this.shown) this.drawBars();
  }
}
