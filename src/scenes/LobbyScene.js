import { GAME_WIDTH, GAME_HEIGHT, COLORS, LOBBY, PIXEL, UI } from '../config.js';
import { createHall, stepHall, facing, pacPos } from '../systems/hall.js';
import { wireMask, ghostWire, subsystemOf, subsystemTiles, standFor, ghostFacing } from '../systems/lobby.js';
import { tileKey } from '../systems/tiles.js';
import { charFrame } from '../systems/anim.js';
import { DEEP_LAYERS } from '../systems/layers/index.js';
import {
  ORDER, isUnlocked, isWon, allWon, isAdderWon, isSwitchOn, markAdderWon, setSwitch, isHard, isHardWon, lamps, setLamp,
} from '../progress.js';
import { world, setLevel256 } from '../systems/arcade/world.js';
import { sfx, unlockAudio, setAudioPaused, setBed } from '../sound.js';
import { addLayerButtonAt } from '../layerButton.js';

const T = PIXEL.tile;
const KEYS = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down',
};
// The cabinet's parts by map character (tiles of assets/board/, drawn over the floor).
const PARTS = { K: 'speaker', D: 'coin-door', W: 'power', E: 'edge' };
const MONITOR = { M: ['tl', 'tc', 'tr'], m: ['bl', 'bc', 'br'] };

// Inside the cabinet: the board lobby, built like the hall (grid walking, tap to talk, a text box with portraits).
// The floor is the PCB with the harness running up to the monitor; every subsystem is a chip with a face that
// enters its deep layer once it's unlocked (src/progress.js). LAYER UP goes back to the maze.
// data.from: 'maze' (zoom out of the monitor) or a deep layer id (zoom out of that subsystem, Pac-Man in front of
// it); data.won: that layer was just won, so the one it unlocked lights up.
export default class LobbyScene extends Phaser.Scene {
  constructor() {
    super('Lobby');
  }

  init(data) {
    this.from = data?.from ?? null;
    this.won = !!data?.won;
    this.leverPulled = Number.isInteger(data?.lever) ? data.lever : null; // restarted after cheat lever i was pulled
    this.fromReel = !!data?.reel; // back from the credits
  }

  // The map: once every subsystem is won, the adder (A) and its 256 switch (Z) stand on their reserved tiles.
  layout() {
    const rows = LOBBY.layout.map((r) => [...r]);
    if (allWon()) {
      const { adder, switch: sw } = LOBBY.reserved;
      rows[adder.y][adder.x] = 'A';
      rows[sw.y][sw.x] = 'Z';
    }
    return rows.map((r) => r.join(''));
  }

