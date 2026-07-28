// Dev tool: endpoint-to-endpoint linking (#389) — extends the #375/#376/#386
// gate-link mechanic so FENCE, PATH, and STREAM endpoints can tap-link to
// ANOTHER endpoint of the SAME category (fence-end↔fence-end, path-end↔
// path-end, stream-end↔stream-end — never across categories), the same way a
// pasture-fence joint already links to the gate.
//
// SELF-LINKING (#393): a PATH or STREAM route's own two absolute endpoints
// (its first and last waypoint — never an interior point, and never a fence
// joint, since fences don't loop) can also tap-link to EACH OTHER, closing
// the route into a loop the exact same way the forest trail's loop has
// always been built (trail.js's `buildTrail()` hardcodes `start` as the
// literal same array reference at both ends of `forestLoop`). Fusing a
// route's own two ends together is just a special case of the general
// "fuse two points into the same reference" mechanic — see the candidate
// search in `_toggleEndpointLink` below.
//
// MID-POINT LINKING (#397): a PATH or STREAM endpoint can now link to any
// INTERIOR waypoint of an eligible route too — its own route included (a
// branch back into its own interior, not just its own far end). Only an
// absolute ENDPOINT (index 0 or length-1) can ever be the thing a tap
// TOGGLES (`_findLinkEndpoint` still only resolves those) — but the pool of
// things it can link TO now spans every point on every eligible path/stream
// route (`_collectLinkTargets`), not just other endpoints. This makes the
// old #393 self-loop case just the special case where the target happens to
// be the route's own OTHER end, rather than a separately-coded path — see
// `_toggleEndpointLink`. Fences are unaffected (still endpoint-to-endpoint
// only, own-array excluded entirely) — #389 scoped fence linking that way
// and #397 doesn't extend it.
//
// A mid-point can pick up links from MORE THAN ONE other route at once (e.g.
// two separate paths both branching off the same bend in a third route) —
// nothing here needs extra bookkeeping to forbid that; the fusion model
// (below) already supports N:1 for free, since each linked endpoint just
// independently holds the same object reference. `_syncLinkedEndpoint` and
// `_detachLinkDependents` both walk ALL matching partners, not just the
// first, so every dependent stays in sync (or gets cleanly detached) even
// when several routes share one mid-point.
//
// #391 had added a guard so tapping the (until then, only ever
// boot-hardcoded) forest loop's shared point wouldn't be misread as "go find
// some unrelated nearby endpoint to link to" — at the time the tool had no
// concept of a route linking to ITSELF at all, so the safest thing was to
// make that one point inert. Now that self-linking is a real, understood
// case, that stopgap is obsolete: a self-closed route (`arr[0] === arr[at
// the far end]`) is just "this route is currently linked to itself", fully
// toggleable like any other link — including the forest loop. There's no
// runtime way to tell "the loop trail.js hardcoded at boot" apart from "a
// loop the player closed by tapping" anyway (both end up as the exact same
// shape: shared reference at index 0 and the last index), so treating them
// identically is also the only option that doesn't need an extra hidden
// flag. Nothing else in the game actually requires the forest loop to stay
// closed (`_bakePathGraphics`/`_rebuildStream` iterate a route's waypoints
// in order regardless of whether the ends happen to be shared; the trail
// entrance marker only reads index 0) — the old comment's claim that
// "nothing supports it being open" was a precaution, not an enforced
// invariant, and the player can always re-tap to re-close it.
//
// FUSION MODEL: unlike gate-linking (a joint carries a `gateLink` tag and
// RE-DERIVES its x/y from the gate's current position every respace), two
// points linked here become the literal SAME object/array reference —
// mirroring how the forest loop's closed start/end point already works
// (trail.js: `this._pathRoutes.forestLoop = [start, ..., start]`, the same
// array at both ends). There's no fixed anchor between two arbitrary points
// the way there is with the gate, so re-deriving one from the other wouldn't
// say which side is the source of truth — sharing the same object sidesteps
// that entirely: whichever side gets dragged mutates the SAME {x,y} (fence
// joint) or [x,y] (path/stream point), so every other side is already
// correct with no direction to prefer.
//
// This is also why NOTHING here needs its own bookkeeping to remember "is
// this endpoint linked, and to what" — that question is answered by literal
// reference equality against every other eligible point
// (`_linkedPartner`/`_syncLinkedEndpoint`/`_detachLinkDependents`), exactly
// like a closed loop's shared point already answers "is my first waypoint
// the same as my last".
//
// WHAT COUNTS AS A LINKABLE ENDPOINT (the thing a tap TOGGLES): the FIRST or
// LAST element of one of:
//   - a fence's joint list (`_fenceJoints()` / `_pastureJoints()` — #386's
//     shared engine; house AND pasture are both category 'fence', since
//     they're the same tool, not look-alikes)
//   - a named path/stream spline's point array (`this._splines`, already
//     built by splineDrag.js — every entry in `this._pathRoutes` plus the
//     stream's `_streamCtrl`; 'stream' is its own category, everything else
//     in `_pathRoutes` is 'path')
//
// WHAT COUNTS AS A LINK TARGET (#397 widens this beyond the above): for
// fences, the same endpoint list. For path/stream, EVERY point (interior
// waypoints included) of every route in the matching category —
// `_collectLinkTargets()`.
//
// REFRESH: mutating the shared object only moves COORDINATES — each feature
// still owns its own downstream rebuild (fence rails/posts/collision, path
// re-bake, stream re-derive). Dragging one side already reruns that side's
// own onChange (unchanged, existing code); `_syncLinkedEndpoint` (called
// from devDrag.js right after each per-category move handler) reruns EVERY
// linked partner's own onChange too, so every fused point stays visually
// correct together — the same problem devDrag.js's `_devDragShiftEntry`
// already solves one-off for "the gate moved, so re-derive the pasture
// fence's gate-linked joint".
//
// DELETING A LINK TARGET (#397): a mid-point currently linked to by one or
// more other routes' endpoints can still be double-tap-deleted (#394) like
// any other interior point — `_detachLinkDependents` (called from
// splineDrag.js's `_splineDeleteNode` just before the splice) finds every
// endpoint currently fused to that exact point and gives each one back its
// own independent copy at the point's CURRENT position first, so the delete
// can't leave a dangling shared reference. The dependent route's end simply
// becomes unlinked, sitting right where it already was.
//
// KNOWN LIMITATION: `_resetSplines()` (splineDrag.js) rebuilds a spline's
// whole point array from its one-time `orig` snapshot, which replaces every
// linked point with a fresh, no-longer-shared copy — same as it already
// does to a closed loop's self-link (which resetSplines re-fixes
// explicitly). A cross-spline (or self-mid) link isn't re-fixed the same
// way; "reset to source" silently drops the link (positions still reset
// correctly, just no longer fused). Acceptable for a session-only dev tool —
// re-tap to re-link. Fence joints have no equivalent reset today, so this
// doesn't apply to fence-fence links.

