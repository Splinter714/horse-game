// Dev overlay: world-object labels + a coordinate grid (#329).
//
// A purely diagnostic overlay so placement/positioning discussions can be
// concrete ("move the beehive from (1450, 300) to about (1450, 380)") instead of
// vibes-based. Two halves, toggled together from ONE pause-menu row:
//
//   1. A small floating label above every placed world object, naming it and
//      showing its (x, y) world coordinates.
//   2. A faint coordinate grid across the visible world, with small integer
//      CELL indices (column/row, not raw pixels) along the top and left edges
//      of the camera view.
//
// Why a pause-menu dev setting rather than `import.meta.env.DEV`: same reasoning
// as the FPS counter (#325) — the owner looks at the game on his iPad, on the
// DEPLOYED build, which is exactly where a positioning conversation happens. So
// it's persisted in devSettings, DEFAULT OFF, and creates nothing at all until
// it's deliberately switched on. Nothing here touches gameplay: no obstacles, no
// input handlers, no interaction — just Text/Graphics on a high depth.
//
// The object list is DERIVED from `this.props` (plus the few placed things that
// live on their own scene field, like the farm stand and garden), never a
// hand-written list. A new prop with x/y gets labelled for free — this feature
// should not need touching again when the world grows.
//
// Object labels are PROXIMITY-GATED (2026-07-26 playtest follow-up): the map has
// enough placed objects that showing every label at once was overwhelming. All
// labels are still built once (cheap: static world-space Text), but only ones
// within LABEL_RADIUS of the player are made visible, re-checked every frame as
// the player moves. The grid half is deliberately NOT proximity-gated — it
// already only draws the visible camera view, which is what "what's around you"
// means for a grid.
//
// Grid coarsened + relabelled to cell indices (2026-07-26 follow-up): a 100px grid
// with raw-pixel axis readouts ("1000", "1200") was too fine and too fiddly to talk
// about ("the beehive is around column 5, row 2" beats a 4-digit pixel number).
// GRID_STEP=300 was picked by checking actual placed-object coordinates via
// `_devLabelTargets()` — most standalone objects (buildings, gathering sources,
// stations) sit 300-600+ world px apart, so a 300px cell puts most of them alone
// in their own cell. Genuinely tight clusters (the 3 coop nests ~24px apart, the
// bird-feeder cluster, the pet bowls) will still share a cell at any sane step —
// that's an accurate reflection of real-world clustering, not a labeling bug, and
// the existing anti-overlap nudge on the object labels already handles it.
//
// Grid tightened back up (2026-07-28, #356 follow-up): 300px cells were too coarse
// for precise positioning work in practice — the numbering scheme (integer column/
// row, not raw pixels) stays exactly as-is, but GRID_STEP dropped to 150 for finer
// placement without going back to the too-fiddly 100px original.
//
// The currently-dragged object's label is ALWAYS shown (2026-07-26 follow-up): the
// #330 drag tool's `this._dragHeld` (the entry under the finger, or null) is read
// directly here — the two dev tools already share state this way (`_devLabelTargets`
// itself). Whichever label's `obj` matches `_dragHeld.obj` is forced visible even
// outside `LABEL_RADIUS`, so nudging an object far from the player doesn't lose its
// name/coords readout. `_dragHeld` is always defined (null when the drag tool is off
// or nothing is held), so this is a no-op — not a crash — whenever nothing is grabbed.

import { loadDevSettings } from '../../data/save.js';
import { dprOf } from '../uiUtils.js';

const GRID_STEP    = 150;   // world px per grid cell (finer from 300 — #356 follow-up)
const GRID_DEPTH   = 9500;  // above world sprites (depth == y, max ~1600), below prompts
const LBL_DEPTH    = 9501;
const LABEL_RADIUS = 80;   // world px — only objects this close to the player get a visible label

// `this.props` buckets that are TRANSIENT clutter rather than placed structures —
// food piles the player drops and droppings that get scooped. They come and go
// constantly, so a label built once would go stale immediately, and labelling
// them isn't what the tool is for (fixed placement). Everything else in props is
// enumerated automatically.
const TRANSIENT = new Set(['droppings', 'hayPiles', 'seedPiles']);