  create() {
    setBed('cabinet');
    this.h = createHall(this.layout(), { solid: LOBBY.solid, speed: LOBBY.walkSpeed, ghosts: {} });
    this.viewW = GAME_WIDTH / LOBBY.zoom;
    this.viewH = GAME_HEIGHT / LOBBY.zoom;
    // The room sits at the top of the view: the LAYER UP button (bottom left, like every layer) and the title get
    // the strip under it.
    this.ox = Math.floor((this.viewW - this.h.w * T) / 2);
    this.oy = 0;
    this.held = null;
    this.keyDir = null;
    this.t = 0;
    this.highlight = null; // { id, t }: a subsystem that just woke up blinks lit
    this.cam = this.cameras.main.setOrigin(0, 0).setRoundPixels(true).setBackgroundColor(LOBBY.colors.wall);

    this.subTiles = subsystemTiles(this.h);
    this.drawMap();
    // Pac-Man starts on S, or in front of the subsystem he comes out of.
    const p = this.h.pac;
    const deep = this.from && this.from !== 'maze' && this.from !== 'adder' ? this.from : null;
    const stand = deep && standFor(this.h, deep);
    if (stand) Object.assign(p, stand);
    if (this.from === 'adder') Object.assign(p, { x: LOBBY.reserved.adder.x, y: LOBBY.reserved.adder.y - 1, dir: 'down' });
    // The zoom out starts at the part we come out of: the monitor from the maze, else the subsystem.
    this.focus = this.from === 'adder' ? this.reservedCenter('adder') : this.centerOf(deep ?? 'crt');
    this.mode = this.from ? 'intro' : 'walk';
    this.introT = this.from ? 0 : 1;

    const actor = (key) => this.add.image(0, 0, key);
    this.pac = actor('arcade/pac-up-0');
    // The four ghosts on their wires to the brain, looking at it.
    this.ghosts = [];
    this.h.rows.forEach((row, y) => [...row].forEach((c, x) => {
      const name = LOBBY.ghosts[c];
      if (name) this.ghosts.push({ name, x, y, dir: ghostFacing(this.h, x, y), s: actor(`maze/ghost-${name}-down-0`) });
      // Mecha-Pac (X), the bot, at the joystick: he plays the machine's game while you're in here.
      if (c === 'X') this.mecha = { x, y, s: actor('board/mecha-0') };
    }));

    this.makeUi();
    this.children.list.filter((o) => o.scrollFactorX === 0).forEach((o) => o.setDepth(1e6));
    this.setupInput();
    this.setupPauseOnHide();
    if (this.won && deep) {
      const next = ORDER[ORDER.indexOf(deep) + 1];
      if (next && isUnlocked(next)) this.highlight = { id: next, t: LOBBY.highlightTime };
    }
    const pulled = this.levers[this.leverPulled];
    if (pulled) Object.assign(p, this.standNext(pulled));
    if (this.fromReel && this.reel) Object.assign(p, this.standNext(this.reel));
    this.updateCamera();
    this.refreshSubsystems();
    if (pulled) {
      const tx = LOBBY.text, on = lamps()[this.leverPulled];
      sfx.power();
      this.say(tx.leverPulled.replace('{n}', this.leverPulled + 1).replace('{state}', on ? tx.leverOn : tx.leverOff),
        tileKey('board', `lamp-${this.leverPulled + 1}-${on ? 'on' : 'off'}`));
    }
  }

  // A free tile next to a solid part and the way to face it from there: below first.
  standNext(at) {
    for (const [dx, dy, dir] of [[0, 1, 'up'], [-1, 0, 'right'], [1, 0, 'left'], [0, -1, 'down']]) {
      const c = this.h.rows[at.y + dy]?.[at.x + dx];
      if (c && !LOBBY.solid.includes(c)) return { x: at.x + dx, y: at.y + dy, dir };
    }
    return {};
  }

  // The index of a lamp or lever (left to right) at a tile.
  partIndex(list, x, y) { return list.findIndex((o) => o.x === x && o.y === y); }

  sx(x) { return this.ox + x * T + T / 2; }
  sy(y) { return this.oy + y * T + T / 2; }

  // The middle of a subsystem's tiles, in art px.
  centerOf(id) {
    const ts = this.subTiles[id] ?? [{ x: this.h.pac.x, y: this.h.pac.y }];
    return { x: this.sx(ts.reduce((a, t) => a + t.x, 0) / ts.length), y: this.sy(ts.reduce((a, t) => a + t.y, 0) / ts.length) };
  }

  reservedCenter(name) {
    const r = LOBBY.reserved[name];
    return { x: this.sx(r.x), y: this.sy(r.y) };
  }

  place(s, at) {
    const y = Math.round(this.sy(at.y));
    s.setDisplaySize(LOBBY.charSize, LOBBY.charSize).setPosition(Math.round(this.sx(at.x)), y).setDepth(y);
  }

  drawMap() {
    this.subImages = {}; // id -> images whose texture shows its state
    this.lamps = []; // the status lamps and cheat levers, left to right (lamp i, lever i)
    this.levers = [];
    const lit = lamps();
    this.h.rows.forEach((row, y) => [...row].forEach((c, x) => {
      const at = (key) => this.add.image(this.ox + x * T, this.oy + y * T, tileKey('board', key)).setOrigin(0);
      if (c === '#') { at('wall'); return; }
      if (c === '=' || c === '-') { at(`${c === '=' ? 'harness' : 'trace'}-${wireMask(this.h, x, y) || (c === '=' ? 5 : 10)}`); return; }
      if (c === '~') { const w = ghostWire(this.h, x, y); at(`wire-${w.ghost}-${w.dir}`); return; }
      if (MONITOR[c]) {
        const i = this.subTiles.crt.filter((t) => t.c === c).findIndex((t) => t.x === x);
        at(`monitor-${MONITOR[c][i]}`);
        return;
      }
      at('floor');
      if (PARTS[c]) at(PARTS[c]);
      if (c === 'A') this.adderImg = at('adder-on');
      if (c === 'Z') this.switchImg = at('switch-stuck');
      if (c === 'O') { const n = this.lamps.length; this.lamps.push({ x, y, img: at(`lamp-${n + 1}-${lit[n] ? 'on' : 'off'}`) }); }
      if (c === 'H') this.levers.push({ x, y, img: at(lit[this.levers.length] ? 'lever-down' : 'lever-up') });
      if (c === 'N') at('sign');
      if (c === 'F') { this.reel = { x, y }; at('reel'); }
      if (c === 'g') at('gurke');
      const id = subsystemOf(c);
      if (id) (this.subImages[id] ??= []).push(at(`${id}-on`));
    }));
  }

