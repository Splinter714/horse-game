// GeneralStoreScene (#215, unified #312) — the whole store's buy panel: spend gold
// on seeds, food/feed, clothing, and pet supplies. Opened when the player interacts
// with the one unified store building in town (PaddockScene.openGeneralStore).
// Mirrors ShopScene's modal-card buy-panel pattern exactly (same look, same input
// handling, same pause-the-world behavior) — ShopScene itself now only sells tool
// upgrades (#295) from the market stall, unrelated to this store.
//
// Two purchase shapes share this one panel (see `_buy`):
//   owned-count   → seeds/clothing/pets deposit into a persisted OWNED COUNT
//                   (storeInventory.js) — no carrier/basket involved.
//   carrier-fill  → food/feed (folded in from the old market-stall stock, #312)
//                   deposits into the equipped carrier (fillActiveCarrier), same as
//                   ShopScene's old feed-buy flow.
//
// TABS: driven by data/generalStore.js's STORE_COUNTERS registry — a list of
// { id, label, icon, items } counters (seeds/food/clothing/pets). The tab strip is
// drawn for the whole list, so adding a counter is a one-line data addition there —
// no UI code here changes.

import Phaser from 'phaser';
import { EVENTS } from '../data/events.js';
import { STORE_COUNTERS } from '../data/generalStore.js';
import { loadStoreInventory, saveStoreInventory, buyStoreItem } from '../data/storeInventory.js';
import { purchase } from '../data/shop.js';
import { growHitArea, applyDpr, logicalW, logicalH } from './uiUtils.js';

const CARD_W  = 340;
const ROW_H   = 56;
const PAD     = 16;
const TABS_H  = 34;  // counter-tab strip, shown above the header when >1 counter
const HEADER  = 92;  // portrait/title/money band above the list
const PAUSABLE = ['PaddockScene', 'DayNightScene'];

export default class GeneralStoreScene extends Phaser.Scene {
  constructor() {
    super('GeneralStoreScene');
    this._focusIdx = 0;
    this._focusActive = false;
    this._counterIdx = 0;
  }

  // `data.counterIds` (#222 pet store): an optional allow-list of STORE_COUNTERS
  // ids this launch should show — lets a second building (the pet store) reuse
  // this exact scene/UI for its own counter without also showing the general
  // store's seeds/clothing tabs. Omitted (general store's own launch) → every
  // counter, unchanged behavior.
  create(data) {
    applyDpr(this, { topLeft: true }); // HiDPI: top-left-anchored UI scene
    this.closing = false;
    this._money = this._readMoney();
    this._inventory = loadStoreInventory();
    this._counters = data?.counterIds
      ? STORE_COUNTERS.filter((c) => data.counterIds.includes(c.id))
      : STORE_COUNTERS;
    this._title = data?.title ?? 'General Store';
    this._buildingIcon = data?.icon ?? 'generalStore';
    this._counterIdx = 0;

    // Freeze the world so nothing moves/decays behind the modal.
    this._paused = [];
    for (const k of PAUSABLE) {
      if (this.scene.isActive(k) && !this.scene.isPaused(k)) { this.scene.pause(k); this._paused.push(k); }
    }
    this.scene.bringToTop();

    this.build();
    this._wireInput();
  }

  // Current balance: read straight off the live HotbarScene (single source of truth),
  // falling back to 0 if it isn't up yet. Mirrors ShopScene._readMoney.
  _readMoney() {
    const hb = this.scene.get('HotbarScene');
    return hb?._money ?? 0;
  }

  get _counter() {
    return this._counters[this._counterIdx] ?? this._counters[0];
  }

