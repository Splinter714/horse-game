// Dev tool: house-fence PATH editing (#370, reworked into a bendable polyline
// by #375) — drag the run's start/end posts to respace the whole fence, and
// (#375) drag any individual #330-style per-post grab point to PROMOTE that
// post into a permanent joint, bending the fence around it.
//
// This extends #330 (devDrag.js) rather than duplicating its gesture/export
// machinery: it hangs off the SAME `dragObjects` on/off toggle and the SAME
// mount/clear lifecycle — devDrag.js's `_mountDevDrag`/`_clearDevDrag` call
// `_mountHouseFencePath`/`_clearHouseFencePath` below, and its
// `_devDragTap`/`_devDragMove`/`_devDragDrop` check the fence posts here
// BEFORE falling through to the generic per-post pick. One toggle, no new
// pause-menu row.
//
// #375 DATA MODEL: the fence is no longer a single `{start, end}` straight
// run. It's an ordered list of JOINTS — `this.props.houseFenceJoints`, always
// at least `[start, end]` — with each consecutive pair a straight SEGMENT.
// `respaceHouseFence` (pure, below) still does the same "how many posts fit
// at ~96px spacing" maths it always did, just called once PER SEGMENT instead
// of once for the whole run; `buildHouseFencePosts` (also pure) stitches every
// segment's posts into the one flat ordered list the rest of the game reads
// (`this.props.houseFence`) — without double-counting the post shared at each
// segment boundary (a joint). Every post in that flat list carries either a
// `jointIndex` (it IS one of the joints) or a `segIndex` (it's an auto-filled
// interior post belonging to that segment, between joints[segIndex] and
// joints[segIndex+1]).
//
// PROMOTION: dragging an existing JOINT (including the original start/end)
// just moves that joint and re-respaces its one or two adjacent segments.
// Dragging an auto-filled INTERIOR post inserts a brand new joint at that
// post's position (splitting its segment into two), then continues the drag
// as a joint-drag from then on — see `_houseFenceResolveJoint`. Promotion is
// deferred until the press actually becomes a drag (past TAP_SLOP in
// devDrag.js), not on the initial tap, so a stray tap on a middle post
// doesn't silently plant a permanent joint there.
//
// `_respaceHouseFenceFromJoints` destroys/recreates the post sprites and
// mutates `this.props.houseFence` IN PLACE (same array object, not a new
// one) so:
//   - the collision segments (`_houseFenceObstacles`/`houseFenceSegmentRects`,
//     houseFence.js) keep following it — each rect's `ownGroup` was captured
//     against this array reference (world.js), so `refitHouseFence()` (also
//     world.js) still finds and rebuilds them after the post count changes, not
//     just after a post moves. `houseFenceSegmentRects` walks the flat post
//     list pairwise, so it needs no change for the polyline case — the shared
//     joint post at a segment boundary appears once, so consecutive pairs
//     still describe exactly the visible segment spans, corners included.
//   - `_devLabelTargets()` (devLabels.js, which devDrag.js's object list is
//     derived from) still enumerates the run correctly next time drag mode is
//     remounted.
//
// Joint handles are drawn as filled magenta circles — visually distinct from
// the #330 per-post amber/green squares — so "grab a joint" reads as a
// different gesture from "grab this auto-filled post" even though both live
// on the same fence line, and every joint (not just the run's ends) gets one.
//
// PASTURE-FENCE / WORN-PATH FOLLOW-UP (explicitly deferred by #370, not built
// here, and still out of scope for #375's polyline rework too): `buildHouseFencePosts`/
// `respaceHouseFence` take plain `{x,y}` points and spacing and return plain
// `{x,y}` records — nothing about the maths is house-fence-specific, so a
// future pass can reuse it wholesale. What ISN'T generic and would need real
// rework: the sprite lifecycle here (texture key `'fence'`, origin (0, 0.5),
// scale `S`, post labelling/splitting) is hardcoded to the house fence's own
// art/rotation, the pasture perimeter isn't a single run (it's four sides
// around a rectangle with a gate gap), and worn paths (`buildPath()`, purely
// cosmetic, no posts/objects at all) have no per-segment sprites to
// destroy/recreate in the first place.

import { S, FENCE_TEX_H, FENCE_POST_CROP_W, FENCE_POST_TOP_SPLIT_Y } from './constants.js';

const SPACING      = 96;      // world px between posts — matches the fence's original fixed spacing
const POST_PICK_R  = 40;      // world px: how close a tap must be to grab ANY post (joint or auto-fill)
const MARK_DEPTH   = 9503;    // above the #330 per-post drag marks (devDrag.js's MARK_DEPTH)
const HANDLE_COLOR = 0xff59e0; // magenta — distinct from the amber (unmoved) / green (moved) post squares
const HANDLE_R     = 12;      // drawn radius of the joint marker, world px

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

