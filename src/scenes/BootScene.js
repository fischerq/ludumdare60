import { COLORS, PLAYER, COIN, HAZARD } from '../config.js';

// Generates all placeholder textures in code. Swap these for real art later.
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.makeCircle('player', PLAYER.radius, COLORS.player);
    this.makeCircle('coin', COIN.radius, COLORS.coin);
    this.makeCircle('hazard', HAZARD.radius, COLORS.hazard);
    this.scene.start('Menu');
  }

  makeCircle(key, radius, color) {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(color, 1);
    g.fillCircle(radius, radius, radius);
    g.lineStyle(4, 0xffffff, 0.6);
    g.strokeCircle(radius, radius, radius - 2);
    g.generateTexture(key, radius * 2, radius * 2);
    g.destroy();
  }
}
