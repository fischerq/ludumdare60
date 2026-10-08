import { GAME_WIDTH, GAME_HEIGHT, COLORS, UI } from '../config.js';

const BEST_KEY = 'ld60.best';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  init(data) {
    this.finalScore = data.score ?? 0;
  }

  create() {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    let best = this.finalScore;
    try {
      best = Math.max(best, Number(localStorage.getItem(BEST_KEY)) || 0);
      localStorage.setItem(BEST_KEY, String(best));
    } catch (e) { /* storage may be unavailable (private mode) */ }

    this.add.text(cx, cy - 220, 'GAME OVER', {
      fontFamily: UI.fontFamily, fontSize: UI.titleSize, color: COLORS.text, fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(cx, cy - 60, `Score: ${this.finalScore}`, {
      fontFamily: UI.fontFamily, fontSize: UI.scoreSize, color: COLORS.text,
    }).setOrigin(0.5);

    this.add.text(cx, cy + 20, `Best: ${best}`, {
      fontFamily: UI.fontFamily, fontSize: UI.bodySize, color: COLORS.textDim,
    }).setOrigin(0.5);

    const prompt = this.add.text(cx, cy + 200, 'Tap to restart', {
      fontFamily: UI.fontFamily, fontSize: UI.bodySize, color: COLORS.textDim,
    }).setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });

    // Short delay so the tap that killed you doesn't instantly restart.
    this.time.delayedCall(400, () => {
      const restart = () => this.scene.start('Game');
      this.input.once('pointerdown', restart);
      this.input.keyboard?.once('keydown-SPACE', restart);
      this.input.keyboard?.once('keydown-ENTER', restart);
    });
  }
}
