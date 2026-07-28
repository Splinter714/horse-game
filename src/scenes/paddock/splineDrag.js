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
//
// FOREST/TRAIL LOOP (#373 follow-up): the owner was explicit that this should
// not be a second system that merely *behaves* like the worn paths — it had to
// actually BE the same one. So it isn't a separate descriptor in this file at
// all: `trail.js`'s `buildTrail()` adds its loop as one more named entry in
// `this._pathRoutes` (`forestLoop`) and calls the SAME `_bakePathGraphics()`
// (world.js) the farm paths already use — including the same "rebake on every
// drag tick" behaviour (that function already destroys+rebakes its
// `bakeStaticGraphics` texture on every call, farm paths included, so there is
// no live-vs-deferred split to make here). Since it's just another entry in
// `_pathRoutes`, the loop below over `Object.entries(this._pathRoutes)` picks
// it up automatically with zero special-casing — it just happens to be closed
// (its first and last waypoints are the literal same array reference, so
// dragging that shared point moves both ends together for free) and longer
// than the others.
//
// INSERTING new waypoints (#373 second follow-up): the fixed-length arrays
// above only let you MOVE an existing waypoint. `_splineDragTap` now runs a
// second pass when the tap misses every existing point — it finds the
// closest point along any SEGMENT (the line between two adjacent waypoints,
// not just its midpoint, so grabbing anywhere along a long stretch works,
// not only its exact centre) within `INSERT_R`, splices a brand-new waypoint
// into the array right there, and hands it back through the exact same
// `{ spline, index }` shape an ordinary grab returns — so from the caller's
// side (devDrag.js) "insert" and "drag" are literally the same gesture: tap
// near a segment, a point appears under your finger already held, drag it
// like any other. This is shared by every spline in `_splines`, paths and
// stream alike, with no per-route special-casing.
//
// The one wrinkle insertion creates is RESET: the array can now be a
// different length than `spline.orig`'s one-time snapshot, so `_resetSplines`
// rebuilds the array from `orig` wholesale (splice-replace) instead of
// walking matching indices. For a closed loop (the forest loop, whose first
// and last waypoints are the SAME array reference) that rebuild would create
// two separate-but-equal objects instead of one shared one — `spline.closed`
// (recorded once at mount time) tells reset to re-link the last point back
// to the first so the "drag one end, both move" behaviour survives a reset.

