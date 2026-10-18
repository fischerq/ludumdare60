import { GAME_WIDTH, GAME_HEIGHT, COLORS, UI, INPUT, DEEP, ADDER } from '../config.js';
import { createAdder, stepAdder, hop, carryPos, pulsesAt, gateOut, cinOf, byteString, byteValue } from '../systems/layers/adder.js';
import { css, floor, neonLine } from '../systems/layers/tron.js';
import { setDriver } from '../systems/arcade/world.js';
import { sfx, unlockAudio, setAudioPaused, setBed } from '../sound.js';
import { addLayerButton } from '../layerButton.js';
import { showCallout } from '../callout.js';

const KEYS = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Space: 'up',
  KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down',
};
const ZOOM = 2;               // screen px per art px
const HUD = 64, BAR = 52;     // art px of the fixed readout at the top and the button bar at the bottom
const ABOVE = 3, BELOW = 4;   // rows of board drawn above the OVERFLOW row and below bit 0 (not walkable)

// The adder bonus layer: the round counter's +1 as an 8-bit ripple-carry adder, played like Crossy Road (rules in
// src/systems/layers/adder.js, numbers in ADDER, design/systems/layer-adder.md). Tap hops up, a swipe hops that way.
//
// data: returnTo (scene key to go back to, default 'Game'), returnData (its data, default { continue: true } for
// 'Game'), onWin(result) called on the win, seed (the board). On the win the scene also emits 'adder-win' with
// result = { hits, time } on this.game.events (and 'win' on its own events), then goes back to returnTo.
export default class AdderScene extends Phaser.Scene {
  constructor() {
    super('Adder');
  }

  create(data = {}) {
    this.data0 = data;
    this.returnTo = data.returnTo ?? 'Game';
    this.returnData = data.returnData ?? (this.returnTo === 'Game' ? { continue: true } : {});
    this.st = createAdder(data.seed ?? Math.floor(Math.random() * 1e9));
    this.P = ADDER.style;
    this.leaving = false;
    this.overT = 0;
    setBed('adder');
    setDriver('bot'); // nobody at the maze while we're in here: the bot plays on

    const T = ADDER.tile, N = this.st.rows.length, vw = GAME_WIDTH / ZOOM, vh = GAME_HEIGHT / ZOOM;
    this.T = T;
    this.N = N;
    this.vh = vh;
    this.ox = Math.floor((vw - ADDER.cols * T) / 2);
    this.H = (ABOVE + N + BELOW) * T;
    const cam = this.cameras.main;
    cam.setZoom(ZOOM).setOrigin(0, 0).setRoundPixels(true).setBackgroundColor(this.P.bg);
    this.drawBoard();

    // Gates (they change when the carry arrives), pulses (a pool) and the carry.
    this.gates = [];
    this.st.rows.forEach((r, y) => {
      if (r.kind !== 'gate') return;
      for (const [x, g] of Object.entries(r.gates)) {
        this.gates.push({ img: this.add.image(this.tx(+x), this.ty(y), this.gateKey(g, 0)).setOrigin(0), g, bit: r.bit });
      }
    });
    this.pool = [];
    this.carry = this.add.image(0, 0, 'deep/adder/carry-0').setDepth(5);
    this.trail = this.add.graphics().setDepth(4);
    this.trailPts = [];

    // The fixed readout: the counter's byte, bit 7 first, and its value.
    const fixed = (o) => o.setScrollFactor(0).setDepth(20);
    fixed(this.add.graphics().fillStyle(this.P.bg, 0.92).fillRect(0, 0, vw, HUD).fillStyle(this.P.line).fillRect(0, HUD - 1, vw, 1));
    fixed(this.add.graphics().fillStyle(this.P.bg, 0.92).fillRect(0, vh - BAR, vw, BAR).fillStyle(this.P.line).fillRect(0, vh - BAR, vw, 1));
    const text = (x, y, s, color = COLORS.text, size = 8, origin = 0.5) => fixed(this.add.text(x, y, s, {
      fontFamily: UI.arcadeFont, fontSize: size, color, align: 'center', resolution: 1,
    }).setOrigin(origin, 0).setLineSpacing(4));
    text(vw / 2, 6, 'BONUS: THE ADDER   COUNTER + 1', css(this.P.line));
    this.bitText = [];
    for (let i = 0; i < 8; i++) {
      const x = vw / 2 + (i - 3.5) * 22;
      this.bitText.push(text(x, 20, '1', css(this.P.one), 16));
      text(x, 38, String(7 - i), COLORS.textDim);
    }
    this.valueText = text(vw / 2, 50, '', COLORS.textDim);
    this.info = text(vw / 2 - 34, vh - BAR + 10, 'TAP: HOP UP\nSWIPE: HOP THAT WAY', COLORS.textDim);
    this.hitText = text(vw / 2 - 34, vh - BAR + 34, '', COLORS.textDim);
    this.upZone = addLayerButton(this, vw - 64, vh - 42, 'LAYER\nUP', () => this.leave(), 1, true);
    this.children.list.slice(-3).forEach((o) => o.setDepth(21));

    this.setupInput();
    this.setupPauseOnHide();
    this.camY = this.camTarget();
    cam.setScroll(0, this.camY);
    cam.setZoom(ZOOM * 2.5);
    cam.zoomTo(ZOOM, ADDER.transition * 1000, 'Sine.easeOut');
    cam.fadeIn(ADDER.transition * 1000);
    this.refreshHud();
  }