  build() {
    const sw = logicalW(this), sh = logicalH(this);
    this._sw = sw; this._sh = sh;

    // Full-screen dim catcher — a tap outside the card closes the store.
    const catcher = this.add.rectangle(0, 0, sw, sh, 0x000000, 0.35)
      .setOrigin(0, 0).setInteractive();
    catcher.on('pointerdown', () => this.close());

    const showTabs = this._counters.length > 1;
    const headerH = HEADER + (showTabs ? TABS_H : 0);
    const rows = this._counter.items.length;
    const listH = rows * ROW_H;
    const cardH = headerH + listH + PAD;
    const cardX = Math.round((sw - CARD_W) / 2);
    const cardY = Math.round((sh - cardH) / 2);
    this._cardX = cardX; this._cardY = cardY; this._cardH = cardH; this._headerH = headerH;

    this.panel = this.add.container(cardX, cardY + 12).setAlpha(0);

    // Card background.
    const bg = this.add.graphics();
    bg.fillStyle(0x141826, 0.99);
    bg.fillRoundedRect(0, 0, CARD_W, cardH, 16);
    bg.lineStyle(2, 0x3a4472, 1);
    bg.strokeRoundedRect(0, 0, CARD_W, cardH, 16);
    this.panel.add(bg);

    // Title + store icon.
    this.panel.add(this.add.image(30, 34, this._buildingIcon).setDisplaySize(40, 40).setOrigin(0.5, 0.5));
    this.panel.add(this.add.text(58, 22, this._title, {
      fontFamily: 'system-ui, sans-serif', fontSize: '22px', color: '#eef0fa', fontStyle: 'bold',
    }).setOrigin(0, 0));
    this._descLbl = this.add.text(58, 50, this._counter.label, {
      fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#9aa0c0',
    }).setOrigin(0, 0);
    this.panel.add(this._descLbl);

    // Money readout (top-right).
    this._moneyLbl = this.add.text(CARD_W - 16, 26, `$${this._money}`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#ffe14d',
      fontStyle: 'bold', stroke: '#1a1408', strokeThickness: 4,
    }).setOrigin(1, 0);
    this.panel.add(this._moneyLbl);

    // Counter tab strip (only drawn once a 2nd counter exists — #217 clothing).
    if (showTabs) this._buildTabs();

    // Divider under the header.
    const div = this.add.graphics();
    div.lineStyle(1, 0x3a4472, 1);
    div.lineBetween(14, headerH - 8, CARD_W - 14, headerH - 8);
    this.panel.add(div);

    // Product rows.
    this._rowNodes = []; // per-row { affordBg, buyLbl, item, y } for focus ring + refresh
    this._counter.items.forEach((item, i) => this._buildRow(item, i));

    // Close button.
    const closeBtn = this.add.text(CARD_W - 12, 8, '✕', {
      fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#9a9fbe',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    growHitArea(closeBtn);
    closeBtn.on('pointerdown', () => this.close());
    this.panel.add(closeBtn);

    // Focus ring (controller/keyboard); hidden until a pad/arrow is used.
    this._ring = this.add.graphics();
    this.panel.add(this._ring);
    this._refreshRing();

    // Pop the card in.
    this.tweens.add({ targets: this.panel, y: cardY, alpha: 1, duration: 160, ease: 'Quad.easeOut' });
  }

  _buildTabs() {
    const tabW = CARD_W / this._counters.length;
    const y = HEADER;
    this._tabNodes = this._counters.map((counter, i) => {
      const x = i * tabW;
      const active = i === this._counterIdx;
      const g = this.add.graphics();
      this._drawTab(g, x, y, tabW, active);
      this.panel.add(g);
      const lbl = this.add.text(x + tabW / 2, y + TABS_H / 2, counter.label, {
        fontFamily: 'system-ui, sans-serif', fontSize: '12px',
        color: active ? '#ffe066' : '#9aa0c0', fontStyle: active ? 'bold' : 'normal',
      }).setOrigin(0.5, 0.5);
      this.panel.add(lbl);
      const zone = this.add.zone(x, y, tabW, TABS_H).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this._switchCounter(i));
      this.panel.add(zone);
      return { g, lbl, x, y, tabW };
    });
  }

  _drawTab(g, x, y, w, active) {
    g.clear();
    g.fillStyle(active ? 0x22283e : 0x181c2c, 1);
    g.fillRect(x, y, w, TABS_H);
    if (active) {
      g.fillStyle(0xffe066, 1);
      g.fillRect(x, y + TABS_H - 2, w, 2);
    }
  }

  // Switch the active counter (tab) and rebuild the card fresh. Simple rebuild
  // rather than in-place diffing — this UI is small enough that it's not worth
  // the complexity, and it only runs on an explicit tap (#217 groundwork).
  _switchCounter(i) {
    if (i === this._counterIdx) return;
    this._counterIdx = i;
    this.panel.destroy();
    this.build();
  }

