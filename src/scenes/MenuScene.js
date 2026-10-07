import { GAME_WIDTH, GAME_HEIGHT, COLORS, UI } from '../config.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    this.add.text(cx, cy - 200, 'LUDUM DARE 60', {
      fontFamily: UI.fontFamily, fontSize: UI.titleSize, color: COLORS.text, fontStyle: 'bold',
    }).setOrigin(0.5);

    const prompt = this.add.text(cx, cy + 120, 'Tap to start', {
      fontFamily: UI.fontFamily, fontSize: UI.bodySize, color: COLORS.textDim,
    }).setOrigin(0.5);

    this.tweens.add({ targets: prompt, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });

    this.add.text(cx, GAME_HEIGHT - 120, 'Touch & drag to move · collect yellow · avoid red', {
      fontFamily: UI.fontFamily, fontSize: 28, color: COLORS.textDim,
      align: 'center', wordWrap: { width: GAME_WIDTH - 80 },
    }).setOrigin(0.5);

    const start = () => this.scene.start('Game');
    this.input.once('pointerdown', start);
    this.input.keyboard?.once('keydown-SPACE', start);
    this.input.keyboard?.once('keydown-ENTER', start);
  }
}