  // Each subsystem's art: awake when unlocked, asleep when locked, blinking lit while it just woke up.
  refreshSubsystems() {
    for (const [id, imgs] of Object.entries(this.subImages)) {
      let mood = isUnlocked(id) ? 'on' : 'off';
      if (this.highlight?.id === id && Math.floor(this.highlight.t * LOBBY.highlightRate * 2) % 2 === 0) mood = 'lit';
      imgs.forEach((im) => im.setTexture(tileKey('board', `${id}-${mood}`)));
    }
    // The adder glows while it's waiting to be played; the switch shows stuck, off or on.
    const blink = Math.floor(this.t * LOBBY.highlightRate / 3) % 2 === 0;
    this.adderImg?.setTexture(tileKey('board', !isAdderWon() && blink ? 'adder-lit' : 'adder-on'));
    this.switchImg?.setTexture(tileKey('board', `switch-${!isAdderWon() ? 'stuck' : isSwitchOn() ? 'on' : 'off'}`));
  }

  makeUi() {
    const fixed = (o) => o.setScrollFactor(0);
    this.layerBtn = addLayerButtonAt(this, 'up', () => this.leave('Game'), { zoom: LOBBY.zoom, scale: 2 / LOBBY.zoom, fixed: true });
    this.title = fixed(this.add.text(this.viewW - 6, this.viewH - 8, 'INSIDE THE\nCABINET', {
      fontFamily: UI.arcadeFont, fontSize: 8, color: COLORS.textReady, resolution: 1, lineSpacing: 4, align: 'right',
    }).setOrigin(1, 1));
    // RPG text box, sized to its text: at the bottom, or at the top while Pac-Man is in the lower half.
    this.box = fixed(this.add.graphics());
    this.boxText = fixed(this.add.text(11, 0, '', {
      fontFamily: UI.arcadeFont, fontSize: 8, color: COLORS.text, resolution: 1, wordWrap: { width: this.viewW - 22 }, lineSpacing: 4,
    }));
    this.portraitFrame = fixed(this.add.graphics());
    this.portrait = fixed(this.add.image(0, 0, 'board/portrait-crt').setOrigin(0));
    this.choiceTexts = [0, 1].map(() => fixed(this.add.text(11, 0, '', {
      fontFamily: UI.arcadeFont, fontSize: 8, color: COLORS.textReady, resolution: 1,
    })));
    this.closeText(true);
  }

  // Show `text` in the box with a portrait (a 48x48 portrait or a 16x16 tile shown 3x); `choices`: [{ label, act }].
  say(text, portrait = null, choices = null) {
    sfx.click();
    this.boxText.setText(text);
    this.choices = choices;
    this.choiceIdx = 0;
    const L = LOBBY.choiceLine, n = choices?.length ?? 0, P = LOBBY.portraitSize;
    const bh = this.boxText.height + 14 + n * L, bw = this.viewW - 8;
    const top = this.sy(this.h.pac.y) - this.cam.scrollY > this.viewH / 2;
    const by = top ? 4 + (portrait ? P + 4 : 0) + 36 : this.viewH - bh - 4;
    this.boxText.setY(by + 7);
    this.choiceTop = by + 7 + this.boxText.height + 4;
    this.choiceTexts.forEach((t, i) => t.setVisible(i < n).setY(this.choiceTop + i * L + (L - 8) / 2));
    this.showChoices();
    this.box.clear().fillStyle(0x000000, 0.92).fillRect(4, by, bw, bh).lineStyle(1, 0xffffff, 1).strokeRect(4.5, by + 0.5, bw - 1, bh - 1).setVisible(true);
    this.boxText.setVisible(true);
    const px = 4, py = by - P - 3;
    this.portraitFrame.clear().fillStyle(0x000000, 1).fillRect(px, py - 1, P + 4, P + 4)
      .lineStyle(1, 0xffffff, 1).strokeRect(px + 0.5, py - 0.5, P + 3, P + 3);
    if (portrait) this.portrait.setTexture(portrait).setDisplaySize(P, P).setPosition(px + 2, py + 1);
    this.portraitFrame.setVisible(!!portrait);
    this.portrait.setVisible(!!portrait);
    this.talking = true;
  }

