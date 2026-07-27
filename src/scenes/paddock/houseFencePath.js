// Dev tool: house-fence PATH editing (#370) — drag the run's start/end posts to
// respace the whole fence, instead of dragging individual fixed posts one at a
// time (the #330 drag tool's existing behaviour, still available for a middle
// post).
//
// This extends #330 (devDrag.js) rather than duplicating its gesture/export
// machinery: it hangs off the SAME `dragObjects` on/off toggle and the SAME
// mount/clear lifecycle — devDrag.js's `_mountDevDrag`/`_clearDevDrag` call
// `_mountHouseFencePath`/`_clearHouseFencePath` below, and its
// `_devDragTap`/`_devDragMove`/`_devDragDrop` check the two endpoint handles
// here BEFORE falling through to the generic per-post pick. One toggle, no new
// pause-menu row.
//
// Dragging an endpoint recomputes the ENTIRE run: given the new start/end world
// positions, `respaceHouseFence` (pure, below) works out how many posts fit at
// ~96px spacing — the spacing the fence was originally built at, see world.js's
// `for (let i = 0; i < 6; i++) { x = -136 + i*96 }` — and evenly spaces them.
// `_respaceHouseFenceTo` then destroys/recreates the post sprites and mutates
// `this.props.houseFence` IN PLACE (same array object, not a new one) so:
//   - the collision band (`_houseFenceObstacles`/`houseFenceRect`, houseFence.js)
//     keeps following it — its `ownGroup` was captured once against this array
//     reference (world.js), so `refitHouseFence()` (also world.js) still finds it
//     after the post count changes, not just after a post moves.
//   - `_devLabelTargets()` (devLabels.js, which devDrag.js's object list is
//     derived from) still enumerates the run correctly next time drag mode is
//     remounted.
//
// Endpoint handles are drawn as filled magenta circles — visually distinct from
// the #330 per-post amber/green squares — so "grab the end of the run" reads as
// a different gesture from "grab this one post" even though both live on the
// same fence line.
//
// PASTURE-FENCE / WORN-PATH FOLLOW-UP (explicitly deferred by #370, not built
// here): `respaceHouseFence` takes a plain `{x,y}` start/end + spacing and
// returns plain `{x,y}` records — nothing about the maths is house-fence-
// specific, so a future pass can reuse it wholesale. What ISN'T generic and
// would need real rework: the sprite lifecycle here (texture key `'fence'`,
// origin `(0, 0.5)`, scale `S`, post labelling) is hardcoded to the house
// fence's own art/rotation, the pasture perimeter isn't a single straight run
// (it's four sides around a rectangle with a gate gap, so "start"/"end" would
// need to mean "corner" or the run would need splitting into per-side runs),
// and worn paths (`buildPath()`, purely cosmetic, no posts/objects at all) have
// no per-segment sprites to destroy/recreate in the first place — that part of
// a follow-up would look completely different from this file, closer to
// resampling `buildPath`'s stamp positions along a spline.

import { S, FENCE_TEX_H, FENCE_POST_CROP_W } from './constants.js';

const SPACING      = 96;      // world px between posts — matches the fence's original fixed spacing
const ENDPOINT_R   = 26;      // world px: how close a tap must be to grab an endpoint handle
const MARK_DEPTH   = 9503;    // above the #330 per-post drag marks (devDrag.js's MARK_DEPTH)
const HANDLE_COLOR = 0xff59e0; // magenta — distinct from the amber (unmoved) / green (moved) post squares
const HANDLE_R     = 12;      // drawn radius of the endpoint marker, world px

// Pure: given a desired start/end world point, how many posts fit at `spacing`
// and where they land, evenly spread along the straight line between them.
// Exported so it can be sanity-checked without Phaser, same as houseFence.js.
export function respaceHouseFence(start, end, spacing = SPACING) {
  const dist  = Math.hypot(end.x - start.x, end.y - start.y);
  const count = Math.max(2, Math.round(dist / spacing) + 1);
  const posts = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    posts.push({ x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t });
  }
  return posts;
}

