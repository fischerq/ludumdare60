import { GAME_WIDTH, GAME_HEIGHT, COLORS, UI, CREDITS } from '../config.js';
import { setBed } from '../sound.js';
import { animFrame, PAC_CYCLE } from '../systems/anim.js';

// The final screen, arcade ending style: a black screen, a slow staff roll, an intermission chase along the
// bottom, and THE END held at the close. Holding the screen fast-forwards; a tap after the end (or BACK) leaves.
// scene.start('Credits', { returnTo, returnData }) starts returnTo (default 'Menu') with returnData on leaving.
export default class CreditsScene extends Phaser.Scene {
  constructor() {
    super('Credits');
  }

  init(data) {
    this.returnTo = data?.returnTo ?? 'Menu';
    this.returnData = data?.returnData;
  }

  create() {
    setBed(CREDITS.bed);
    const cx = GAME_WIDTH / 2, S = CREDITS.style;
    this.cameras.main.setBackgroundColor(COLORS.background);
    const text = (y, str, st, font = UI.arcadeFont) => this.add.text(cx, y, str, {
      fontFamily: font, fontSize: st.size, color: st.color ?? '#ffffff', align: 'center',
    }).setOrigin(0.5, 0).setLineSpacing(st.size * 0.5);

    // Build the roll below the screen, one container that scrolls up.
    this.roll = this.add.container(0, GAME_HEIGHT - CREDITS.chase.band);
    let y = 0;
    for (const line of CREDITS.lines) {
      if (line.kind === 'gap') { y += CREDITS.emptyGap; continue; }
      const t = line.kind === 'emoji' ? text(y, line.text, S.emoji, UI.fontFamily) : text(y, line.text, S[line.kind]);
      this.roll.add(t);
      y += t.height + CREDITS.lineGap;
    }
    // THE END rolls in last and stops at endY.
    y += CREDITS.endGap;
    const end = text(y, CREDITS.endTitle, S.end);
    const endLine = text(y + end.height + CREDITS.lineGap * 2, CREDITS.endLine, S.endLine);
    this.roll.add([end, endLine]);
    this.stopAt = CREDITS.endY - y; // container y at which THE END sits at endY
    this.ended = false;
    this.endTime = 0;
    this.leaving = false; // the scene object is reused: without this, the second roll could never leave
    this.armed = false;

    this.prompt = this.add.text(cx, GAME_HEIGHT - 300, CREDITS.endPrompt, {
      fontFamily: UI.arcadeFont, fontSize: S.prompt.size, color: S.prompt.color,
    }).setOrigin(0.5).setVisible(false);

    // BACK, top left, with a big padded hit area.
    this.back = this.add.text(CREDITS.backPos.x, CREDITS.backPos.y, CREDITS.back, {
      fontFamily: UI.arcadeFont, fontSize: S.back.size, color: S.back.color, padding: { x: CREDITS.backPad, y: CREDITS.backPad },
    }).setOrigin(0.5).setDepth(2).setInteractive({ useHandCursor: true });
    this.back.on('pointerup', () => this.leave());

    this.makeChase();

    // Touch: hold anywhere to fast-forward, tap after the end to leave. Keyboard: hold SPACE / DOWN, ENTER or ESC.
    // A tap only leaves when it started after the end, so letting go of a fast-forward hold doesn't skip THE END.
    this.input.on('pointerdown', (_p, over) => {
      this.armed = !over.includes(this.back) && this.ended && this.endTime >= CREDITS.holdBeforeLeave;
    });
    this.input.on('pointerup', () => { if (this.armed) this.leave(); });
    const kb = this.input.keyboard;
    this.fastKeys = kb ? [kb.addKey('SPACE'), kb.addKey('DOWN')] : [];
    kb?.on('keydown-ESC', () => this.leave());
    kb?.on('keydown-ENTER', () => { if (this.ended) this.leave(); });
    this.t = 0;
  }

  // The intermission: Pac-Man runs left with the four ghosts after him, then chases them back blue.
  makeChase() {
    const C = CREDITS.chase, names = Object.keys(COLORS.ghosts);
    this.add.rectangle(0, GAME_HEIGHT - C.band, GAME_WIDTH, C.band, COLORS.background).setOrigin(0).setDepth(1);
    const sprite = (key) => this.add.image(0, C.y, key).setDepth(1).setScale(C.size / this.textures.get(key).getSourceImage().width);
    this.pac = sprite('maze/pac-0');
    this.ghosts = names.map((name) => ({ name, img: sprite(`maze/ghost-${name}-left-0`) }));
    // Everyone's offset behind the leader; the train runs one width plus its length each way.
    this.trainLen = C.pacLead + (names.length - 1) * C.ghostGap + C.size;
    this.chaseX = 0;
    this.chaseDir = -1;
  }

  updateChase(dt) {
    const C = CREDITS.chase, span = GAME_WIDTH + this.trainLen + C.size;
    this.chaseX += C.speed * dt;
    if (this.chaseX > span) { this.chaseX = 0; this.chaseDir = -this.chaseDir; }
    const pacFrame = PAC_CYCLE[animFrame(this.t, C.pacAnim, PAC_CYCLE.length)];
    const gf = animFrame(this.t, C.ghostAnim, 2);
    if (this.chaseDir < 0) {
      // Leftward: Pac-Man leads, ghosts follow.
      const x = GAME_WIDTH + C.size / 2 - this.chaseX;
      this.pac.setTexture(`maze/pac-${pacFrame}`).setFlipX(true).setX(x);
      this.ghosts.forEach((g, i) => g.img.setTexture(`maze/ghost-${g.name}-left-${gf}`).setX(x + C.pacLead + i * C.ghostGap));
    } else {
      // Rightward: the ghosts flee frightened, Pac-Man behind them.
      const x = -C.size / 2 + this.chaseX;
      this.ghosts.forEach((g, i) => g.img.setTexture(`maze/ghost-fright-${gf}`).setX(x - i * C.ghostGap));
      this.pac.setTexture(`maze/pac-${pacFrame}`).setFlipX(false).setX(x - (this.ghosts.length - 1) * C.ghostGap - C.pacLead);
    }
  }

  update(_time, delta) {
    const dt = delta / 1000;
    this.t += dt;
    const held = this.input.activePointer.isDown && !this.back.input?.isOver || this.fastKeys.some((k) => k.isDown);
    if (!this.ended) {
      this.roll.y -= (held ? CREDITS.fastSpeed : CREDITS.rollSpeed) * dt;
      if (this.roll.y <= this.stopAt) {
        this.roll.y = this.stopAt;
        this.ended = true;
      }
    } else {
      this.endTime += dt;
      if (this.endTime >= CREDITS.holdBeforeLeave && !this.prompt.visible) {
        this.prompt.setVisible(true);
        this.tweens.add({ targets: this.prompt, alpha: 0.2, duration: CREDITS.promptBlink * 1000, yoyo: true, repeat: -1 });
      }
    }
    this.updateChase(dt);
  }

  leave() {
    if (this.leaving) return;
    this.leaving = true;
    this.scene.start(this.returnTo, this.returnData);
  }
}