  showChoices() {
    this.choices?.forEach((c, i) => this.choiceTexts[i].setText(`${i === this.choiceIdx ? '>' : ' '} ${c.label}`));
  }

  pickChoice(y) {
    const i = y == null ? this.choiceIdx : Math.floor((y / LOBBY.zoom - this.choiceTop) / LOBBY.choiceLine);
    const c = this.choices[i];
    if (!c) return;
    this.closeText();
    c.act?.();
  }

  closeText(silent) {
    this.choices = null;
    this.choiceTexts.forEach((t) => t.setVisible(false));
    [this.box, this.boxText, this.portraitFrame, this.portrait].forEach((o) => o.setVisible(false));
    this.talking = false;
    if (!silent) sfx.click();
  }

  // Tap: pick a choice or close the box, or talk to whatever Pac-Man faces.
  interact(y = null) {
    if (this.mode !== 'walk') return;
    if (this.talking && this.choices) { this.pickChoice(y); return; }
    if (this.talking) { this.closeText(); return; }
    const f = facing(this.h), tx = LOBBY.text;
    const id = subsystemOf(f.cell);
    if (id) { this.talkTo(id); return; }
    if (f.cell === 'A') { this.talkToAdder(); return; }
    if (f.cell === 'Z') { this.useSwitch(); return; }
    if (f.cell === 'O') { this.talkToLamp(this.partIndex(this.lamps, f.x, f.y)); return; }
    if (f.cell === 'H') { this.useLever(this.partIndex(this.levers, f.x, f.y)); return; }
    if (f.cell === 'F') { this.talkToReel(); return; }
    if (f.cell === 'X') { this.say(world.halted ? tx.mechaOver : tx.mecha, 'board/portrait-mecha'); return; }
    const ghost = LOBBY.ghosts[f.cell];
    if (ghost) { this.say(tx[ghost], 'board/portrait-logic'); return; }
    const key = LOBBY.cellText[f.cell];
    const art = PARTS[f.cell] ?? { N: 'sign', g: 'gurke' }[f.cell];
    if (key) this.say(tx[key], art ? tileKey('board', art) : null);
  }

  // A subsystem: one line about what it does; unlocked, it offers to ENTER its layer. Locked, it sleeps.
  talkTo(id) {
    const tx = LOBBY.text, i = ORDER.indexOf(id), name = LOBBY.names[id];
    if (!isUnlocked(id)) {
      if (i === 0) { this.say(tx.crtLocked, 'board/portrait-crt'); return; }
      this.say(tx.locked.replace('{name}', name).replace('{prev}', LOBBY.names[ORDER[i - 1]]), `board/portrait-${id}-off`);
      return;
    }
    // While the 256 switch is on (hard mode), every part not yet beaten in hard mode offers its hard layer.
    const hard = isHard() && !isHardWon(id);
    const text = isHard() && isHardWon(id) ? `${tx[id]} ${tx.hardWon}` : hard ? `${tx[id]} ${tx.hard}`
      : isWon(id) ? `${tx[id]} ${tx.won}` : tx[id];
    this.say(text, `board/portrait-${id}`, [
      { label: hard ? tx.enterHard : tx.enter, act: () => this.enter(id) },
      { label: tx.notNow },
    ]);
  }

