import { GAME_TITLE, GAME_WIDTH, GAME_HEIGHT, COLORS, PIXEL, UI, MENU } from '../config.js';
import { unlockAudio, setBed, audioRunning, isMuted } from '../sound.js';
import { fxSeconds, animFrame, PAC_CYCLE } from '../systems/anim.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    // The start screen's tune. Browsers only allow sound after a tap: where it can't start on its own (phones),
    // the first tap starts the music and the next one the game.
    setBed('menu');
    unlockAudio();
    const cx = GAME_WIDTH / 2;

    this.add.text(cx, MENU.titleY, GAME_TITLE.toUpperCase(), {
      fontFamily: UI.arcadeFont, fontSize: 48, color: COLORS.textReady,
    }).setOrigin(0.5);

    // The big layer cake with the arcade machine standing on top, both 1:1.
    this.add.image(MENU.cakeX, MENU.cakeY, 'menu/cake').setOrigin(0);
    this.add.image(MENU.machineX, MENU.machineY, 'cabinet/machine').setOrigin(0);

    // The machine's screen runs the attract show: the cast chases across a row of dots, clipped to the picture.
    const S = MENU.screen, sx = MENU.machineX + S.x, sy = MENU.machineY + S.y;
    this.screen = { x: sx, w: S.w };
    const clip = this.make.graphics({ add: false }).fillRect(sx, sy, S.w, S.h).createGeometryMask();
    const rowY = sy + MENU.castY;
    this.dots = [];
    for (let x = sx + MENU.dotGap / 2; x < sx + S.w; x += MENU.dotGap) {
      this.dots.push(this.add.image(x, rowY, 'maze/dot'));
    }
    // Animated like in the maze: a single still frame of Max's chomp can read oddly on its own.
    const sprite = (key) => this.add.image(0, rowY, key).setMask(clip)
      .setScale(PIXEL.sprite / this.textures.get(key).getSourceImage().width);
    this.pac = sprite('maze/pac-0');
    this.ghosts = Object.keys(COLORS.ghosts).map((name) => [name, sprite(`maze/ghost-${name}-right-0`)]);
    this.t = 0;

    const prompt = this.add.text(sx + S.w / 2, sy + MENU.promptY, 'TAP TO\nSTART', {
      fontFamily: UI.arcadeFont, fontSize: MENU.promptSize, color: COLORS.text, align: 'center',
    }).setOrigin(0.5).setLineSpacing(12);

    this.tweens.add({ targets: prompt, alpha: 0.2, duration: fxSeconds('tapPrompt') * 1000, yoyo: true, repeat: -1 });

    // Footer links in one row. Big padded hit areas; tapping one must not start the game.
    const links = [['Making-Of', './making-of/'], ['Lab', './lab/'], ['Impressum', './impressum/']].map(([label, url], i) => {
      const link = this.add.text(cx + (i - 1) * 230, GAME_HEIGHT - 70, label, {
        fontFamily: UI.fontFamily, fontSize: UI.linkSize, color: i === 0 ? COLORS.link : COLORS.textDim,
        padding: { x: 30, y: 30 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      link.on('pointerup', () => { window.location.href = url; });
      return link;
    });

    let started = false;
    const start = () => {
      if (started) return;
      if (!audioRunning() && !isMuted()) { unlockAudio(); return; }
      started = true;
      this.scene.start('Game');
    };
    this.input.on('pointerdown', (pointer, over) => {
      if (!links.some((l) => over.includes(l))) start();
    });
    this.input.keyboard?.once('keydown-SPACE', start);
    this.input.keyboard?.once('keydown-ENTER', start);
  }

  update(_time, delta) {
    this.t += delta / 1000;
    // The cast runs left to right (Pac-Man in front, the ghosts after him), eats the dots and comes round again.
    const { x, w } = this.screen, n = this.ghosts.length;
    const lap = w + (n + 2) * MENU.castGap;
    const pacX = x - MENU.castGap + ((this.t * MENU.castSpeed) % lap);
    this.pac.x = Math.round(pacX);
    this.ghosts.forEach(([, g], i) => { g.x = Math.round(pacX - (i + 2) * MENU.castGap); });
    this.dots.forEach((dot) => dot.setVisible(dot.x > pacX));
    this.pac.setTexture(`maze/pac-${PAC_CYCLE[animFrame(this.t, UI.menuPacAnim, PAC_CYCLE.length)]}`);
    this.ghosts.forEach(([name, g]) => g.setTexture(`maze/ghost-${name}-right-${animFrame(this.t, UI.menuGhostAnim, 2)}`));
  }
}
