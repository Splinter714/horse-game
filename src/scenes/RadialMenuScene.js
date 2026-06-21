import Phaser from 'phaser';

const FOOD_ITEMS = [
  { key: 'hay',    label: 'Hay',    icon: 'iconHay',    action: 'feed' },
  { key: 'seed',   label: 'Seeds',  icon: 'iconSeed',   action: 'seed' },
  { key: 'apple',  label: 'Apple',  icon: 'iconApple',  action: 'feed' },
  { key: 'carrot', label: 'Carrot', icon: 'iconCarrot', action: 'feed' },
  { key: 'treat',  label: 'Treat',  icon: 'iconTreat',  action: 'pet'  },
];

const TOOL_ITEMS = [
  { key: 'brush',  label: 'Brush',  icon: 'iconBrush',  action: 'brush'  },
  { key: 'bucket', label: 'Water',  icon: 'iconWater',  action: 'water'  },
  { key: 'lead',   label: 'Lead',   icon: 'iconLead',   action: 'lead'   },
  { key: 'saddle', label: 'Saddle', icon: 'iconSaddle', action: 'ride'   },
  { key: 'basket', label: 'Basket', icon: 'iconBasket', action: 'basket' },
];

const RADIUS  = 110;
const SLOT_R  = 26;
const HOLD_MS = 220;

export default class RadialMenuScene extends Phaser.Scene {
  constructor() { super('RadialMenuScene'); }

  create() {
    this.foodItem  = FOOD_ITEMS[0];
    this.toolItem  = TOOL_ITEMS[0];
    this.primary   = 'food'; // which slot is "active" for getActiveItem()
    this.isOpen    = false;
    this._which    = null;   // 'food' | 'tool' — which radial is open
    this._nodes    = [];
    this._slots    = null;
    this._hlIdx    = 0;
    this._cx = 0; this._cy = 0;

    // Badge display objects
    this._bg      = this.add.graphics().setDepth(900);
    this._foodIco = this.add.image(0, 0, this.foodItem.icon).setDepth(901);
    this._foodLbl = this.add.text(0, 0, this.foodItem.label, {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#ffffff',
    }).setOrigin(0.5, 0.5).setDepth(901);
    this._toolIco = this.add.image(0, 0, this.toolItem.icon).setDepth(901);
    this._toolLbl = this.add.text(0, 0, this.toolItem.label, {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#ffffff',
    }).setOrigin(0.5, 0.5).setDepth(901);
    this._divider = this.add.graphics().setDepth(901);
    this._foodZone = null;
    this._toolZone = null;
    this._rebuildBadge();
    this.scale.on('resize', this._rebuildBadge, this);

    // Keyboard: hold F = food, hold T = tools
    this._fKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    this._tKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.T);
    this._fPrev = false; this._fHoldTimer = null;
    this._tPrev = false; this._tHoldTimer = null;

