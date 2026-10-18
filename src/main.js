import { GAME_WIDTH, GAME_HEIGHT, COLORS, reloadAnim } from './config.js';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';
import CabinetScene from './scenes/CabinetScene.js';
import HallScene from './scenes/HallScene.js';
import DeepScene from './scenes/DeepScene.js';
import { world, startWorld, tickWorld, pauseWorld } from './systems/arcade/world.js';
import { loadProgram } from './systems/arcade/program.js';
import { unlockAudio, toggleMute, isMuted } from './sound.js';

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
  scene: [BootScene, MenuScene, GameScene, CabinetScene, HallScene, DeepScene],
};

window.game = new Phaser.Game(config);

// The emulated arcade machine runs in the background whatever scene is showing, and pauses with the tab.
window.__world = world; // for debugging in the console
startWorld(loadProgram).catch((e) => console.warn('arcade machine unavailable', e));
window.game.events.on(Phaser.Core.Events.STEP, (time, delta) => tickWorld(delta));
window.game.events.on(Phaser.Core.Events.HIDDEN, () => pauseWorld(true));
window.game.events.on(Phaser.Core.Events.VISIBLE, () => pauseWorld(false));

// Hot reload the animation settings, so a new src/settings/animation.json shows without a restart: when the tab
// comes back, and on a local server (plain http) also every second while the game runs.
document.addEventListener('visibilitychange', () => { if (!document.hidden) reloadAnim(); });
if (location.protocol === 'http:') setInterval(() => { if (!document.hidden) reloadAnim(); }, 1000);

// Sound on/off: one button over every scene (an HTML button, so no scene has to make room for it).
const muteButton = document.getElementById('mute');
const showMute = () => { muteButton.textContent = isMuted() ? '\u00d7' : '\u266a'; };
muteButton.addEventListener('click', () => { unlockAudio(); toggleMute(); showMute(); });
showMute();
