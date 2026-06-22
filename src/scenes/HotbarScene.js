import Phaser from 'phaser';
import { ALL_ITEMS, ITEM_MAP } from '../data/items.js';
import { loadGameState, saveGameState } from '../data/save.js';
import { toggleMute, isMuted } from '../audio/sounds.js';

const SLOT_SIZE = 52;
const SLOT_GAP  = 6;
const NUM_SLOTS = 10;
const INV_COLS  = 5;
const INV_ROWS  = 10;

export default class HotbarScene extends Phaser.Scene {
  constructor() { super('HotbarScene'); }

  create() {
    const saved      = loadGameState();
    this.hotbar      = saved.hotbar;
    this.inventory   = saved.inventory;
    this.activeSlot  = 0;
    this.invOpen     = false;
    this._money      = 0;
    this._basketEggs = 0;
    this._slots      = [];
    this._invNodes   = [];
    this._muteBtn    = null;
    this._moneyLbl   = null;
    this._basketLbl  = null;

    this._buildHotbar();

    const KEY_NAMES = ['ONE','TWO','THREE','FOUR','FIVE','SIX','SEVEN','EIGHT','NINE','ZERO'];
    KEY_NAMES.forEach((name, i) => {
      this.input.keyboard.on(`keydown-${name}`, () => this._setActive(i));
    });
    this.input.keyboard.on('keydown-I', () => this._toggleInventory());
    this.input.keyboard.on('keydown-M', () => {
      const nowMuted = toggleMute();
      this._muteBtn?.setText(nowMuted ? '🔇' : '🔊');
    });

    this.input.gamepad.on('down', (_pad, button) => {
      if (button.index === 4) this._setActive((this.activeSlot - 1 + NUM_SLOTS) % NUM_SLOTS);
      if (button.index === 5) this._setActive((this.activeSlot + 1) % NUM_SLOTS);
    });

    this._onResize = () => {
      this._buildHotbar();
      if (this.invOpen) this._openInventory();
    };
    this.scale.on('resize', this._onResize, this);

    // Update money/basket labels in-place — no full rebuild needed
    this._onMoney  = v => { this._money = v;      this._updateStatusLabels(); };
    this._onBasket = v => { this._basketEggs = v;  this._updateStatusLabels(); };
    this.game.events.on('money-changed',  this._onMoney);
    this.game.events.on('basket-changed', this._onBasket);

    // Clean up global listeners on scene shutdown
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this._onResize, this);
      this.game.events.off('money-changed',  this._onMoney);
      this.game.events.off('basket-changed', this._onBasket);
    });
  }

  // ── Hotbar ─────────────────────────────────────────────────────────────────

  _buildHotbar() {
    // Destroy all tracked hotbar display objects
    for (const o of this._slots) {
      o.g?.destroy();
      o.numLbl?.destroy();
      o.icon?.destroy();
      o.itemLbl?.destroy();
      o.qtyLbl?.destroy();
      o.zone?.destroy();
    }
    this._stripBg?.destroy();
    this._muteBtn?.destroy();
    this._invBtn?.destroy();
    this._moneyLbl?.destroy();
    this._basketLbl?.destroy();
    this._slots      = [];
    this._muteBtn    = null;
    this._invBtn     = null;
    this._moneyLbl   = null;
    this._basketLbl  = null;
    this._stripBg    = null;

    const sw = this.scale.width;
    const sh = this.scale.height;

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

    this._invBtn = this.add.text(12, slotY + ss / 2, '🎒', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: `${Math.max(14, Math.floor(20 * fit))}px`,
    }).setOrigin(0, 0.5).setDepth(2).setInteractive({ useHandCursor: true });
    this._invBtn.on('pointerdown', () => this._toggleInventory());

    this._muteBtn = this.add.text(sw - 12, slotY + ss / 2, isMuted() ? '🔇' : '🔊', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: `${Math.max(14, Math.floor(20 * fit))}px`,
    }).setOrigin(1, 0.5).setDepth(2).setInteractive({ useHandCursor: true });
    this._muteBtn.on('pointerdown', () => {
      const nowMuted = toggleMute();
      this._muteBtn.setText(nowMuted ? '🔇' : '🔊');
    });

    // Status labels (money / basket) — created empty, filled by _updateStatusLabels
    const fontSize = `${Math.max(10, Math.floor(13 * fit))}px`;
    this._moneyLbl = this.add.text(sw - 12, slotY - 6, '', {
      fontFamily: 'system-ui, sans-serif', fontSize, color: '#f0d060',
    }).setOrigin(1, 1).setDepth(2).setVisible(false);

    this._basketLbl = this.add.text(0, slotY - 6, '', {
      fontFamily: 'system-ui, sans-serif', fontSize, color: '#fffde0',
    }).setOrigin(1, 1).setDepth(2).setVisible(false);

    this._updateStatusLabels();

    // Slots
    for (let i = 0; i < NUM_SLOTS; i++) {
      const x     = startX + i * (ss + sg);
      const active = i === this.activeSlot;

      const g = this.add.graphics().setDepth(2);
      this._drawSlot(g, x, slotY, ss, radius, active);

      const numLbl = this.add.text(x + 3, slotY + 2, String((i + 1) % 10), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: `${Math.max(7, Math.floor(9 * fit))}px`,
        color: '#6a7090',
      }).setDepth(3);

      const key  = this.hotbar[i];
      const item = key ? ITEM_MAP[key] : null;
      let icon = null, itemLbl = null, qtyLbl = null;

      if (item) {
        const iconSize = Math.max(14, Math.floor(26 * fit));
        icon = this.add.image(x + ss / 2, slotY + ss * 0.38, item.icon)
          .setDisplaySize(iconSize, iconSize).setDepth(3);
        itemLbl = this.add.text(x + ss / 2, slotY + ss - 8, item.label, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: `${Math.max(6, Math.floor(8 * fit))}px`,
          color: '#c8cce0',
        }).setOrigin(0.5, 0.5).setDepth(3);

        const qty = this.inventory[key];
        if (qty !== undefined) {
          qtyLbl = this.add.text(x + ss - 3, slotY + 3, `${qty}`, {
            fontFamily: 'system-ui, sans-serif',
            fontSize: `${Math.max(6, Math.floor(8 * fit))}px`,
            color: '#ffdd66',
            backgroundColor: '#000a',
            padding: { x: 1, y: 0 },
          }).setOrigin(1, 0).setDepth(4);
        }
      }

      const zone = this.add.zone(x, slotY, ss, ss).setOrigin(0, 0).setInteractive().setDepth(5);
      zone.on('pointerdown', () => {
        if (this.invOpen) this._closeInventory();
        this._setActive(i);
      });

      this._slots.push({ g, numLbl, icon, itemLbl, qtyLbl, zone, x, slotY, ss, radius });
    }
  }

  // Update just the money/basket text without rebuilding everything
  _updateStatusLabels() {
    if (!this._moneyLbl || !this._basketLbl) return;

    const sw = this.scale.width;

    if (this._money > 0) {
      this._moneyLbl.setText(`$${this._money}`).setVisible(true);
      const rightEdge = sw - 12 - this._moneyLbl.width - 6;
      if (this._basketEggs > 0) {
        this._basketLbl.setText(`🥚×${this._basketEggs}`).setX(rightEdge).setVisible(true);
      } else {
        this._basketLbl.setVisible(false);
      }
    } else {
      this._moneyLbl.setVisible(false);
      if (this._basketEggs > 0) {
        this._basketLbl.setText(`🥚×${this._basketEggs}`).setX(sw - 12).setVisible(true);
      } else {
        this._basketLbl.setVisible(false);
      }
    }
  }

  _drawSlot(g, x, y, ss, radius, active) {
    g.clear();
    g.fillStyle(active ? 0x2a3050 : 0x1a1e30, active ? 0.95 : 0.85);
    g.fillRoundedRect(x, y, ss, ss, radius);
    g.lineStyle(2, active ? 0xe8c84a : 0x3a4060, 1);
    g.strokeRoundedRect(x, y, ss, ss, radius);
  }

  _setActive(index) {
    const prev = this._slots[this.activeSlot];
    if (prev) this._drawSlot(prev.g, prev.x, prev.slotY, prev.ss, prev.radius, false);
    this.activeSlot = index;
    const curr = this._slots[this.activeSlot];
    if (curr) this._drawSlot(curr.g, curr.x, curr.slotY, curr.ss, curr.radius, true);
  }

  // ── Inventory panel ────────────────────────────────────────────────────────

  _toggleInventory() {
    if (this.invOpen) this._closeInventory();
    else              this._openInventory();
  }

  _openInventory() {
    for (const o of this._invNodes) o.destroy();
    this._invNodes = [];
    this.invOpen   = true;

    const sw = this.scale.width;
    const sh = this.scale.height;

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
      fontFamily: 'system-ui, sans-serif', fontSize: '15px', color: '#c8cce0',
    }).setOrigin(0.5, 0).setDepth(103);
    this._invNodes.push(title);

    const slotNum = this.activeSlot + 1 === 10 ? 10 : (this.activeSlot + 1) % 10;
    const hint = this.add.text(px + panelW / 2, py + panelH - 8,
      `Tap item → assign to slot ${slotNum}`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '10px', color: '#6a7090',
    }).setOrigin(0.5, 1).setDepth(103);
    this._invNodes.push(hint);

    const closeBtn = this.add.text(px + panelW - 10, py + 10, '✕', {
      fontFamily: 'system-ui, sans-serif', fontSize: '15px', color: '#8090b0',
    }).setOrigin(1, 0).setDepth(104).setInteractive({ useHandCursor: true });
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

        const iconSize = Math.max(18, Math.floor(CELL * 0.44));
        const ico = this.add.image(cx + CELL / 2, cy + CELL * 0.4, item.icon)
          .setDisplaySize(iconSize, iconSize).setDepth(104);
        const lbl = this.add.text(cx + CELL / 2, cy + CELL * 0.78, item.label, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: `${Math.max(7, Math.floor(CELL * 0.14))}px`,
          color: '#c8cce0',
        }).setOrigin(0.5, 0.5).setDepth(104);
        this._invNodes.push(ico, lbl);

        const qty = this.inventory[item.key];
        if (qty !== undefined) {
          const qtyLbl = this.add.text(cx + CELL - 4, cy + 4, `${qty}`, {
            fontFamily: 'system-ui, sans-serif',
            fontSize: `${Math.max(7, Math.floor(CELL * 0.13))}px`,
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
    saveGameState({ hotbar: this.hotbar, inventory: this.inventory });
    this._closeInventory();
    this._buildHotbar();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  getActiveItem() {
    const key = this.hotbar[this.activeSlot];
    return key ? (ITEM_MAP[key] ?? null) : null;
  }
}
