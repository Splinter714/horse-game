// Hotbar strip — building/redrawing the slot row (with the pause/preview buttons
// and money label), the active-slot highlight, and the slot press/hold input that
// drives selection, cycling, and opening the carrier fly-out (#75/#131/#132).
// Extracted from the monolithic HotbarScene (issue #167).

import { ITEM_MAP } from '../../data/items.js';
import { growHitArea, logicalW, logicalH } from '../uiUtils.js';
import { saveDevSettings } from '../../data/save.js';
import { SLOT_SIZE, SLOT_GAP, NUM_SLOTS, HOLD_FLYOUT_MS } from './constants.js';

export const WithHotbarSlots = (Base) => class extends Base {
  _buildHotbar() {
    // Destroy all tracked hotbar display objects
    for (const o of this._slots) {
      o.g?.destroy();
      o.numLbl?.destroy();
      o.icon?.destroy();
      o.itemLbl?.destroy();
      o.qtyLbl?.destroy();
      o.zone?.destroy();
      o.stackG?.destroy();
    }
    this._stripBg?.destroy();
    this._pauseBtn?.destroy();
    this._previewBtn?.destroy();
    this._moneyLbl?.destroy();
    for (const b of this._actionBtns ?? []) { b.g.destroy(); b.lbl.destroy(); b.zone.destroy(); }
    this._slots      = [];
    this._pauseBtn   = null;
    this._previewBtn = null;
    this._moneyLbl   = null;
    this._stripBg    = null;
    this._actionBtns = null;

    const sw = logicalW(this);
    const sh = logicalH(this);

    const naturalW = NUM_SLOTS * SLOT_SIZE + (NUM_SLOTS - 1) * SLOT_GAP;
    const fit    = Math.min(1, (sw - 16) / naturalW);
    const ss     = Math.max(28, Math.floor(SLOT_SIZE * fit));
    const sg     = Math.max(2,  Math.floor(SLOT_GAP  * fit));
    const totalW = NUM_SLOTS * ss + (NUM_SLOTS - 1) * sg;
    const startX = Math.round((sw - totalW) / 2);
    const slotY  = sh - ss - 10;
    const radius = Math.max(4, Math.floor(7 * fit));
    this._slotY  = slotY;
    this._ss     = ss;
    this._fit    = fit;

    this._stripBg = this.add.graphics().setDepth(1);
    this._stripBg.fillStyle(0x111622, 0.72);
    this._stripBg.fillRoundedRect(startX - 8, slotY - 8, totalW + 16, ss + 16, radius + 2);

    // Pause / settings menu button — top-left corner (clear of the time-of-day
    // display in the top-right). Mute lives inside it.
    this._pauseBtn = this.add.text(14, 14, '⏸', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: `${Math.max(16, Math.floor(22 * fit))}px`,
      color: '#dfe4f5',
      backgroundColor: '#111622cc',
      padding: { x: 6, y: 3 },
    }).setOrigin(0, 0).setDepth(2).setInteractive({ useHandCursor: true });
    growHitArea(this._pauseBtn); // comfortable tap target (#100)
    this._pauseBtn.on('pointerdown', () => this._togglePause());

    // Dev-only shortcut to the Art Preview gallery (boots into ArtPreviewScene on
    // reload). Same as flipping the pause-menu "Start screen → Art preview" knob,
    // but one click. Hidden in production builds.
    if (import.meta.env.DEV) {
      this._previewBtn = this.add.text(14, 48, '🎨', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: `${Math.max(16, Math.floor(22 * fit))}px`,
        color: '#dfe4f5', backgroundColor: '#111622cc', padding: { x: 6, y: 3 },
      }).setOrigin(0, 0).setDepth(2).setInteractive({ useHandCursor: true });
      growHitArea(this._previewBtn);
      this._previewBtn.on('pointerdown', () => {
        saveDevSettings({ startEditor: 'preview' });
        window.location.reload();
      });
    }

    // (The old 🐴 "Stable" button is gone: appearance editing now lives on each
    // horse's info panel — walk up and open it, then "Edit appearance" (#147).)

    // Money label — created empty, filled by _updateStatusLabels. Bigger, bolder,
    // and dark-stroked so it stays legible over the bright world (#120).
    const fontSize = `${Math.max(14, Math.round(ss * 0.2))}px`;
    this._moneyLbl = this.add.text(sw - 12, slotY - 6, '', {
      fontFamily: 'system-ui, sans-serif', fontSize, color: '#ffe14d',
      fontStyle: 'bold', stroke: '#1a1408', strokeThickness: 4,
    }).setOrigin(1, 1).setDepth(2).setVisible(false);

    this._updateStatusLabels();

    // Slots
    for (let i = 0; i < NUM_SLOTS; i++) {
      const x     = startX + i * (ss + sg);
      const active = i === this.activeSlot;

      const g = this.add.graphics().setDepth(2);
      this._drawSlot(g, x, slotY, ss, radius, active);

      // Text/icon scale with the actual slot size (#119) so bigger slots read as
      // bigger, clearer icons + labels — not just a wider box with tiny glyphs.
      const numLbl = this.add.text(x + 4, slotY + 3, String((i + 1) % 10), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: `${Math.max(9, Math.round(ss * 0.13))}px`,
        color: '#8a90b0',
      }).setDepth(3);

      const key  = this.hotbar[i];
      const item = key ? ITEM_MAP[key] : null;
      let icon = null, itemLbl = null, qtyLbl = null;

      if (item) {
        const view = this._slotView(item, key);
        const iconSize = Math.round(ss * 0.46);
        icon = this.add.image(x + ss / 2, slotY + ss * 0.40, view.icon)
          .setDisplaySize(iconSize, iconSize).setDepth(3);
        itemLbl = this.add.text(x + ss / 2, slotY + ss - Math.max(9, Math.round(ss * 0.12)), view.label, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: `${Math.max(9, Math.round(ss * 0.145))}px`,
          color: '#dde1f0',
        }).setOrigin(0.5, 0.5).setDepth(3);

        const qty = view.count;
        if (qty !== undefined) {
          qtyLbl = this.add.text(x + ss - 4, slotY + 4, `${qty}`, {
            fontFamily: 'system-ui, sans-serif',
            fontSize: `${Math.max(10, Math.round(ss * 0.165))}px`,
            color: '#ffdd66',
            backgroundColor: '#000a',
            padding: { x: 2, y: 0 },
          }).setOrigin(1, 0).setDepth(4);
        }
      }

      // Tap target is a full-height column (strip top → screen bottom) spanning
      // the slot plus its gap, so small slots on phones stay easy to hit (#100).
      // Columns tile exactly with no overlap; the Use button sits higher up.
      const colTop = slotY - 8;
      const zone = this.add.zone(x - sg / 2, colTop, ss + sg, sh - colTop)
        .setOrigin(0, 0).setInteractive().setDepth(5);
      zone.on('pointerdown', () => this._slotDown(i, 'pointer'));

      // A carrier group draws a faint "stacked card" peeking behind the slot, so
      // it reads as several carriers in one slot (#75). The slot itself shows the
      // active member; the fly-out lists them all.
      let stackG = null;
      if (item?.type === 'carrierGroup') {
        stackG = this.add.graphics().setDepth(1.5);
        stackG.fillStyle(0x1a1e30, 0.85);
        stackG.fillRoundedRect(x + 3, slotY - 3, ss, ss, radius);
        stackG.lineStyle(2, 0x3a4060, 1);
        stackG.strokeRoundedRect(x + 3, slotY - 3, ss, ss, radius);
      }

      this._slots.push({ g, numLbl, icon, itemLbl, qtyLbl, zone, stackG, x, slotY, ss, radius });
    }

    this._buildActionButtons(startX, totalW, slotY, fit);
  }

  // Update just the money text without rebuilding everything
  _updateStatusLabels() {
    if (!this._moneyLbl) return;
    if (this._money > 0) this._moneyLbl.setText(`$${this._money}`).setVisible(true);
    else                 this._moneyLbl.setVisible(false);
  }

  _drawSlot(g, x, y, ss, radius, active) {
    g.clear();
    if (active) {
      // Bold "selected" treatment so it's unmistakable which slot / fly-out member
      // is active: a soft gold glow ring behind, a noticeably brighter fill, and a
      // thick bright-gold border (#75 follow-up).
      g.fillStyle(0xffd24a, 0.22);
      g.fillRoundedRect(x - 3, y - 3, ss + 6, ss + 6, radius + 2);
      g.fillStyle(0x44508a, 1);
      g.fillRoundedRect(x, y, ss, ss, radius);
      g.lineStyle(4, 0xffe066, 1);
      g.strokeRoundedRect(x, y, ss, ss, radius);
    } else {
      g.fillStyle(0x1a1e30, 0.85);
      g.fillRoundedRect(x, y, ss, ss, radius);
      g.lineStyle(2, 0x3a4060, 1);
      g.strokeRoundedRect(x, y, ss, ss, radius);
    }
  }

  _setActive(index) {
    this._closeFlyout(); // any picker belongs to the previously-active slot
    const prev = this._slots[this.activeSlot];
    if (prev) this._drawSlot(prev.g, prev.x, prev.slotY, prev.ss, prev.radius, false);
    this.activeSlot = index;
    const curr = this._slots[this.activeSlot];
    if (curr) this._drawSlot(curr.g, curr.x, curr.slotY, curr.ss, curr.radius, true);
    // The Use button's availability follows the equipped tool, but that's driven
    // by PaddockScene's per-frame ACTIONS_CHANGED — no direct refresh needed here.
  }

  // ── Slot press vs. hold (#75 / #131 / #132) ─────────────────────────────────
  // Switching is IMMEDIATE on press-down (#131): pressing a slot selects it right
  // away, never gated behind the hold timer. Layered on top, a sustained HOLD opens
  // the carrier fly-out picker, and a quick re-press of the already-active carrier
  // group cycles to its next instance (with a brief flash, #132). _slotDown does the
  // instant switch + arms the hold timer; _slotUp resolves a quick tap.
  _slotDown(i, src) {
    // Ignore key auto-repeat / a second down for the same in-progress press.
    if (this._slotHold && this._slotHold.i === i && this._slotHold.src === src) return;
    this._cancelSlotHold();
    const wasActive = i === this.activeSlot;
    const wasOpen   = this._flyoutSlot === i;
    // The switch happens now, on press — not on release (#131). Re-pressing the
    // slot you're already on waits for release to tell a tap (cycle) from a hold.
    if (!wasActive) this._switchTo(i);
    const hold = { i, src, wasActive, wasOpen, fired: false };
    hold.timer = this.time.delayedCall(HOLD_FLYOUT_MS, () => {
      hold.fired = true; // held long enough → open the picker (suppresses the tap)
      this._openActiveFlyout();
    });
    this._slotHold = hold;
  }

  _slotUp(i, src) {
    const hold = this._slotHold;
    if (!hold || hold.i !== i || hold.src !== src) return;
    const { wasActive, wasOpen, fired } = hold;
    this._cancelSlotHold();
    if (fired) return; // the hold already opened the fly-out
    // Quick release. Any switch already happened on press-down (#131); the only
    // remaining tap action is cycling the active carrier group's instance.
    if (wasActive && this._isGroup(this.hotbar[i])) {
      this._cycleMember(this.hotbar[i]);
      if (wasOpen) this._openFlyout(i); // keep an open picker in sync + refresh it
      else         this._flashSlot(i);  // cycling stacked items in place → flash (#132)
    }
  }

  // Release came in on the scene (the slot zone may not get its own pointerup).
  _slotPointerUp() {
    if (this._slotHold?.src === 'pointer') this._slotUp(this._slotHold.i, 'pointer');
  }

  _cancelSlotHold() {
    this._slotHold?.timer?.remove();
    this._slotHold = null;
  }

  // Immediately make slot `i` active — the #131 instant switch. No flash: a plain
  // slot switch is shown by the moving highlight; the flash is reserved for cycling
  // stacked instances in place (#132).
  _switchTo(i) {
    if (this.invOpen) this._closeInventory();
    this._setActive(i); // also closes any open fly-out (it belonged to the old slot)
  }

  // Brief white blink over a slot: feedback that you've stepped to a different
  // stacked instance while the fly-out is closed (#132). At most one alive at a time.
  _flashSlot(i) {
    const slot = this._slots[i];
    if (!slot) return;
    this._slotFlash?.destroy();
    const { x, slotY, ss, radius } = slot;
    const flash = this.add.graphics().setDepth(6);
    flash.fillStyle(0xffffff, 0.5);
    flash.fillRoundedRect(x, slotY, ss, ss, radius);
    this._slotFlash = flash;
    this.tweens.add({
      targets: flash, alpha: 0,
      duration: 200, ease: 'Quad.easeOut',
      onComplete: () => { if (this._slotFlash === flash) this._slotFlash = null; flash.destroy(); },
    });
  }

  // Open the active slot's fly-out picker (the hold gesture / controller LT hold).
  _openActiveFlyout() {
    if (this.invOpen || this.pauseOpen) return;
    if (this._isGroup(this.hotbar[this.activeSlot])) this._openFlyout(this.activeSlot);
  }

  // Controller left trigger mirrors a number key: a short pull selects/cycles the
  // active slot, a hold opens its fly-out (#75). Routed through the same press/hold
  // machinery as keys/taps so behaviour stays identical across inputs.
  _padTriggerDown() { this._slotDown(this.activeSlot, 'pad'); }
  _padTriggerUp()   { if (this._slotHold?.src === 'pad') this._slotUp(this._slotHold.i, 'pad'); }

  // Gamepad slot navigation (driven by PaddockScene's raw-pad poller, #121): step
  // to the prev/next slot, wrapping. An immediate, flash-free switch (#131/#132) —
  // cycling instances is D-pad up/down or LT, and the fly-out is opened with LT hold.
  navSlot(dir) {
    this._switchTo((this.activeSlot + dir + NUM_SLOTS) % NUM_SLOTS);
  }
};
