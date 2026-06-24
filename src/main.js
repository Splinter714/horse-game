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

// HiDPI: render the canvas buffer at the device's PHYSICAL pixels so pixel-art and
// text are crisp on Retina screens (e.g. iPad, devicePixelRatio 2), while keeping
// the on-screen size and all game coordinates LOGICAL (CSS px) — each scene's camera
// zoom = DPR compensates (see uiUtils.applyDpr). Phaser 3 has no built-in DPR support
// and Scale.RESIZE renders at CSS resolution (the device's extra pixels are wasted),
// so we drive the size manually with Scale.NONE.
//
// MAX_DPR caps the fill-rate cost: 2 = full native quality on any iPad/Retina laptop
// (their DPR is 2); higher only matters on DPR-3 phones, where it would burn battery
// for no visible gain. At DPR 1 (standard monitors, headless smoke) this is a no-op.
const MAX_DPR = 2;
export const getDpr = () => Math.min(window.devicePixelRatio || 1, MAX_DPR);

const config = {
  type: forceCanvas ? Phaser.CANVAS : Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#82c24e',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.NONE,
    width: window.innerWidth * getDpr(),
    height: window.innerHeight * getDpr(),
  },
  input: {
    gamepad: true
  },
  scene: [BootScene, PaddockScene, DayNightScene, InfoPanelScene, HotbarScene]
};

const game = new Phaser.Game(config);
game.registry.set('dpr', getDpr()); // available to scenes from their first create()

// Keep the canvas DISPLAYED at logical size (the buffer stays physical px). Phaser
// would otherwise size the canvas style to the physical buffer (2× too big).
const fixCanvasStyle = () => {
  const c = game.canvas;
  if (c) { c.style.width = window.innerWidth + 'px'; c.style.height = window.innerHeight + 'px'; }
};
fixCanvasStyle();                            // canvas exists synchronously after construction
game.events.once('ready', fixCanvasStyle);   // belt-and-suspenders

window.addEventListener('resize', () => {
  const dpr = getDpr();
  game.registry.set('dpr', dpr);
  game.scale.resize(window.innerWidth * dpr, window.innerHeight * dpr); // emits Scale RESIZE → UI relayouts
  fixCanvasStyle();
  // Re-apply camera zoom in case the device pixel ratio changed (e.g. window dragged
  // to a monitor with a different DPR). Constant on a single device like the iPad.
  game.scene.scenes.forEach((s) => s.cameras?.main?.setZoom(dpr));
});

// Exposed for debugging/automated checks during development.
if (import.meta.env.DEV) {
  window.__game = game;
}
