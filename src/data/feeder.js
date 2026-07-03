// Seed bird feeder (#240) — the pure fill/drain arithmetic for the refillable
// songbird feeder, split from the scene plumbing (paddock/birdEcosystem.js) so it's
// unit-testable with no Phaser. The feeder holds a numeric seed level in "servings":
// the player refills it with seed (from the grain bin, via the gather-and-fill carrier
// loop) which tops it to the cap, and each bird that feeds nibbles it down by one.
// When it's empty the birds stop coming; refill it and they return.
//
// Mirrors the pet-bowl model (data/bowls.js) but is its OWN module: a feeder isn't a
// pet dish (no species eats from it directly — it's ambient-bird attraction), and it
// caps higher so a fill lasts through several bird visits before it needs topping up.

// How many bird-feedings a full feeder holds. Higher than a pet bowl (BOWL_CAP=4) so
// one refill sustains a stretch of ambient visits — a light upkeep chore, not a
// constant one. A balance lever to tune at playtest.
export const FEEDER_CAP = 8;

// Refilling tops the feeder right up to the cap (one gather-and-pour fills it, like the
// trough/pet bowls — kid-friendly). Pure: takes the cap, returns the new level.
export function fillFeederLevel(cap = FEEDER_CAP) {
  return cap;
}

// A bird feeding nibbles the level down by one, never below empty. Pure.
export function drainFeederLevel(level) {
  return Math.max(0, level - 1);
}

// Does the feeder have seed in it? Drives both the sprite swap (stocked vs empty
// texture) and whether birds are drawn to it (an empty feeder attracts nobody).
export function feederHasSeed(level) {
  return level > 0;
}
