// ShopScene (#29, narrowed by #312) — the tool-upgrades buy panel. Opened when the
// player interacts with the market stall (PaddockScene.openShop). A modal overlay
// card mirroring the info panel / pause menu look, driven entirely by
// ALL_TOOL_UPGRADES data (src/data/shop.js / items.js).
//
// Before #312 this scene ALSO sold feed (SHOP_STOCK) — that counter has moved into
// the unified store (data/generalStore.js's `food` counter, opened at the one store
// building in town; see GeneralStoreScene). Tool upgrades weren't part of that
// unification ask, so they stayed here at the market stall, which is no longer
// staffed by the shopkeeper NPC (moved to the unified store, #244/#312).
//
// Input parity (controller + touch + keyboard): tap a row's Buy button, or focus
// rows with the d-pad/arrows and press A/Enter; B/Esc/✕ closes. The world is paused
// while it's open so nothing decays behind the modal.

import Phaser from 'phaser';
import { EVENTS } from '../data/events.js';
import { ALL_TOOL_UPGRADES, purchaseUpgrade } from '../data/shop.js';
import { growHitArea, applyDpr, logicalW, logicalH } from './uiUtils.js';

const CARD_W  = 340;
const ROW_H   = 56;
const PAD     = 16;
const HEADER  = 92;   // portrait/title/money band above the list
const PAUSABLE = ['PaddockScene', 'DayNightScene'];

export default class ShopScene extends Phaser.Scene {
  constructor() {
    super('ShopScene');
    this._focusIdx = 0;
    this._focusActive = false;
  }

  create() {
    applyDpr(this, { topLeft: true }); // HiDPI: top-left-anchored UI scene
    this.closing = false;
    this._money = this._readMoney();

    // Freeze the world so nothing moves/decays behind the modal.
    this._paused = [];
    for (const k of PAUSABLE) {
      if (this.scene.isActive(k) && !this.scene.isPaused(k)) { this.scene.pause(k); this._paused.push(k); }
    }
    this.scene.bringToTop();

    this._buyFlash = null;
    this.build();
    this._wireInput();
  }

  // Current balance: read straight off the live HotbarScene (single source of truth),
  // falling back to 0 if it isn't up yet.
  _readMoney() {
    const hb = this.scene.get('HotbarScene');
    return hb?._money ?? 0;
  }

  // Tool upgrades (#295) not yet purchased — a one-time unlock, so once bought it
  // drops off this list (mirrors a shop that doesn't re-sell what you already own).
  // Generic over every tool in ALL_TOOL_UPGRADES, whichever ships first.
  _availableUpgrades() {
    const hb = this.scene.get('HotbarScene');
    return ALL_TOOL_UPGRADES.filter((u) => !hb?.ownsToolUpgrade?.(u.id));
  }

  build() {
    const sw = logicalW(this), sh = logicalH(this);
    this._sw = sw; this._sh = sh;

    // Full-screen dim catcher — a tap outside the card closes the shop. Built once;
    // _rebuild() (after an upgrade purchase removes a row) only replaces the card.
    if (!this._catcher) {
      this._catcher = this.add.rectangle(0, 0, sw, sh, 0x000000, 0.35)
        .setOrigin(0, 0).setInteractive();
      this._catcher.on('pointerdown', () => this.close());
    }

    this._upgradeRows = this._availableUpgrades();
    const rows = this._upgradeRows.length;
    const listH = rows * ROW_H;
    const cardH = HEADER + listH + PAD;
    const cardX = Math.round((sw - CARD_W) / 2);
    const cardY = Math.round((sh - cardH) / 2);
    this._cardX = cardX; this._cardY = cardY; this._cardH = cardH;

    this.panel = this.add.container(cardX, cardY + 12).setAlpha(0);

    // Card background.
    const bg = this.add.graphics();
    bg.fillStyle(0x141826, 0.99);
    bg.fillRoundedRect(0, 0, CARD_W, cardH, 16);
    bg.lineStyle(2, 0x3a4472, 1);
    bg.strokeRoundedRect(0, 0, CARD_W, cardH, 16);
    this.panel.add(bg);

    // Title + shop icon.
    this.panel.add(this.add.image(30, 34, 'shopStall').setDisplaySize(48, 32).setOrigin(0.5, 0.5));
    this.panel.add(this.add.text(58, 22, 'Tool Upgrades', {
      fontFamily: 'system-ui, sans-serif', fontSize: '22px', color: '#eef0fa', fontStyle: 'bold',
    }).setOrigin(0, 0));
    this.panel.add(this.add.text(58, 50, 'Permanent upgrades for your tools', {
      fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#9aa0c0',
    }).setOrigin(0, 0));

    // Money readout (top-right).
    this._moneyLbl = this.add.text(CARD_W - 16, 26, `$${this._money}`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#ffe14d',
      fontStyle: 'bold', stroke: '#1a1408', strokeThickness: 4,
    }).setOrigin(1, 0);
    this.panel.add(this._moneyLbl);

