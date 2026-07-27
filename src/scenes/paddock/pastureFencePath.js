// Dev tool: pasture-perimeter fence joint/segment editing (#376) — converts the
// pasture's perimeter fence to the SAME bendable-joint model #375 built for the
// house fence (houseFencePath.js), extended for a #376 wrinkle the house fence
// doesn't have: a GATE in the middle of the run whose two flanking joints must
// track the gate object if it's ever repositioned.
//
// WHY NOT A DROP-IN REUSE of houseFencePath.js: `respaceHouseFence` (the pure
// "how many posts fit at spacing, evenly spread" maths) is genuinely generic —
// reused as-is below. But everything else about the pasture fence's ART is
// different (#372's own investigation, confirmed again in #376): the house
// fence crops every post to just its post column and draws two separate
// continuous rail LINES across the whole run; the pasture fence's 'fence' tile
// is drawn WHOLE (post + baked-in rail) and stepped at HALF its own rendered
// width so consecutive tiles overlap ~50% and the rail reads as continuous —
// no separate rail Graphics, but every post has to be individually ROTATED to
// match its own segment's angle (the house fence's posts stay unrotated since
// its rail is a separate line, not baked per-tile). So this file builds its own
// `buildPastureFencePosts`/`_fillPastureFencePosts`/etc., following the SAME
// PATTERN as houseFencePath.js (joint list → per-segment respace → flat post
// list → promote-on-drag → per-segment collision) rather than sharing code that
// isn't actually shared between the two fences' art.
//
// LOOP SHAPE (#376 decided scope: "one continuous bendable loop... any point
// along any side, including original corners, can become a bend point"): the
// joint list is one OPEN polyline that starts at one side of the gate opening
// and runs the long way around the perimeter (corner → corner → corner →
// corner) back to the other side of the gate opening. It isn't a mathematically
// CLOSED ring — there's no fence segment across the gate gap itself, the gate
// object fills that visually — but every original corner, plus the gate's own
// two flanking points, is a joint that can be dragged/bent like any other,
// which is what "continuous bendable loop" means from the owner's side: the
// whole perimeter reshapes as one connected thing, not four independent walls
// with fixed corners.
//
// GATE LINKING (#376 decided: "follows if the gate moves"): the two joints
// flanking the gate opening carry a `gateLink: 'left' | 'right'` tag instead of
// a plain fixed {x,y}. `_applyPastureGateLinks` re-derives BOTH joints' actual
// position from `this.props.gate`'s CURRENT x/y (at a fixed half-gate-width
// offset) every time, BEFORE the per-segment respace math runs — so the fence
// ends stay glued to the gate permanently, not just snapped once at placement.
// One consequence worth flagging (not spelled out in the issue): because the
// link is re-applied on every respace, a gate-linked joint can't be
// independently dragged away from the gate — any manual drag on it snaps back
// to the gate-derived position on the very next respace. That's the simplest,
// least-surprising reading of "follows if the gate moves" (the link is a
// standing constraint, not a one-time default); the alternative — letting a
// drag "detach" the joint from the gate — was more work for an ambiguous
// benefit and is flagged as the alternative in the issue-comment summary.
//
// This extends the SAME #330 dev-drag-tool lifecycle houseFencePath.js does —
// see that file's header for the shared mount/tap/move/drop machinery this
// hangs off of (devDrag.js calls `_mountPastureFencePath`/`_clearPastureFencePath`
// alongside their house-fence counterparts).

import { S, PASTURE_FENCE_SPACING, GATE_HALF_W } from './constants.js';
import { respaceHouseFence } from './houseFencePath.js';

const SPACING      = PASTURE_FENCE_SPACING; // world px between posts — half the rendered tile width (50% overlap)
const POST_PICK_R  = 40;       // world px: how close a tap must be to grab ANY post (joint or auto-fill)
const MARK_DEPTH   = 9504;     // above the house-fence joint marks (9503) so both are visible at once
const HANDLE_COLOR = 0x59c8ff; // blue — distinct from the house fence's magenta and the spline tool's colors
const HANDLE_R     = 12;       // drawn radius of the joint marker, world px

// Pure (#376): the full ordered post list for a pasture-fence JOINT polyline —
// one `respaceHouseFence` call per segment, stitched together without
// double-counting the post shared at each segment boundary, same structure as
// houseFencePath.js's `buildHouseFencePosts`. The one addition: every post
// carries the ANGLE of the segment it was generated from (a shared joint post
// takes the angle of the segment it's the END of, i.e. the incoming segment) —
// the house fence doesn't need this since its posts are always drawn unrotated.
export function buildPastureFencePosts(joints, spacing = SPACING) {
  if (!joints || joints.length < 2) return [];
  const posts = [];
  for (let i = 0; i < joints.length - 1; i++) {
    const a = joints[i], b = joints[i + 1];
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const segPosts = respaceHouseFence(a, b, spacing);
    segPosts.forEach((p, j) => {
      const isStart = j === 0;
      const isEnd   = j === segPosts.length - 1;
      if (i > 0 && isStart) return; // shared joint post — already pushed by the previous segment
      const rec = { x: p.x, y: p.y, angle };
      if (isStart) rec.jointIndex = i;
      else if (isEnd) rec.jointIndex = i + 1;
      else rec.segIndex = i;
      posts.push(rec);
    });
  }
  return posts;
}

