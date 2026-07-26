// FPS counter overlay (#325) — a small, semi-transparent readout in the
// bottom-left corner showing the live frame rate.
//
// Why it's a pause-menu dev-tool toggle rather than `import.meta.env.DEV`:
// the frame-rate problem this was built for shows up on the owner's iPad
// playing the DEPLOYED build, where a DEV-only overlay would never render.
// The pause menu's "🛠 Dev tools" section already ships in production for
// exactly this reason (the "Start screen" knob is documented as working in
// production builds "so the owner can test on the deployed game"), so this
// follows the same precedent: persisted in devSettings, DEFAULT OFF, opt-in
// from the pause menu. Nothing shows unless it's deliberately switched on.
//
// Cost: the label re-renders at most REFRESH_HZ times a second, not every
// frame — a Phaser Text re-render is a canvas draw, so ticking it per frame
// would make the counter itself part of the problem it measures. Between
// refreshes `update()` does a single cheap counter increment.

import { logicalH } from '../uiUtils.js';
import { loadDevSettings, saveDevSettings } from '../../data/save.js';

// How often the readout re-renders. 5×/sec is responsive enough to see a dip
// while still being ~1/12th the render work of updating every frame at 60fps.
const REFRESH_HZ = 5;
const REFRESH_MS = 1000 / REFRESH_HZ;

// Colour bands so a dip is readable at a glance without reading the number.
const GOOD = '#7fe08a'; // ≥ 50
const OK   = '#e8d36a'; // ≥ 30
const BAD  = '#e88a7f'; // < 30

export const WithFpsCounter = (Base) => class extends Base {
  // Built once in create() and again on resize (NOT from _buildHotbar, which
  // reruns on every carrier/slot change and would churn the label needlessly).
  // Reads the persisted toggle; creates nothing at all when it's off.
  _buildFpsCounter() {
    this._fpsLbl?.destroy();
    this._fpsLbl = null;
    this._fpsAccum = 0;
    this._fpsWorstFrame = 0;

    if (!loadDevSettings().showFps) return;

    // Bottom-left, sitting just above the hotbar strip's top edge so it never
    // overlaps the slots (which are centred) or the money label (bottom-right).
    const y = (this._slotY ?? logicalH(this) - 40) - 12;
    this._fpsLbl = this.add.text(10, y, '', {
      fontFamily: 'ui-monospace, Menlo, monospace',
      fontSize: '12px',
      color: GOOD,
      backgroundColor: '#11162299',
      padding: { x: 5, y: 2 },
    }).setOrigin(0, 1).setDepth(2).setAlpha(0.75);
  }

  // Called from HotbarScene.update(). Cheap no-op when the counter is off.
  _tickFpsCounter(delta) {
    const lbl = this._fpsLbl;
    if (!lbl) return;

    // Track the worst single frame in this refresh window — an averaged fps
    // hides the stutters (one 80ms hitch per second barely moves the mean but
    // is exactly what "starting to struggle" feels like).
    if (delta > this._fpsWorstFrame) this._fpsWorstFrame = delta;

    this._fpsAccum += delta;
    if (this._fpsAccum < REFRESH_MS) return;
    this._fpsAccum = 0;

    const fps   = Math.round(this.game.loop.actualFps);
    const worst = Math.round(this._fpsWorstFrame);
    this._fpsWorstFrame = 0;

    lbl.setColor(fps >= 50 ? GOOD : fps >= 30 ? OK : BAD);
    lbl.setText(`${fps} fps  ${worst}ms`);
  }

  // Pause-menu row handler: flip the persisted setting and apply it live.
  _toggleFpsCounter() {
    saveDevSettings({ showFps: !loadDevSettings().showFps });
    this._buildFpsCounter();
  }
};
