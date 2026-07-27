// TEMP dev tools — the "🛠 Dev tools" block at the bottom of the pause menu, plus
// the draggable Random Events panel. Split out of pauseMenu.js (which was over the
// #167 size budget) when the Reset Save row landed (#351); the pause menu now just
// calls `_buildDevTools()` and reserves `DEV_TOOLS_H` pixels for it.
//
// Everything here is scaffolding meant to be removed before a real release — with
// the exception of the persisted ON/Off overlays, which are deliberately available
// in production builds because the owner looks at the DEPLOYED game on his iPad.

import { resetAllHorses, resetAllSaveData, loadDevSettings, saveDevSettings } from '../../data/save.js';
import { devEventList } from '../../data/ambientEvents.js';
import { logicalH } from '../uiUtils.js';

// "Reset Save" row wording + how long the armed state sticks around before it
// disarms itself (#351).
const RESET_SAVE_IDLE  = '🧹 Reset Save…';
const RESET_SAVE_ARMED = '⚠ Tap again to erase EVERYTHING';
const RESET_SAVE_ARM_MS = 5000;

// Height the dev block needs inside the pause panel: heading + hint, then 12 rows.
// Keep in sync with the rows built in _buildDevTools.
export const DEV_TOOLS_ROWS = 12;
export const devToolsHeight = (rowH) => 38 + rowH * DEV_TOOLS_ROWS;