  _buildRow(item, i) {
    const y = this._headerH + i * ROW_H;
    const canAfford = this._money >= item.price;

    // Icon.
    this.panel.add(this.add.image(30, y + ROW_H / 2 - 4, item.icon).setDisplaySize(34, 34).setOrigin(0.5, 0.5));

    // Label + description.
    this.panel.add(this.add.text(56, y + 8, item.label, {
      fontFamily: 'system-ui, sans-serif', fontSize: '15px', color: '#e6e9f8', fontStyle: 'bold',
    }).setOrigin(0, 0));
    this.panel.add(this.add.text(56, y + 28, item.desc, {
      fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: '#9298bc',
    }).setOrigin(0, 0));

    // Buy button (price). Greyed when unaffordable.
    const bw = 64, bh = 34;
    const bx = CARD_W - PAD - bw, by = y + (ROW_H - bh) / 2 - 4;
    const g = this.add.graphics();
    this._drawBuyBtn(g, bx, by, bw, bh, canAfford);
    this.panel.add(g);

    const buyLbl = this.add.text(bx + bw / 2, by + bh / 2, `$${item.price}`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '15px',
      color: canAfford ? '#10131f' : '#6b7096', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    this.panel.add(buyLbl);

    const zone = this.add.zone(bx, by, bw, bh).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => this._buy(i));
    this.panel.add(zone);

    this._rowNodes.push({ g, buyLbl, item, bx, by, bw, bh });
  }

  _drawBuyBtn(g, x, y, w, h, canAfford) {
    g.clear();
    g.fillStyle(canAfford ? 0xffe066 : 0x2a3050, 1);
    g.fillRoundedRect(x, y, w, h, 8);
    g.lineStyle(2, canAfford ? 0xffd23a : 0x3a4472, 1);
    g.strokeRoundedRect(x, y, w, h, 8);
  }

  // Attempt to buy row `i`. Two purchase shapes share this one buy panel (#312 —
  // the food counter folded in the market stall's old feed stock as-is):
  //   owned-count (seeds/clothing/pets) → bump the item's persisted owned count
  //     (storeInventory.js). No carrier involved.
  //   carrier-fill (food, identified by item.content) → deposit into the equipped
  //     carrier (fillActiveCarrier), mirroring ShopScene's old feed-buy exactly,
  //     including the "equip the right carrier" / "carrier full" refusals.
  _buy(i) {
    const item = this._counter.items[i];
    if (!item) return;

    if (item.content) { this._buyCarrierItem(i, item); return; }

    // Refresh from the live balance (in case a sale credited between opens).
    this._money = this._readMoney();
    const res = buyStoreItem(this._money, this._inventory, item.key);
    if (!res.ok) { this._flashRow(i, "Can't afford"); return; }

    this._inventory = res.inventory;
    saveStoreInventory(this._inventory);

    // Debit gold: HotbarScene is the persisted writer and listens for MONEY_CHANGED,
    // so this both updates the HUD and saves the new balance.
    this._money = res.balance;
    this.game.events.emit(EVENTS.MONEY_CHANGED, this._money);
    this._moneyLbl.setText(`$${this._money}`);
    this._refreshAfford();
    this._flashRow(i, `+1 ${item.label}`);
  }

  // Carrier-fill purchase (food counter, #312) — mirrors ShopScene's old feed _buy
  // exactly: check funds AND that a matching carrier is equipped with room, debit
  // gold, deposit into the carrier.
  _buyCarrierItem(i, item) {
    const hb = this.scene.get('HotbarScene');
    if (!hb) return;

    this._money = this._readMoney();
    const res = purchase(this._money, item);
    if (!res.ok) { this._flashRow(i, "Can't afford"); return; }

    const active = hb.getActiveItem?.();
    const okCarrier = active?.type === 'carrier' && active.carrier === item.carrier;
    if (!okCarrier) {
      const cName = item.carrier === 'bucket' ? 'Bucket' : 'Basket';
      this._flashRow(i, `Equip a ${cName}`);
      return;
    }
    const added = hb.fillActiveCarrier?.(item.content, 1) ?? 0;
    if (added <= 0) { this._flashRow(i, 'Carrier full'); return; }

    this._money = res.balance;
    this.game.events.emit(EVENTS.MONEY_CHANGED, this._money);
    this._moneyLbl.setText(`$${this._money}`);
    this._refreshAfford();
    this._flashRow(i, `+1 ${item.label}`);
  }

