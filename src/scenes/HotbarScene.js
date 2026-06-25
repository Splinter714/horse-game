// HotbarScene — the on-screen HUD: hotbar strip, carriers, inventory, on-screen
// action buttons, and the pause menu. A thin orchestrator composed from concern
// mixins (see src/scenes/hotbar/*), mirroring PaddockScene's functional-mixin
// pattern (issue #167). This core file owns only the scene lifecycle (create):
// loading state, wiring keyboard/pointer/event listeners, and shutdown cleanup.

import Phaser from 'phaser';
import { loadGameState, loadUiSettings } from '../data/save.js';
import { EVENTS } from '../data/events.js';
import { applyDpr } from './uiUtils.js';
import { NUM_SLOTS } from './hotbar/constants.js';
import { WithHotbarSlots } from './hotbar/slots.js';
import { WithCarriers } from './hotbar/carriers.js';
import { WithInventory } from './hotbar/inventory.js';
import { WithActionButtons } from './hotbar/actionButtons.js';
import { WithPauseMenu } from './hotbar/pauseMenu.js';

export default class HotbarScene
  extends WithPauseMenu(WithInventory(WithActionButtons(WithCarriers(WithHotbarSlots(Phaser.Scene))))) {
  constructor() { super('HotbarScene'); }

  create() {
    applyDpr(this, { topLeft: true }); // HiDPI: zoom this UI scene's camera (top-left anchored)

    const saved      = loadGameState();
    this.hotbar      = saved.hotbar;
    this.inventory   = saved.inventory;
    this.carriers    = saved.carriers;
    this.activeCarrier = saved.activeCarrier; // active member of each carrier group (#75)
    this.activeSlot  = 0;
    this.invOpen     = false;
    this.pauseOpen   = false;
    this._money      = 0;
    this._slots      = [];
    this._invNodes   = [];
    this._flyoutNodes = []; // carrier-group fly-out picker (#75)
    this._flyoutSlot  = null;
    this._flyoutTimer = null; // auto-dismiss timer for the fly-out
    this._slotHold    = null; // in-progress press/tap on a slot (tap vs hold, #75)
    this._slotFlash   = null; // transient "slot changed" blink overlay (#75)
    this._pauseNodes = [];
    this._pauseBtn   = null;
    this._muteRowLbl = null;
    this._promptRowLbl = null;
    this._moneyLbl   = null;

    // Control-prompt visibility (#82) — toggled in the pause menu, persisted.
    this._showPrompts = loadUiSettings().showPrompts;

    // On-screen action buttons (Interact / Info / Use) are a touch affordance —
    // keyboard/gamepad players use E/C/F (A/Y/X) and read the prompt panel, so the
    // buttons only show in touch mode. Default from the device's primary pointer;
    // PaddockScene keeps it in sync via INPUT_MODE_CHANGED.
    this._isTouch = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
    // Latest contextual action labels { interact, info, use } (each a string or
    // null), pushed from PaddockScene via ACTIONS_CHANGED; each button shows only
    // when its label is non-null.
    this._actions = { interact: null, info: null, use: null };

    this._buildHotbar();

    const KEY_NAMES = ['ONE','TWO','THREE','FOUR','FIVE','SIX','SEVEN','EIGHT','NINE','ZERO'];
    KEY_NAMES.slice(0, NUM_SLOTS).forEach((name, i) => {
      // A quick press selects / cycles; holding opens the fly-out (#75).
      this.input.keyboard.on(`keydown-${name}`, () => this._slotDown(i, 'key'));
      this.input.keyboard.on(`keyup-${name}`,   () => this._slotUp(i, 'key'));
    });
    // Finalize a press/tap on a slot when the pointer is released (tap = cycle,
    // hold = fly-out; see _slotDown).
    this.input.on('pointerup',        () => this._slotPointerUp());
    this.input.on('pointerupoutside', () => this._slotPointerUp());
    // Volume-slider drag works for mouse AND touch: a slider's pointerdown sets
    // `_activeSlider`, then any pointer move while held drives it, until release (#159).
    this.input.on('pointermove', (p) => { if (this._activeSlider && p.isDown) this._activeSlider(p.x); });
    this.input.on('pointerup',   () => { this._activeSlider = null; });
    this.input.keyboard.on('keydown-I', () => this._toggleInventory());
    this.input.keyboard.on('keydown-M', () => this._toggleMute());
    // Esc closes an open info popup first; only when none is open does it
    // toggle the pause menu (so one Esc doesn't both close a popup and pause).
    this.input.keyboard.on('keydown-ESC', () => {
      if (!this.pauseOpen && this.scene.isActive('InfoPanelScene')) {
        this.scene.get('InfoPanelScene').close();
        return;
      }
      this._togglePause();
    });

    // Gamepad input is polled from the raw pad in PaddockScene (_pollRawPad) to
    // avoid Phaser's stale-cache issues; it drives navSlot / _padCycleMember here.

    this._onResize = () => {
      this._closeFlyout();
      this._buildHotbar();
      if (this.invOpen)   this._openInventory();
      if (this.pauseOpen) this._openPause();
    };
    this.scale.on('resize', this._onResize, this);

    // Update money label in-place — no full rebuild needed
    this._onMoney  = v => { this._money = v; this._updateStatusLabels(); };
    this.game.events.on(EVENTS.MONEY_CHANGED,  this._onMoney);

    // Show/hide the on-screen action buttons as the player switches input devices.
    this._onInputMode = mode => {
      const touch = mode === 'touch';
      if (touch === this._isTouch) return;
      this._isTouch = touch;
      this._closeFlyout();
      this._buildHotbar(); // recreate the strip with/without the action buttons
    };
    this.game.events.on(EVENTS.INPUT_MODE_CHANGED, this._onInputMode);

    // Update the action buttons as the contextual actions change.
    this._onActions = actions => {
      this._actions = actions || { interact: null, info: null, use: null };
      this._updateActionButtons();
    };
    this.game.events.on(EVENTS.ACTIONS_CHANGED, this._onActions);

    // Clean up global listeners on scene shutdown
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this._onResize, this);
      this.game.events.off(EVENTS.MONEY_CHANGED,  this._onMoney);
      this.game.events.off(EVENTS.INPUT_MODE_CHANGED, this._onInputMode);
      this.game.events.off(EVENTS.ACTIONS_CHANGED, this._onActions);
    });
  }
}
