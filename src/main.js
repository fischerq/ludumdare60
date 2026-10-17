import { GAME_WIDTH, GAME_HEIGHT, COLORS, reloadAnim } from './config.js';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';
import CabinetScene from './scenes/CabinetScene.js';
import HallScene from './scenes/HallScene.js';
import { world, startWorld, tickWorld, pauseWorld } from './systems/arcade/world.js';

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
  scene: [BootScene, MenuScene, GameScene, CabinetScene, HallScene],
};

window.game = new Phaser.Game(config);

// The emulated arcade machine runs in the background whatever scene is showing, and pauses with the tab.
window.__world = world; // for debugging in the console
startWorld().catch((e) => console.warn('arcade machine unavailable', e));
window.game.events.on(Phaser.Core.Events.STEP, (time, delta) => tickWorld(delta));
window.game.events.on(Phaser.Core.Events.HIDDEN, () => pauseWorld(true));
window.game.events.on(Phaser.Core.Events.VISIBLE, () => pauseWorld(false));

// Hot reload the animation settings, so a new src/settings/animation.json shows without a restart: when the tab
// comes back, and on a local server (plain http) also every second while the game runs.
document.addEventListener('visibilitychange', () => { if (!document.hidden) reloadAnim(); });
if (location.protocol === 'http:') setInterval(() => { if (!document.hidden) reloadAnim(); }, 1000);
