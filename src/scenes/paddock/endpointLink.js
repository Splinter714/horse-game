// Dev tool: endpoint-to-endpoint linking (#389) — extends the #375/#376/#386
// gate-link mechanic so FENCE, PATH, and STREAM endpoints can tap-link to
// ANOTHER endpoint of the SAME category (fence-end↔fence-end, path-end↔
// path-end, stream-end↔stream-end — never across categories), the same way a
// pasture-fence joint already links to the gate.
//
// FUSION MODEL: unlike gate-linking (a joint carries a `gateLink` tag and
// RE-DERIVES its x/y from the gate's current position every respace), two
// endpoints linked here become the literal SAME object/array reference —
// mirroring how the forest loop's closed start/end point already works
// (trail.js: `this._pathRoutes.forestLoop = [start, ..., start]`, the same
// array at both ends). There's no fixed anchor between two arbitrary
// endpoints the way there is with the gate, so re-deriving one from the
// other wouldn't say which side is the source of truth — sharing the same
// object sidesteps that entirely: whichever side gets dragged mutates the
// SAME {x,y} (fence joint) or [x,y] (path/stream point), so the other side
// is already correct with no direction to prefer.
//
// This is also why NOTHING here needs its own bookkeeping to remember "is
// this endpoint linked, and to what" — that question is answered by literal
// reference equality against every other same-category endpoint
// (`_linkedPartner`), exactly like a closed loop's shared point already
// answers "is my first waypoint the same as my last".
//
// WHAT COUNTS AS AN ENDPOINT: the FIRST or LAST element of one of:
//   - a fence's joint list (`_fenceJoints()` / `_pastureJoints()` — #386's
//     shared engine; house AND pasture are both category 'fence', since
//     they're the same tool, not look-alikes)
//   - a named path/stream spline's point array (`this._splines`, already
//     built by splineDrag.js — every entry in `this._pathRoutes` plus the
//     stream's `_streamCtrl`; 'stream' is its own category, everything else
//     in `_pathRoutes` is 'path')
//
// REFRESH: mutating the shared object only moves COORDINATES — each feature
// still owns its own downstream rebuild (fence rails/posts/collision, path
// re-bake, stream re-derive). Dragging one side already reruns that side's
// own onChange (unchanged, existing code); `_syncLinkedEndpoint` (called
// from devDrag.js right after each per-category move handler) reruns the
// LINKED PARTNER's onChange too, so both stay visually correct together —
// the same problem devDrag.js's `_devDragShiftEntry` already solves one-off
// for "the gate moved, so re-derive the pasture fence's gate-linked joint".
//
// KNOWN LIMITATION: `_resetSplines()` (splineDrag.js) rebuilds a spline's
// whole point array from its one-time `orig` snapshot, which replaces the
// shared endpoint object with a fresh, no-longer-shared copy — same as it
// already does to a closed loop's self-link (which resetSplines re-fixes
// explicitly). A cross-spline link isn't re-fixed the same way; "reset to
// source" silently drops the link (positions still reset correctly, just
// no longer fused). Acceptable for a session-only dev tool — re-tap to
// re-link. Fence joints have no equivalent reset today, so this doesn't
// apply to fence-fence links.

const LINK_R = 150; // world px: how far a tap-linked endpoint may search for its nearest
                     // same-category partner — roughly 1.5x the fence's post spacing, so a
                     // run dragged up close to another one is caught but a stray endpoint
                     // clear across the map isn't.

const endIndex = (arr, end) => (end === 'first' ? 0 : arr.length - 1);
const endpointXY = (v) => (Array.isArray(v) ? [v[0], v[1]] : [v.x, v.y]);
const cloneEndpointValue = (v) => (Array.isArray(v) ? [v[0], v[1]] : { ...v });

