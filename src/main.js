import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';
import GameOverScene from './scenes/GameOverScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: COLORS.background,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  input: {
    activePointers: 2,
  },
  scene: [BootScene, MenuScene, GameScene, GameOverScene],
};

window.game = new Phaser.Game(config);