export const WithDevTools = (Base) => class extends Base {
  // Build the whole dev-tools block starting at `y`. Uses the pause menu's row
  // helpers (_addToggleRow/_addCycleRow), so it inherits the same visuals, node
  // bookkeeping and controller focus.
  _buildDevTools(rowX, y, rowW, rowH) {
    const devLbl = this.add.text(rowX, y + 4, '🛠 Dev tools', {
      fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#7a80a0',
    }).setOrigin(0, 0).setDepth(104);
    this._pauseNodes.push(devLbl);
    // The "Start …" rows below are persisted boot-state knobs; they take effect on
    // the next page reload, not live.
    const devHint = this.add.text(rowX + 80, y + 5, '(start state — applies on reload)', {
      fontFamily: 'system-ui, sans-serif', fontSize: '10px', color: '#5a6080',
    }).setOrigin(0, 0).setDepth(104);
    this._pauseNodes.push(devHint);

    let dy = y + 22;
    this._addToggleRow(rowX, dy, rowW, rowH, '⏭ Advance Time of Day', () => this._advanceTime());
    dy += rowH;
    this._addCycleRow(rowX, dy, rowW, rowH, '🕑 Start phase',
      ['Morning', 'Afternoon', 'Evening', 'Night'],
      () => loadDevSettings().startPhase,
      (v) => saveDevSettings({ startPhase: v }));
    dy += rowH;
    this._addCycleRow(rowX, dy, rowW, rowH, '🖥 Start screen',
      [null, 'horse', 'preview'],
      () => loadDevSettings().startEditor,
      (v) => saveDevSettings({ startEditor: v }),
      (v) => (v === 'preview' ? 'Art preview' : v ? 'Horse editor' : 'Farm'));
    dy += rowH;
    this._addCycleRow(rowX, dy, rowW, rowH, '📍 Start at',
      ['House', 'Barn', 'Pasture', 'Gate', 'Farm stand', 'Coop'],
      () => loadDevSettings().startLocation,
      (v) => saveDevSettings({ startLocation: v }));
    dy += rowH;
    this._addToggleRow(rowX, dy, rowW, rowH, '♻ Reset Herd to Default', () => this._resetHerd());
    dy += rowH;
    // Full wipe (#351). Two-step: the first tap ARMS the row (label flips to a warning
    // that auto-disarms after a few seconds), the second tap raises the native confirm.
    // Deliberately more friction than any other row — it erases the whole save.
    this._resetSaveArmed = false;
    this._resetSaveLbl = this._addToggleRow(rowX, dy, rowW, rowH,
      RESET_SAVE_IDLE, () => this._resetSave());
    dy += rowH;
    this._addToggleRow(rowX, dy, rowW, rowH, '🎲 Random Events…', () => {
      this._closePause();           // resume the game first so events are visible
      this._toggleDevEvents();
    });
    dy += rowH;
    // The persisted ON/Off dev overlays, as one table instead of four copy-pasted
    // rows. All are live (no reload):
    //   #325 FPS readout · #329 object labels + grid · #330 drag-to-reposition ·
    //   #332 usage tooltips.
    // The FPS row flips + persists its own flag inside _toggleFpsCounter (the
    // overlay lives on this scene); the rest save here and poke PaddockScene.
    const paddock = () => this.scene.get('PaddockScene');
    const flip = (key, apply) => () => {
      saveDevSettings({ [key]: !loadDevSettings()[key] });
      apply();
    };
    const devToggles = [
      ['📈 FPS Counter',          'showFps',       () => this._toggleFpsCounter()],
      ['📐 Object Labels + Grid', 'showDevLabels', flip('showDevLabels', () => paddock()?.refreshDevOverlay())],
      ['✋ Drag Objects',         'dragObjects',   flip('dragObjects',   () => paddock()?.refreshDevDrag())],
      ['💡 Usage Tooltips',       'usageTips',     flip('usageTips',     () => paddock()?.refreshDevTooltips())],
    ];
    for (const [label, key, onTap] of devToggles) {
      const text = () => `${label}: ${loadDevSettings()[key] ? 'ON' : 'Off'}`;
      const row = this._addToggleRow(rowX, dy, rowW, rowH, text(),
        () => { onTap(); row.setText(text()); });
      dy += rowH;
    }
    const freezeDecayLbl = this._addToggleRow(rowX, dy, rowW, rowH,
      `❄️ Freeze Decay: ${window.__devFreezeDecay ? 'ON' : 'Off'}`,
      () => {
        window.__devFreezeDecay = !window.__devFreezeDecay;
        freezeDecayLbl.setText(`❄️ Freeze Decay: ${window.__devFreezeDecay ? 'ON' : 'Off'}`);
      });
  }

  // TEMP dev tool: jump the day/night clock forward one phase WITHOUT unpausing.
  // The menu stays open so you can keep clicking to skip multiple phases; the
  // lighting + clock label refresh in place (a paused scene still renders).
  _advanceTime() {
    const dn = this.scene.get('DayNightScene');
    if (!dn) return;
    dn._advancePhase();
    dn._applyClock();
  }

  // TEMP dev tool: wipe every horse's saved data back to the default herd.
  _resetHerd() {
    const ok = window.confirm(
      'Reset the whole herd to defaults?\n\nThis erases every horse’s custom colour, markings, and name.'
    );
    if (!ok) return;
    resetAllHorses();
    window.location.reload();
  }

  // Dev tool (#351): wipe the ENTIRE save — every `horse-game-*` and `horse-care-*`
  // key (herd + every other animal roster, money/game state, garden, pantry, recipe
  // book, barn stalls, store inventory, player look, taming + friendship counters,
  // gestations/pair bonds/incubations, audio + UI settings and the dev knobs) — then
  // reload into a brand-new farm.
  //
  // Two-step so it's never one accidental tap from a wipe: tap once to arm (the row
  // turns into a warning that disarms itself after RESET_SAVE_ARM_MS), tap again to
  // get the native confirm, which is the point of no return.
  _resetSave() {
    if (!this._resetSaveArmed) {
      this._resetSaveArmed = true;
      this._resetSaveLbl?.setText(RESET_SAVE_ARMED);
      this._resetSaveTimer?.remove();
      this._resetSaveTimer = this.time.delayedCall(RESET_SAVE_ARM_MS, () => this._disarmResetSave());
      return;
    }
    this._disarmResetSave();
    const ok = window.confirm(
      'Erase the whole save?\n\nEvery animal, all your money, the garden, pantry, barn and '
      + 'settings go back to a brand-new farm. This cannot be undone.'
    );
    if (!ok) return;
    resetAllSaveData();
    window.location.reload();
  }

  // Back to the idle wording + cancel the auto-disarm timer. Called on timeout, on
  // the confirming tap, and whenever the pause menu opens or closes.
  _disarmResetSave() {
    this._resetSaveArmed = false;
    this._resetSaveTimer?.remove();
    this._resetSaveTimer = null;
    // The label is destroyed when the menu closes; guard against a stale reference.
    if (this._resetSaveLbl?.active) this._resetSaveLbl.setText(RESET_SAVE_IDLE);
  }

  // The dev-overlay event list is DERIVED from the data-driven registry
  // (data/ambientEvents.js) — the same registry the ambient scheduler reads, so an
  // event declared once auto-appears here AND enters the random rotation (#253).
  _devEventList() {
    return devEventList();
  }

  _toggleDevEvents() {
    if (this._devPanel?.active) { this._closeDevEvents(); return; }
    this._openDevEvents();
  }

  _openDevEvents() {
    this._closeDevEvents();

    const sh = logicalH(this);
    const events = this._devEventList();
    const ROW = 40, PAD = 12, HDR = 38;
    const W = 230, H = HDR + events.length * ROW + PAD;

    // Start near bottom-left, clear of the hotbar. Clamp to the top so a tall list
    // (the registry now drives its length) doesn't spill off-screen — it's draggable.
    const cx = 20, cy = Math.max(20, sh - H - 80);

    const panel = this.add.container(cx, cy).setDepth(300);
    this._devPanel = panel;

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x0d1020, 0.97);
    bg.fillRoundedRect(0, 0, W, H, 10);
    bg.lineStyle(2, 0x3a4060, 1);
    bg.strokeRoundedRect(0, 0, W, H, 10);
    panel.add(bg);

    // Title
    panel.add(this.add.text(W / 2, 12, '🎲 Random Events', {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#c8cce0',
    }).setOrigin(0.5, 0));

    // Drag handle — title bar strip (added before close button so ✕ sits on top).
    const drag = this.add.zone(0, 0, W, HDR).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    let _lx = 0, _ly = 0, _dragging = false;
    drag.on('pointerdown', (ptr) => { _dragging = true; _lx = ptr.x; _ly = ptr.y; });
    const onMove = (ptr) => {
      if (!_dragging) return;
      panel.x += ptr.x - _lx; panel.y += ptr.y - _ly;
      _lx = ptr.x; _ly = ptr.y;
    };
    const onUp = () => { _dragging = false; };
    this.input.on('pointermove', onMove);
    this.input.on('pointerup', onUp);
    this._devPanelDragListeners = { onMove, onUp };
    panel.add(drag);

    // Close button — added after drag zone so it's on top and gets input first.
    const closeBtn = this.add.text(W - 10, 8, '✕', {
      fontFamily: 'system-ui, sans-serif', fontSize: '15px', color: '#8090b0',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this._closeDevEvents());
    panel.add(closeBtn);

    // Event buttons
    const paddock = this.scene.get('PaddockScene');
    events.forEach((ev, i) => {
      const ry = HDR + i * ROW, bh = ROW - 6, bw = W - PAD * 2;
      const g = this.add.graphics();
      const draw = (col) => { g.clear(); g.fillStyle(col, 0.9); g.fillRoundedRect(PAD, ry, bw, bh, 7); };
      draw(0x1a1e30);
      panel.add(g);
      panel.add(this.add.text(W / 2, ry + bh / 2, ev.label, {
        fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#dfe4f5',
      }).setOrigin(0.5, 0.5));
      const zone = this.add.zone(PAD, ry, bw, bh).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => draw(0x2a3860));
      zone.on('pointerout',  () => draw(0x1a1e30));
      zone.on('pointerdown', () => { if (paddock) ev.fire(paddock); });
      panel.add(zone);
    });
  }

  _closeDevEvents() {
    if (this._devPanel) { this._devPanel.destroy(true); this._devPanel = null; }
    const dl = this._devPanelDragListeners;
    if (dl) {
      this.input.off('pointermove', dl.onMove);
      this.input.off('pointerup', dl.onUp);
      this._devPanelDragListeners = null;
    }
  }
};