export const WithEndpointLink = (Base) => class extends Base {
  // Every linkable endpoint, freshly derived from current state (fence joint
  // lists and `this._splines` are both already the LIVE arrays the rest of
  // the drag tool mutates, so nothing here needs its own cache/lifecycle).
  _collectLinkEndpoints() {
    const out = [];
    const fenceSpecs = [
      { joints: this._fenceJoints?.(), onChange: () => this._respaceHouseFenceFromJoints?.(), label: 'house fence' },
      { joints: this._pastureJoints?.(), onChange: () => this._respacePastureFenceFromJoints?.(), label: 'pasture fence' },
    ];
    for (const spec of fenceSpecs) {
      const joints = spec.joints;
      if (!joints || joints.length < 2) continue;
      out.push({ category: 'fence', arr: joints, end: 'first', onChange: spec.onChange, label: `${spec.label} start` });
      out.push({ category: 'fence', arr: joints, end: 'last',  onChange: spec.onChange, label: `${spec.label} end` });
    }
    for (const spline of this._splines ?? []) {
      const pts = spline.points;
      if (!pts || pts.length < 2) continue;
      const category = spline.id === 'stream' ? 'stream' : 'path';
      out.push({ category, arr: pts, end: 'first', onChange: spline.onChange, label: `${spline.label} start` });
      out.push({ category, arr: pts, end: 'last',  onChange: spline.onChange, label: `${spline.label} end` });
    }
    return out;
  }

  // Given the array a joint/point was picked from and its resolved index,
  // returns the matching endpoint descriptor — null if that index isn't
  // actually a RUN endpoint (index 0 or length-1), since only true endpoints
  // are linkable (an interior joint/point never is). Called from devDrag.js
  // right after a plain tap (never dragged) resolves to a joint/point index.
  _findLinkEndpoint(arr, index) {
    if (!arr || (index !== 0 && index !== arr.length - 1)) return null;
    const end = index === 0 ? 'first' : 'last';
    return this._collectLinkEndpoints().find((e) => e.arr === arr && e.end === end) ?? null;
  }

  // The other endpoint (of a DIFFERENT array — never this endpoint's own
  // other end, e.g. a closed loop's self-shared start/end) currently fused
  // to `ep`, if any — pure reference-equality lookup, no separate link
  // records to go stale.
  _linkedPartner(ep, all = this._collectLinkEndpoints()) {
    const mine = ep.arr[endIndex(ep.arr, ep.end)];
    return all.find((o) => o.arr !== ep.arr && o.arr[endIndex(o.arr, o.end)] === mine) ?? null;
  }

  // Tap-toggle (mirrors the gate-link gesture): already linked → unlink
  // (give this endpoint back its own independent copy at its current
  // position); otherwise link to the NEAREST eligible same-category
  // endpoint within LINK_R, if any. Returns a small result object for the
  // caller to turn into a HUD message.
  _toggleEndpointLink(ep) {
    const all = this._collectLinkEndpoints();
    const idx = endIndex(ep.arr, ep.end);
    const cur = ep.arr[idx];
    const partner = this._linkedPartner(ep, all);
    if (partner) {
      ep.arr[idx] = cloneEndpointValue(cur);
      ep.onChange?.();
      return { linked: false, unlinked: true, label: partner.label };
    }
    let best = null, bestD = LINK_R;
    const [ex, ey] = endpointXY(cur);
    for (const other of all) {
      if (other.category !== ep.category || other.arr === ep.arr) continue;
      const [ox, oy] = endpointXY(other.arr[endIndex(other.arr, other.end)]);
      const d = Math.hypot(ox - ex, oy - ey);
      if (d < bestD) { bestD = d; best = other; }
    }
    if (!best) return { linked: false };
    const bIdx = endIndex(best.arr, best.end);
    ep.arr[idx] = best.arr[bIdx]; // FUSE: same reference from here on
    ep.onChange?.();
    best.onChange?.();
    return { linked: true, label: best.label };
  }

  // Called from devDrag.js's `_devDragMove` right after moving an endpoint
  // that turns out to be linked — reruns the PARTNER's own onChange (rails/
  // posts/collision refit, path re-bake, or stream re-derive) so both halves
  // of the fused pair redraw together, not just the one actually dragged.
  _syncLinkedEndpoint(arr, index) {
    if (!arr || (index !== 0 && index !== arr.length - 1)) return;
    const end = index === 0 ? 'first' : 'last';
    const all = this._collectLinkEndpoints();
    const ep = all.find((e) => e.arr === arr && e.end === end);
    if (!ep) return;
    this._linkedPartner(ep, all)?.onChange?.();
  }
};
