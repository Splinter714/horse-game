// Dev overlay: world-object labels + a coordinate grid (#329).
//
// A purely diagnostic overlay so placement/positioning discussions can be
// concrete ("move the beehive from (1450, 300) to about (1450, 380)") instead of
// vibes-based. Two halves, toggled together from ONE pause-menu row:
//
//   1. A small floating label above every placed world object, naming it and
//      showing its (x, y) world coordinates.
//   2. A faint 100px coordinate grid across the visible world, with x/y readouts
//      along the top and left edges of the camera view.
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

import { loadDevSettings } from '../../data/save.js';
import { dprOf } from '../uiUtils.js';

const GRID_STEP  = 100;   // world px between gridlines
const GRID_DEPTH = 9500;  // above world sprites (depth == y, max ~1600), below prompts
const LBL_DEPTH  = 9501;

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
  }

  _mountDevOverlay() {
    this._devGrid = this.add.graphics().setDepth(GRID_DEPTH);
    this._buildDevObjectLabels();
    this._drawDevGrid();
  }

  // Called every frame from PaddockScene.update(). Cheap no-op when off; when on,
  // it only redraws the grid once the camera has actually moved (the object
  // labels are static world-space Text and need no per-frame work at all).
  updateDevOverlay() {
    if (!this._devGrid) return;
    const cam = this.cameras.main;
    const at = `${Math.round(cam.scrollX / 4)},${Math.round(cam.scrollY / 4)},${Math.round(cam.worldView.width)}`;
    if (at === this._devGridAt) return;
    this._devGridAt = at;
    this._drawDevGrid();
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
      const lbl = this.add.text(Math.round(t.x), Math.round(t.y) - 8,
        `${t.name} (${Math.round(t.x)}, ${Math.round(t.y)})`, {
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
      this._devObjLabels.push(lbl);
    }
  }

  // ─── Coordinate grid ───────────────────────────────────────────────────────

  // Faint gridlines every GRID_STEP world px across the visible camera view, with
  // the x value printed along the top edge and the y value along the left edge.
  // Only the visible span is drawn (a full-world grid would be ~600 lines and
  // hundreds of Text objects); the axis labels are a reused pool, so panning the
  // camera repositions them instead of churning new ones.
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
      // Every 500px reads a touch stronger, so it's easy to count across.
      g.lineStyle(1, 0xffffff, x % 500 === 0 ? 0.30 : 0.14);
      g.lineBetween(x, view.y, x, y1);
      this._devAxisLabel(n++, `${x}`, x + 3, view.y + 2, 0, 0);
    }
    for (let y = y0; y <= y1; y += GRID_STEP) {
      g.lineStyle(1, 0xffffff, y % 500 === 0 ? 0.30 : 0.14);
      g.lineBetween(view.x, y, x1, y);
      this._devAxisLabel(n++, `${y}`, view.x + 2, y + 2, 0, 0);
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
