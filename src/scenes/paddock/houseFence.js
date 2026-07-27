// House fence line geometry (#344, reworked #372) — pure, no Phaser, so it can be
// unit-tested (kept pure even though this repo dropped its test runner
// 2026-07-27, matching houseFencePath.js's `respaceHouseFence`).
//
// The fence posts near the house are tracked prop records (#329) that the dev
// drag tool can reposition individually, as a #337 group, or (#370) by dragging
// the whole run's start/end endpoint. Their collision used to be a hardcoded rect
// matching where they originally sat, so relocating the run left an invisible
// fence behind at the old spot; later (#372) it became a single bounding box over
// every post's live x/y instead.
//
// #372 playtest follow-up: a single box spanning the run's full x/y extent
// over-covers near the ends/corners of any diagonal run (you'd feel a collision
// block a bit before/after the visible fence line) — the box's corners stick out
// past the actual (thin, angled) rail. This instead returns one tight rect PER
// POST-TO-POST SPAN, hugging just that segment's own bounding box — a "thick
// line" rather than one box over the whole run. Still axis-aligned (not a true
// rotated rect/OBB): the existing collision system (`_hits`/`_collides` in
// world.js) is AABB-vs-circle per obstacle for every obstacle in the game, and
// splitting into several tighter segment boxes fits that shape with no changes
// there, vs. reworking the shared system for a genuine OBB. A single segment
// (post-to-post pair) is still nearly as diagonal as the box was, but each one
// only spans ~96px instead of the whole run, so the over-coverage shrinks to
// "near this one segment's ends" rather than "near the whole run's ends" — and a
// horizontal or near-horizontal run (the common case) is unaffected either way.

/** One tight AABB around the segment between two adjacent posts. */
export function houseFenceSegmentRect(a, b, band) {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y) - band / 2;
  return { x, y, w: Math.max(a.x, b.x) - x, h: Math.max(a.y, b.y) + band / 2 - y };
}

/** @param {{x:number,y:number}[]} posts */
export function houseFenceSegmentRects(posts, band) {
  if (!posts || posts.length < 2) return [];
  const rects = [];
  for (let i = 0; i < posts.length - 1; i++) {
    rects.push(houseFenceSegmentRect(posts[i], posts[i + 1], band));
  }
  return rects;
}

// #376: the pasture-perimeter fence reuses this same "one AABB per post-to-post
// span" approach, but — unlike the house fence — its segments are NOT always
// near-horizontal (the left/right perimeter walls are pure vertical runs, and a
// promoted/dragged joint could make any segment diagonal). `houseFenceSegmentRect`
// above only pads in Y (fine for a near-horizontal run; a pure-vertical one would
// collapse to zero width), so this pads by `band/2` on BOTH axes instead. That
// costs a touch more corner over-coverage on a horizontal span than the
// house-fence version, which is why this is a separate function rather than a
// change to the tuned one above.
export function perimeterFenceSegmentRect(a, b, band) {
  const x = Math.min(a.x, b.x) - band / 2, y = Math.min(a.y, b.y) - band / 2;
  return { x, y, w: Math.max(a.x, b.x) - x + band / 2, h: Math.max(a.y, b.y) - y + band / 2 };
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
