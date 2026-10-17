import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';
import GameOverScene from './scenes/GameOverScene.js';
import CabinetScene from './scenes/CabinetScene.js';
import HallScene from './scenes/HallScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: COLORS.background,
  pixelArt: true, // hard pixel edges when the arcade-resolution art is scaled up
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  input: {
    activePointers: 2,
  },
  scene: [BootScene, MenuScene, GameScene, GameOverScene, CabinetScene, HallScene],
};

window.game = new Phaser.Game(config);
