import { GAME_TITLE, GAME_WIDTH, GAME_HEIGHT, COLORS, PIXEL, UI } from '../config.js';
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
    const cy = GAME_HEIGHT / 2;

    this.add.text(cx, cy - 300, GAME_TITLE.toUpperCase(), {
      fontFamily: UI.arcadeFont, fontSize: 48, color: COLORS.textReady,
    }).setOrigin(0.5);

    // The cast, arcade attract-screen style.
    const sprite = (x, key) => this.add.image(x, cy - 100, key)
      .setScale(PIXEL.sprite * PIXEL.zoom / this.textures.get(key).getSourceImage().width);
    // Animated like in the maze: a single still frame of Max's chomp can read oddly on its own.
    this.pac = sprite(cx - 180, 'maze/pac-0');
    this.ghosts = Object.keys(COLORS.ghosts).map((name, i) => [name, sprite(cx - 60 + i * 80, `maze/ghost-${name}-left-0`)]);
    this.t = 0;

    const prompt = this.add.text(cx, cy + 120, 'TAP TO START', {
      fontFamily: UI.arcadeFont, fontSize: 36, color: COLORS.text,
    }).setOrigin(0.5);

    this.tweens.add({ targets: prompt, alpha: 0.2, duration: fxSeconds('tapPrompt') * 1000, yoyo: true, repeat: -1 });

    this.add.text(cx, GAME_HEIGHT - 260, 'SWIPE TO TURN\nEAT ALL THE DOTS', {
      fontFamily: UI.arcadeFont, fontSize: 24, color: COLORS.textDim, align: 'center',
    }).setOrigin(0.5).setLineSpacing(16);

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
    this.pac.setTexture(`maze/pac-${PAC_CYCLE[animFrame(this.t, UI.menuPacAnim, PAC_CYCLE.length)]}`);
    this.ghosts.forEach(([name, g]) => g.setTexture(`maze/ghost-${name}-left-${animFrame(this.t, UI.menuGhostAnim, 2)}`));
  }
}