export const WithDevLabels = (Base) => class extends Base {
  // Called once from create(). Reads the persisted toggle; builds nothing when off.
  buildDevLabels() {
    this._devGrid       = null;
    this._devAxisLabels = [];
    this._devObjLabels  = [];
    this._devGridAt     = null; // last camera scroll the grid was drawn for
    this._devLabelsAt   = null; // last player position bucket labels were gated for
    if (loadDevSettings().showDevLabels) this._mountDevOverlay();
  }

  // Pause-menu handler: tear the overlay down and rebuild it from the (already
  // saved) setting. Live — no reload needed, and it works while paused because
  // the grid draws immediately here rather than waiting on update().
  refreshDevOverlay() {
    this._clearDevOverlay();
    if (loadDevSettings().showDevLabels) this._mountDevOverlay();
  }

  _clearDevOverlay() {
    this._devGrid?.destroy();
    this._devGrid = null;
    for (const t of this._devAxisLabels ?? []) t.destroy();
    for (const t of this._devObjLabels  ?? []) t.destroy();
    this._devAxisLabels = [];
    this._devObjLabels  = [];
    this._devGridAt     = null;
    this._devLabelsAt   = null;
  }

  _mountDevOverlay() {
    this._devGrid = this.add.graphics().setDepth(GRID_DEPTH);
    this._buildDevObjectLabels();
    this._updateDevLabelVisibility(); // apply immediately — matches the grid, works while paused
    this._drawDevGrid();
  }

  // Called every frame from PaddockScene.update(). Cheap no-op when off; when on,
  // it redraws the grid once the camera has actually moved, and refreshes which
  // object labels are visible once the player has actually moved (both throttled
  // to "moved more than a few px", not truly every frame).
  updateDevOverlay() {
    if (!this._devGrid) return;
    const cam = this.cameras.main;
    const at = `${Math.round(cam.scrollX / 4)},${Math.round(cam.scrollY / 4)},${Math.round(cam.worldView.width)}`;
    if (at !== this._devGridAt) {
      this._devGridAt = at;
      this._drawDevGrid();
    }
    this._updateDevLabelVisibility();
  }

  // ─── Object labels ─────────────────────────────────────────────────────────

  // Every placed world object as `{ name, x, y, obj, also }`, derived from
  // `this.props` so a newly-added prop is labelled without touching this file.
  // Named (non-array) props are collected first so that when a prop is ALSO a
  // member of a generic list (e.g. `props.catBowl` is one of `props.petBowls`)
  // the readable name wins and the duplicate at the same spot is dropped.
  //
  // `obj` is the live object itself and `also` the same-spot duplicates that were
  // deduped away — the labels ignore both, but the drag tool (#330) needs them so
  // grabbing a thing moves ALL of what sits at that coordinate. Shared on purpose:
  // both dev tools enumerate the world through this one function.
  _devLabelTargets() {
    const out  = [];
    const seen = new Map();
    const push = (name, o) => {
      if (!o || typeof o.x !== 'number' || typeof o.y !== 'number') return;
      const at = `${Math.round(o.x)}:${Math.round(o.y)}`;
      const dup = seen.get(at);
      if (dup) { // same spot already named by a friendlier key
        if (o !== dup.obj && !dup.also.includes(o)) dup.also.push(o);
        return;
      }
      const entry = { name, x: o.x, y: o.y, obj: o, also: [] };
      seen.set(at, entry);
      out.push(entry);
    };

    const entries = Object.entries(this.props ?? {}).filter(([k]) => !TRANSIENT.has(k));
    for (const [key, val] of entries) if (!Array.isArray(val)) push(key, val);
    // Placed things that live on their own scene field rather than in props.
    push('farmStand', this.farmStand);
    push('garden', this.garden);
    for (const [key, val] of entries) {
      if (!Array.isArray(val)) continue;
      // A list member may carry its own display `label` (the gather sources do).
      val.forEach((item, i) => push(item?.label ?? `${key}[${i}]`, item));
    }
    return out;
  }

  _buildDevObjectLabels() {
    const res = dprOf(this);
    // Top-down, so the collision nudge below always pushes a colliding label UP
    // into space already known to be clear.
    const targets = this._devLabelTargets().sort((a, b) => a.y - b.y || a.x - b.x);
    const placed = [];

    for (const t of targets) {
      // Precise pixel coords stay (useful for the #330 drag/export tool); the
      // trailing "cN,rN" is the coarse grid-cell index, so a label can be read
      // off either against the axis ("beehive is around column 3, row 1") or
      // pasted precisely.
      const col = Math.floor(t.x / GRID_STEP), row = Math.floor(t.y / GRID_STEP);
      const lbl = this.add.text(Math.round(t.x), Math.round(t.y) - 8,
        `${t.name} (${Math.round(t.x)}, ${Math.round(t.y)}) c${col},r${row}`, {
          fontFamily: 'ui-monospace, Menlo, monospace',
          fontSize: '9px',
          color: '#ffe9a8',
          backgroundColor: '#12162acc',
          padding: { x: 3, y: 1 },
        }).setOrigin(0.5, 1).setDepth(LBL_DEPTH).setResolution(res);

      // Nudge upward while this label would sit on top of one already placed, so
      // clustered objects (the bird feeders, the pet bowls) stay all readable.
      const w = lbl.width, h = lbl.height;
      let y = lbl.y;
      for (let tries = 0; tries < 12; tries++) {
        const hit = placed.some(p =>
          Math.abs(p.x - lbl.x) < (p.w + w) / 2 && Math.abs(p.y - y) < h + 1);
        if (!hit) break;
        y -= h + 2;
      }
      lbl.setY(y);
      placed.push({ x: lbl.x, y, w, h });
      // Stash the object's true anchor (pre-nudge) for the proximity check below —
      // the label's own (x, y) can be nudged 40-60px up in a cluster.
      lbl.setData('at', { x: t.x, y: t.y });
      // The live object itself, so the drag tool's "currently held" entry can be
      // matched by identity rather than by (fragile, non-unique) name.
      lbl.setData('obj', t.obj);
      this._devObjLabels.push(lbl);
    }
    this._devLabelsAt = null; // force a fresh visibility pass against the new set
  }

  // Show only the object labels within LABEL_RADIUS of the player; re-run as the
  // player moves (throttled to "moved more than a few px" so this isn't a real
  // per-frame cost). Nothing to do while the overlay is off or there's no player
  // yet (e.g. very first frames of create()).
  //
  // Exception to the throttle/radius: whatever the #330 drag tool currently has
  // held (`this._dragHeld`) always shows its label, however far it's been dragged
  // from the player — and since a drag moves the object without moving the
  // player, the throttle is bypassed too (there's always at most one held object,
  // so this stays cheap).
  _updateDevLabelVisibility() {
    const p = this.player?.sprite;
    if (!p) return;
    const heldObj = this._dragHeld?.obj ?? null;
    const at = `${Math.round(p.x / 8)},${Math.round(p.y / 8)}`;
    if (at === this._devLabelsAt && !heldObj) return;
    this._devLabelsAt = at;
    const r2 = LABEL_RADIUS * LABEL_RADIUS;
    for (const lbl of this._devObjLabels) {
      if (heldObj && lbl.getData('obj') === heldObj) { lbl.setVisible(true); continue; }
      const src = lbl.getData('at');
      const dx = src.x - p.x, dy = src.y - p.y;
      lbl.setVisible(dx * dx + dy * dy <= r2);
    }
  }

  // ─── Coordinate grid ───────────────────────────────────────────────────────

  // Faint gridlines every GRID_STEP world px across the visible camera view, with
  // the small integer CELL INDEX (column along the top edge, row along the left
  // edge — `Math.floor(worldCoord / GRID_STEP)`) rather than raw pixel values, so
  // a position reads as "column 5, row 2" instead of a 4-digit pixel number. Only
  // the visible span is drawn (a full-world grid would be ~600 lines and hundreds
  // of Text objects); the axis labels are a reused pool, so panning the camera
  // repositions them instead of churning new ones.
  _drawDevGrid() {
    const g = this._devGrid;
    if (!g) return;
    const view = this.cameras.main.worldView;
    const x0 = Math.floor(view.x / GRID_STEP) * GRID_STEP;
    const y0 = Math.floor(view.y / GRID_STEP) * GRID_STEP;
    const x1 = view.right, y1 = view.bottom;

    g.clear();
    let n = 0;
    for (let x = x0; x <= x1; x += GRID_STEP) {
      // Every 3rd line (every 450px at GRID_STEP=150) reads a touch stronger, so
      // it's easy to count across without every single line looking the same.
      const col = Math.round(x / GRID_STEP);
      g.lineStyle(1, 0xffffff, col % 3 === 0 ? 0.30 : 0.14);
      g.lineBetween(x, view.y, x, y1);
      this._devAxisLabel(n++, `${col}`, x + 3, view.y + 2, 0, 0);
    }
    for (let y = y0; y <= y1; y += GRID_STEP) {
      const row = Math.round(y / GRID_STEP);
      g.lineStyle(1, 0xffffff, row % 3 === 0 ? 0.30 : 0.14);
      g.lineBetween(view.x, y, x1, y);
      this._devAxisLabel(n++, `${row}`, view.x + 2, y + 2, 0, 0);
    }
    // Park any pooled labels the current view doesn't need.
    for (let i = n; i < this._devAxisLabels.length; i++) this._devAxisLabels[i].setVisible(false);
  }

  // Pooled axis readout #i — created on first use, then just repositioned.
  _devAxisLabel(i, text, x, y, ox, oy) {
    let lbl = this._devAxisLabels[i];
    if (!lbl) {
      lbl = this.add.text(0, 0, '', {
        fontFamily: 'ui-monospace, Menlo, monospace',
        fontSize: '8px',
        color: '#bfe4ff',
        backgroundColor: '#0d1020aa',
        padding: { x: 2, y: 0 },
      }).setDepth(GRID_DEPTH).setResolution(dprOf(this));
      this._devAxisLabels[i] = lbl;
    }
    lbl.setOrigin(ox, oy).setPosition(Math.round(x), Math.round(y)).setVisible(true);
    if (lbl.text !== text) lbl.setText(text);
    return lbl;
  }
};