  // World art px of tile column x / the top of row y.
  tx(x) { return this.ox + x * this.T; }
  ty(y) { return (ABOVE + this.N - 1 - y) * this.T; }
  gateKey(g, out) { return `deep/adder/gate-${g.replace(/\d/, '')}-${out}`; }

  // The board that doesn't move, into one canvas: floor grid, the wires, the chip of each gate row, and labels.
  drawBoard() {
    const T = this.T, W = ADDER.cols * T, P = this.P, key = 'adder-board';
    if (this.textures.exists(key)) this.textures.remove(key);
    const tex = this.textures.createCanvas(key, W, this.H), ctx = tex.getContext();
    ctx.imageSmoothingEnabled = false;
    floor(ctx, P, ADDER.cols, this.H / T, T);
    const chip = this.textures.get('deep/adder/chip').getSourceImage();
    const label = (x, y, s, color, size = 8, origin = 0) => this.add.text(x, y, s, {
      fontFamily: UI.arcadeFont, fontSize: size, color, resolution: 1,
    }).setOrigin(origin, 0.5).setDepth(1);
    // Below bit 0, the +1 coming in; above the top, the edge of the 8-bit register.
    const yIn = (ABOVE + this.N) * T, yTop = ABOVE * T;
    ctx.fillStyle = css(P.glow);
    ctx.fillRect(0, yIn + T, W, 2);
    ctx.fillRect(0, yTop - 2, W, 2);
    label(this.ox + W / 2, yIn + T * 1.6, 'COUNTER = 255\nTHE +1 COMES IN\nAS CARRY INTO BIT 0', css(P.line), 8, 0.5).setAlign('center').setLineSpacing(6);
    label(this.ox + W / 2, T * 1.5, 'OUT OF THE\n8-BIT REGISTER', COLORS.textDim, 8, 0.5).setAlign('center').setLineSpacing(6);
    this.sumText = [];
    this.st.rows.forEach((r, y) => {
      const top = this.ty(y), mid = top + T / 2, py = top; // the canvas sits at world y 0
      if (r.kind === 'lane') {
        neonLine(ctx, 0, py + T / 2, W - 1, py + T / 2, P.wire, P.glow);
        // Faint arrows along the wire show which way its pulses run.
        ctx.fillStyle = css(P.wire);
        for (let x = 1; x < ADDER.cols; x += 3) {
          const cx = x * T + T / 2;
          for (let k = 0; k < 4; k++) ctx.fillRect(cx + (r.dir > 0 ? -k : k), py + T / 2 - 6 + k, 1, 12 - 2 * k);
        }
        label(this.ox + 2, mid - 10, r.name, css(P.wire));
      } else if (r.kind === 'gate') {
        for (let x = 0; x < ADDER.cols; x++) if (!r.gates[x]) ctx.drawImage(chip, x * T, py);
      } else if (r.kind === 'cin') {
        ctx.fillStyle = css(P.line);
        ctx.fillRect(0, py, W, 1);
        label(this.ox + 4, mid - 6, `BIT ${r.bit}`, css(P.line));
        label(this.ox + 4, mid + 7, r.bit === 0 ? 'A=1 B=0 CIN=1 (+1)' : 'A=1 B=0 CIN=CARRY', COLORS.textDim);
        this.sumText[r.bit] = label(this.ox + W - 4, mid, 'S=1', css(P.one), 8, 1);
      } else if (r.kind === 'top') {
        ctx.fillStyle = css(DEEP.hazard);
        ctx.fillRect(0, py, W, 1);
        ctx.fillRect(0, py + T - 1, W, 1);
        label(this.ox + W / 2, mid, 'CARRY OUT: OVERFLOW', css(DEEP.hazard), 8, 0.5);
      }
    });
    tex.refresh();
    this.add.image(this.ox, 0, key).setOrigin(0);
  }

