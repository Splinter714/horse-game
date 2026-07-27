// Dev tool: drag placed world objects live, then export their new coordinates (#330).
//
// The companion to the object-labels/grid overlay (#329). That one lets a
// placement be DESCRIBED in absolute coordinates; this one lets it be FOUND by
// hand — grab the beehive, slide it where it looks right, read the number off,
// and hand it back so the source constants can be edited.
//
// Three deliberate constraints:
//
//   1. SESSION-ONLY. Dragging never touches the save. Nothing here writes to
//      localStorage except the on/off toggle itself, and a reload puts every
//      object back exactly where the source code says it goes. This is a ruler,
//      not a level editor — the real placement always lives in the source.
//   2. The object list is NOT a hand-written list. It reuses `_devLabelTargets()`
//      from devLabels.js, which derives everything from `this.props`, so the two
//      dev tools can never drift apart as the world grows.
//   3. It works on the DEPLOYED build (persisted dev setting, default off) for
//      the same reason the FPS counter (#325) and the label grid (#329) do — the
//      owner looks at the game on his iPad, which is where the "that's slightly
//      too far left" conversation actually happens.
//
// Because the iPad has no devtools console, the export is shown THREE ways: an
// on-screen readable panel (the one that matters on a tablet), a clipboard copy
// when the browser allows it, and a `[dev-positions]` console.log for desktop.
//
// MULTI-SELECT + GROUPS (#337). One gesture does both jobs, so nothing needs a
// modifier key (there isn't one to press on an iPad):
//
//   • TAP an object (press and release without moving past TAP_SLOP) → toggles it
//     into/out of the selection. Selected objects get a cyan ring.
//   • DRAG an object (press and move) → moves it. If it belongs to a GROUP, the
//     whole group moves; otherwise if it's part of the current selection, the whole
//     selection moves; otherwise just it. Everything moves by the same delta, so
//     relative positions are preserved.
//
// The selection can then be saved as a named GROUP (the ⛓ button), after which any
// member is a handle for the whole run — the house fence's six posts stop being six
// separate drags. Selection is session-only; groups persist (see devGroups.js for
// why that isn't a violation of constraint 1 — a group is tool config, not a
// position). All the selection/group state and maths lives in devGroups.js; this
// file is the gesture and the drawing.

import { loadDevSettings } from '../../data/save.js';
import { dprOf, logicalW, logicalH, worldUiOffset } from '../uiUtils.js';

const PICK_R     = 90;    // world px: how close a tap must be to grab an object
const TAP_SLOP   = 6;     // world px of travel before a press counts as a drag, not a tap
const MARK_DEPTH = 9502;  // above the #329 labels
const UI_DEPTH   = 9600;  // screen-fixed buttons/readout, below the pause overlay
const BTN_X      = 8;     // logical screen px, top-left stack
const BTN_Y      = 64;    // clear of the day/night HUD row along the very top
const BTN_H      = 30;

// A value that can be moved on screen (a Phaser GameObject), as opposed to the
// plain `{ x, y, sprite }` records most props are.
const isGameObj = (v) =>
  !!v && typeof v === 'object' &&
  typeof v.setPosition === 'function' && typeof v.x === 'number' && typeof v.y === 'number';