const LINK_R = 150; // world px: how far a tap-linked endpoint may search for its nearest
                     // eligible link target — roughly 1.5x the fence's post spacing, so a
                     // run dragged up close to another one is caught but a stray endpoint
                     // clear across the map isn't.

const endpointXY = (v) => (Array.isArray(v) ? [v[0], v[1]] : [v.x, v.y]);
const cloneEndpointValue = (v) => (Array.isArray(v) ? [v[0], v[1]] : { ...v });

export const WithEndpointLink = (Base) => class extends Base {
  // Every linkable ENDPOINT, freshly derived from current state (fence joint
  // lists and `this._splines` are both already the LIVE arrays the rest of
  // the drag tool mutates, so nothing here needs its own cache/lifecycle).
  // This is the pool of things a tap can TOGGLE — always index 0 or
  // length-1, never an interior point.
  _collectLinkEndpoints() {
    const out = [];
    const fenceSpecs = [
      { joints: this._fenceJoints?.(), onChange: () => this._respaceHouseFenceFromJoints?.(), label: 'house fence' },
      { joints: this._pastureJoints?.(), onChange: () => this._respacePastureFenceFromJoints?.(), label: 'pasture fence' },
    ];
    for (const spec of fenceSpecs) {
      const joints = spec.joints;
      if (!joints || joints.length < 2) continue;
      out.push({ category: 'fence', arr: joints, index: 0, onChange: spec.onChange, label: `${spec.label} start` });
      out.push({ category: 'fence', arr: joints, index: joints.length - 1, onChange: spec.onChange, label: `${spec.label} end` });
    }
    for (const spline of this._splines ?? []) {
      const pts = spline.points;
      if (!pts || pts.length < 2) continue;
      const category = spline.id === 'stream' ? 'stream' : 'path';
      out.push({ category, arr: pts, index: 0, onChange: spline.onChange, label: `${spline.label} start` });
      out.push({ category, arr: pts, index: pts.length - 1, onChange: spline.onChange, label: `${spline.label} end` });
    }
    return out;
  }

  // #397: every point (endpoints AND interior waypoints alike) on every
  // PATH/STREAM route — the pool of things an endpoint may link TO. Fences
  // are deliberately excluded here (they stay endpoint-only, see
  // `_linkCandidatePool`). Not cheap to call on every pointer move, but only
  // ever called on a plain tap/drop/delete (not per-frame), and the LINK_R
  // proximity check below still bounds the search to a small neighbourhood
  // in practice — a hand-rolled spatial index would be over-engineering for
  // a dev-only tool with a handful of routes.
  _collectLinkTargets() {
    const out = [];
    for (const spline of this._splines ?? []) {
      const pts = spline.points;
      if (!pts || pts.length < 1) continue;
      const category = spline.id === 'stream' ? 'stream' : 'path';
      pts.forEach((_, index) => {
        const label = index === 0 ? `${spline.label} start`
          : index === pts.length - 1 ? `${spline.label} end`
          : `${spline.label} point ${index + 1}`;
        out.push({ category, arr: pts, index, onChange: spline.onChange, label });
      });
    }
    return out;
  }

  // The full candidate pool for a link involving `category` — fences stay
  // endpoint-only (own-array entries excluded entirely, see
  // `_toggleEndpointLink`); path/stream get every point on every route in
  // that category, mid-points included (#397).
  _linkCandidatePool(category) {
    if (category === 'fence') return this._collectLinkEndpoints().filter((e) => e.category === 'fence');
    return this._collectLinkTargets().filter((e) => e.category === category);
  }

  // Given the array a joint/point was picked from and its resolved index,
  // returns the matching ENDPOINT descriptor — null if that index isn't
  // actually a RUN endpoint (index 0 or length-1), since only true endpoints
  // are ever tap-toggleable (an interior joint/point can be a link TARGET,
  // #397, but never the thing a tap picks up directly). Called from
  // devDrag.js right after a plain tap (never dragged) resolves to a
  // joint/point index.
  _findLinkEndpoint(arr, index) {
    if (!arr || (index !== 0 && index !== arr.length - 1)) return null;
    return this._collectLinkEndpoints().find((e) => e.arr === arr && e.index === index) ?? null;
  }

  // The other point currently fused to `ep` (reference equality against
  // `ep.arr[ep.index]`), if any — no separate link records to go stale.
  // Covers a cross-route fusion, a route fused to its OWN far end (a closed
  // loop, #393), and a route fused to its OWN interior (#397) identically —
  // all three are just "some other pool entry holds the same reference".
  _linkedPartner(ep, pool = this._linkCandidatePool(ep.category)) {
    const mine = ep.arr[ep.index];
    return pool.find((o) => !(o.arr === ep.arr && o.index === ep.index) && o.arr[o.index] === mine) ?? null;
  }

  // Tap-toggle (mirrors the gate-link gesture): already linked → unlink
  // (give this endpoint back its own independent copy at its current
  // position); otherwise link to the NEAREST eligible target within LINK_R —
  // another route's endpoint or mid-point, or (path/stream only) a point on
  // THIS route itself (its own far end closes a loop like #393 always did;
  // any other own point branches back into its own interior, #397). Returns
  // a small result object for the caller to turn into a HUD message.
  _toggleEndpointLink(ep) {
    const pool = this._linkCandidatePool(ep.category);
    const idx = ep.index;
    const cur = ep.arr[idx];
    const partner = this._linkedPartner(ep, pool);
    if (partner) {
      const selfLoop = partner.arr === ep.arr;
      const selfEnd = selfLoop && (partner.index === 0 || partner.index === partner.arr.length - 1);
      ep.arr[idx] = cloneEndpointValue(cur);
      ep.onChange?.();
      return { linked: false, unlinked: true, selfLoop, selfEnd, label: partner.label };
    }
    let best = null, bestD = LINK_R;
    const [ex, ey] = endpointXY(cur);
    for (const other of pool) {
      if (other.arr === ep.arr) {
        // Fences never link to themselves (they never loop); path/stream
        // may link to any OTHER point on their own route (#393's far-end
        // loop close, generalized by #397 to any interior point too) — just
        // never to the exact same slot.
        if (ep.category === 'fence') continue;
        if (other.index === idx) continue;
      } else if (other.category !== ep.category) continue;
      const [ox, oy] = endpointXY(other.arr[other.index]);
      const d = Math.hypot(ox - ex, oy - ey);
      if (d < bestD) { bestD = d; best = other; }
    }
    if (!best) return { linked: false };
    const selfLoop = best.arr === ep.arr;
    const selfEnd = selfLoop && (best.index === 0 || best.index === best.arr.length - 1);
    ep.arr[idx] = best.arr[best.index]; // FUSE: same reference from here on
    ep.onChange?.();
    if (!selfLoop) best.onChange?.(); // same route — one onChange covers both sides
    return { linked: true, selfLoop, selfEnd, label: best.label };
  }

  // Called from devDrag.js's `_devDragMove` right after moving a fence
  // joint or spline point that turns out to have one or more dependents
  // fused to it — reruns EVERY dependent's own onChange (rails/posts/
  // collision refit, path re-bake, or stream re-derive) so every fused
  // point redraws together, not just the one actually dragged. A mid-point
  // can have several independent dependents at once (#397); this walks all
  // of them, not just the first match. Points on the SAME route as the one
  // just dragged are skipped — that route's own move handler already ran
  // its own onChange for this drag tick (covers a self-loop/self-branch
  // moving its own far end/mid-point too).
  _syncLinkedEndpoint(arr, index) {
    if (!arr || index == null || index < 0 || index >= arr.length) return;
    const value = arr[index];
    const houseJoints = this._fenceJoints?.();
    const pastureJoints = this._pastureJoints?.();
    let pool;
    if (arr === houseJoints || arr === pastureJoints) {
      pool = this._linkCandidatePool('fence');
    } else {
      const spline = this._splines?.find((s) => s.points === arr);
      if (!spline) return;
      pool = this._linkCandidatePool(spline.id === 'stream' ? 'stream' : 'path');
    }
    for (const partner of pool) {
      if (partner.arr === arr) continue; // same route, already handled this tick
      if (partner.arr[partner.index] === value) partner.onChange?.();
    }
  }

  // #397: called from splineDrag.js's `_splineDeleteNode` just before an
  // interior path/stream point is spliced out — finds every OTHER point
  // (any route, any index, including more than one) currently fused to this
  // exact one and gives each an independent copy at the point's current
  // position, so the delete can't leave a dangling shared reference. A
  // point with no dependents is a no-op.
  _detachLinkDependents(arr, index) {
    if (!arr || index == null || index < 0 || index >= arr.length) return;
    const value = arr[index];
    const spline = this._splines?.find((s) => s.points === arr);
    if (!spline) return;
    const pool = this._linkCandidatePool(spline.id === 'stream' ? 'stream' : 'path');
    for (const partner of pool) {
      if (partner.arr === arr) continue; // the route the point is being deleted from
      if (partner.arr[partner.index] === value) {
        partner.arr[partner.index] = cloneEndpointValue(value);
        partner.onChange?.();
      }
    }
  }
};