const MARK_DEPTH    = 9504;    // above the #370 fence-endpoint marks (9503)
const PICK_R        = 22;      // world px: how close a tap must be to grab a control point
const INSERT_R       = 26;     // world px: how close a tap must be to a segment to insert a new point there
const PATH_COLOR     = 0xffa64d; // warm orange — the worn-path route handles (incl. the forest loop)
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
        closed: points.length > 1 && points[0] === points[points.length - 1],
        onChange: () => this._bakePathGraphics(),
      });
    }
    if (this._streamCtrl) {
      out.push({
        id: 'stream', label: 'Stream', color: STREAM_COLOR,
        points: this._streamCtrl, orig: this._streamCtrl.map((p) => [p[0], p[1]]),
        closed: false,
        onChange: () => this._rebuildStream(),
      });
    }
    return out;
  }

  // Called from devDrag.js's `_devDragTap`, in WORLD space, ahead of the generic
  // per-post pick — same priority as the #370 fence endpoints, so grabbing a
  // control point always wins over anything else that happens to sit near it.
  // Returns `{ spline, index }` or null.
  //
  // Two passes: first, try to grab an EXISTING point (unchanged radius/
  // behaviour — this always wins when both a point and a segment are in
  // range). Second, if nothing existing was hit, see if the tap landed near a
  // SEGMENT and, if so, INSERT a new waypoint there and hand it back already
  // "held" — see the file header for why this is one gesture, not two.
  _splineDragTap(w) {
    if (!this._splines) return null;
    let best = null, bestD = PICK_R;
    for (const spline of this._splines) {
      spline.points.forEach((p, index) => {
        const d = Math.hypot(p[0] - w.x, p[1] - w.y);
        if (d < bestD) { bestD = d; best = { spline, index }; }
      });
    }
    if (best) return best;
    return this._splineInsertTap(w);
  }

  // Finds the closest point along any segment (of any spline) to `w`, within
  // `INSERT_R`, splices a new waypoint in right there, and returns it as an
  // already-held `{ spline, index }` — identical shape to an ordinary grab.
  _splineInsertTap(w) {
    let best = null, bestD = INSERT_R;
    for (const spline of this._splines) {
      const pts = spline.points;
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1];
        const [x1, y1] = pts[i];
        const dx = x1 - x0, dy = y1 - y0;
        const lenSq = dx * dx + dy * dy;
        if (lenSq < 1) continue; // zero-length segment (e.g. a degenerate pair) — nothing to insert into
        let t = ((w.x - x0) * dx + (w.y - y0) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
        const px = x0 + dx * t, py = y0 + dy * t;
        const d = Math.hypot(px - w.x, py - w.y);
        if (d < bestD) { bestD = d; best = { spline, segIndex: i, x: px, y: py }; }
      }
    }
    if (!best) return null;
    const { spline, segIndex, x, y } = best;
    spline.points.splice(segIndex, 0, [x, y]);
    spline.onChange();
    this._drawSplineMarks();
    return { spline, index: segIndex };
  }

  // #394: given an EXISTING held control point `{ spline, index }`, splices it
  // back OUT of `spline.points` so the route goes straight through where it
  // used to bend — the inverse of `_splineInsertTap`. Never removes the
  // route's own absolute first/last waypoint (index 0 or length-1) — those
  // are the anchors a whole route hangs off, including (for the forest loop)
  // a self-closed shared reference at BOTH ends, so this deliberately treats
  // "index 0" and "index length-1" as untouchable regardless of whether
  // they're currently fused to anything.
  //
  // #397: an interior point CAN now be a link target (another route's, or
  // this route's own, endpoint fused to it) — `_detachLinkDependents`
  // (endpointLink.js) runs first and gives every such dependent its own
  // independent copy at the current position, so deleting the point never
  // leaves a dangling shared reference. A point nobody's linked to is
  // unaffected (the call is a no-op).
  _splineDeleteNode(held) {
    if (!held) return false;
    const { spline, index } = held;
    const pts = spline.points;
    if (index <= 0 || index >= pts.length - 1) return false; // anchors — never deletable
    this._detachLinkDependents?.(pts, index);
    pts.splice(index, 1);
    spline.onChange();
    this._drawSplineMarks();
    return true;
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
        // Reference equality, not index equality: a closed spline's shared
        // start/end point (trail.js's loop) is literally the same array at
        // two different indices, so this correctly highlights BOTH ends
        // together instead of only whichever index the pick happened to land on.
        const held = this._splineHeld?.spline === spline && spline.points[this._splineHeld.index] === p;
        g.fillStyle(spline.color, held ? 0.9 : 0.55);
        g.fillCircle(p[0], p[1], held ? 9 : 7);
        g.lineStyle(1.5, spline.color, held ? 1 : 0.85);
        g.strokeCircle(p[0], p[1], held ? 9 : 7);
      });
    }
  }

  // Put every control point back where the source code put it, and re-run each
  // touched feature's own rebuild. Called from devDrag.js's `resetDevPositions`.
  //
  // Rebuilds the array wholesale from `orig` (splice-replace, not a per-index
  // walk) so this also undoes any inserted points — an inserted waypoint has
  // no counterpart in `orig` at all, so there's no per-index value to reset it
  // TO; the only sane "undo" is dropping it. A closed spline (the forest loop)
  // needs its shared first/last reference re-linked afterwards, since the
  // fresh copies made from `orig` are two separate-but-equal objects.
  _resetSplines() {
    for (const spline of this._splines ?? []) {
      const { points, orig, closed } = spline;
      const same = points.length === orig.length &&
        points.every((p, i) => p[0] === orig[i][0] && p[1] === orig[i][1]);
      if (!same) {
        const rebuilt = orig.map(([x, y]) => [x, y]);
        if (closed && rebuilt.length > 1) rebuilt[rebuilt.length - 1] = rebuilt[0];
        points.splice(0, points.length, ...rebuilt);
        spline.onChange();
      }
    }
    this._drawSplineMarks();
  }

  // Every spline whose points differ from its source snapshot (moved OR a
  // different length, i.e. a point was inserted), as a copy-pasteable
  // `{ [id]: [[x,y],...] }`, bakeable straight into world.js's route consts /
  // stream.js's `ctrl` array. Called from devDrag.js's `exportDevPositions`.
  _splineExport() {
    if (!this._splines) return null;
    const out = {};
    for (const spline of this._splines) {
      const moved = spline.points.length !== spline.orig.length ||
        spline.points.some((p, i) => p[0] !== spline.orig[i][0] || p[1] !== spline.orig[i][1]);
      if (!moved) continue;
      out[spline.id] = spline.points.map(([x, y]) => [Math.round(x), Math.round(y)]);
    }
    return Object.keys(out).length ? out : null;
  }
};