export const WithDevDrag = (Base) => class extends Base {
  // Called once from create(). Reads the persisted toggle; builds nothing when off.
  buildDevDrag() {
    this._dragEntries = null;  // [{ name, obj, also, ox, oy }] snapshot, mount-time
    this._dragHeld    = null;  // the entry currently under the finger
    this._dragMove    = null;  // every entry this press moves (group / selection / just one)
    this._dragMoved   = false; // has this press travelled far enough to be a drag, not a tap?
    this._dragSel     = null;  // Set of selected entries (#337, session-only)
    this._dragGroups  = null;  // [{ name, members: [objectName] }] (#337, persisted)
    this._dragMarks   = null;  // Graphics: a grab marker per object
    this._dragBtns    = [];    // screen-fixed Text buttons + their hit rects
    this._dragHud     = null;  // "what am I holding" readout
    this._dragPanel   = null;  // the export readout panel
    if (loadDevSettings().dragObjects) this._mountDevDrag();
  }

  // Pause-menu handler: apply the (already saved) toggle live, no reload.
  // Turning the mode OFF exports first, so a session's worth of nudging can't be
  // lost by flipping the switch — the numbers are the whole point of the tool.
  refreshDevDrag() {
    const on = loadDevSettings().dragObjects;
    if (!on && this._dragEntries) this.exportDevPositions({ quiet: true });
    this._clearDevDrag();
    if (on) this._mountDevDrag();
  }

  _clearDevDrag() {
    if (this._dragEntries) {
      this.input.off('pointermove',      this._devDragMove, this);
      this.input.off('pointerup',        this._devDragDrop, this);
      this.input.off('pointerupoutside', this._devDragDrop, this);
    }
    this._dragMarks?.destroy();
    this._dragHud?.destroy();
    this._dragPanel?.destroy();
    for (const b of this._dragBtns) b.txt.destroy();
    this._dragEntries = null;
    this._dragHeld    = null;
    this._dragMove    = null;
    this._dragMoved   = false;
    this._dragSel     = null;
    this._dragMarks   = null;
    this._dragHud     = null;
    this._dragPanel   = null;
    this._dragBtns    = [];
  }

  _mountDevDrag() {
    // Snapshot every placed object AND where it started, so "moved" is knowable
    // and a reset is possible without reloading.
    this._dragEntries = this._devLabelTargets().map(t => ({
      name: t.name, obj: t.obj, also: t.also ?? [], ox: t.x, oy: t.y,
    })).filter(e => e.obj);
    this.initDevSelection(); // #337 selection set + persisted groups

    this._dragMarks = this.add.graphics().setDepth(MARK_DEPTH);
    this._drawDevDragMarks();

    const o = worldUiOffset(this);
    this._dragHud = this.add.text(BTN_X + o.x, BTN_Y - 18 + o.y,
      'Drag mode: tap to select, drag to move', {
        fontFamily: 'ui-monospace, Menlo, monospace',
        fontSize: '11px', color: '#bfe4ff', backgroundColor: '#0d1020cc',
        padding: { x: 4, y: 2 },
      }).setOrigin(0, 1).setScrollFactor(0).setDepth(UI_DEPTH).setResolution(dprOf(this));

    this._addDevDragBtn('export', '📋 Export positions', BTN_Y);
    this._addDevDragBtn('reset',  '↺ Reset to source',   BTN_Y + (BTN_H + 6));
    this._addDevDragBtn('group',  '⛓ Group',             BTN_Y + (BTN_H + 6) * 2);
    this._addDevDragBtn('clear',  '✖ Clear selection',   BTN_Y + (BTN_H + 6) * 3);
    this._devDragSyncBtns();

    this.input.on('pointermove',      this._devDragMove, this);
    this.input.on('pointerup',        this._devDragDrop, this);
    this.input.on('pointerupoutside', this._devDragDrop, this);
  }

  // Screen-fixed button. Hit-testing is done by hand in _devDragTap (against the
  // stored LOGICAL rect) rather than with setInteractive, so that one entry point
  // decides whether a tap belongs to this tool or to normal play.
  _addDevDragBtn(id, label, y) {
    const o = worldUiOffset(this);
    const txt = this.add.text(BTN_X + o.x, y + o.y, label, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px', color: '#ffe9a8', backgroundColor: '#242a44ee',
      padding: { x: 8, y: 6 },
    }).setOrigin(0, 0).setScrollFactor(0).setDepth(UI_DEPTH).setResolution(dprOf(this));
    this._dragBtns.push({ id, txt, x: BTN_X, y, w: txt.width, h: txt.height });
  }

  // The two selection buttons re-label themselves from the current selection, so
  // one button covers both "make a group of these" and "dissolve this group"
  // (the second only offered when the selection IS exactly an existing group —
  // otherwise it would be ambiguous what's being dissolved).
  _devDragSyncBtns() {
    const n   = this._dragSel?.size ?? 0;
    const grp = this._devSelGroup?.() ?? null;
    for (const b of this._dragBtns) {
      const label =
        b.id === 'group' ? (grp ? `✂ Ungroup ${grp.name}` : n >= 2 ? `⛓ Group these ${n}` : '⛓ Group (select 2+)')
        : b.id === 'clear' ? (n ? `✖ Clear selection (${n})` : '✖ Clear selection')
        : null;
      if (label === null || b.txt.text === label) continue;
      b.txt.setText(label);
      b.w = b.txt.width; b.h = b.txt.height;
    }
  }

  _devDragHitBtn(lpx, lpy) {
    for (const b of this._dragBtns) {
      if (lpx >= b.x && lpx <= b.x + b.w && lpy >= b.y && lpy <= b.y + b.h) return b.id;
    }
    return null;
  }

  // ─── Picking / dragging ────────────────────────────────────────────────────

  // Called FIRST from handleTap. Returns true when this tool claims the tap (a
  // button press or a grab); false lets the tap fall through to normal play, so
  // walking around while the mode is on still works.
  _devDragTap(pointer) {
    if (!this._dragEntries || pointer.button !== 0) return false;
    const dpr = dprOf(this);
    const lpx = pointer.x / dpr, lpy = pointer.y / dpr;
    // Leave the hotbar strip and the on-screen action buttons alone.
    if (lpy > logicalH(this) - 72) return false;
    if (this.scene.get('HotbarScene')?.isPointerOnActionButton?.(lpx, lpy)) return false;

    const btn = this._devDragHitBtn(lpx, lpy);
    if (btn === 'export') { this.exportDevPositions(); return true; }
    if (btn === 'reset')  { this.resetDevPositions();  return true; }
    if (btn === 'group')  { this.toggleDevGroup();     return true; }
    if (btn === 'clear')  { this.clearDevSelection();  return true; }
    if (this._dragPanel) { this._dragPanel.destroy(); this._dragPanel = null; }

    const w = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    let best = null, bestD = PICK_R;
    for (const e of this._dragEntries) {
      const d = Math.hypot(e.obj.x - w.x, e.obj.y - w.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    if (!best) return false;

    // Remember the grab offset so the object doesn't jump its centre to the finger,
    // and the press point, so a press that never travels can be read as a TAP
    // (= toggle selection) instead of a drag.
    this._dragHeld   = best;
    this._dragMove   = this._devDragSet(best);
    this._dragMoved  = false;
    this._dragPressX = w.x;
    this._dragPressY = w.y;
    best.gx = w.x - best.obj.x;
    best.gy = w.y - best.obj.y;
    this._devDragHud(best);
    return true;
  }

  // Nothing actually moves until the press has travelled TAP_SLOP — below that it's
  // still a candidate tap. Past it, every entry in the moving set gets the SAME
  // delta (a rigid translation), so a group keeps its shape.
  _devDragMove(pointer) {
    const e = this._dragHeld;
    if (!e || !pointer.isDown) return;
    const w = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    if (!this._dragMoved) {
      if (Math.hypot(w.x - this._dragPressX, w.y - this._dragPressY) < TAP_SLOP) return;
      this._dragMoved = true;
    }
    const dx = (w.x - e.gx) - e.obj.x, dy = (w.y - e.gy) - e.obj.y;
    for (const m of this._dragMove ?? [e]) this._devDragShiftEntry(m, dx, dy);
    this._devDragHud(e);
    this._drawDevDragMarks();
  }

  // A press that never became a drag is a tap: toggle the object (and its group)
  // in or out of the selection.
  _devDragDrop() {
    const e = this._dragHeld;
    if (!e) return;
    if (!this._dragMoved) this._devSelToggle(e);
    this._dragHeld  = null;
    this._dragMove  = null;
    this._dragMoved = false;
    this._devDragHud(e);
    this._devDragSyncBtns();
    this._drawDevDragMarks();
  }

  _devDragHud(e) {
    const sel = this._devSelSummary?.() ?? '';
    this._dragHud?.setText(e
      ? `${e.name}  (${Math.round(e.obj.x)}, ${Math.round(e.obj.y)})${sel}`
      : `Drag mode: tap to select, drag to move${sel}`);
  }

  // The ⛓ button. Groups the current selection, or dissolves the group when the
  // selection is exactly one. Persisted either way (devGroups.js).
  toggleDevGroup() {
    const existing = this._devSelGroup();
    if (existing) {
      this._devUngroupSelection();
      this._devDragSyncBtns();
      this._drawDevDragMarks();
      this._showDevDragPanel({}, false, `Ungrouped ${existing.name} — its ${existing.members.length} objects move separately again.`);
      return;
    }
    const made = this._devGroupSelection();
    this._devDragSyncBtns();
    this._drawDevDragMarks();
    this._showDevDragPanel({}, false, made
      ? `Grouped ${made.members.length} objects as "${made.name}" — dragging any one now moves them all. Groups are remembered across reloads.`
      : 'Select at least 2 objects first (tap each one), then tap ⛓ Group.');
  }

  clearDevSelection() {
    this._devSelClear();
    this._devDragSyncBtns();
    this._devDragHud(null);
    this._drawDevDragMarks();
  }

  // Move one entry (and anything stacked at the same spot) by a delta. Props are
  // usually a plain `{ x, y, sprite }` record, so the record's own coordinates AND
  // its child GameObjects both have to shift — otherwise the number moves and the
  // picture doesn't, or vice versa. Depth is y-sorted in this game, so a sprite
  // whose depth tracks its y keeps doing that after the move.
  _devDragShiftEntry(e, dx, dy) {
    if (!dx && !dy) return;
    const done = new Set();
    for (const o of [e.obj, ...e.also]) this._devDragShift(o, dx, dy, done);
  }

  _devDragShift(o, dx, dy, done) {
    if (!o || typeof o !== 'object' || done.has(o)) return;
    done.add(o);
    if (isGameObj(o)) {
      const wasSorted = typeof o.depth === 'number' && Math.abs(o.depth - o.y) < 4;
      o.setPosition(o.x + dx, o.y + dy);
      if (wasSorted) o.setDepth(o.y);
      return;
    }
    if (typeof o.x !== 'number' || typeof o.y !== 'number') return;
    o.x += dx; o.y += dy;
    // One level down only: the sprite(s) hanging off a prop record. Never recurse
    // into GameObjects themselves (they reference the scene, the world, everything).
    for (const v of Object.values(o)) {
      if (Array.isArray(v)) { for (const m of v) if (isGameObj(m)) this._devDragShift(m, dx, dy, done); }
      else if (isGameObj(v)) this._devDragShift(v, dx, dy, done);
    }
  }

  // A small hollow marker per grabbable object — amber for untouched, green once
  // moved, so at a glance you can see what this session has actually changed.
  // On top of that (#337): a cyan chain line through the members of every group
  // (so a fence run reads as one linked thing) and a cyan ring around anything
  // currently selected. Three colours, three different questions: amber/green =
  // "has this moved?", cyan ring = "will this move with the next drag?", chain =
  // "these are permanently one handle".
  _drawDevDragMarks() {
    const g = this._dragMarks;
    if (!g) return;
    g.clear();
    for (const grp of this._dragGroups ?? []) {
      const members = this._devEntriesNamed(grp.members);
      if (members.length < 2) continue;
      g.lineStyle(1, 0x6fd3ff, 0.35);
      for (let i = 1; i < members.length; i++) {
        g.lineBetween(members[i - 1].obj.x, members[i - 1].obj.y, members[i].obj.x, members[i].obj.y);
      }
    }
    for (const e of this._dragEntries ?? []) {
      if (this._dragSel?.has(e)) {
        g.lineStyle(1, 0x6fd3ff, 0.95);
        g.strokeRect(Math.round(e.obj.x) - 10, Math.round(e.obj.y) - 10, 20, 20);
      }
      const moved = Math.round(e.obj.x) !== Math.round(e.ox) || Math.round(e.obj.y) !== Math.round(e.oy);
      g.lineStyle(1, moved ? 0x7fe08a : 0xffc857, e === this._dragHeld ? 1 : 0.65);
      g.strokeRect(Math.round(e.obj.x) - 5, Math.round(e.obj.y) - 5, 10, 10);
      g.lineBetween(e.obj.x - 9, e.obj.y, e.obj.x + 9, e.obj.y);
      g.lineBetween(e.obj.x, e.obj.y - 9, e.obj.x, e.obj.y + 9);
    }
  }

  // ─── Export ────────────────────────────────────────────────────────────────

  // Everything that actually moved, as `{ name: { x, y } }` with the ORIGINAL
  // coordinates alongside, so the source edit is unambiguous.
  _devMovedPositions() {
    const out = {};
    for (const e of this._dragEntries ?? []) {
      const x = Math.round(e.obj.x), y = Math.round(e.obj.y);
      if (x === Math.round(e.ox) && y === Math.round(e.oy)) continue;
      out[e.name] = { x, y, from: { x: Math.round(e.ox), y: Math.round(e.oy) } };
    }
    return out;
  }

  // Console (desktop) + clipboard (when allowed) + an on-screen panel (the only
  // one of the three that's readable on the iPad). `quiet` skips the panel — used
  // when the mode is switched off from the pause menu and the world is about to
  // be torn down anyway.
  exportDevPositions({ quiet = false } = {}) {
    const moved = this._devMovedPositions();
    const n = Object.keys(moved).length;
    const json = JSON.stringify(moved, null, 2);
    // eslint-disable-next-line no-console
    console.log('[dev-positions]', n ? json : '(nothing moved)');
    // Clipboard access is best-effort — it needs a secure context and a user
    // gesture, and rejects ASYNCHRONOUSLY when denied, so the promise is caught
    // too (an unhandled rejection would show up as a console error in the smoke test).
    let copied = false;
    try {
      const p = navigator.clipboard?.writeText(json);
      if (p) { copied = true; p.catch(() => {}); }
    } catch { /* clipboard not available — the panel and the log still have it */ }
    if (!quiet) this._showDevDragPanel(moved, copied);
    return moved;
  }

  // Put every object back where the source code put it. Session-only means a
  // reload does this too — but resetting in place keeps a long positioning
  // session going without losing the day/time state.
  resetDevPositions() {
    for (const e of this._dragEntries ?? []) {
      this._devDragShiftEntry(e, e.ox - e.obj.x, e.oy - e.obj.y);
    }
    this._dragHeld = null;
    this._dragMove = null;
    this._devDragHud(null);
    this._drawDevDragMarks();
    this._showDevDragPanel({}, false, 'Reset — everything back to its source position. (Selection and groups are kept.)');
  }

  _showDevDragPanel(moved, copied, note) {
    this._dragPanel?.destroy();
    const names = Object.keys(moved);
    const lines = names.length
      ? names.map(k => `${k}: { x: ${moved[k].x}, y: ${moved[k].y} }   (was ${moved[k].from.x}, ${moved[k].from.y})`)
      : note ? [] : ['Nothing has been moved yet.'];
    const head = note
      ? [note]
      : [`${names.length} moved${copied ? ' — copied to clipboard' : ''}`,
         'Also logged to the console as [dev-positions]. Tap to dismiss.'];
    // Grouped runs export as their individual members (that's what a source edit
    // needs), so the panel names the groups separately — otherwise six moved fence
    // posts look like six coincidences.
    const groups = (this._dragGroups ?? []).map(g => `⛓ ${g.name}: ${g.members.join(', ')}`);

    const o = worldUiOffset(this);
    this._dragPanel = this.add.text(BTN_X + o.x, BTN_Y + (BTN_H + 6) * 4 + 10 + o.y,
      [...head, '', ...lines, ...(groups.length ? ['', ...groups] : [])].join('\n'), {
        fontFamily: 'ui-monospace, Menlo, monospace',
        fontSize: '11px', color: '#ffffff', backgroundColor: '#0d1020f2',
        padding: { x: 8, y: 6 }, lineSpacing: 3,
        wordWrap: { width: Math.max(200, logicalW(this) - BTN_X * 2 - 16) },
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(UI_DEPTH).setResolution(dprOf(this));
  }
};