  // The bonus layer: the round counter's +1, played in the Adder scene. Winning it flips the 256 switch on.
  talkToAdder() {
    const tx = LOBBY.text;
    this.say(isAdderWon() ? `${tx.adder} ${tx.adderWon}` : tx.adder, 'board/portrait-adder', [
      { label: tx.enter, act: () => this.enterAdder() },
      { label: tx.notNow },
    ]);
  }

  enterAdder() {
    const back = { from: 'adder' };
    this.leave('Adder', {
      returnTo: 'Lobby',
      returnData: back,
      onWin: () => { markAdderWon(); setLevel256(true); back.won = true; },
    }, this.reservedCenter('adder'));
  }

  // The 256 switch: stuck until the adder is won, then it flips the maze between level 256 and level 1.
  useSwitch() {
    const tx = LOBBY.text;
    if (!isAdderWon()) { this.say(tx.switchStuck, 'board/portrait-switch'); return; }
    const on = isSwitchOn();
    this.say(on ? tx.switchOn : tx.switchOff, 'board/portrait-switch', [
      { label: on ? tx.flipOff : tx.flipOn, act: () => { sfx.click(); setSwitch(!on); setLevel256(!on); } },
      { label: tx.leave },
    ]);
  }

  // A status lamp: what it stands for and whether it's lit.
  talkToLamp(i) {
    const tx = LOBBY.text, on = lamps()[i];
    this.say(tx.lamp.replace('{n}', i + 1).replace('{what}', tx.lamps[i]).replace('{state}', on ? tx.lampOn : tx.lampOff),
      tileKey('board', `lamp-${i + 1}-${on ? 'on' : 'off'}`));
  }

  // A cheat lever: flips its lamp's achievement (src/progress.js setLamp, which also sets or clears the lamps it
  // depends on), keeps the maze's level in step with the 256 switch, and restarts the lobby to show it.
  useLever(i) {
    const tx = LOBBY.text;
    this.say(tx.lever.replaceAll('{n}', i + 1), tileKey('board', lamps()[i] ? 'lever-down' : 'lever-up'), [
      { label: tx.pull, act: () => {
        const was = isSwitchOn();
        setLamp(i, !lamps()[i]);
        if (isSwitchOn() !== was) setLevel256(isSwitchOn());
        this.scene.restart({ lever: i });
      } },
      { label: tx.notNow },
    ]);
  }

  // The film reel: WATCH zooms into it and plays the credits, which come back here.
  talkToReel() {
    const tx = LOBBY.text, portrait = tileKey('board', 'reel');
    if (!this.scene.manager.keys.Credits) { this.say(`${tx.reel} ${tx.reelEmpty}`, portrait); return; }
    this.say(tx.reel, portrait, [
      { label: tx.watch, act: () => this.leave('Credits', { returnTo: 'Lobby', returnData: { reel: true } }, { x: this.sx(this.reel.x), y: this.sy(this.reel.y) }) },
      { label: tx.notNow },
    ]);
  }

  // Zoom into the subsystem, then its deep layer.
  enter(id) {
    this.leave('Deep', { layer: DEEP_LAYERS.findIndex((L) => L.id === id), from: 'lobby' }, this.centerOf(id));
  }

  leave(scene, data = {}, focus = this.centerOf('crt')) {
    if (this.mode !== 'walk') return;
    this.closeText(true);
    this.mode = 'outro';
    this.introT = 1;
    this.focus = focus;
    this.target = { scene, data: scene === 'Game' ? { continue: true } : data };
  }

