import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import PaddockScene from './scenes/PaddockScene.js';
import InfoPanelScene from './scenes/InfoPanelScene.js';
import HotbarScene from './scenes/HotbarScene.js';
import DayNightScene from './scenes/DayNightScene.js';
import ArtPreviewScene from './scenes/ArtPreviewScene.js';
import CustomizerScene from './scenes/CustomizerScene.js';

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
  scene: [BootScene, PaddockScene, DayNightScene, InfoPanelScene, HotbarScene, ArtPreviewScene, CustomizerScene]
};

const game = new Phaser.Game(config);
game.registry.set('dpr', getDpr()); // available to scenes from their first create()

const gameEl = document.getElementById('game');
let lastW = 0, lastH = 0;

// Size the renderer to the device's PHYSICAL pixels while DISPLAYING at logical (CSS)
// size. Scale.NONE doesn't auto-track the container the way Scale.RESIZE does, and
// window.innerWidth/Height is unreliable on iOS while the Safari toolbar / orientation
// settle — so we measure the #game container (inset:0 → fills the viewport) and re-run
// this on every viewport change (incl. a ResizeObserver, which fires on the initial
// layout). Fixes "doesn't fill the screen until I resize", and the bogus-size guard
// stops a transient 0×0 from freezing the canvas.
function applySize() {
  const dpr = getDpr();
  const w = Math.round(gameEl?.clientWidth || window.innerWidth);
  const h = Math.round(gameEl?.clientHeight || window.innerHeight);
  if (w <= 0 || h <= 0) return;                                   // ignore bogus transient sizes
  if (w === lastW && h === lastH && game.registry.get('dpr') === dpr) return; // unchanged → skip
  lastW = w; lastH = h;
  game.registry.set('dpr', dpr);
  game.scale.resize(w * dpr, h * dpr);                            // emits Scale RESIZE → UI relayouts
  const c = game.canvas;
  if (c) { c.style.width = w + 'px'; c.style.height = h + 'px'; } // displayed size stays logical
  game.scene.scenes.forEach((s) => s.cameras?.main?.setZoom(dpr));
}

applySize();                       // initial size (the canvas exists synchronously)
game.events.once('ready', applySize);
window.addEventListener('resize', applySize);
window.addEventListener('orientationchange', () => setTimeout(applySize, 50));
window.visualViewport?.addEventListener('resize', applySize);
if (window.ResizeObserver && gameEl) new ResizeObserver(applySize).observe(gameEl);

// Exposed for debugging/automated checks during development.
if (import.meta.env.DEV) {
  window.__game = game;
}
