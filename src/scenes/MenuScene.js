import { GAME_TITLE, GAME_WIDTH, GAME_HEIGHT, COLORS, PIXEL, UI } from '../config.js';
import { unlockAudio } from '../sound.js';

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

    this.tweens.add({ targets: prompt, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });

    this.add.text(cx, GAME_HEIGHT - 260, 'SWIPE TO TURN\nEAT ALL THE DOTS', {
      fontFamily: UI.arcadeFont, fontSize: 24, color: COLORS.textDim, align: 'center',
    }).setOrigin(0.5).setLineSpacing(16);

    // Link to the making-of page. Big padded hit area; tapping it must not start the game.
    const link = this.add.text(cx, GAME_HEIGHT - 120, 'How this game was made →', {
      fontFamily: UI.fontFamily, fontSize: UI.linkSize, color: COLORS.link,
      padding: { x: 40, y: 28 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    link.on('pointerup', () => { window.location.href = './making-of/'; });

    const legal = this.add.text(cx, GAME_HEIGHT - 40, 'Impressum', {
      fontFamily: UI.fontFamily, fontSize: UI.legalSize, color: COLORS.textDim,
      padding: { x: 30, y: 14 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    legal.on('pointerup', () => { window.location.href = './impressum/'; });

    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      unlockAudio();
      this.scene.start('Game');
    };
    this.input.on('pointerdown', (pointer, over) => {
      if (!over.includes(link) && !over.includes(legal)) start();
    });
    this.input.keyboard?.once('keydown-SPACE', start);
    this.input.keyboard?.once('keydown-ENTER', start);
  }
}
