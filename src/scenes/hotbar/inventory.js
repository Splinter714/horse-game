// Inventory panel — the full item grid (open via I / the inventory toggle). Tap an
// item to assign it to the active hotbar slot. Mutually exclusive with the pause
// menu. Extracted from the monolithic HotbarScene (issue #167).

import { ALL_ITEMS } from '../../data/items.js';
import { growHitArea, logicalW, logicalH } from '../uiUtils.js';
import { INV_COLS, INV_ROWS } from './constants.js';

export const WithInventory = (Base) => class extends Base {
  _toggleInventory() {
    if (this.invOpen) this._closeInventory();
    else              this._openInventory();
  }

  _openInventory() {
    this._closeFlyout();
    for (const o of this._invNodes) o.destroy();
    this._invNodes = [];
    this.invOpen   = true;

    // Inventory and pause are mutually exclusive overlays
    if (this.pauseOpen) this._closePause();

    const sw = logicalW(this);
    const sh = logicalH(this);

    const CELL  = Math.max(44, Math.min(70, Math.floor((sw - 40) / INV_COLS)));
    const GAP   = 4;
    const panelW = INV_COLS * CELL + (INV_COLS + 1) * GAP;
    const panelH = INV_ROWS * CELL + (INV_ROWS + 1) * GAP + 48;
    const px = Math.round((sw - panelW) / 2);
    const py = Math.max(8, Math.round((sh - panelH) / 2));

    const dim = this.add.rectangle(0, 0, sw, sh, 0x000000, 0.6)
      .setOrigin(0, 0).setInteractive().setDepth(100);
    dim.on('pointerdown', () => this._closeInventory());
    this._invNodes.push(dim);

    const bg = this.add.graphics().setDepth(101);
    bg.fillStyle(0x0d1020, 0.98);
    bg.fillRoundedRect(px, py, panelW, panelH, 12);
    bg.lineStyle(2, 0x3a4060, 1);
    bg.strokeRoundedRect(px, py, panelW, panelH, 12);
    this._invNodes.push(bg);

    // Absorb clicks inside the panel so they don't fall through to the dim
    const absorb = this.add.zone(px, py, panelW, panelH)
      .setOrigin(0, 0).setInteractive().setDepth(102);
    this._invNodes.push(absorb);

    const title = this.add.text(px + panelW / 2, py + 14, 'Inventory', {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#dfe2f0', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(103);
    this._invNodes.push(title);

    const slotNum = this.activeSlot + 1 === 10 ? 10 : (this.activeSlot + 1) % 10;
    const hint = this.add.text(px + panelW / 2, py + panelH - 8,
      `Tap item → assign to slot ${slotNum}`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#9298b8',
    }).setOrigin(0.5, 1).setDepth(103);
    this._invNodes.push(hint);

    const closeBtn = this.add.text(px + panelW - 10, py + 10, '✕', {
      fontFamily: 'system-ui, sans-serif', fontSize: '15px', color: '#8090b0',
    }).setOrigin(1, 0).setDepth(104).setInteractive({ useHandCursor: true });
    growHitArea(closeBtn); // (#100)
    closeBtn.on('pointerdown', () => this._closeInventory());
    this._invNodes.push(closeBtn);

    const gridY = py + 40;
    for (let row = 0; row < INV_ROWS; row++) {
      for (let col = 0; col < INV_COLS; col++) {
        const idx  = row * INV_COLS + col;
        const cx   = px + GAP + col * (CELL + GAP);
        const cy   = gridY + GAP + row * (CELL + GAP);
        const item = idx < ALL_ITEMS.length ? ALL_ITEMS[idx] : null;
        const isEquipped = item && this.hotbar[this.activeSlot] === item.key;

        const slotG = this.add.graphics().setDepth(103);
        slotG.fillStyle(isEquipped ? 0x2a3050 : 0x1a1e30, 0.9);
        slotG.fillRoundedRect(cx, cy, CELL, CELL, 6);
        slotG.lineStyle(2, isEquipped ? 0xe8c84a : 0x2a3060, 1);
        slotG.strokeRoundedRect(cx, cy, CELL, CELL, 6);
        this._invNodes.push(slotG);

        if (!item) continue;

        const view = this._slotView(item, item.key);
        const iconSize = Math.max(18, Math.floor(CELL * 0.44));
        const ico = this.add.image(cx + CELL / 2, cy + CELL * 0.4, view.icon)
          .setDisplaySize(iconSize, iconSize).setDepth(104);
        const lbl = this.add.text(cx + CELL / 2, cy + CELL * 0.78, view.label, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: `${Math.max(11, Math.round(CELL * 0.17))}px`,
          color: '#dde1f0',
        }).setOrigin(0.5, 0.5).setDepth(104);
        this._invNodes.push(ico, lbl);

        const qty = view.count;
        if (qty !== undefined) {
          const qtyLbl = this.add.text(cx + CELL - 4, cy + 4, `${qty}`, {
            fontFamily: 'system-ui, sans-serif',
            fontSize: `${Math.max(11, Math.round(CELL * 0.16))}px`,
            color: '#ffdd66',
            backgroundColor: '#000a',
            padding: { x: 2, y: 0 },
          }).setOrigin(1, 0).setDepth(104);
          this._invNodes.push(qtyLbl);
        }

        const zone = this.add.zone(cx, cy, CELL, CELL)
          .setOrigin(0, 0).setInteractive({ useHandCursor: true }).setDepth(105);
        zone.on('pointerdown', () => this._assignToSlot(item.key));
        this._invNodes.push(zone);
      }
    }
  }

  _closeInventory() {
    this.invOpen = false;
    for (const o of this._invNodes) o.destroy();
    this._invNodes = [];
  }

  _assignToSlot(itemKey) {
    this.hotbar[this.activeSlot] = itemKey;
    this._saveCarriers();
    this._closeInventory();
    this._buildHotbar();
  }
};