  // Redraw every Buy button's affordable/greyed state after the balance changed.
  _refreshAfford() {
    for (const r of this._rowNodes) {
      const canAfford = this._money >= r.item.price;
      this._drawBuyBtn(r.g, r.bx, r.by, r.bw, r.bh, canAfford);
      r.buyLbl.setColor(canAfford ? '#10131f' : '#6b7096');
    }
  }

  // Brief floating feedback over a row (bought / can't afford).
  _flashRow(i, text) {
    const r = this._rowNodes[i];
    if (!r) return;
    const good = text.startsWith('+');
    const lbl = this.add.text(this._cardX + r.bx + r.bw / 2, this._cardY + r.by - 6, text, {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px',
      color: good ? '#8effa8' : '#ffb0b0', fontStyle: 'bold',
      backgroundColor: '#0a0d18e0', padding: { x: 8, y: 4 },
    }).setOrigin(0.5, 1).setDepth(10);
    this.tweens.add({
      targets: lbl, y: lbl.y - 22, alpha: 0, duration: 900, ease: 'Sine.easeOut',
      onComplete: () => lbl.destroy(),
    });
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  _wireInput() {
    this.input.keyboard.on('keydown-ESC', () => this.close());
    this.input.keyboard.on('keydown-UP',   () => this._moveFocus(-1));
    this.input.keyboard.on('keydown-DOWN', () => this._moveFocus(1));
    this.input.keyboard.on('keydown-ENTER', () => this._activateFocus());
    this.input.keyboard.on('keydown-SPACE', () => this._activateFocus());
    this._padPrev = {};
  }

  // Controller nav while the world is paused (mirrors ShopScene.update).
  update() {
    const pad = this.input.gamepad && this.input.gamepad.getPad(0);
    if (!pad) return;
    const ls = pad.leftStick || { x: 0, y: 0 };
    const cur = {
      up: pad.up || ls.y < -0.5, down: pad.down || ls.y > 0.5,
      A: pad.A, B: pad.B,
    };
    const prev = this._padPrev || {};
    if (cur.B && !prev.B) { this.close(); this._padPrev = cur; return; }
    if (!this._focusActive && (cur.up || cur.down || cur.A)) {
      this._focusActive = true; this._focusIdx = 0; this._refreshRing();
    } else if (this._focusActive) {
      if (cur.up && !prev.up) this._moveFocus(-1);
      if (cur.down && !prev.down) this._moveFocus(1);
      if (cur.A && !prev.A) this._activateFocus();
    }
    this._padPrev = cur;
  }

  _moveFocus(d) {
    this._focusActive = true;
    const n = this._counter.items.length;
    this._focusIdx = (this._focusIdx + d + n) % n;
    this._refreshRing();
  }

  _activateFocus() {
    if (!this._focusActive) { this._focusActive = true; this._refreshRing(); return; }
    this._buy(this._focusIdx);
  }

  _refreshRing() {
    if (!this._ring) return;
    this._ring.clear();
    if (!this._focusActive) return;
    const r = this._rowNodes[this._focusIdx];
    if (!r) return;
    this._ring.lineStyle(3, 0xffe066, 0.95);
    this._ring.strokeRoundedRect(r.bx - 4, r.by - 4, r.bw + 8, r.bh + 8, 10);
  }

  close() {
    if (this.closing) return;
    this.closing = true;
    // Resume the world scenes we paused.
    if (this._paused) { for (const k of this._paused) if (this.scene.isPaused(k)) this.scene.resume(k); this._paused = null; }
    this.tweens.add({
      targets: this.panel, y: (this._cardY ?? 0) + 12, alpha: 0,
      duration: 130, ease: 'Quad.easeIn',
      onComplete: () => this.scene.stop(),
    });
  }
}
