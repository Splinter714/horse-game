// Neighbor NPC (#294) — pure relationship + trade logic. A neighbor visits
// periodically (mirroring the farm-stand customer's arrival, paddock/farmStand.js
// _spawnCustomer), but instead of buying stock, they offer to TRADE an item for gold
// AND can be GIFTED an item to build a relationship score — mirroring the bird-
// befriending shape (data/birdFriendship.js visitBird): a single incrementing
// counter, crossing thresholds unlocks something (here: better trade offers), kept
// Phaser-free and unit-tested here. The scene half (paddock/neighbor.js) owns the
// sprite/tween wiring and persistence plumbing (data/save.js loadNeighborFriendship/
// saveNeighborFriendship).
//
// Kept deliberately simple for v1 (flagged in the issue for playtest to retune):
// each gift is worth a flat point regardless of what's given (mirrors a bird visit
// being a flat tick regardless of which prop) — a future pass could weight by item
// value, but that's a balance lever, not a v1 requirement.

// Relationship score thresholds that unlock a new (better) trade tier. Three tiers
// keep the ladder readable within a play session without needing many gifts — a
// smaller ask than the bird's 5-visit-per-type befriending since there's only one
// neighbor, not several types to befriend.
export const NEIGHBOR_GIFT_THRESHOLDS = [3, 8, 15];

// Trade tiers, keyed by relationship LEVEL (0 = stranger, 1..3 = warmer). Each tier
// is the neighbor's current offer: give the player `give` (a CONTENT_DEFS key +
// qty) for `price` gold. Levels up (cheaper price / better give) as the score climbs
// past each threshold in NEIGHBOR_GIFT_THRESHOLDS — a first-pass balance ladder,
// numbers are a playtest lever, not locked in.
export const NEIGHBOR_TRADE_TIERS = [
  { level: 0, give: { content: 'apple', qty: 1 }, price: 6 },
  { level: 1, give: { content: 'apple', qty: 2 }, price: 10 },
  { level: 2, give: { content: 'carrot', qty: 3 }, price: 12 },
  { level: 3, give: { content: 'wheat', qty: 3 }, price: 12 },
];

// How many thresholds have been crossed by `score` (0..NEIGHBOR_GIFT_THRESHOLDS.length).
// Pure — just counts how many thresholds are <= score.
export function neighborLevel(score, thresholds = NEIGHBOR_GIFT_THRESHOLDS) {
  return thresholds.filter((t) => score >= t).length;
}

// The neighbor's current trade offer for a given relationship score — the tier at
// or below the current level, so an unmapped/interpolated score still resolves to
// something sensible.
export function neighborTradeOffer(score, tiers = NEIGHBOR_TRADE_TIERS, thresholds = NEIGHBOR_GIFT_THRESHOLDS) {
  const level = neighborLevel(score, thresholds);
  return tiers.find((t) => t.level === level) ?? tiers[tiers.length - 1];
}

// Pure gift step (unit-tested in ./neighbor.test.js). Given the current running
// relationship score, return the state after ONE gift:
//   { score, leveledUp }
//     score     — the running score after this gift (always +1 per gift, v1-simple)
//     leveledUp — true on the gift that crosses a NEW threshold (the commit moment,
//                 so the caller can show a little "friendship grew!" beat), false
//                 otherwise. Mirrors visitBird's `befriended` flag, generalized to
//                 multiple level-ups instead of a single one-shot commit.
export function giftNeighbor(score, thresholds = NEIGHBOR_GIFT_THRESHOLDS) {
  const next = score + 1;
  const leveledUp = thresholds.includes(next);
  return { score: next, leveledUp };
}
