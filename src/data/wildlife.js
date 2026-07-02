// Pure decision logic for the ambient WILDLIFE (issues #181/#191). Kept separate from
// the scene mixins (scenes/paddock/wildlife.js, raccoon.js) so the *decisions* — when
// the raccoon is active, whether it visits the trash can, whether it grabs loot, when
// it bolts — are Phaser-free and unit-testable (mirrors how species behaviors split a
// pure `test(ctx)` from a scene-coupled `run`). The scene wires these to sprites/tweens.

// Phases where the raccoon is "nocturnal-active" (out and about by default).
const NOCTURNAL_PHASES = new Set(['Evening', 'Night']);

export function isRaccoonActivePhase(phase) {
  return NOCTURNAL_PHASES.has(phase);
}

// Should a raccoon appear on this visit tick? Nocturnal: always eligible at
// dusk/night; a rare daytime cameo otherwise. `roll` is a 0..1 random (injected so
// the decision is deterministic/testable). Never while the player is asleep.
export function shouldRaccoonSpawn({ phase, sleeping, roll, dayChance = 0.15 }) {
  if (sleeping) return false;
  if (isRaccoonActivePhase(phase)) return true;
  return roll < dayChance;
}

// How soon the next raccoon visit is scheduled (ms). Livelier at night, sparse by day.
export function raccoonVisitDelay(phase, rand) {
  return isRaccoonActivePhase(phase) ? rand(12000, 28000) : rand(30000, 60000);
}

// A rummaging raccoon should bolt when the player crowds it (skittish). Fish and
// birds-in-flight ignore the player; only ground critters flee. Already-fleeing
// critters don't re-trigger.
export function shouldRaccoonBolt({ fleeing, dist, fleeDist }) {
  return !fleeing && dist < fleeDist;
}

// At a stop, does the raccoon rummage the trash can (vs. potter at a plain prop)?
// Only when a trash can exists AND this stop is the trash can. `roll` gates the
// chance it actually digs in rather than just sniffing past.
export function shouldRummageTrash({ atTrashCan, hasTrashCan, roll, chance = 0.85 }) {
  return hasTrashCan && atTrashCan && roll < chance;
}

// After rummaging, does it scurry off clutching a (cosmetic) morsel? Purely visual —
// the caller must NOT deduct any real stock/money. `roll` gates the chance.
export function shouldGrabLoot({ roll, chance = 0.5 }) {
  return roll < chance;
}
