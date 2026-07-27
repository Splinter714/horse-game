// House fence line geometry (#344, reworked #372, oriented-rect #387) — pure,
// no Phaser, so it can be unit-tested (kept pure even though this repo
// dropped its test runner 2026-07-27, matching houseFencePath.js's
// `respaceHouseFence`).
//
// The fence posts near the house are tracked prop records (#329) that the dev
// drag tool can reposition individually, as a #337 group, or (#370) by dragging
// the whole run's start/end endpoint. Their collision used to be a hardcoded rect
// matching where they originally sat, so relocating the run left an invisible
// fence behind at the old spot; later (#372) it became a single bounding box over
// every post's live x/y.
//
// #372 playtest follow-up: a single box spanning the run's full x/y extent
// over-covers near the ends/corners of any diagonal run (you'd feel a collision
// block a bit before/after the visible fence line) — the box's corners stick out
// past the actual (thin, angled) rail. #372 fixed that down to one axis-aligned
// tight rect PER POST-TO-POST SPAN, hugging just that segment's own bounding box.
//
// #387 follow-up: even one ~96px span's axis-aligned box still sticks its
// corners out past a diagonal rail. Rather than chaining several small
// axis-aligned boxes (a stopgap considered and dropped — the owner asked for
// the rect itself to be oriented along the rail instead), each span is now a
// single true ORIENTED rect (OBB): centered on the segment's midpoint, sized to
// the segment's own length × the collision band thickness, and rotated to the
// segment's actual angle. `world.js`'s shared `_hits()` circle-vs-rect check
// was extended to understand an optional `angle` field (rotating the query
// point into the rect's local frame) — see its comment for the maths. A rect
// with no `angle` behaves exactly as before (plain corner-based AABB); these
// fence rects are the only thing in the game that sets one.

/**
 * One post-to-post span's collision as a single rect oriented along the
 * segment (an OBB), rather than an axis-aligned box that over-covers a
 * diagonal run. `x`/`y` are the rect's CENTER (not a corner, unlike a plain
 * obstacle rect) — see world.js's `_hits()`.
 * @param {{x:number,y:number}} a
 * @param {{x:number,y:number}} b
 * @param {number} band collision thickness across the rail
 * @returns {{x:number,y:number,w:number,h:number,angle:number}}
 */
export function houseFenceSegmentRect(a, b, band) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    w: len,
    h: band,
    angle: Math.atan2(dy, dx),
  };
}

/** One oriented rect per post-to-post span in the run.
 * @param {{x:number,y:number}[]} posts */
export function houseFenceSegmentRects(posts, band) {
  if (!posts || posts.length < 2) return [];
  const rects = [];
  for (let i = 0; i < posts.length - 1; i++) {
    rects.push(houseFenceSegmentRect(posts[i], posts[i + 1], band));
  }
  return rects;
}

// #376: the pasture-perimeter fence reuses the same oriented-rect approach.
// Unlike the old axis-aligned versions, an oriented rect naturally handles a
// pure-vertical span (the left/right perimeter walls) the same way as any
// other angle, so — unlike before #387 — the house-fence and pasture-fence
// rect maths no longer need to differ; this is kept as a separate exported
// name (rather than just re-exporting `houseFenceSegmentRect`) so callers can
// keep referring to "the pasture fence's rect fn" explicitly, matching the
// rest of the file's naming.
export function perimeterFenceSegmentRect(a, b, band) {
  return houseFenceSegmentRect(a, b, band);
}

/** @param {{x:number,y:number}[]} posts */
export function perimeterFenceSegmentRects(posts, band) {
  if (!posts || posts.length < 2) return [];
  const rects = [];
  for (let i = 0; i < posts.length - 1; i++) {
    rects.push(perimeterFenceSegmentRect(posts[i], posts[i + 1], band));
  }
  return rects;
}
