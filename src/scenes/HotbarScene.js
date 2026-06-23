import Phaser from 'phaser';
import { ALL_ITEMS, ITEM_MAP, CARRIER_DEFS, CONTENT_DEFS } from '../data/items.js';
import { loadGameState, saveGameState, loadUiSettings, saveUiSettings } from '../data/save.js';
import { toggleMute, isMuted, setVolume, getAudioSettings } from '../audio/sounds.js';
import { EVENTS } from '../data/events.js';
import { growHitArea } from './uiUtils.js';

// Gameplay scenes frozen while the pause menu is open
const PAUSABLE_SCENES = ['PaddockScene', 'DayNightScene', 'InfoPanelScene'];

// Base slot dimensions. Bigger than before for readability (#119); on narrow /
// portrait screens the whole strip is scaled down by `fit` so it never overflows
// the viewport width.
const SLOT_SIZE = 84;
const SLOT_GAP  = 8;
// Only as many slots as we actually use (2 carrier groups + 3 tools). Add more
// here as new tools/items arrive rather than pre-allocating empties (#118).
const NUM_SLOTS = 5;
const INV_COLS  = 5;
const INV_ROWS  = 10;
// The carrier fly-out is now a deliberate "show all instances" picker: a quick
// press/tap just selects or cycles, while a HOLD this long opens the fly-out (#75).
const HOLD_FLYOUT_MS = 350;
// Once open, it auto-dismisses after this long if untouched (a generous fallback —
// you normally close it by picking, selecting another slot, or holding away).
const FLYOUT_CLOSE_MS = 1500;

export default class HotbarScene extends Phaser.Scene {
  constructor() { super('HotbarScene'); }

  create() {
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
      o.stackG?.destroy();
    }
    this._stripBg?.destroy();
    this._pauseBtn?.destroy();
    this._moneyLbl?.destroy();
    for (const b of this._actionBtns ?? []) { b.g.destroy(); b.lbl.destroy(); b.zone.destroy(); }
    this._slots      = [];
    this._pauseBtn   = null;
    this._moneyLbl   = null;
    this._stripBg    = null;
    this._actionBtns = null;

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

  // Update just the money text without rebuilding everything
  _updateStatusLabels() {
    if (!this._moneyLbl) return;
    if (this._money > 0) this._moneyLbl.setText(`$${this._money}`).setVisible(true);
    else                 this._moneyLbl.setVisible(false);
  }

  // ── Carriers ─────────────────────────────────────────────────────────────

  // Resolve how an item should render in a slot: icon, label, and count badge.
  _slotView(item, key) {
    // A carrier group renders as its currently-active member (#75).
    if (item.type === 'carrierGroup') {
      const m = this._resolveKey(item.key);
      return this._slotView(ITEM_MAP[m], m);
    }
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
    saveGameState({
      hotbar: this.hotbar, inventory: this.inventory,
      carriers: this.carriers, activeCarrier: this.activeCarrier,
    });
  }

  // ── Carrier groups (#75) ───────────────────────────────────────────────────

  // True if a hotbar key is a grouped carrier slot (Basket / Bucket).
  _isGroup(key) { return ITEM_MAP[key]?.type === 'carrierGroup'; }

  // Resolve a hotbar key to a concrete item key: a group → its active member
  // carrier (guarding against a stale/invalid saved member); anything else → as-is.
  _resolveKey(key) {
    const it = ITEM_MAP[key];
    if (it?.type !== 'carrierGroup') return key;
    const m = this.activeCarrier?.[it.carrier];
    return it.members.includes(m) ? m : it.members[0];
  }

  // Add `amount` of `content` to the active carrier. Returns how many were added
  // (0 if the carrier is incompatible, full, or already holds something else).
  fillActiveCarrier(content, amount = 1) {
    const key  = this._resolveKey(this.hotbar[this.activeSlot]);
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
    this._closeFlyout();
    this._saveCarriers();
    this._buildHotbar();
    return added;
  }

