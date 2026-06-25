// On-screen action buttons — the Interact / Info / Use buttons above the hotbar
// strip (#101). Touch only: keyboard/gamepad players use E/C/F (A/Y/X) and read
// the prompt panel, so these aren't built otherwise. Each shows only when its
// contextual action is possible. Extracted from the monolithic HotbarScene (#167).

export const WithActionButtons = (Base) => class extends Base {
  // On-screen contextual action buttons — Interact / Info / Use — spread across
  // the top of the hotbar (#101). Touch only: keyboard/gamepad players use the
  // E/C/F (A/Y/X) keys and read the prompt panel, so these aren't built at all
  // otherwise. Each button shows only when its action is currently possible
  // (label non-null); _updateActionButtons fills/positions them from _actions.
  _buildActionButtons(startX, totalW, slotY, fit) {
    if (!this._isTouch) { this._actionBtns = null; return; }

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

    this._actionBtns = ['interact', 'info', 'use'].map((key) => {
      const g   = this.add.graphics().setDepth(2).setVisible(false);
      const lbl = this.add.text(anchors[key], y + h / 2, '', {
        fontFamily: 'system-ui, sans-serif', fontSize: font,
        color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5, 0.5).setDepth(3).setVisible(false);
      const zone = this.add.zone(0, 0, 10, h).setOrigin(0, 0)
        .setInteractive({ useHandCursor: true }).setDepth(5);
      zone.input.enabled = false;
      zone.on('pointerup', () => { if (!this.invOpen) triggers[key](); });
      return { key, g, lbl, zone, anchorX: anchors[key], y, h, radius, bounds: null };
    });
    this._updateActionButtons();
  }

  // Fill/position/show the action buttons from the latest _actions labels. Each
  // is sized to its text (centred on its fixed anchor), padded into a comfortable
  // touch zone (#100). Hidden buttons drop out of input entirely.
  _updateActionButtons() {
    if (!this._actionBtns) return;
    const padX = 10, padTop = 12, padBot = 6;
    for (const b of this._actionBtns) {
      const label = this._actions?.[b.key];
      if (!label) {
        b.g.clear().setVisible(false);
        b.lbl.setVisible(false);
        b.zone.input.enabled = false;
        b.bounds = null;
        continue;
      }
      b.lbl.setText(label).setVisible(true);
      const w = Math.max(64, Math.ceil(b.lbl.width) + 24);
      const x = b.anchorX - w / 2;

      b.g.clear().setVisible(true);
      b.g.fillStyle(0x3b4a63, 0.95);
      b.g.fillRoundedRect(x, b.y, w, b.h, b.radius);
      b.g.lineStyle(1, 0xffffff, 0.18);
      b.g.strokeRoundedRect(x, b.y, w, b.h, b.radius);

      const zx = x - padX, zy = b.y - padTop, zw = w + padX * 2, zh = b.h + padTop + padBot;
      b.zone.setPosition(zx, zy).setSize(zw, zh); // setSize resizes the hit area too
      b.zone.input.enabled = true;
      b.bounds = { x: zx, y: zy, w: zw, h: zh };
    }
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
