// House fence line geometry (#344) — pure, no Phaser, so it can be unit-tested.
//
// The six fence posts near the house are tracked prop records (#329) that the dev
// drag tool can reposition individually or as a #337 group. Their collision used to
// be a hardcoded rect matching where they originally sat, so relocating the run left
// an invisible fence behind at the old spot. This derives the band from wherever the
// posts actually are instead.
//
// Each post draws the 'fence' rail with origin (0, 0.5): the rail extends RIGHT from
// the post's x, and is vertically centred on its y. So the span runs from the
// leftmost post's x to the rightmost post's x plus one segment width, and the band is
// `band` tall around the posts' y (min/max, so a post nudged out of line is still
// covered rather than being left with a gap you can walk through).

/** @param {{x:number,y:number}[]} posts */
export function houseFenceRect(posts, segW, band) {
  if (!posts?.length) return null;
  const xs = posts.map((p) => p.x), ys = posts.map((p) => p.y);
  const x = Math.min(...xs), y = Math.min(...ys) - band / 2;
  return { x, y, w: Math.max(...xs) + segW - x, h: Math.max(...ys) + band / 2 - y };
}
