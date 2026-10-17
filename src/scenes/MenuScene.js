import { GAME_TITLE, GAME_WIDTH, GAME_HEIGHT, COLORS, PIXEL, UI } from '../config.js';
import { unlockAudio } from '../sound.js';
import { fxSeconds } from '../systems/anim.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    this.add.text(cx, cy - 300, GAME_TITLE.toUpperCase(), {
      fontFamily: UI.arcadeFont, fontSize: 48, color: COLORS.textReady,
    }).setOrigin(0.5);

    // The cast, arcade attract-screen style.
    const sprite = (x, key) => this.add.image(x, cy - 100, key)
      .setScale(PIXEL.sprite * PIXEL.zoom / this.textures.get(key).getSourceImage().width);
    sprite(cx - 180, 'pac-2');
    ['blinky', 'pinky', 'inky', 'clyde'].forEach((name, i) => {
      const x = cx - 60 + i * 80;
      sprite(x, 'ghost-0').setTint(COLORS.ghosts[name]);
      sprite(x, 'eyes-left');
    });

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
      started = true;
      unlockAudio();
      this.scene.start('Game');
    };
    this.input.on('pointerdown', (pointer, over) => {
      if (!links.some((l) => over.includes(l))) start();
    });
    this.input.keyboard?.once('keydown-SPACE', start);
    this.input.keyboard?.once('keydown-ENTER', start);
  }
}