  // Remove `amount` from the active carrier; reverts it to empty at zero.
  // Returns how many were actually removed.
  useActiveCarrier(amount = 1) {
    const key = this._resolveKey(this.hotbar[this.activeSlot]);
    const st  = key ? this.carriers[key] : null;
    if (!st || st.count <= 0) return 0;
    const used = Math.min(st.count, amount);
    st.count -= used;
    if (st.count <= 0) { st.content = null; st.count = 0; }
    this._closeFlyout();
    this._saveCarriers();
    this._buildHotbar();
    return used;
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

  // ── Slot press vs. hold (#75) ───────────────────────────────────────────────
  // A quick press/tap selects the slot, and re-pressing the active carrier group
  // cycles to the next instance — no fly-out. HOLDING a slot opens the fly-out
  // picker instead. _slotDown starts a hold timer; _slotUp resolves the gesture.
  _slotDown(i, src) {
    // Ignore key auto-repeat / a second down for the same in-progress press.
    if (this._slotHold && this._slotHold.i === i && this._slotHold.src === src) return;
    this._cancelSlotHold();
    const hold = { i, src, fired: false };
    hold.timer = this.time.delayedCall(HOLD_FLYOUT_MS, () => {
      hold.fired = true; // a hold → open the picker, and suppress the tap action
      if (this.invOpen || this.pauseOpen) return;
      this._setActive(i);
      this._openActiveFlyout();
    });
    this._slotHold = hold;
  }

  _slotUp(i, src) {
    const hold = this._slotHold;
    if (!hold || hold.i !== i || hold.src !== src) return;
    const fired = hold.fired;
    this._cancelSlotHold();
    if (!fired) this._selectOrCycle(i); // quick release → select / cycle (no fly-out)
  }

  // Release came in on the scene (the slot zone may not get its own pointerup).
  _slotPointerUp() {
    if (this._slotHold?.src === 'pointer') this._slotUp(this._slotHold.i, 'pointer');
  }

  _cancelSlotHold() {
    this._slotHold?.timer?.remove();
    this._slotHold = null;
  }

  // Quick press/tap: select the slot; re-selecting the active carrier group cycles
  // to the next instance. Never opens the fly-out (that's the hold gesture). If the
  // fly-out happens to be open, cycling keeps it in sync.
  _selectOrCycle(i) {
    if (this.invOpen) this._closeInventory();
    const wasActive = i === this.activeSlot;
    const wasOpen   = this._flyoutSlot === i;
    const key = this.hotbar[i];
    this._setActive(i); // selects, closes any open fly-out
    if (this._isGroup(key) && wasActive) {
      this._cycleMember(key);
      if (wasOpen) this._openFlyout(i); // refresh the picker only if it was already open
    }
  }

  // Open the active slot's fly-out picker (the hold gesture / controller LT).
  _openActiveFlyout() {
    if (this.invOpen || this.pauseOpen) return;
    if (this._isGroup(this.hotbar[this.activeSlot])) this._openFlyout(this.activeSlot);
  }

  // Step the active member of a carrier group by `dir` (default forward), wrapping.
  _cycleMember(groupKey, dir = 1) {
    const group = ITEM_MAP[groupKey];
    if (!group?.members) return;
    const cur = this._resolveKey(groupKey);
    const n = group.members.length;
    const idx = group.members.indexOf(cur);
    this.activeCarrier[group.carrier] = group.members[(((idx + dir) % n) + n) % n];
    this._saveCarriers();
    this._buildHotbar();
  }

  // Gamepad D-pad up/down cycling of the active group's instances (#121): step the
  // member by `dir`. No fly-out unless it's already open (then keep it in sync) —
  // the fly-out is opened deliberately with LT (#75).
  _padCycleMember(dir) {
    const key = this.hotbar[this.activeSlot];
    if (!this._isGroup(key)) return;
    const wasOpen = this._flyoutSlot === this.activeSlot;
    this._cycleMember(key, dir);
    if (wasOpen) this._openFlyout(this.activeSlot);
  }

  // Gamepad slot navigation (driven by PaddockScene's raw-pad poller, #121): step
  // to the prev/next slot, wrapping. Just selects — the fly-out is opened with LT.
  navSlot(dir) {
    this._selectOrCycle((this.activeSlot + dir + NUM_SLOTS) % NUM_SLOTS);
  }

  // Directly select a member from the fly-out.
  _pickMember(group, memberKey) {
    this.activeCarrier[group.carrier] = memberKey;
    this._saveCarriers();
    this._closeFlyout();
    this._buildHotbar();
  }

  // ── Carrier-group fly-out picker (#75) ──────────────────────────────────────

  // Vertical list of a group's members, stacked above its slot. Each entry shows
  // its contents/count; the active one is highlighted; tapping one selects it. The
  // picker auto-dismisses after FLYOUT_CLOSE_MS (it doesn't close on movement), and
  // taps on it are absorbed (see isPointerOnFlyout) so picking doesn't also move you.
  _openFlyout(slotIndex) {
    this._closeFlyout();
    const key = this.hotbar[slotIndex];
    const group = ITEM_MAP[key];
    const slot = this._slots[slotIndex];
    if (group?.type !== 'carrierGroup' || !slot) return;

    this._flyoutSlot  = slotIndex;
    this._flyoutNodes = [];

    const { x, slotY, ss, radius } = slot;
    const gap = 4;
    const stripTop = slotY - 8;

    const active = this._resolveKey(key);
    const n = group.members.length;
    group.members.forEach((mKey, idx) => {
      // First member at the top, last nearest the slot — so re-pressing the slot's
      // key cycles the highlight top → bottom through the list (#75 follow-up).
      const ey = stripTop - (n - idx) * (ss + gap);
      const isActive = mKey === active;

      const g = this.add.graphics().setDepth(41);
      this._drawSlot(g, x, ey, ss, radius, isActive);
      this._flyoutNodes.push(g);

      const view = this._slotView(ITEM_MAP[mKey], mKey);
      const iconSize = Math.round(ss * 0.46);
      this._flyoutNodes.push(this.add.image(x + ss / 2, ey + ss * 0.40, view.icon)
        .setDisplaySize(iconSize, iconSize).setDepth(42));
      this._flyoutNodes.push(this.add.text(x + ss / 2, ey + ss - Math.max(9, Math.round(ss * 0.12)), view.label, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: `${Math.max(9, Math.round(ss * 0.145))}px`,
        color: '#dde1f0',
      }).setOrigin(0.5, 0.5).setDepth(42));

      if (view.count !== undefined) {
        this._flyoutNodes.push(this.add.text(x + ss - 4, ey + 4, `${view.count}`, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: `${Math.max(10, Math.round(ss * 0.165))}px`,
          color: '#ffdd66', backgroundColor: '#000a', padding: { x: 2, y: 0 },
        }).setOrigin(1, 0).setDepth(43));
      }

      const zone = this.add.zone(x, ey, ss, ss)
        .setOrigin(0, 0).setInteractive({ useHandCursor: true }).setDepth(44);
      zone.on('pointerdown', () => this._pickMember(group, mKey));
      this._flyoutNodes.push(zone);
    });

    // Auto-dismiss after a delay if you don't pick anything (#75) — no longer tied
    // to player movement.
    this._flyoutTimer = this.time.delayedCall(FLYOUT_CLOSE_MS, () => this._closeFlyout());
  }

  // Is (px,py) over an open fly-out entry? PaddockScene.handleTap checks this so a
  // tap that picks a member doesn't also start the player walking (#75).
  isPointerOnFlyout(px, py) {
    if (this._flyoutSlot == null) return false;
    return this._flyoutNodes.some(n =>
      n.type === 'Zone' && px >= n.x && px <= n.x + n.width && py >= n.y && py <= n.y + n.height);
  }

  _closeFlyout() {
    this._flyoutTimer?.remove();
    this._flyoutTimer = null;
    if (!this._flyoutNodes?.length) { this._flyoutSlot = null; return; }
    for (const o of this._flyoutNodes) o.destroy();
    this._flyoutNodes = [];
    this._flyoutSlot  = null;
  }

  // ── Inventory panel ────────────────────────────────────────────────────────

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
    this._closeFlyout();
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
    const key  = this._resolveKey(this.hotbar[this.activeSlot]); // group → active member (#75)
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
