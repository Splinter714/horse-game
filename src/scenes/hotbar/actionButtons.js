// On-screen action buttons — the Interact / Info / Use buttons above the hotbar
// strip (#101). Touch only: keyboard/gamepad players use E/C/F (A/Y/X) and read
// the prompt panel, so these aren't built otherwise. Each shows only when its
// contextual action is possible. Extracted from the monolithic HotbarScene (#167).

import { logicalW } from '../uiUtils.js';
import { renderBakedLayer, destroyBakedLayer } from './bakedLayer.js';

export const WithActionButtons = (Base) => class extends Base {
  // On-screen contextual action buttons — Interact / Info / Use — spread across
  // the top of the hotbar (#101). Touch only: keyboard/gamepad players use the
  // E/C/F (A/Y/X) keys and read the prompt panel, so these aren't built at all
  // otherwise. Each button shows only when its action is currently possible
  // (label non-null); _updateActionButtons fills/positions them from _actions.
  _buildActionButtons(startX, totalW, slotY, fit) {
    if (!this._isTouch) {
      this._actionBtns = null;
      this._actionBtnLayer = destroyBakedLayer(this._actionBtnLayer);
      this._actionBtnSig = null;
      return;
    }

    const h    = Math.max(40, Math.floor(44 * fit));
    const y     = slotY - h - 14;        // the row just above the strip
    const font  = `${Math.max(12, Math.floor(16 * fit))}px`;
    const radius = Math.max(4, Math.floor(8 * fit));
    // Fixed anchors (left / centre / right thirds) so a button doesn't reflow
    // when its neighbours appear or disappear — it just fades in over its spot.
    const anchors = {
      interact: startX + totalW * (1 / 6),
      info:     startX + totalW * (3 / 6),
      use:      startX + totalW * (5 / 6),
    };
    const triggers = {
      interact: () => this.scene.get('PaddockScene')?.triggerInteract(),
      info:     () => this.scene.get('PaddockScene')?.triggerInfo(),
      use:      () => this.scene.get('PaddockScene')?.useActiveTool(),
    };

    this._actionBtnSig = null; // geometry changed → force a re-stamp below

    this._actionBtns = ['interact', 'info', 'use'].map((key) => {
      const lbl = this.add.text(anchors[key], y + h / 2, '', {
        fontFamily: 'system-ui, sans-serif', fontSize: font,
        color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5, 0.5).setDepth(3).setVisible(false);
      const zone = this.add.zone(0, 0, 10, h).setOrigin(0, 0)
        .setInteractive({ useHandCursor: true }).setDepth(5);
      zone.input.enabled = false;
      zone.on('pointerup', () => { if (!this.invOpen) triggers[key](); });
      return { key, lbl, zone, anchorX: anchors[key], y, h, radius, bounds: null };
    });
    this._updateActionButtons();
  }

  // Fill/position/show the action buttons from the latest _actions labels. Each
  // is sized to its text (centred on its fixed anchor), padded into a comfortable
  // touch zone (#100). Hidden buttons drop out of input entirely.
  _updateActionButtons() {
    if (!this._actionBtns) return;
    // Availability is already change-gated upstream (PaddockScene only emits
    // ACTIONS_CHANGED when the label set actually differs), so this runs a handful
    // of times a minute — but the pill backgrounds it drew used to be three live
    // Graphics re-tessellated every frame regardless. They're now one baked texture,
    // re-stamped only when the labels/geometry change (#326).
    const padX = 10, padTop = 12, padBot = 6;
    const boxes = [];
    for (const b of this._actionBtns) {
      const label = this._actions?.[b.key];
      if (!label) {
        b.lbl.setVisible(false);
        b.zone.input.enabled = false;
        b.bounds = null;
        continue;
      }
      b.lbl.setText(label).setVisible(true);
      const w = Math.max(64, Math.ceil(b.lbl.width) + 24);
      const x = b.anchorX - w / 2;
      boxes.push({ x, y: b.y, w, h: b.h, radius: b.radius });

      const zx = x - padX, zy = b.y - padTop, zw = w + padX * 2, zh = b.h + padTop + padBot;
      b.zone.setPosition(zx, zy).setSize(zw, zh); // setSize resizes the hit area too
      b.zone.input.enabled = true;
      b.bounds = { x: zx, y: zy, w: zw, h: zh };
    }

    const sig = boxes.map((r) => `${r.x},${r.y},${r.w},${r.h}`).join(';');
    if (sig === this._actionBtnSig) return; // same pills as last time — nothing to re-stamp
    this._actionBtnSig = sig;
    if (!boxes.length) {
      this._actionBtnLayer = destroyBakedLayer(this._actionBtnLayer);
      return;
    }
    const row = this._actionBtns[0];
    this._actionBtnLayer = renderBakedLayer(this, this._actionBtnLayer,
      { x: 0, y: row.y - 2, w: logicalW(this), h: row.h + 4 }, 2, (g) => {
        for (const r of boxes) {
          g.fillStyle(0x3b4a63, 0.95);
          g.fillRoundedRect(r.x, r.y, r.w, r.h, r.radius);
          g.lineStyle(1, 0xffffff, 0.18);
          g.strokeRoundedRect(r.x, r.y, r.w, r.h, r.radius);
        }
      });
  }

  // Is a screen-space point on a visible action button? Lets PaddockScene's tap
  // handler ignore taps that land on these buttons (so they don't also walk).
  isPointerOnActionButton(px, py) {
    for (const b of this._actionBtns ?? []) {
      const r = b.bounds;
      if (r && px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return true;
    }
    return false;
  }
};