  setupInput() {
    const touches = new Map();
    this.input.on('pointerdown', (p, over) => {
      unlockAudio();
      if (over?.includes(this.upZone)) return;
      touches.set(p.id, { x: p.x, y: p.y, used: false });
    });
    this.input.on('pointermove', (p) => {
      const s = touches.get(p.id);
      if (!p.isDown || !s || s.used) return;
      const dx = p.x - s.x, dy = p.y - s.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < INPUT.swipeMin) return;
      s.used = true;
      hop(this.st, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    });
    this.input.on('pointerup', (p) => {
      const s = touches.get(p.id);
      touches.delete(p.id);
      if (s && !s.used) hop(this.st, 'up'); // a tap
    });
    this.input.keyboard?.on('keydown', (e) => {
      unlockAudio();
      if (KEYS[e.code]) hop(this.st, KEYS[e.code]);
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

  camTarget() {
    const c = carryPos(this.st), y = this.ty(c.y) + this.T / 2 - ADDER.camLead * this.vh;
    return Phaser.Math.Clamp(y, -HUD, this.H - this.vh + BAR);
  }

  update(time, delta) {
    const dt = Math.min(delta / 1000, 0.05), st = this.st;
    for (const e of stepAdder(st, dt)) {
      if (e.type === 'hop') sfx.click();
      if (e.type === 'hit') sfx.death();
      if (e.type === 'stage') { sfx.power(); this.refreshHud(); }
      if (e.type === 'overflow') this.overflow();
    }
    if (st.won) this.overT += dt;

    // Camera: follows the carry up and down, eased; during the overflow it follows the carry flying out.
    const k = 1 - Math.exp(-ADDER.camEase * dt);
    this.camY += (this.camTarget() - this.camY) * k;
    this.cameras.main.setScroll(0, Math.round(this.camY));

    this.drawPulses();
    this.drawCarry();
  }

  drawPulses() {
    const T = this.T, top = this.camY - T, bottom = this.camY + this.vh + T;
    let n = 0;
    this.st.rows.forEach((r, y) => {
      const ry = this.ty(y);
      if (r.kind !== 'lane' || ry < top || ry > bottom) return;
      const side = r.dir > 0 ? 'right' : 'left';
      for (const q of pulsesAt(r, this.st.t)) {
        for (let i = 0; i < q.len; i++) {
          const px = q.x + i;
          if (px <= -1 || px >= ADDER.cols) continue;
          const front = r.dir > 0 ? i === q.len - 1 : i === 0, back = r.dir > 0 ? i === 0 : i === q.len - 1;
          const key = q.len === 1 ? 'single' : front ? `head-${side}` : back ? `tail-${side}` : 'body';
          const img = this.pool[n] ?? (this.pool[n] = this.add.image(0, 0, '__DEFAULT').setOrigin(0).setDepth(3));
          img.setTexture(`deep/adder/pulse-${key}`).setPosition(Math.round(this.tx(px)), ry).setVisible(true)
            .setCrop(Math.max(0, -px) * T, 0, Math.min(1, ADDER.cols - px) * T - Math.max(0, -px) * T, T);
          n++;
        }
      }
    });
    for (let i = n; i < this.pool.length; i++) this.pool[i].setVisible(false);
  }

  drawCarry() {
    const st = this.st, c = carryPos(st), T = this.T;
    let x = this.tx(c.x) + T / 2, y = this.ty(c.y) + T / 2;
    let key = 'carry-' + (Math.floor(st.t * 4) % 2);
    if (c.hopping) { key = 'carry-hop'; y -= Math.round(Math.sin(Math.PI * c.k) * 6); }
    if (st.hitT > 0) key = 'carry-hit';
    if (st.won) y -= Math.round(this.overT * this.overT * 120); // the carry falls out of the register, upward
    this.carry.setTexture(`deep/adder/${key}`).setPosition(Math.round(x), Math.round(y))
      .setVisible(st.hitT <= 0 || Math.floor(st.t * 10) % 2 === 0);
    // Light trail behind the carry (visual only).
    const last = this.trailPts[this.trailPts.length - 1];
    if (!last || last.x !== x || last.y !== y) this.trailPts.push({ x, y, t: st.t });
    while (this.trailPts.length && st.t - this.trailPts[0].t > DEEP.trail) this.trailPts.shift();
    if (st.hitT > 0) this.trailPts = [];
    const g = this.trail.clear();
    for (const [w, color] of [[DEEP.trailWidth + 2, this.P.glow], [DEEP.trailWidth, this.P.line]]) {
      for (let i = 1; i < this.trailPts.length; i++) {
        const a = this.trailPts[i - 1], b = this.trailPts[i];
        g.lineStyle(w, color, 1 - (st.t - b.t) / DEEP.trail).lineBetween(a.x, a.y, b.x, b.y);
      }
    }
  }

  refreshHud() {
    const st = this.st, bits = byteString(st);
    [...bits].forEach((b, i) => this.bitText[i].setText(b).setColor(css(b === '1' ? this.P.one : this.P.zero)));
    this.valueText.setText(st.won ? '= 0  THE CARRY IS LOST' : `= ${byteValue(st)}`);
    st.sum.forEach((b, i) => this.sumText[i]?.setText(`S=${b}`).setColor(css(b ? this.P.one : this.P.zero)));
    for (const g of this.gates) g.img.setTexture(this.gateKey(g.g, gateOut(g.g, cinOf(st, g.bit))));
    this.hitText.setText(st.hits ? `HITS ${st.hits}` : '');
  }

  // Past bit 7: the carry has nowhere to go, the byte wraps to 00000000. Then the layer ends.
  overflow() {
    sfx.clear();
    this.refreshHud();
    this.cameras.main.shake(400, 0.006);
    const c = showCallout(this, GAME_WIDTH / ZOOM / 2, this.vh / 2, 'OVERFLOW!\n11111111 + 1\n= 00000000\nLEVEL 256', 1);
    this.children.list.slice(-2).forEach((o) => o.setScrollFactor(0).setDepth(30)); // the callout's box and text
    const result = { hits: this.st.hits, time: +this.st.t.toFixed(1) };
    this.time.delayedCall(ADDER.overflowTime * 1000, () => {
      this.data0.onWin?.(result);
      this.events.emit('win', result);
      this.game.events.emit('adder-win', result);
      this.leave();
    });
  }

  leave() {
    if (this.leaving) return;
    this.leaving = true;
    const cam = this.cameras.main, ms = ADDER.transition * 1000;
    cam.zoomTo(ZOOM * 0.6, ms, 'Sine.easeIn');
    cam.fadeOut(ms);
    this.time.delayedCall(ms, () => this.scene.start(this.returnTo, this.returnData));
  }
}