  setupInput() {
    // Hold a finger down and drag to keep walking; a short tap talks or picks.
    this.anchor = null;
    this.input.on('pointerdown', (p, over) => {
      unlockAudio();
      if (this.mode === 'intro') { this.introT = 1; return; } // tap to skip the zoom-out
      if (over.includes(this.layerBtn)) return;
      this.anchor = { x: p.x, y: p.y, id: p.id, at: this.time.now, moved: false };
    });
    this.input.on('pointermove', (p) => {
      const a = this.anchor;
      if (!a || p.id !== a.id || !p.isDown) return;
      const dx = p.x - a.x, dy = p.y - a.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < LOBBY.dragDeadzone) { this.held = null; return; }
      a.moved = true;
      if (this.choices) return;
      if (this.talking) this.closeText();
      this.held = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    });
    this.input.on('pointerup', (p) => {
      const a = this.anchor;
      if (!a || p.id !== a.id) return;
      this.anchor = null;
      this.held = null;
      if (!a.moved && this.time.now - a.at < LOBBY.tapTime) this.interact(p.y);
    });
    this.input.keyboard?.on('keydown', (e) => {
      unlockAudio();
      if (e.code === 'Space' || e.code === 'Enter') this.interact();
      if (this.choices && (KEYS[e.code] === 'up' || KEYS[e.code] === 'down')) {
        const n = this.choices.length;
        this.choiceIdx = (this.choiceIdx + (KEYS[e.code] === 'up' ? n - 1 : 1)) % n;
        this.showChoices();
        return;
      }
      if (this.choices) return;
      if (KEYS[e.code]) { this.keyDir = KEYS[e.code]; if (this.talking) this.closeText(); }
    });
    this.input.keyboard?.on('keyup', (e) => { if (KEYS[e.code] === this.keyDir) this.keyDir = null; });
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

  // The room fits the screen, so the view is fixed; during the intro/outro the camera zooms from/to `focus`.
  updateCamera() {
    const normal = { x: this.viewW / 2, y: this.viewH / 2 };
    let zoom = LOBBY.zoom, center = normal;
    if (this.mode === 'intro' || this.mode === 'outro') {
      const e = 1 - (1 - Math.min(1, Math.max(0, this.introT))) ** 3;
      zoom = LOBBY.introZoom * (LOBBY.zoom / LOBBY.introZoom) ** e;
      center = { x: this.focus.x + (normal.x - this.focus.x) * e, y: this.focus.y + (normal.y - this.focus.y) * e };
    }
    this.cam.setZoom(zoom);
    this.cam.setScroll(center.x - GAME_WIDTH / zoom / 2, center.y - GAME_HEIGHT / zoom / 2);
    const showUi = this.mode === 'walk';
    const textBox = [this.box, this.boxText, this.portraitFrame, this.portrait, ...this.choiceTexts];
    this.children.list.filter((o) => o.scrollFactorX === 0 && !textBox.includes(o)).forEach((o) => o.setVisible(showUi));
  }

  update(time, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    this.t += dt;
    if (this.mode === 'intro') {
      this.introT += dt / LOBBY.introTime;
      if (this.introT >= 1) this.arrived();
    } else if (this.mode === 'outro') {
      this.introT -= dt / LOBBY.outroTime;
      if (this.introT <= 0) { this.mode = 'gone'; this.scene.start(this.target.scene, this.target.data); return; }
    } else if (this.mode === 'walk' && !this.talking) {
      stepHall(this.h, dt, this.held ?? this.keyDir);
    }
    if (this.highlight && this.mode === 'walk') {
      this.highlight.t -= dt;
      if (this.highlight.t <= 0) this.highlight = null;
    }
    this.refreshSubsystems();

    const p = this.h.pac;
    const frame = p.moving ? charFrame('pac', (p.steps + p.t) / LOBBY.walkSpeed, 2) : 0;
    this.place(this.pac.setTexture(`arcade/pac-${p.dir === 'left' ? 'right' : p.dir}-${frame}`).setFlipX(p.dir === 'left'), pacPos(this.h));
    if (this.mecha) this.place(this.mecha.s.setTexture(`board/mecha-${world.halted ? 1 : Math.floor(this.t * LOBBY.mechaRate) % 2}`), this.mecha);
    for (const g of this.ghosts) this.place(g.s.setTexture(`maze/ghost-${g.name}-${g.dir}-${charFrame(g.name, this.t, 2)}`), g);
    this.updateCamera();
  }

  // The zoom out is done: say what just happened.
  arrived() {
    this.mode = 'walk';
    const tx = LOBBY.text;
    if (this.from === 'adder' && this.won) { sfx.power(); this.say(tx.switchFlipped, 'board/portrait-switch'); return; }
    if (this.highlight) { sfx.power(); this.say(tx.woke.replace('{name}', LOBBY.names[this.highlight.id]), `board/portrait-${this.highlight.id}`); }
    else if (this.won && allWon()) this.say(`${tx.allWon} ${tx.adderAppears}`, 'board/portrait-adder');
  }
}
