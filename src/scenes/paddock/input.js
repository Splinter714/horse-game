// Input plumbing — the raw gamepad poll that turns a live pad into edge-triggered
// actions (and routes them to the hotbar / scene), the pause overlay, the
// input-device-changed broadcast, and the prompt-visibility toggle. The per-frame
// player *movement* lives with the player mixin; this is the device/menu plumbing
// around it. Extracted from PaddockScene as its own concern (issue #167).

import { EVENTS } from '../../data/events.js';
import { logicalW, logicalH, worldUiOffset } from '../uiUtils.js';

export const WithInput = (Base) => class extends Base {
  _togglePause() {
    this._paused = !this._paused;
    if (this._paused) {
      const sw = logicalW(this), sh = logicalH(this);
      const o = worldUiOffset(this); // screen-fixed overlay on the centred-origin world camera
      const bg = this.add.graphics().setDepth(9990).setScrollFactor(0);
      bg.fillStyle(0x000000, 0.55);
      bg.fillRect(-sw, -sh, sw * 3, sh * 3); // oversized so it covers the screen regardless of zoom origin
      const lbl = this.add.text(sw / 2 + o.x, sh / 2 + o.y, 'PAUSED', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '32px',
        color: '#ffffff',
      }).setOrigin(0.5).setDepth(9991).setScrollFactor(0);
      const hint = this.add.text(sw / 2 + o.x, sh / 2 + 48 + o.y, 'Press Start to resume', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#9aa0c0',
      }).setOrigin(0.5).setDepth(9991).setScrollFactor(0);
      this._pauseOverlay = [bg, lbl, hint];
    } else {
      this._pauseOverlay?.forEach(o => o.destroy());
      this._pauseOverlay = null;
    }
  }

  _pollRawPad() {
    const raw = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
    if (!raw) { this._rawPad = null; return; }

    // If Phaser detected it, keep this.gamePad set so the rest of the code knows a pad exists.
    // But we'll read actual state from the raw pad to avoid Phaser's stale cache.
    if (!this.gamePad && this.input.gamepad.total > 0) {
      this.gamePad = this.input.gamepad.getPad(0);
    }
    if (!this.gamePad && raw) this.gamePad = {}; // sentinel so movePlayer enters the pad branch

    const btns = raw.buttons;
    const axes = raw.axes;

    // Standard gamepad mapping
    this._rawPad = {
      leftStickX:  axes[0] ?? 0,
      leftStickY:  axes[1] ?? 0,
      dUp:     btns[12]?.pressed ?? false,
      dDown:   btns[13]?.pressed ?? false,
      dLeft:   btns[14]?.pressed ?? false,
      dRight:  btns[15]?.pressed ?? false,
      btnA:    btns[0]?.pressed  ?? false,
      btnB:    btns[1]?.pressed  ?? false,
      btnX:    btns[2]?.pressed  ?? false,
      btnY:    btns[3]?.pressed  ?? false,
      btnLB:   btns[4]?.pressed  ?? false,
      btnRB:   btns[5]?.pressed  ?? false,
      btnLT:   (btns[6]?.value ?? 0) > 0.3,
      btnRT:   (btns[7]?.value ?? 0) > 0.3,
      btnBack: btns[8]?.pressed  ?? false,
      btnStart:btns[9]?.pressed  ?? false,
    };

    const prev    = this._prevRawButtons ?? {};
    const hotbar  = this.scene.get('HotbarScene');

    if (this._rawPad.btnA && !prev.btnA) {
      this.padAJustDown = true;
      this.usingPad = true;
    }
    // B = close any open menu
    if (this._rawPad.btnB && !prev.btnB) {
      this.usingPad = true;
      if (hotbar?.invOpen)                      hotbar._closeInventory();
      else if (this.scene.isActive('InfoPanelScene')) this.scene.get('InfoPanelScene').close();
    }
    // X = use the armed hotbar tool (interact is A)
    if (this._rawPad.btnX && !prev.btnX) {
      this.usingPad = true;
      this.useActiveTool();
    }
    // Y = open the info panel for the animal in reach (interact/A always pets, #79)
    if (this._rawPad.btnY && !prev.btnY) {
      this.usingPad = true;
      this.openProxInfo();
    }
    // Hotbar navigation (#121): the D-pad drives the hotbar (it no longer moves the
    // player — see movePlayer). D-pad left/right and the bumpers step between slots;
    // D-pad up/down cycle the instances inside a carrier group (no fly-out). The
    // left trigger mirrors a number key: a short pull selects/cycles the active
    // slot, a hold opens its fly-out picker (#75). RT is still free.
    const rp = this._rawPad;
    if (rp.dLeft  && !prev.dLeft)  { this.usingPad = true; hotbar?.navSlot(-1); }
    if (rp.dRight && !prev.dRight) { this.usingPad = true; hotbar?.navSlot(+1); }
    if (rp.btnLB  && !prev.btnLB)  { this.usingPad = true; hotbar?.navSlot(-1); }
    if (rp.btnRB  && !prev.btnRB)  { this.usingPad = true; hotbar?.navSlot(+1); }
    if (rp.dUp    && !prev.dUp)    { this.usingPad = true; hotbar?._padCycleMember(-1); }
    if (rp.dDown  && !prev.dDown)  { this.usingPad = true; hotbar?._padCycleMember(+1); }
    if (rp.btnLT  && !prev.btnLT)  { this.usingPad = true; hotbar?._padTriggerDown(); }
    if (!rp.btnLT && prev.btnLT)   { hotbar?._padTriggerUp(); }
    // Back = toggle inventory
    if (this._rawPad.btnBack && !prev.btnBack) {
      this.usingPad = true;
      hotbar?._toggleInventory();
    }
    // Start = open the full pause menu (volume/mute/dev tools), so a controller
    // player reaches the same menu as touch/keyboard and can adjust volume (#159).
    // While that menu is open this scene is paused, so HotbarScene polls Start to close.
    if (this._rawPad.btnStart && !prev.btnStart) {
      this.usingPad = true;
      this.scene.get('HotbarScene')?._togglePause();
    }

    this._prevRawButtons = {
      btnA:     this._rawPad.btnA,
      btnB:     this._rawPad.btnB,
      btnX:     this._rawPad.btnX,
      btnY:     this._rawPad.btnY,
      btnLB:    this._rawPad.btnLB,
      btnRB:    this._rawPad.btnRB,
      btnLT:    this._rawPad.btnLT,
      btnRT:    this._rawPad.btnRT,
      dUp:      this._rawPad.dUp,
      dDown:    this._rawPad.dDown,
      dLeft:    this._rawPad.dLeft,
      dRight:   this._rawPad.dRight,
      btnBack:  this._rawPad.btnBack,
      btnStart: this._rawPad.btnStart,
    };
  }

  // Broadcast the active input device when it changes, so UI scenes can react —
  // e.g. HotbarScene shows the on-screen Use button only for touch players.
  _syncInputMode() {
    const mode = this._promptMode();
    if (mode !== this._lastInputMode) {
      this._lastInputMode = mode;
      this.game.events.emit(EVENTS.INPUT_MODE_CHANGED, mode);
    }
  }

  // Pause-menu toggle (#82) flipped the control-prompt setting. Update our flag
  // and hide the panel immediately if they were just turned off.
  _onPromptsChanged(show) {
    this.promptsOn = !!show;
    if (!this.promptsOn) { this._promptLines = []; this.promptPanel?.setVisible(false); }
  }
};
