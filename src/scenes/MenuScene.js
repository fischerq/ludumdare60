import { GAME_TITLE, GAME_WIDTH, GAME_HEIGHT, COLORS, UI } from '../config.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    this.add.text(cx, cy - 200, GAME_TITLE, {
      fontFamily: UI.fontFamily, fontSize: UI.titleSize, color: COLORS.text, fontStyle: 'bold',
    }).setOrigin(0.5);

    const prompt = this.add.text(cx, cy + 120, 'Tap to start', {
      fontFamily: UI.fontFamily, fontSize: UI.bodySize, color: COLORS.textDim,
    }).setOrigin(0.5);

    this.tweens.add({ targets: prompt, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });

    this.add.text(cx, GAME_HEIGHT - 200, 'Touch & drag to move · collect yellow · avoid red', {
      fontFamily: UI.fontFamily, fontSize: 28, color: COLORS.textDim,
      align: 'center', wordWrap: { width: GAME_WIDTH - 80 },
    }).setOrigin(0.5);

    // Link to the making-of page. Big padded hit area; tapping it must not start the game.
    const link = this.add.text(cx, GAME_HEIGHT - 80, 'How this game was made →', {
      fontFamily: UI.fontFamily, fontSize: UI.linkSize, color: COLORS.link,
      padding: { x: 40, y: 28 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    link.on('pointerup', () => { window.location.href = './making-of/'; });

    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      this.scene.start('Game');
    };
    this.input.on('pointerdown', (pointer, over) => {
      if (!over.includes(link)) start();
    });
    this.input.keyboard?.once('keydown-SPACE', start);
    this.input.keyboard?.once('keydown-ENTER', start);
  }
}
