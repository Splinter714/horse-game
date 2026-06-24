import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import PaddockScene from './scenes/PaddockScene.js';
import InfoPanelScene from './scenes/InfoPanelScene.js';
import HotbarScene from './scenes/HotbarScene.js';
import DayNightScene from './scenes/DayNightScene.js';

// Dev-only escape hatch: `?canvas` forces the Canvas renderer. Headless browsers
// (used by the smoke test, scripts/smoke.mjs) often lack WebGL framebuffers, and
// the game logic we verify there is renderer-agnostic. No effect in production.
const forceCanvas = import.meta.env.DEV &&
  new URLSearchParams(window.location.search).has('canvas');

const config = {
  type: forceCanvas ? Phaser.CANVAS : Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#82c24e',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
  },
  input: {
    gamepad: true
  },
  scene: [BootScene, PaddockScene, DayNightScene, InfoPanelScene, HotbarScene]
};

const game = new Phaser.Game(config);

// Exposed for debugging/automated checks during development.
if (import.meta.env.DEV) {
  window.__game = game;
}
