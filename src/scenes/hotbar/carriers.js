// Carriers — the carrier state model behind the hotbar: how a slot renders
// (_slotView), filling/emptying the active carrier, the grouped-carrier members
// (#75) and their fly-out picker, and the getActiveItem public API the rest of the
// game reads. Extracted from the monolithic HotbarScene (issue #167).

import { ITEM_MAP, CARRIER_DEFS, CONTENT_DEFS } from '../../data/items.js';
import { saveGameState } from '../../data/save.js';
import { FLYOUT_CLOSE_MS } from './constants.js';

export const WithCarriers = (Base) => class extends Base {
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
    else         this._flashSlot(this.activeSlot);
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
};
