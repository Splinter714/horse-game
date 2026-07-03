// Beehive honey production (#239) — the pure ripen/harvest arithmetic, split from the
// scene plumbing (paddock/birdEcosystem.js) so it's unit-testable with no Phaser. The
// hive slowly accumulates honey on a timer up to a cap; once it's ripe enough to harvest
// the player can gather the whole batch into a basket, which resets it to zero and it
// starts filling again. Bees are purely benign (no sting) — they're ambient charm only.

// How many jars a full hive holds, and the threshold at which a harvest is offered.
// A harvest yields whatever has ripened (up to the cap), so HONEY_CAP is the batch size.
export const HONEY_CAP = 3;
// Honey must reach at least this many jars before the hive reads as "ready to harvest"
// (so you don't harvest a near-empty hive for a single jar the instant it ticks). At the
// cap it's plainly ripe; this just gates the very-early trickle.
export const HONEY_READY_AT = 1;

// One production tick adds a jar, never past the cap. Pure. (The scene fires this on a
// slow timer; the amount-per-tick is 1 so the cadence is set purely by the timer delay.)
export function ripenHoney(level, cap = HONEY_CAP) {
  return Math.min(cap, level + 1);
}

// Is there enough honey to harvest? Drives both the "Harvest Honey" prompt and the
// ripe-vs-working hive sprite swap.
export function honeyReady(level) {
  return level >= HONEY_READY_AT;
}

// Harvesting takes the whole ripe batch. Returns { yield, level } — how many jars go
// into the basket and the hive's new level (0). A no-op (yield 0) if it isn't ripe yet.
export function harvestHoney(level) {
  if (!honeyReady(level)) return { yield: 0, level };
  return { yield: level, level: 0 };
}
