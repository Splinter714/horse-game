import Phaser from 'phaser';
import { ALL_ITEMS, ITEM_MAP, CARRIER_DEFS, CONTENT_DEFS } from '../data/items.js';
import { loadGameState, saveGameState, loadUiSettings, saveUiSettings } from '../data/save.js';
import { toggleMute, isMuted, setVolume, getAudioSettings } from '../audio/sounds.js';
import { EVENTS } from '../data/events.js';
import { growHitArea } from './uiUtils.js';

// Gameplay scenes frozen while the pause menu is open
const PAUSABLE_SCENES = ['PaddockScene', 'DayNightScene', 'InfoPanelScene'];

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
    this.carriers    = saved.carriers;
    this.activeSlot  = 0;
    this.invOpen     = false;
    this.pauseOpen   = false;
    this._money      = 0;
    this._slots      = [];
    this._invNodes   = [];
    this._pauseNodes = [];
    this._pauseBtn   = null;
    this._muteRowLbl = null;
    this._promptRowLbl = null;
    this._moneyLbl   = null;

    // Control-prompt visibility (#82) — toggled in the pause menu, persisted.
    this._showPrompts = loadUiSettings().showPrompts;

    // The on-screen Use button is a touch affordance — keyboard/gamepad players
    // use F / X instead, so it only shows in touch mode. Default from the device's
    // primary pointer; PaddockScene keeps it in sync via INPUT_MODE_CHANGED.
    this._isTouch = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
    // The Use button's label tracks the action it would take (Brush/Feed/Gather…),
    // pushed from PaddockScene via USE_LABEL_CHANGED. Fixed-width button (below) so
    // the text changing never resizes it.
    this._useLabel = 'Use';

    this._buildHotbar();

    const KEY_NAMES = ['ONE','TWO','THREE','FOUR','FIVE','SIX','SEVEN','EIGHT','NINE','ZERO'];
    KEY_NAMES.forEach((name, i) => {
      this.input.keyboard.on(`keydown-${name}`, () => this._setActive(i));
    });
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

    this.input.gamepad.on('down', (_pad, button) => {
      if (button.index === 4) this._setActive((this.activeSlot - 1 + NUM_SLOTS) % NUM_SLOTS);
      if (button.index === 5) this._setActive((this.activeSlot + 1) % NUM_SLOTS);
    });

    this._onResize = () => {
      this._buildHotbar();
      if (this.invOpen)   this._openInventory();
      if (this.pauseOpen) this._openPause();
    };
    this.scale.on('resize', this._onResize, this);

    // Update money label in-place — no full rebuild needed
    this._onMoney  = v => { this._money = v; this._updateStatusLabels(); };
    this.game.events.on(EVENTS.MONEY_CHANGED,  this._onMoney);

    // Show/hide the on-screen Use button as the player switches input devices.
    this._onInputMode = mode => {
      const touch = mode === 'touch';
      if (touch === this._isTouch) return;
      this._isTouch = touch;
      this._buildHotbar(); // recreate the strip with/without the Use button
    };
    this.game.events.on(EVENTS.INPUT_MODE_CHANGED, this._onInputMode);

    // Update the Use button's label as the contextual action changes.
    this._onUseLabel = label => {
      this._useLabel = label || 'Use';
      this._use?.lbl?.setText(this._useLabel);
    };
    this.game.events.on(EVENTS.USE_LABEL_CHANGED, this._onUseLabel);

    // Clean up global listeners on scene shutdown
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this._onResize, this);
      this.game.events.off(EVENTS.MONEY_CHANGED,  this._onMoney);
      this.game.events.off(EVENTS.INPUT_MODE_CHANGED, this._onInputMode);
      this.game.events.off(EVENTS.USE_LABEL_CHANGED, this._onUseLabel);
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
    this._pauseBtn?.destroy();
    this._moneyLbl?.destroy();
    this._use?.g?.destroy();
    this._use?.lbl?.destroy();
    this._use?.zone?.destroy();
    this._slots      = [];
    this._pauseBtn   = null;
    this._moneyLbl   = null;
    this._stripBg    = null;
    this._use        = null;

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

    // Money label — created empty, filled by _updateStatusLabels
    const fontSize = `${Math.max(10, Math.floor(13 * fit))}px`;
    this._moneyLbl = this.add.text(sw - 12, slotY - 6, '', {
      fontFamily: 'system-ui, sans-serif', fontSize, color: '#f0d060',
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
        const view = this._slotView(item, key);
        const iconSize = Math.max(14, Math.floor(26 * fit));
        icon = this.add.image(x + ss / 2, slotY + ss * 0.38, view.icon)
          .setDisplaySize(iconSize, iconSize).setDepth(3);
        itemLbl = this.add.text(x + ss / 2, slotY + ss - 8, view.label, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: `${Math.max(6, Math.floor(8 * fit))}px`,
          color: '#c8cce0',
        }).setOrigin(0.5, 0.5).setDepth(3);

        const qty = view.count;
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

      // Tap target is a full-height column (strip top → screen bottom) spanning
      // the slot plus its gap, so small slots on phones stay easy to hit (#100).
      // Columns tile exactly with no overlap; the Use button sits higher up.
      const colTop = slotY - 8;
      const zone = this.add.zone(x - sg / 2, colTop, ss + sg, sh - colTop)
        .setOrigin(0, 0).setInteractive().setDepth(5);
      zone.on('pointerdown', () => {
        if (this.invOpen) this._closeInventory();
        this._setActive(i);
      });

      this._slots.push({ g, numLbl, icon, itemLbl, qtyLbl, zone, x, slotY, ss, radius });
    }

    this._buildUseButton(startX, totalW, slotY, ss, radius, fit);
  }

  // The "Use" button — applies the armed tool. It's a touch affordance only:
  // keyboard/gamepad players use F / controller-X, so it's not built at all
  // unless we're in touch mode (toggled live via INPUT_MODE_CHANGED). Sits just
  // above the right end of the hotbar strip; dimmed when the active slot is empty.
  _buildUseButton(startX, totalW, slotY, ss, radius, fit) {
    if (!this._isTouch) { this._use = null; return; } // hidden for keyboard/gamepad

    // Fixed width — sized for the longest verb ('Unsaddle'/'Collect') so the text
    // changing per action never makes the button jump around (#100). Kept generous
    // even on small screens.
    const useW = Math.max(96, Math.floor(116 * fit));
    const useH = Math.max(40, Math.floor(44 * fit));
    const ux   = startX + totalW - useW;
    const uy   = slotY - useH - 14;

    const g = this.add.graphics().setDepth(2);
    const lbl = this.add.text(ux + useW / 2, uy + useH / 2, this._useLabel, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: `${Math.max(12, Math.floor(16 * fit))}px`,
      color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(3);

    // Pad the touch zone beyond the visual button — extra room up/left/right and
    // a touch below (without reaching the slot columns at slotY-8) (#100).
    const padX = 10, padTop = 12, padBot = 6;
    const zone = this.add.zone(ux - padX, uy - padTop, useW + padX * 2, useH + padTop + padBot)
      .setOrigin(0, 0).setInteractive({ useHandCursor: true }).setDepth(5);
    zone.on('pointerup', () => {
      if (this.invOpen) return;
      this.scene.get('PaddockScene')?.useActiveTool();
    });

    this._use = { g, lbl, zone, ux, uy, useW, useH, radius };
    this._refreshUseButton();
  }

  // Redraw the Use button to reflect whether the active slot holds a usable tool.
  _refreshUseButton() {
    const u = this._use;
    if (!u) return;
    const key  = this.hotbar[this.activeSlot];
    const item = key ? ITEM_MAP[key] : null;
    // Empty slots aren't "used"; every tool/carrier is.
    const usable = !!item;

    u.g.clear();
    u.g.fillStyle(usable ? 0x3b4a63 : 0x2a2f3c, usable ? 0.95 : 0.6);
    u.g.fillRoundedRect(u.ux, u.uy, u.useW, u.useH, u.radius);
    u.g.lineStyle(1, 0xffffff, usable ? 0.18 : 0.08);
    u.g.strokeRoundedRect(u.ux, u.uy, u.useW, u.useH, u.radius);
    u.lbl.setAlpha(usable ? 1 : 0.5);
  }

  // Update just the money text without rebuilding everything
  _updateStatusLabels() {
    if (!this._moneyLbl) return;
    if (this._money > 0) this._moneyLbl.setText(`$${this._money}`).setVisible(true);
    else                 this._moneyLbl.setVisible(false);
  }

  // ── Carriers ─────────────────────────────────────────────────────────────

  // Resolve how an item should render in a slot: icon, label, and count badge.
  _slotView(item, key) {
    if (item.type !== 'carrier') {
      return { icon: item.icon, label: item.label, count: undefined };
    }
    const st  = this.carriers[key] ?? { content: null, count: 0 };
    const def = CARRIER_DEFS[item.carrier];
    const cdef = st.count > 0 ? CONTENT_DEFS[st.content] : null;
    return {
      icon:  cdef ? cdef.icon  : def.emptyIcon,
      label: cdef ? cdef.label : item.label,
      count: st.count > 0 ? st.count : undefined,
    };
  }

  _saveCarriers() {
    saveGameState({ hotbar: this.hotbar, inventory: this.inventory, carriers: this.carriers });
  }

  // Add `amount` of `content` to the active carrier. Returns how many were added
  // (0 if the carrier is incompatible, full, or already holds something else).
  fillActiveCarrier(content, amount = 1) {
    const key  = this.hotbar[this.activeSlot];
    const item = key ? ITEM_MAP[key] : null;
    if (!item || item.type !== 'carrier') return 0;
    const def = CARRIER_DEFS[item.carrier];
    if (!def.accepts.includes(content)) return 0;
    const st = this.carriers[key];
    if (st.count > 0 && st.content !== content) return 0; // strict: no mixing
    const added = Math.min(def.capacity - st.count, amount);
    if (added <= 0) return 0;
    st.content = content;
    st.count  += added;
    this._saveCarriers();
    this._buildHotbar();
    return added;
  }

  // Remove `amount` from the active carrier; reverts it to empty at zero.
  // Returns how many were actually removed.
  useActiveCarrier(amount = 1) {
    const key = this.hotbar[this.activeSlot];
    const st  = key ? this.carriers[key] : null;
    if (!st || st.count <= 0) return 0;
    const used = Math.min(st.count, amount);
    st.count -= used;
    if (st.count <= 0) { st.content = null; st.count = 0; }
    this._saveCarriers();
    this._buildHotbar();
    return used;
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
    this._refreshUseButton();
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

    // Inventory and pause are mutually exclusive overlays
    if (this.pauseOpen) this._closePause();

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
          fontSize: `${Math.max(7, Math.floor(CELL * 0.14))}px`,
          color: '#c8cce0',
        }).setOrigin(0.5, 0.5).setDepth(104);
        this._invNodes.push(ico, lbl);

        const qty = view.count;
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
    this._saveCarriers();
    this._closeInventory();
    this._buildHotbar();
  }

  // ── Pause menu ───────────────────────────────────────────────────────────────

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
    return lbl;
  }

  _openPause() {
    for (const o of this._pauseNodes) o.destroy();
    this._pauseNodes = [];
    this.pauseOpen   = true;

    // Inventory and pause are mutually exclusive overlays
    if (this.invOpen) this._closeInventory();

    // Actually freeze the world while paused
    for (const key of PAUSABLE_SCENES) {
      if (this.scene.isActive(key)) this.scene.pause(key);
    }

    const sw = this.scale.width;
    const sh = this.scale.height;

    const panelW = Math.min(320, sw - 40);
    const rowH   = 48;
    const sliderH = 44;            // height per volume-slider row
    const sliders = [
      ['Master',  'master'],
      ['Music',   'music'],
      ['Ambient', 'ambient'],
      ['Effects', 'effects'],
    ];
    const panelH = 56 + rowH * 2 + sliders.length * sliderH + 8; // title + 2 toggles + sliders
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

    // Per-bus volume sliders, stacked below the toggle rows.
    const vols = getAudioSettings().volumes;
    let sy = promptRowY + rowH + 4;
    for (const [label, bus] of sliders) {
      this._addVolumeSlider(rowX, sy, rowW, label, bus, vols[bus]);
      sy += sliderH;
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
      .setOrigin(0, 0).setInteractive({ useHandCursor: true, draggable: true }).setDepth(105);
    const setFromX = (px) => {
      v = Math.max(0, Math.min(1, (px - trackX) / trackW));
      draw();
      setVolume(bus, v);
    };
    zone.on('pointerdown', (p) => setFromX(p.x));
    zone.on('drag', (p) => setFromX(p.x));
    this._pauseNodes.push(zone);
  }

  _closePause() {
    this.pauseOpen   = false;
    this._muteRowLbl = null;
    for (const o of this._pauseNodes) o.destroy();
    this._pauseNodes = [];

    // Resume the world
    for (const key of PAUSABLE_SCENES) {
      if (this.scene.isPaused(key)) this.scene.resume(key);
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  getActiveItem() {
    const key  = this.hotbar[this.activeSlot];
    const item = key ? ITEM_MAP[key] : null;
    if (!item) return null;
    if (item.type !== 'carrier') return item;

    // Resolve a carrier into a usable view: its current content drives the
    // action (an empty carrier has no use-action, only gathering).
    const def  = CARRIER_DEFS[item.carrier];
    const st   = this.carriers[key] ?? { content: null, count: 0 };
    const content = st.count > 0 ? st.content : null;
    const cdef = content ? CONTENT_DEFS[content] : null;
    return {
      ...item,
      content,
      count:    st.count,
      capacity: def.capacity,
      accepts:  def.accepts,
      action:   cdef ? cdef.action : null,
      icon:     cdef ? cdef.icon   : def.emptyIcon,
      label:    cdef ? cdef.label  : item.label,
    };
  }
}