    // Gamepad
    this._pad  = null;
    this._ltPrev = false; this._ltHoldTimer = null;
    this._rtPrev = false; this._rtHoldTimer = null;
    this.input.gamepad?.on('connected', p => { this._pad = p; });
    if (this.input.gamepad?.total > 0) this._pad = this.input.gamepad.getPad(0);
  }

  _rebuildBadge() {
    const sw = this.scale.width;
    const sh = this.scale.height;
    const pw = 130, ph = 52, gap = 12;
    const cy = sh - ph / 2 - 10;
    const cx = sw / 2;
    const lx = cx - gap / 2 - pw;
    const rx = cx + gap / 2;

    this._bg.clear();
    const foodActive = this.primary === 'food';
    const toolActive = this.primary === 'tool';

    this._bg.fillStyle(0x111622, 0.88);
    this._bg.fillRoundedRect(lx, cy - ph / 2, pw, ph, 26);
    this._bg.lineStyle(2, foodActive ? 0xe8c84a : 0x3a4060, 1);
    this._bg.strokeRoundedRect(lx, cy - ph / 2, pw, ph, 26);

    this._bg.fillStyle(0x111622, 0.88);
    this._bg.fillRoundedRect(rx, cy - ph / 2, pw, ph, 26);
    this._bg.lineStyle(2, toolActive ? 0xe8c84a : 0x3a4060, 1);
    this._bg.strokeRoundedRect(rx, cy - ph / 2, pw, ph, 26);

    this._foodIco.setPosition(lx + 26, cy).setDisplaySize(28, 28)
      .setTexture(this.foodItem?.icon ?? FOOD_ITEMS[0].icon);
    this._foodLbl.setPosition(lx + 70, cy).setText(this.foodItem?.label ?? '');

    this._toolIco.setPosition(rx + 26, cy).setDisplaySize(28, 28)
      .setTexture(this.toolItem?.icon ?? TOOL_ITEMS[0].icon);
    this._toolLbl.setPosition(rx + 70, cy).setText(this.toolItem?.label ?? '');

    if (this._foodZone) this._foodZone.destroy();
    if (this._toolZone) this._toolZone.destroy();
    this._foodZone = this.add.zone(lx, cy - ph / 2, pw, ph)
      .setOrigin(0, 0).setInteractive({ useHandCursor: true }).setDepth(902);
    this._foodZone.on('pointerdown', () => { if (!this.isOpen) this._open('food'); });
    this._toolZone = this.add.zone(rx, cy - ph / 2, pw, ph)
      .setOrigin(0, 0).setInteractive({ useHandCursor: true }).setDepth(902);
    this._toolZone.on('pointerdown', () => { if (!this.isOpen) this._open('tool'); });
  }

  _open(which) {
    if (this.isOpen) return;
    this.isOpen = true;
    this._which = which;
    this.primary = which;

    const items = which === 'food' ? FOOD_ITEMS : TOOL_ITEMS;
    const sw = this.scale.width;
    const sh = this.scale.height;
    this._cx = sw / 2;
    this._cy = sh * 0.46;

    // Full-screen dim + blocker
    const blocker = this.add.rectangle(0, 0, sw, sh, 0x000000, 0.42)
      .setOrigin(0, 0).setInteractive().setDepth(1000);
    blocker.on('pointerup', () => this._close(false));
    this._nodes.push(blocker);

    // Label above radial
    const title = this.add.text(this._cx, this._cy - RADIUS - 36,
      which === 'food' ? '🌾 Food' : '🔧 Tools', {
      fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#c8cce0',
    }).setOrigin(0.5, 1).setDepth(1003);
    this._nodes.push(title);

    // Center hint
    const hint = this.add.text(this._cx, this._cy, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#9aa0c0',
    }).setOrigin(0.5).setDepth(1003);
    this._nodes.push(hint);
    this._hint = hint;

    // Item slots
    this._slots = items.map((item, i) => {
      const angle = (i / items.length) * Math.PI * 2 - Math.PI / 2;
      const ix = this._cx + Math.cos(angle) * RADIUS;
      const iy = this._cy + Math.sin(angle) * RADIUS;

      const bg  = this.add.graphics().setDepth(1001);
      const ico = this.add.image(ix, iy, item.icon).setDisplaySize(26, 26).setDepth(1002);
      const lbl = this.add.text(ix, iy + 23, item.label, {
        fontFamily: 'system-ui, sans-serif', fontSize: '9px', color: '#c8cce0',
      }).setOrigin(0.5, 0).setDepth(1002);

      const zone = this.add.zone(ix - SLOT_R, iy - SLOT_R, SLOT_R * 2, SLOT_R * 2)
        .setOrigin(0, 0).setInteractive().setDepth(1003);
      zone.on('pointerover', () => { this._hlIdx = i; this._drawHighlight(); });
      zone.on('pointerup',   () => { this._hlIdx = i; this._close(true); });

      this._nodes.push(bg, ico, lbl, zone);
      return { item, bg, ico, lbl, ix, iy, angle };
    });

    const current = which === 'food' ? this.foodItem : this.toolItem;
    this._hlIdx = Math.max(0, items.indexOf(current));
    this._drawHighlight();
  }

  _drawHighlight() {
    if (!this._slots) return;
    this._slots.forEach(({ bg, ico, ix, iy }, i) => {
      const on = i === this._hlIdx;
      bg.clear();
      bg.fillStyle(on ? 0x2a3050 : 0x0d1020, on ? 0.98 : 0.80);
      bg.fillCircle(ix, iy, SLOT_R);
      bg.lineStyle(2, on ? 0xe8c84a : 0x2a3060, 1);
      bg.strokeCircle(ix, iy, SLOT_R);
      ico.setScale(on ? 1.25 : 1);
    });
    if (this._hint) {
      const items = this._which === 'food' ? FOOD_ITEMS : TOOL_ITEMS;
      this._hint.setText(items[this._hlIdx]?.label ?? '');
    }
  }

  _close(confirm) {
    if (!this.isOpen) return;
    this.isOpen = false;
    if (confirm && this._slots) {
      const item = this._slots[this._hlIdx].item;
      if (this._which === 'food') this.foodItem = item;
      else                        this.toolItem = item;
    }
    for (const o of this._nodes) o.destroy();
    this._nodes = [];
    this._slots = null;
    this._hint  = null;
    this._which = null;
    this._rebuildBadge();
  }

  _angleToHighlight(px, py) {
    if (!this.isOpen || !this._slots) return;
    const dx = px - this._cx, dy = py - this._cy;
    if (dx * dx + dy * dy < 900) return;
    const angle = Math.atan2(dy, dx);
    let best = this._hlIdx, bestD = Infinity;
    this._slots.forEach(({ angle: a }, i) => {
      let d = Math.abs(angle - a);
      if (d > Math.PI) d = Math.PI * 2 - d;
      if (d < bestD) { bestD = d; best = i; }
    });
    if (best !== this._hlIdx) { this._hlIdx = best; this._drawHighlight(); }
  }

  // Returns the active item — most recently focused slot wins.
  // PaddockScene reads this to know what to use on E press / tap.
  getActiveItem() {
    return this.primary === 'food' ? this.foodItem : this.toolItem;
  }

  getFoodItem() { return this.foodItem; }
  getToolItem() { return this.toolItem; }

  update() {
    // ── Update highlight from mouse/stick FIRST so _hlIdx is current on release
    if (this.isOpen) {
      const p = this.input.activePointer;
      if (p) this._angleToHighlight(p.x, p.y);

      const pad = this._pad ?? (this.input.gamepad?.total > 0 ? this.input.gamepad.getPad(0) : null);
      if (pad) {
        const sx = pad.leftStick?.x ?? 0, sy = pad.leftStick?.y ?? 0;
        if (sx * sx + sy * sy > 0.09)
          this._angleToHighlight(this._cx + sx * 150, this._cy + sy * 150);
      }
    }

    // ── Keyboard: hold F = food, hold T = tools (release to confirm) ─────────
    const fDown = this._fKey.isDown;
    const tDown = this._tKey.isDown;

    if (fDown && !this._fPrev && !this.isOpen)
      this._fHoldTimer = this.time.delayedCall(HOLD_MS, () => this._open('food'));
    if (!fDown && this._fPrev) {
      if (this._fHoldTimer) { this._fHoldTimer.remove(); this._fHoldTimer = null; }
      if (this.isOpen && this._which === 'food') this._close(true);
    }
    this._fPrev = fDown;

    if (tDown && !this._tPrev && !this.isOpen) {
      this._tHoldTimer = this.time.delayedCall(HOLD_MS, () => this._open('tool'));
      this._tTappedBasket = this.toolItem?.key === 'basket';
    }
    if (!tDown && this._tPrev) {
      if (this._tHoldTimer) {
        // Short tap — didn't open the radial
        this._tHoldTimer.remove(); this._tHoldTimer = null;
        if (this._tTappedBasket) this.game.events.emit('basket-shortcut');
      }
      if (this.isOpen && this._which === 'tool') this._close(true);
    }
    this._tPrev = tDown;

    // ── Gamepad: LT (index 6) = food, RT (index 7) = tools ───────────────
    const pad = this._pad ?? (this.input.gamepad?.total > 0 ? this.input.gamepad.getPad(0) : null);
    if (pad) {
      const ltDown = (pad.buttons[6]?.value ?? 0) > 0.3;
      const rtDown = (pad.buttons[7]?.value ?? 0) > 0.3;

      if (ltDown && !this._ltPrev && !this.isOpen)
        this._ltHoldTimer = this.time.delayedCall(HOLD_MS, () => this._open('food'));
      if (!ltDown && this._ltPrev) {
        if (this._ltHoldTimer) { this._ltHoldTimer.remove(); this._ltHoldTimer = null; }
        if (this.isOpen && this._which === 'food') this._close(true);
      }
      this._ltPrev = ltDown;

      if (rtDown && !this._rtPrev && !this.isOpen) {
        this._rtHoldTimer = this.time.delayedCall(HOLD_MS, () => this._open('tool'));
        this._rtTappedBasket = this.toolItem?.key === 'basket';
      }
      if (!rtDown && this._rtPrev) {
        if (this._rtHoldTimer) {
          // Short tap — didn't open the radial
          this._rtHoldTimer.remove(); this._rtHoldTimer = null;
          if (this._rtTappedBasket) this.game.events.emit('basket-shortcut');
        }
        if (this.isOpen && this._which === 'tool') this._close(true);
      }
      this._rtPrev = rtDown;
    }
  }
}
