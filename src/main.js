import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import PaddockScene from './scenes/PaddockScene.js';
import PortraitScene from './scenes/PortraitScene.js';
import ChickenInfoScene from './scenes/ChickenInfoScene.js';
import HotbarScene from './scenes/HotbarScene.js';
import DayNightScene from './scenes/DayNightScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#82c24e',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
  },
  input: {
    gamepad: true
  },
  scene: [BootScene, PaddockScene, DayNightScene, PortraitScene, ChickenInfoScene, HotbarScene]
};

const game = new Phaser.Game(config);

// Exposed for debugging/automated checks during development.
if (import.meta.env.DEV) {
  window.__game = game;
}
