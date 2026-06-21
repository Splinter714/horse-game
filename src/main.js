import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import PaddockScene from './scenes/PaddockScene.js';
import PortraitScene from './scenes/PortraitScene.js';

const config = {
  type: Phaser.AUTO,
  width: 960,
  height: 640,
  parent: 'game',
  backgroundColor: '#82c24e',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  input: {
    gamepad: true
  },
  scene: [BootScene, PaddockScene, PortraitScene]
};

const game = new Phaser.Game(config);

// Exposed for debugging/automated checks during development.
if (import.meta.env.DEV) {
  window.__game = game;
}
