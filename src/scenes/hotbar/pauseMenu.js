// Pause menu — the full settings overlay: mute, control-prompt toggle, per-bus
// volume sliders, the TEMP dev tools, and the gamepad focus navigation that drives
// it while the world is frozen (#159). Freezes/*un*freezes the gameplay scenes.
// Extracted from the monolithic HotbarScene (issue #167).

import { toggleMute, isMuted, setVolume, getAudioSettings, playNicker } from '../../audio/sounds.js';
import { saveUiSettings, resetAllHorses, loadDevSettings, saveDevSettings } from '../../data/save.js';
import { EVENTS } from '../../data/events.js';
import { growHitArea, logicalW, logicalH, dprOf } from '../uiUtils.js';
import { PAUSABLE_SCENES } from './constants.js';

export const WithPauseMenu = (Base) => class extends Base {
  _togglePause() {
    if (this.pauseOpen) this._closePause();
    else                this._openPause();
  }

  _toggleMute() {
    const nowMuted = toggleMute();
    this._muteRowLbl?.setText(`Sound: ${nowMuted ? 'Off 🔇' : 'On 🔊'}`);
  }

  _togglePrompts() {
    this._showPrompts = !this._showPrompts;
    saveUiSettings({ showPrompts: this._showPrompts });
    this._promptRowLbl?.setText(`Control Prompts: ${this._showPrompts ? 'On' : 'Off'}`);
    this.game.events.emit(EVENTS.PROMPTS_CHANGED, this._showPrompts);
  }

  // Close the pause menu (which resumes the world) and launch the player customizer on
  // top; it pauses/hides the world + hotbar itself while editing and restores them on exit.
  _openPlayerCustomizer() {
    this._closePause();
    this.scene.launch('PlayerCustomizerScene');
  }

  // Build one full-width toggle row in the pause menu. Returns its label Text so
  // the caller can update the wording when the value flips.
  _addToggleRow(rowX, rowY, rowW, rowH, text, onClick) {
    const rowG = this.add.graphics().setDepth(103);
    const drawRow = (bg2) => {
      rowG.clear();
      rowG.fillStyle(bg2, 0.9);
      rowG.fillRoundedRect(rowX, rowY, rowW, rowH - 8, 8);
      rowG.lineStyle(2, 0x2a3060, 1);
      rowG.strokeRoundedRect(rowX, rowY, rowW, rowH - 8, 8);
    };
    drawRow(0x1a1e30);
    this._pauseNodes.push(rowG);

    const lbl = this.add.text(rowX + rowW / 2, rowY + (rowH - 8) / 2, text, {
      fontFamily: 'system-ui, sans-serif', fontSize: '15px', color: '#dfe4f5',
    }).setOrigin(0.5, 0.5).setDepth(104);
    this._pauseNodes.push(lbl);

    const zone = this.add.zone(rowX, rowY, rowW, rowH - 8)
      .setOrigin(0, 0).setInteractive({ useHandCursor: true }).setDepth(105);
    zone.on('pointerover', () => drawRow(0x2a3050));
    zone.on('pointerout',  () => drawRow(0x1a1e30));
    zone.on('pointerdown', onClick);
    this._pauseNodes.push(zone);
    // Register as a controller-focusable button row (#159).
    this._pauseFocus?.push({ x: rowX, y: rowY, w: rowW, h: rowH - 8, kind: 'button', activate: onClick });
    return lbl;
  }

  // A toggle row that cycles through a list of values on each click (dev tools).
  // `opts` is the ordered value list; `get` returns the current value, `set`
  // persists the new one. `labelFor(v)` maps a value to its display text (default:
  // the value itself, or "Off" for null). A stored value not in `opts` normalizes
  // to the first option, so an unset setting reads as its default. Reuses
  // _addToggleRow for the visuals + controller focus.
  _addCycleRow(rowX, rowY, rowW, rowH, title, opts, get, set, labelFor) {
    const show = labelFor ?? ((v) => v ?? 'Off');
    const text = (v) => `${title}: ${show(v)}`;
    const cur  = () => (opts.includes(get()) ? get() : opts[0]);
    let lbl;
    lbl = this._addToggleRow(rowX, rowY, rowW, rowH, text(cur()), () => {
      const next = opts[(opts.indexOf(cur()) + 1) % opts.length];
      set(next);
      lbl.setText(text(next));
    });
    return lbl;
  }

  _openPause() {
    this._closeFlyout();
    for (const o of this._pauseNodes) o.destroy();
    this._pauseNodes = [];
    this.pauseOpen   = true;
    // Controller-nav state (#159): focusables are collected as rows/sliders build.
    this._pauseFocus = [];
    this._pauseFocusIdx = 0;
    this._pauseFocusActive = false;
    this._pauseJustOpened = true; // 1-frame grace so a held Start doesn't insta-close

    // Inventory and pause are mutually exclusive overlays
    if (this.invOpen) this._closeInventory();

    // Actually freeze the world while paused
    for (const key of PAUSABLE_SCENES) {
      if (this.scene.isActive(key)) this.scene.pause(key);
    }

    const sw = logicalW(this);
    const sh = logicalH(this);

    const panelW = Math.min(320, sw - 40);
    const rowH   = 48;
    const sliderH = 44;            // height per volume-slider row
    const sliders = [
      ['Master',  'master'],
      ['Music',   'music'],
      ['Ambient', 'ambient'],
      ['Effects', 'effects'],
    ];
    const devH   = 38 + rowH * 6;  // TEMP dev-tools: heading + hint + 6 rows
    // 3 action/toggle rows: mute, control-prompts, Customize Character.
    const panelH = 56 + rowH * 3 + sliders.length * sliderH + 8 + devH;
    const px = Math.round((sw - panelW) / 2);
    const py = Math.round((sh - panelH) / 2);

    const dim = this.add.rectangle(0, 0, sw, sh, 0x000000, 0.6)
      .setOrigin(0, 0).setInteractive().setDepth(100);
    dim.on('pointerdown', () => this._closePause());
    this._pauseNodes.push(dim);

    const bg = this.add.graphics().setDepth(101);
    bg.fillStyle(0x0d1020, 0.98);
    bg.fillRoundedRect(px, py, panelW, panelH, 12);
    bg.lineStyle(2, 0x3a4060, 1);
    bg.strokeRoundedRect(px, py, panelW, panelH, 12);
    this._pauseNodes.push(bg);

    // Absorb clicks inside the panel so they don't fall through to the dim
    const absorb = this.add.zone(px, py, panelW, panelH)
      .setOrigin(0, 0).setInteractive().setDepth(102);
    this._pauseNodes.push(absorb);

    const title = this.add.text(px + panelW / 2, py + 14, 'Paused', {
      fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: '#c8cce0',
    }).setOrigin(0.5, 0).setDepth(103);
    this._pauseNodes.push(title);

    const closeBtn = this.add.text(px + panelW - 12, py + 10, '✕', {
      fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: '#8090b0',
    }).setOrigin(1, 0).setDepth(104).setInteractive({ useHandCursor: true });
    growHitArea(closeBtn); // (#100)
    closeBtn.on('pointerdown', () => this._closePause());
    this._pauseNodes.push(closeBtn);

    // Toggle rows: mute, then control-prompt visibility (#82).
    const rowY = py + 50;
    const rowX = px + 12;
    const rowW = panelW - 24;

    this._muteRowLbl = this._addToggleRow(rowX, rowY, rowW, rowH,
      `Sound: ${isMuted() ? 'Off 🔇' : 'On 🔊'}`, () => this._toggleMute());

    const promptRowY = rowY + rowH;
    this._promptRowLbl = this._addToggleRow(rowX, promptRowY, rowW, rowH,
      `Control Prompts: ${this._showPrompts ? 'On' : 'Off'}`, () => this._togglePrompts());

    // Open the player character customizer (#44). A real (non-dev) feature, so it sits
    // here with the settings, above the TEMP dev tools.
    const customizeRowY = promptRowY + rowH;
    this._addToggleRow(rowX, customizeRowY, rowW, rowH,
      '🧑 Customize Character', () => this._openPlayerCustomizer());

    // Per-bus volume sliders, stacked below the toggle rows.
    const vols = getAudioSettings().volumes;
    let sy = customizeRowY + rowH + 4;
    for (const [label, bus] of sliders) {
      this._addVolumeSlider(rowX, sy, rowW, label, bus, vols[bus]);
      sy += sliderH;
    }

    // ── TEMP dev tools (remove before a real release) ──────────────────────────
    const devLbl = this.add.text(rowX, sy + 4, '🛠 Dev tools', {
      fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#7a80a0',
    }).setOrigin(0, 0).setDepth(104);
    this._pauseNodes.push(devLbl);
    // The two "Start …" rows below are persisted boot-state knobs; they take
    // effect on the next page reload, not live.
    const devHint = this.add.text(rowX + 80, sy + 5, '(start state — applies on reload)', {
      fontFamily: 'system-ui, sans-serif', fontSize: '10px', color: '#5a6080',
    }).setOrigin(0, 0).setDepth(104);
    this._pauseNodes.push(devHint);

    let dy = sy + 22;
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
      ['Barn', 'Pasture', 'Gate', 'Farm stand', 'Coop'],
      () => loadDevSettings().startLocation,
      (v) => saveDevSettings({ startLocation: v }));
    dy += rowH;
    this._addToggleRow(rowX, dy, rowW, rowH, '♻ Reset Herd to Default', () => this._resetHerd());
    dy += rowH;
    this._addToggleRow(rowX, dy, rowW, rowH, '🎲 Random Events…', () => {
      this._closePause();           // resume the game first so events are visible
      this._toggleDevEvents();
    });
    dy += rowH;
    const freezeDecayLbl = this._addToggleRow(rowX, dy, rowW, rowH,
      `❄️ Freeze Decay: ${window.__devFreezeDecay ? 'ON' : 'Off'}`,
      () => {
        window.__devFreezeDecay = !window.__devFreezeDecay;
        freezeDecayLbl.setText(`❄️ Freeze Decay: ${window.__devFreezeDecay ? 'ON' : 'Off'}`);
      });

    // Controller focus highlight, drawn above the rows (#159).
    this._pauseRing = this.add.graphics().setDepth(106);
    this._pauseNodes.push(this._pauseRing);
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

  _devEventList() {
    const idleHorse = (p) => {
      const agents = p._grazers?.() ?? [];
      const idle = agents.filter((h) => h.state === 'idle' && h.sprite?.active);
      return idle.length ? idle[Phaser.Math.Between(0, idle.length - 1)] : null;
    };
    return [
      { label: '🐦 Bird on horse back',  fire: (p) => p._maybeSpawnHorsePerch?.() },
      { label: '🐦 Bird fly-by',         fire: (p) => p._spawnFlyby?.() },
      { label: '🐦 Bird perch (ground)', fire: (p) => p._spawnPerch?.() },
      { label: '🦝 Raccoon visit',       fire: (p) => p._spawnRaccoon?.() },
      { label: '🐟 Fish surface',        fire: (p) => p._spawnFish?.() },
      { label: '🐴 Horse rolls in dirt', fire: (p) => {
        const h = idleHorse(p); if (!h) return;
        const horse = p.registry.get('allHorses')?.[h.key];
        if (horse) p._rollInDirt?.(h, horse);
      }},
      { label: '🐴 Horse nicker',        fire: (p) => {
        const h = idleHorse(p); if (!h) return;
        p._shake?.(h.sprite);
        playNicker();
      }},
    ];
  }

  _toggleDevEvents() {
    if (this._devPanel?.active) { this._closeDevEvents(); return; }
    this._openDevEvents();
  }

  _openDevEvents() {
    this._closeDevEvents();

    const sw = logicalW(this), sh = logicalH(this);
    const events = this._devEventList();
    const ROW = 40, PAD = 12, HDR = 38;
    const W = 230, H = HDR + events.length * ROW + PAD;

    // Start near bottom-left, clear of the hotbar.
    let cx = 20, cy = sh - H - 80;

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

  // Draggable horizontal volume slider for one mixer bus (0–1). Calls setVolume
  // live as the player drags; persistence happens via the audio module's onChange.
  _addVolumeSlider(x, y, w, label, bus, value) {
    const labelW = 64;
    const trackX = x + labelW;
    const trackW = w - labelW;
    const cy = y + 16; // vertical centre of the track

    const lbl = this.add.text(x, cy, label, {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#aab0ca',
    }).setOrigin(0, 0.5).setDepth(104);
    this._pauseNodes.push(lbl);

    const g = this.add.graphics().setDepth(104);
    this._pauseNodes.push(g);

    let v = Math.max(0, Math.min(1, value));
    const draw = () => {
      g.clear();
      // Track
      g.fillStyle(0x1a1e30, 1);
      g.fillRoundedRect(trackX, cy - 4, trackW, 8, 4);
      // Filled portion
      g.fillStyle(0x5a7de0, 1);
      g.fillRoundedRect(trackX, cy - 4, Math.max(8, trackW * v), 8, 4);
      // Knob
      g.fillStyle(0xdfe4f5, 1);
      g.fillCircle(trackX + trackW * v, cy, 8);
    };
    draw();

    const zone = this.add.zone(trackX - 8, y - 4, trackW + 16, 40)
      .setOrigin(0, 0).setInteractive({ useHandCursor: true }).setDepth(105);
    const setFromX = (px) => {
      // Phaser reports pointer x in physical/buffer px; this scene's camera is
      // zoomed by DPR (top-left origin) so the track geometry is in LOGICAL px.
      // Convert before mapping, else on HiDPI the value is off by the DPR factor
      // and the slider won't track (the volumes-stuck-at-max regression).
      const lx = px / dprOf(this);
      v = Math.max(0, Math.min(1, (lx - trackX) / trackW));
      draw();
      setVolume(bus, v);
    };
    const adjustBy = (d) => {
      v = Math.max(0, Math.min(1, v + d));
      draw();
      setVolume(bus, v);
    };
    // Mouse + touch: arm the shared drag handler so a press-and-move tracks (#159).
    zone.on('pointerdown', (p) => { this._activeSlider = setFromX; setFromX(p.x); });
    this._pauseNodes.push(zone);
    // Controller-focusable: left/right nudges the value (#159).
    this._pauseFocus?.push({ x: trackX - 8, y: y - 4, w: trackW + 16, h: 40, kind: 'slider', adjust: adjustBy });
  }

  _closePause() {
    this.pauseOpen   = false;
    this._muteRowLbl = null;
    this._pauseFocus = null;
    this._pauseRing  = null;
    this._activeSlider = null;
    for (const o of this._pauseNodes) o.destroy();
    this._pauseNodes = [];

    // Resume the world
    for (const key of PAUSABLE_SCENES) {
      if (this.scene.isPaused(key)) this.scene.resume(key);
    }
  }

  // While the pause menu is open the world scenes are paused, so HotbarScene drives
  // the gamepad here: d-pad/stick to focus a row, A to activate a toggle/button,
  // left/right to adjust the focused slider, B/Start to close (#159).
  update() {
    if (!this.pauseOpen || !this._pauseFocus?.length) return;
    const pad = this.input.gamepad && this.input.gamepad.getPad(0);
    if (!pad) return;
    const ls = pad.leftStick || { x: 0, y: 0 };
    const cur = {
      up: pad.up || ls.y < -0.5, down: pad.down || ls.y > 0.5,
      left: pad.left || ls.x < -0.5, right: pad.right || ls.x > 0.5,
      A: pad.A, B: pad.B, start: !!(pad.buttons && pad.buttons[9] && pad.buttons[9].pressed),
    };
    // 1-frame grace after opening so a still-held Start (which opened it) won't close.
    if (this._pauseJustOpened) { this._pauseJustOpened = false; this._pausePadPrev = cur; return; }
    const prev = this._pausePadPrev || {};
    if ((cur.B && !prev.B) || (cur.start && !prev.start)) { this._closePause(); return; }
    if (!this._pauseFocusActive && (cur.up || cur.down || cur.left || cur.right || cur.A)) {
      this._pauseFocusActive = true; this._pauseFocusIdx = 0; this._drawPauseRing(); // first press: show ring
    } else if (this._pauseFocusActive) {
      if (cur.up && !prev.up) this._movePauseFocus(-1);
      if (cur.down && !prev.down) this._movePauseFocus(1);
      const f = this._pauseFocus[this._pauseFocusIdx];
      if (f) {
        if (f.kind === 'slider') {
          if (cur.left && !prev.left) f.adjust(-0.1);
          if (cur.right && !prev.right) f.adjust(0.1);
        }
        if (cur.A && !prev.A && f.activate) f.activate();
      }
    }
    this._pausePadPrev = cur;
  }

  _movePauseFocus(d) {
    const n = this._pauseFocus.length;
    this._pauseFocusIdx = (this._pauseFocusIdx + d + n) % n;
    this._drawPauseRing();
  }

  _drawPauseRing() {
    if (!this._pauseRing) return;
    this._pauseRing.clear();
    if (!this._pauseFocusActive) return;
    const f = this._pauseFocus[this._pauseFocusIdx];
    if (!f) return;
    this._pauseRing.lineStyle(3, 0xffe066, 0.95);
    this._pauseRing.strokeRoundedRect(f.x - 3, f.y - 3, f.w + 6, f.h + 6, 8);
  }
};
