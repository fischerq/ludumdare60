import { GAME_WIDTH, GAME_HEIGHT, COLORS, UI, BEST_KEY } from '../config.js';
import { unlockAudio } from '../sound.js';
import { fxSeconds } from '../systems/anim.js';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  init(data) {
    this.finalScore = data.score ?? 0;
    this.cleared = !!data.cleared;
  }

  create() {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const style = (color, size) => ({ fontFamily: UI.arcadeFont, fontSize: size, color, align: 'center' });

    let best = this.finalScore;
    try {
      best = Math.max(best, Number(localStorage.getItem(BEST_KEY)) || 0);
      localStorage.setItem(BEST_KEY, String(best));
    } catch (e) { /* storage may be unavailable (private mode) */ }

    this.add.text(cx, cy - 260, this.cleared ? 'MAZE\nCLEAR!' : 'GAME\nOVER', style(this.cleared ? COLORS.textReady : COLORS.textHud, 72))
      .setOrigin(0.5).setLineSpacing(24);

    this.add.text(cx, cy - 40, `SCORE ${this.finalScore}`, style(COLORS.text, 36)).setOrigin(0.5);
    this.add.text(cx, cy + 30, `HIGH  ${best}`, style(COLORS.textDim, 28)).setOrigin(0.5);

    if (this.cleared) {
      // Placeholder until the first tech layer exists: clearing the maze will open the machine.
      this.add.text(cx, cy + 150, 'THE SCREEN FLICKERS...\nSOMETHING IS BEHIND\nTHE GLASS', style(COLORS.textDim, 22))
        .setOrigin(0.5).setLineSpacing(14);
    }

    const prompt = this.add.text(cx, cy + 320, 'TAP TO PLAY AGAIN', style(COLORS.text, 28)).setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.2, duration: fxSeconds('tapPrompt') * 1000, yoyo: true, repeat: -1 });

    // Short delay so the swipe that ended the game doesn't instantly restart.
    this.time.delayedCall(600, () => {
      const restart = () => { unlockAudio(); this.scene.start('Game'); };
      this.input.once('pointerdown', restart);
      this.input.keyboard?.once('keydown-SPACE', restart);
      this.input.keyboard?.once('keydown-ENTER', restart);
    });
  }
}
