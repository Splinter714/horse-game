// Cat bowl fill/consume arithmetic (#202 rework) — the pure core of the cat's food +
// water bowls, split out from the scene plumbing (scenes/paddock/worldObjects.js
// fillCatBowl / _setCatBowlLevel and catAI.js catEatFromBowl) so it's unit-testable
// with no Phaser. A bowl holds a numeric level in "servings": the player refilling it
// tops it to the cap, and each meal the cat takes lowers it by one. The bowl's sprite
// swaps between a filled and an empty texture as the level crosses zero.

// Fill a bowl to the cap (one scoop/pour refills the whole dish — kid-friendly, like
// a real feeding). Pure: takes the cap, returns the new level.
export function fillBowlLevel(cap) {
  return cap;
}

// A single serving eaten/drunk lowers the level by one, never below empty. Pure.
export function drainBowlLevel(level) {
  return Math.max(0, level - 1);
}

// Is there anything in the bowl to eat/drink? Drives both the sprite swap (filled vs
// empty texture) and the cat's seek gate (an empty bowl reads as "nothing to seek").
export function bowlHasFood(level) {
  return level > 0;
}