export const WithPastureFencePath = (Base) => class extends Base {
  // Called from devDrag.js's `_mountDevDrag` once `this.props.pastureFence` exists.
  _mountPastureFencePath() {
    this._pastureJointMarks = this.add.graphics().setDepth(MARK_DEPTH);
    this._pastureJointHeld  = null; // { pending: post } | { index } | null
    this._drawPastureFenceJoints();
  }

  // Called from devDrag.js's `_clearDevDrag`.
  _clearPastureFencePath() {
    this._pastureJointMarks?.destroy();
    this._pastureJointMarks = null;
    this._pastureJointHeld  = null;
  }

  _pasturePosts()  { return this.props.pastureFence ?? []; }
  _pastureJoints() { return this.props.pastureFenceJoints ?? []; }

  // #376 gate link: re-derive the position of any `gateLink`-tagged joint from
  // `this.props.gate`'s CURRENT x/y, before the segment respace maths below
  // consumes the joint list. Called on every respace (including the initial
  // build in world.js), so the two fence ends track the gate permanently.
  _applyPastureGateLinks(joints) {
    const gate = this.props.gate;
    if (!gate) return;
    for (const j of joints) {
      if (j.gateLink === 'left')  { j.x = gate.x - GATE_HALF_W; j.y = gate.y; }
      if (j.gateLink === 'right') { j.x = gate.x + GATE_HALF_W; j.y = gate.y; }
    }
  }

  // One whole tile per post (post + baked-in rail), rotated to the segment's
  // angle — unlike the house fence's cropped cap/body split, there's nothing to
  // draw separately here since the rail art is part of the same tile.
  _buildPastureFencePostSprite(x, y, angle) {
    return this.add.image(x, y, 'fence').setScale(S).setOrigin(0.5, 0.5)
      .setRotation(angle).setDepth(y);
  }

  _destroyPastureFencePostSprite(post) {
    post.sprite?.destroy();
  }

  // Build every post for `joints` and push them onto `this.props.pastureFence`
  // (assumed already emptied by the caller — world.js's initial build and
  // `_respacePastureFenceFromJoints` below, the only two callers).
  _fillPastureFencePosts(joints) {
    const posts = this.props.pastureFence;
    const specs = buildPastureFencePosts(joints, SPACING);
    specs.forEach((p, i) => {
      const sprite = this._buildPastureFencePostSprite(p.x, p.y, p.angle);
      posts.push({
        x: p.x, y: p.y, angle: p.angle, sprite, label: `Pasture Fence Post ${i + 1}`,
        jointIndex: p.jointIndex, segIndex: p.segIndex,
      });
    });
  }

  // Same "first refusal" pick as houseFencePath.js's `_houseFencePathTap` —
  // called from devDrag.js's `_devDragTap` in WORLD space.
  _pastureFencePathTap(w) {
    const posts = this._pasturePosts();
    let best = null, bestD = POST_PICK_R;
    for (const p of posts) {
      const d = Math.hypot(p.x - w.x, p.y - w.y);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best ? { pending: best } : null;
  }

  // Same promote-on-first-real-move semantics as `_houseFenceResolveJoint`.
  _pastureFenceResolveJoint(held) {
    if (!held || held.index !== undefined) return held;
    const post = held.pending;
    if (post.jointIndex !== undefined) return { index: post.jointIndex };
    const joints = this._pastureJoints();
    const idx = post.segIndex + 1;
    joints.splice(idx, 0, { x: post.x, y: post.y });
    this._respacePastureFenceFromJoints();
    return { index: idx };
  }

  // Called on every tick while a pasture-fence joint is held. A gate-linked
  // joint's x/y gets written here like any other, but `_respacePastureFenceFromJoints`
  // immediately re-derives it from the gate right after — see the file header
  // re: gate-linked joints not being independently draggable.
  _pastureFencePathMove(jointIndex, w) {
    const joints = this._pastureJoints();
    if (!joints[jointIndex]) return;
    joints[jointIndex].x = w.x;
    joints[jointIndex].y = w.y;
    this._respacePastureFenceFromJoints();
    this._dragHud?.setText(
      `Pasture fence: ${this._pasturePosts().length} posts (dragging joint ${jointIndex + 1}/${joints.length})`);
  }

  // Destroy/recreate every post sprite for the current joint list (after first
  // re-deriving any gate-linked joint's position), refit collision, and
  // refresh the drag tool's stale object references — mirrors
  // `_respaceHouseFenceFromJoints` exactly, see that function's comments for
  // why a full re-mount isn't used here.
  _respacePastureFenceFromJoints() {
    const posts = this._pasturePosts();
    if (!posts.length) return;
    const joints = this._pastureJoints();
    this._applyPastureGateLinks(joints);
    for (const p of posts) this._destroyPastureFencePostSprite(p);
    posts.length = 0;
    this._fillPastureFencePosts(joints);
    this.refitPastureFence?.();
    this._refreshDragEntries?.();
    this._drawPastureFenceJoints();
  }

  _drawPastureFenceJoints() {
    const g = this._pastureJointMarks;
    if (!g) return;
    g.clear();
    const joints = this._pastureJoints();
    joints.forEach((p, i) => {
      const held = this._pastureJointHeld?.index === i;
      g.fillStyle(HANDLE_COLOR, held ? 0.45 : 0.25);
      g.fillCircle(p.x, p.y, HANDLE_R);
      g.lineStyle(2, HANDLE_COLOR, held ? 1 : 0.85);
      g.strokeCircle(p.x, p.y, HANDLE_R);
    });
  }

  // The current joint list (rounded) + post count, for the #330-style export —
  // bakeable into world.js's `buildPastureFence`. Null while there's no fence.
  _pastureFenceExport() {
    const joints = this._pastureJoints();
    const posts  = this._pasturePosts();
    if (joints.length < 2 || posts.length < 2) return null;
    return {
      joints: joints.map(j => ({ x: Math.round(j.x), y: Math.round(j.y), ...(j.gateLink ? { gateLink: j.gateLink } : {}) })),
      count: posts.length,
    };
  }
};