    // Divider under the header.
    const div = this.add.graphics();
    div.lineStyle(1, 0x3a4472, 1);
    div.lineBetween(14, HEADER - 8, CARD_W - 14, HEADER - 8);
    this.panel.add(div);

    // Product rows: tool upgrades (#295), a one-time permanent purchase per tier.
    // Only unowned tiers show — an owned tier drops off the list.
    this._rowNodes = []; // per-row { affordBg, buyLbl, item, y } for focus ring + refresh
    this._upgradeRows.forEach((item, j) =>
      this._buildRow(item, j, HEADER + j * ROW_H, true));

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

  _buildRow(item, i, y, isUpgrade = false) {
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

    this._rowNodes.push({ g, buyLbl, item, bx, by, bw, bh, isUpgrade });
  }

  _drawBuyBtn(g, x, y, w, h, canAfford) {
    g.clear();
    g.fillStyle(canAfford ? 0xffe066 : 0x2a3050, 1);
    g.fillRoundedRect(x, y, w, h, 8);
    g.lineStyle(2, canAfford ? 0xffd23a : 0x3a4472, 1);
    g.strokeRoundedRect(x, y, w, h, 8);
  }

  // Buy row `i` — every row here is a tool-upgrade tier (#295) since #312 moved
  // feed-buying into the unified store's food counter (GeneralStoreScene).
  _buy(i) {
    const row = this._rowNodes[i];
    const hb = this.scene.get('HotbarScene');
    if (!row || !hb) return;
    this._buyUpgrade(i, row.item, hb);
  }

  // Buy a tool-upgrade tier (#295): a one-time, permanent purchase — no carrier
  // needed, and it can't be bought twice. hb.buyToolUpgrade does the actual debit +
  // persistence (mirrors HotbarScene owning money/scooperLoad/etc as the single
  // writer); this just reflects the result back into the shop UI.
  _buyUpgrade(i, upgrade, hb) {
    this._money = this._readMoney();
    const check = purchaseUpgrade(this._money, upgrade, hb.ownsToolUpgrade?.(upgrade.id));
    if (!check.ok) {
      this._flashRow(i, hb.ownsToolUpgrade?.(upgrade.id) ? 'Already owned' : "Can't afford");
      return;
    }
    const res = hb.buyToolUpgrade(upgrade.id);
    if (!res.ok) { this._flashRow(i, "Can't afford"); return; }

    this._money = res.balance;
    this.game.events.emit(EVENTS.MONEY_CHANGED, this._money);
    this._moneyLbl.setText(`$${this._money}`);
    this._flashRow(i, `Bought ${upgrade.label}`);
    // Owned upgrades drop off the list — rebuild the card so the row disappears
    // and the layout reflows (mirrors close/build rather than patching in place).
    this.time.delayedCall(650, () => { if (!this.closing) this._rebuild(); });
  }

  // Tear down and rebuild the card in place (after an upgrade purchase removes a
  // row) without replaying the open animation or touching the paused-scene state.
  _rebuild() {
    this.panel?.destroy();
    this.build();
  }

  // Redraw every Buy button's affordable/greyed state after the balance changed.
  _refreshAfford() {
    for (const r of this._rowNodes) {
      const canAfford = this._money >= r.item.price;
      this._drawBuyBtn(r.g, r.bx, r.by, r.bw, r.bh, canAfford);
      r.buyLbl.setColor(canAfford ? '#10131f' : '#6b7096');
    }
  }

  // Brief floating feedback over a row (bought / can't afford / equip a basket).
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

  // Controller nav while the world is paused (see pauseMenu.update for the pattern).
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
    const n = this._rowNodes.length;
    if (!n) return;
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