export const WithHouseFencePath = (Base) => class extends Base {
  // Called from devDrag.js's `_mountDevDrag` once `this.props.houseFence` exists.
  _mountHouseFencePath() {
    this._fenceEndpointMarks = this.add.graphics().setDepth(MARK_DEPTH);
    this._fenceEndpointHeld  = null; // 'start' | 'end' | null — which handle is under the finger
    this._drawFenceEndpoints();
  }

  // Called from devDrag.js's `_clearDevDrag`.
  _clearHouseFencePath() {
    this._fenceEndpointMarks?.destroy();
    this._fenceEndpointMarks = null;
    this._fenceEndpointHeld  = null;
  }

  _fencePosts() { return this.props.houseFence ?? []; }

  _fenceEnd(which) {
    const posts = this._fencePosts();
    if (!posts.length) return null;
    return which === 'start' ? posts[0] : posts[posts.length - 1];
  }

  // Called from devDrag.js's `_devDragTap`, in WORLD space, BEFORE the generic
  // per-post pick — so grabbing right on the end of the run always means "drag
  // the endpoint", not "drag this one post". Returns 'start' | 'end' | null.
  _houseFencePathTap(w) {
    if (!this._fenceEndpointMarks) return null;
    for (const which of ['start', 'end']) {
      const p = this._fenceEnd(which);
      if (p && Math.hypot(p.x - w.x, p.y - w.y) < ENDPOINT_R) return which;
    }
    return null;
  }

  // Called from devDrag.js's `_devDragMove` while an endpoint is held.
  _houseFencePathMove(which, w) {
    const posts = this._fencePosts();
    if (!posts.length) return;
    const start = which === 'start' ? w : posts[0];
    const end   = which === 'end'   ? w : posts[posts.length - 1];
    this._respaceHouseFenceTo(start, end);
    this._dragHud?.setText(`House fence: ${this._fencePosts().length} posts (dragging ${which} endpoint)`);
  }

  // Destroy/recreate the post sprites for the new span, mutating
  // `this.props.houseFence` IN PLACE (see file header for why the array object
  // itself must stay the same reference).
  _respaceHouseFenceTo(start, end) {
    const posts = this._fencePosts();
    if (!posts.length) return;
    const specs = respaceHouseFence(start, end, SPACING);
    // #372: rotate each post to match the run's direction — the whole run is one
    // straight line between `start`/`end` (respaceHouseFence interpolates along
    // it), so a single angle for the entire run is correct, not a per-segment
    // angle. The rail's origin is (0, 0.5) (pivot at its left edge) and its
    // rendered length (48 * S = 96, see constants.js) equals SPACING exactly, so
    // a rotated rail still reaches exactly from one post to the next with no gap
    // or overlap, at any angle.
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    for (const p of posts) p.sprite?.destroy();
    posts.length = 0;
    specs.forEach((p, i) => {
      const sprite = this.add.image(p.x, p.y, 'fence').setScale(S).setDepth(p.y).setOrigin(0, 0.5).setRotation(angle);
      // #372: the LAST post is an end cap — crop off the tile's trailing rail
      // (there's no next post for it to connect to) so the run doesn't show a
      // dangling rail one segment-length past its actual end.
      if (i === specs.length - 1) sprite.setCrop(0, 0, FENCE_POST_CROP_W, FENCE_TEX_H);
      posts.push({ x: p.x, y: p.y, sprite, label: `Fence Post ${i + 1}` });
    });
    this.refitHouseFence?.();
    // The #330 drag tool's own object snapshot (`_dragEntries`) was taken at
    // mount time and still names the OLD post objects/count — re-snapshot it so
    // the new posts are immediately pickable without toggling Drag Objects off
    // and on. A FULL _clearDevDrag()/_mountDevDrag() here (the original
    // approach) also reset `_fenceEndpointHeld`/`_dragHeld`/`_dragMoved` on
    // every single move tick during an active drag, silently cancelling it
    // after the first tiny move (2026-07-27 playtest) — this lighter refresh
    // only replaces the stale object references.
    this._refreshDragEntries?.();
    this._drawFenceEndpoints();
  }

  _drawFenceEndpoints() {
    const g = this._fenceEndpointMarks;
    if (!g) return;
    g.clear();
    for (const which of ['start', 'end']) {
      const p = this._fenceEnd(which);
      if (!p) continue;
      const held = this._fenceEndpointHeld === which;
      g.fillStyle(HANDLE_COLOR, held ? 0.45 : 0.25);
      g.fillCircle(p.x, p.y, HANDLE_R);
      g.lineStyle(2, HANDLE_COLOR, held ? 1 : 0.85);
      g.strokeCircle(p.x, p.y, HANDLE_R);
    }
  }

  // The current run as `{start, end, count}` (rounded), for the #330-style
  // export — bakeable straight into world.js's `this.props.houseFence` loop
  // (see devDrag.js's `exportDevPositions`). Null while there's no fence (or
  // fewer than 2 posts, which can't happen in practice but guards the maths).
  _houseFenceExport() {
    const posts = this._fencePosts();
    if (posts.length < 2) return null;
    const start = posts[0], end = posts[posts.length - 1];
    return {
      start: { x: Math.round(start.x), y: Math.round(start.y) },
      end:   { x: Math.round(end.x),   y: Math.round(end.y) },
      count: posts.length,
    };
  }
};
