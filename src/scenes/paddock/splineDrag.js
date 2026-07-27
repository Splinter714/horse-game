// Dev tool: control-point spline editing for the worn dirt paths and the stream
// (#373) — the same "grab a point, watch it re-bake live" spirit as #370's house-
// fence endpoint handles, generalized to arrays of interior control points
// instead of two endpoints.
//
// SHARED vs SEPARATE (#373 asked us to use judgment here): the PICK/DRAG/EXPORT
// gesture is identical for every spline in this file — "here's an array of
// [x,y] points, grab the nearest one, drag it, call onChange()" — so that half
// is ONE generic implementation (`_splineDragTap`/`_splineDragMove`/
// `_splineExport`) shared by both features. What ISN'T shared is what happens
// on `onChange`: a worn path just re-stamps + re-bakes its Graphics
// (`_bakePathGraphics`, world.js) — no collision, no other systems reading it.
// The stream re-derives FOUR things (`_rebuildStream`, stream.js): the spline
// itself, its baked visual, its collision rects (which live inside the SHARED
// `this.obstacles` list and have to be pulled out/pushed back in, not just
// replaced), `streamPath` (read fresh by the fish/cat each use, so simple
// reassignment is safe) and its bank gather points (spliced in/out of the
// shared `this.props.sources`). That asymmetry is exactly why each feature owns
// its own rebuild method rather than this file trying to guess how to rebuild a
// generic "thing" — the shared code here stops at "an array of points changed";
// each feature's own file decides what that means.
//
// Same lighter-refresh lesson as #370's post-fix `_respaceHouseFenceTo`: moving
// a control point NEVER calls `_clearDevDrag()`/`_mountDevDrag()` mid-drag (that
// full remount reset `_dragHeld`/held-state and silently cancelled a drag after
// its first tiny move — the bug found right after #370 shipped). A spline move
// only reruns the ONE feature's own rebuild method; the drag tool's own state
// (`_splineHeld`, `_dragMoved`, `_dragPressX/Y`, devDrag.js's `_dragEntries`) is
// untouched by it — nothing here even needs `_refreshDragEntries()`, since
// paths/stream were never entries in that list to begin with (they're not
// `this.props` objects, see `_devLabelTargets`).
//
// Handles are drawn as small filled circles, one colour per spline family, so
// "grab a path/stream point" reads as visually distinct from #370's magenta
// fence endpoints and the ordinary #330 per-post amber/green squares.

const MARK_DEPTH    = 9504;    // above the #370 fence-endpoint marks (9503)
const PICK_R        = 22;      // world px: how close a tap must be to grab a control point
const PATH_COLOR     = 0xffa64d; // warm orange — the worn-path route handles
const STREAM_COLOR   = 0x39c6ff; // cyan-blue — the stream centerline handles

export const WithSplineDrag = (Base) => class extends Base {
  // Called from devDrag.js's `_mountDevDrag`.
  _mountSplineDrag() {
    this._splines = this._buildSplineList();
    this._splineHeld = null; // { spline, index } | null
    this._splineMarks = this.add.graphics().setDepth(MARK_DEPTH);
    this._drawSplineMarks();
  }

  // Called from devDrag.js's `_clearDevDrag`.
  _clearSplineDrag() {
    this._splineMarks?.destroy();
    this._splineMarks = null;
    this._splines = null;
    this._splineHeld = null;
  }

  // One descriptor per editable spline. `points` is the LIVE array the feature's
  // own build code already owns (`this._pathRoutes.<name>` / `this._streamCtrl`)
  // — dragging mutates it in place, so the feature never has to be told the new
  // values separately. `orig` is a one-time deep snapshot for reset/export-diff.
  _buildSplineList() {
    const out = [];
    for (const [name, points] of Object.entries(this._pathRoutes ?? {})) {
      out.push({
        id: `path:${name}`, label: `Path: ${name}`, color: PATH_COLOR,
        points, orig: points.map((p) => [p[0], p[1]]),
        onChange: () => this._bakePathGraphics(),
      });
    }
    if (this._streamCtrl) {
      out.push({
        id: 'stream', label: 'Stream', color: STREAM_COLOR,
        points: this._streamCtrl, orig: this._streamCtrl.map((p) => [p[0], p[1]]),
        onChange: () => this._rebuildStream(),
      });
    }
    return out;
  }

  // Called from devDrag.js's `_devDragTap`, in WORLD space, ahead of the generic
  // per-post pick — same priority as the #370 fence endpoints, so grabbing a
  // control point always wins over anything else that happens to sit near it.
  // Returns `{ spline, index }` or null.
  _splineDragTap(w) {
    if (!this._splines) return null;
    let best = null, bestD = PICK_R;
    for (const spline of this._splines) {
      spline.points.forEach((p, index) => {
        const d = Math.hypot(p[0] - w.x, p[1] - w.y);
        if (d < bestD) { bestD = d; best = { spline, index }; }
      });
    }
    return best;
  }

  // Called from devDrag.js's `_devDragMove` while a control point is held.
  _splineDragMove(w) {
    const { spline, index } = this._splineHeld;
    spline.points[index][0] = w.x;
    spline.points[index][1] = w.y;
    spline.onChange();
    this._dragHud?.setText(`${spline.label} — point ${index + 1}/${spline.points.length} (${Math.round(w.x)}, ${Math.round(w.y)})`);
    this._drawSplineMarks();
  }

  _drawSplineMarks() {
    const g = this._splineMarks;
    if (!g) return;
    g.clear();
    for (const spline of this._splines ?? []) {
      g.lineStyle(1, spline.color, 0.35);
      for (let i = 1; i < spline.points.length; i++) {
        const [x0, y0] = spline.points[i - 1], [x1, y1] = spline.points[i];
        g.lineBetween(x0, y0, x1, y1);
      }
      spline.points.forEach((p, i) => {
        const held = this._splineHeld?.spline === spline && this._splineHeld?.index === i;
        g.fillStyle(spline.color, held ? 0.9 : 0.55);
        g.fillCircle(p[0], p[1], held ? 9 : 7);
        g.lineStyle(1.5, spline.color, held ? 1 : 0.85);
        g.strokeCircle(p[0], p[1], held ? 9 : 7);
      });
    }
  }

  // Put every control point back where the source code put it, and re-run each
  // touched feature's own rebuild. Called from devDrag.js's `resetDevPositions`.
  _resetSplines() {
    for (const spline of this._splines ?? []) {
      let moved = false;
      spline.points.forEach((p, i) => {
        const [ox, oy] = spline.orig[i];
        if (p[0] !== ox || p[1] !== oy) moved = true;
        p[0] = ox; p[1] = oy;
      });
      if (moved) spline.onChange();
    }
    this._drawSplineMarks();
  }

  // Every spline whose points differ from its source snapshot, as a copy-pasteable
  // `{ [id]: [[x,y],...] }`, bakeable straight into world.js's route consts /
  // stream.js's `ctrl` array. Called from devDrag.js's `exportDevPositions`.
  _splineExport() {
    if (!this._splines) return null;
    const out = {};
    for (const spline of this._splines) {
      const moved = spline.points.some((p, i) => p[0] !== spline.orig[i][0] || p[1] !== spline.orig[i][1]);
      if (!moved) continue;
      out[spline.id] = spline.points.map(([x, y]) => [Math.round(x), Math.round(y)]);
    }
    return Object.keys(out).length ? out : null;
  }
};
