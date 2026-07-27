// Where each flock bird stands when the flock moves as a group (#328).
//
// Two group formations exist: trailing the player (chickenFollow) and waiting in a
// loose arc at the grain bin (chickenGatherAt, flock.js). Both give every bird its
// OWN fixed spot so the flock reads as a spread-out cluster rather than a single
// stacked sprite — and, just as importantly, so a bird that has reached its spot can
// stop re-pathing (it parks and pecks) without landing on top of a neighbour.
//
// The spot is chosen from a bird's flock SLOT — a small integer unique per bird.
// It used to be derived from the last character of the sprite key
// (`key.charCodeAt(key.length - 1)`), which collided across species: 'chicken0' and
// 'rooster0' both end in '0', so the white hen (chicken0 = Daisy) and the rooster
// (rooster0) computed the *identical* target spot, walked onto the same pixel and
// parked there overlapping — reading in play as the two of them stuck together
// (#328). Slots now come from the bird's position in the flock (flock.js
// `_flockSlot`), so they're unique regardless of species or key naming.

// Slots are laid out as a sunflower/phyllotaxis spiral: each next slot turns by the
// golden angle and steps out by sqrt(slot), which keeps every pair of spots at least
// ~`spread` apart no matter how many birds the flock grows to. (The old fixed-step
// arc only stayed spread out for a handful of birds — five slots round the arc and
// the sixth landed back on the first.) `squash` flattens the circle into the game's
// isometric-ish oval so the cluster reads as standing on the ground, not in a ring.
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ≈ 2.3999 rad

function spiralSpot(slot, cx, cy, spread, squash) {
  const angle = slot * GOLDEN_ANGLE;
  const r = spread * Math.sqrt(slot + 1);
  return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r * squash };
}

// Trailing spot just behind the player, fanned out by slot.
export function flockFollowSpot(slot, px, py) {
  return spiralSpot(slot, px, py + 30, 28, 0.62);
}

// Waiting spot in a loose cluster around the grain bin, fanned out by slot.
export function flockGatherSpot(slot, bx, by) {
  return spiralSpot(slot, bx, by + 20, 30, 0.62);
}