// Pure (#375): the full ordered post list for a JOINT polyline — one
// `respaceHouseFence` call per segment (joints[i] → joints[i+1]), stitched
// together without double-counting the post shared at each segment boundary.
// Every post is tagged with either `jointIndex` (it IS joints[jointIndex]) or
// `segIndex` (it's an auto-filled interior post of segment `segIndex`, i.e.
// between joints[segIndex] and joints[segIndex+1]) — `_houseFenceResolveJoint`
// below reads this to know where a promoted post's new joint gets inserted.
export function buildHouseFencePosts(joints, spacing = SPACING) {
  if (!joints || joints.length < 2) return [];
  const posts = [];
  for (let i = 0; i < joints.length - 1; i++) {
    const segPosts = respaceHouseFence(joints[i], joints[i + 1], spacing);
    segPosts.forEach((p, j) => {
      const isStart = j === 0;
      const isEnd   = j === segPosts.length - 1;
      if (i > 0 && isStart) return; // shared joint post — already pushed by the previous segment
      const rec = { x: p.x, y: p.y };
      if (isStart) rec.jointIndex = i;
      else if (isEnd) rec.jointIndex = i + 1;
      else rec.segIndex = i;
      posts.push(rec);
    });
  }
  return posts;
}

export const WithHouseFencePath = (Base) => class extends Base {
  // Called from devDrag.js's `_mountDevDrag` once `this.props.houseFence` exists.
  _mountHouseFencePath() {
    this._fenceJointMarks = this.add.graphics().setDepth(MARK_DEPTH);
    this._fenceJointHeld  = null; // { pending: post } | { index } | null — see _houseFenceResolveJoint
    this._drawFenceJoints();
  }

  // Called from devDrag.js's `_clearDevDrag`.
  _clearHouseFencePath() {
    this._fenceJointMarks?.destroy();
    this._fenceJointMarks = null;
    this._fenceJointHeld  = null;
  }

  _fencePosts()  { return this.props.houseFence ?? []; }
  _fenceJoints() { return this.props.houseFenceJoints ?? []; }

  // Average joint y — the single depth every rail line (and, offset ±1, every
  // post's cap/body split) is drawn at. A plain average rather than per-post
  // because the rails live in ONE Graphics object spanning every segment.
  _houseFenceRailDepth(joints) {
    if (!joints?.length) return 0;
    return joints.reduce((s, j) => s + j.y, 0) / joints.length;
  }

  // The two split sprites for one post (#375 owner ask): a cap (above the top
  // rail's centerline) drawn IN FRONT of the rail Graphics, and a body (the
  // rest, including where the bottom rail crosses it) drawn BEHIND it. Depths
  // are rail-relative (±1), not the post's own y, so the split holds
  // regardless of where this post falls along a diagonal segment.
  _buildHouseFencePostSprites(x, y, railDepth) {
    const topSprite = this.add.image(x, y, 'fence').setScale(S).setOrigin(0, 0.5)
      .setDepth(railDepth + 1)
      .setCrop(0, 0, FENCE_POST_CROP_W, FENCE_POST_TOP_SPLIT_Y);
    const bottomSprite = this.add.image(x, y, 'fence').setScale(S).setOrigin(0, 0.5)
      .setDepth(railDepth - 1)
      .setCrop(0, FENCE_POST_TOP_SPLIT_Y, FENCE_POST_CROP_W, FENCE_TEX_H - FENCE_POST_TOP_SPLIT_Y);
    return { topSprite, bottomSprite };
  }

  _destroyHouseFencePostSprites(post) {
    post.topSprite?.destroy();
    post.bottomSprite?.destroy();
    post.sprite?.destroy(); // safety net for any pre-#375 single-sprite record
  }

  // Build every post for `joints` and push them onto `this.props.houseFence`
  // (assumed already emptied by the caller — see world.js's initial build and
  // `_respaceHouseFenceFromJoints` below, the only two callers). Shared so the
  // two never drift apart.
  _fillHouseFencePosts(joints) {
    const posts = this.props.houseFence;
    const specs = buildHouseFencePosts(joints, SPACING);
    const railDepth = this._houseFenceRailDepth(joints);
    specs.forEach((p, i) => {
      const { topSprite, bottomSprite } = this._buildHouseFencePostSprites(p.x, p.y, railDepth);
      posts.push({
        x: p.x, y: p.y, topSprite, bottomSprite, label: `Fence Post ${i + 1}`,
        jointIndex: p.jointIndex, segIndex: p.segIndex,
      });
    });
  }

  // Called from devDrag.js's `_devDragTap`, in WORLD space, BEFORE the generic
  // per-post pick — so grabbing ANY post on the fence (joint or auto-fill)
  // always means "reshape the fence", never "move this one sprite". Returns a
  // PENDING descriptor (not yet a joint) so a plain tap that never becomes a
  // drag can't silently promote an interior post — see `_houseFenceResolveJoint`.
  _houseFencePathTap(w) {
    const posts = this._fencePosts();
    let best = null, bestD = POST_PICK_R;
    for (const p of posts) {
      const d = Math.hypot(p.x - w.x, p.y - w.y);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best ? { pending: best } : null;
  }

  // Called from devDrag.js's `_devDragMove` the FIRST tick a press on a post
  // actually travels past TAP_SLOP — i.e. once it's definitely a drag, not a
  // tap. If the grabbed post is already a joint, just resolves to its index;
  // if it's an auto-filled interior post, PROMOTES it — splices a new joint
  // into `this.props.houseFenceJoints` at its current position, splitting its
  // segment into two, and re-derives the post list around the new joint.
  _houseFenceResolveJoint(held) {
    if (!held || held.index !== undefined) return held;
    const post = held.pending;
    if (post.jointIndex !== undefined) return { index: post.jointIndex };
    const joints = this._fenceJoints();
    const idx = post.segIndex + 1;
    joints.splice(idx, 0, { x: post.x, y: post.y });
    this._respaceHouseFenceFromJoints();
    return { index: idx };
  }

  // Called from devDrag.js's `_devDragMove` on every tick while a joint is held.
  _houseFencePathMove(jointIndex, w) {
    const joints = this._fenceJoints();
    if (!joints[jointIndex]) return;
    joints[jointIndex].x = w.x;
    joints[jointIndex].y = w.y;
    this._respaceHouseFenceFromJoints();
    this._dragHud?.setText(
      `House fence: ${this._fencePosts().length} posts (dragging joint ${jointIndex + 1}/${joints.length})`);
  }

  // Destroy/recreate every post sprite for the current joint list, mutating
  // `this.props.houseFence` IN PLACE (see file header for why the array object
  // itself must stay the same reference), then redraw the rails and refit
  // collision. Called after every joint move AND every promotion.
  _respaceHouseFenceFromJoints() {
    const posts = this._fencePosts();
    if (!posts.length) return;
    const joints = this._fenceJoints();
    for (const p of posts) this._destroyHouseFencePostSprites(p);
    posts.length = 0;
    this._fillHouseFencePosts(joints);
    // Redraw the rail lines for every segment — this destroys/recreates the
    // same Graphics object `_buildHouseFenceRails` built initially, so a
    // mid-drag respace (every pointermove tick) keeps the rails glued to the
    // moving joint instead of leaving a stale line behind from the old shape.
    this._buildHouseFenceRails?.(joints);
    this.refitHouseFence?.();
    // The #330 drag tool's own object snapshot (`_dragEntries`) was taken at
    // mount time and still names the OLD post objects/count — re-snapshot it so
    // the new posts are immediately pickable without toggling Drag Objects off
    // and on. A FULL _clearDevDrag()/_mountDevDrag() here (the original
    // approach) also reset `_fenceJointHeld`/`_dragHeld`/`_dragMoved` on every
    // single move tick during an active drag, silently cancelling it after the
    // first tiny move (2026-07-27 playtest) — this lighter refresh only
    // replaces the stale object references.
    this._refreshDragEntries?.();
    this._drawFenceJoints();
  }

  _drawFenceJoints() {
    const g = this._fenceJointMarks;
    if (!g) return;
    g.clear();
    const joints = this._fenceJoints();
    joints.forEach((p, i) => {
      const held = this._fenceJointHeld?.index === i;
      g.fillStyle(HANDLE_COLOR, held ? 0.45 : 0.25);
      g.fillCircle(p.x, p.y, HANDLE_R);
      g.lineStyle(2, HANDLE_COLOR, held ? 1 : 0.85);
      g.strokeCircle(p.x, p.y, HANDLE_R);
    });
  }

  // The current run's full joint list (rounded) + post count, for the #330-
  // style export — bakeable straight into world.js's house-fence build (see
  // devDrag.js's `exportDevPositions`). Null while there's no fence.
  _houseFenceExport() {
    const joints = this._fenceJoints();
    const posts  = this._fencePosts();
    if (joints.length < 2 || posts.length < 2) return null;
    return {
      joints: joints.map(j => ({ x: Math.round(j.x), y: Math.round(j.y) })),
      count: posts.length,
    };
  }
};
