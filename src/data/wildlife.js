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

// ── Bird variety (#182 → #220) ────────────────────────────────────────────────
// Ambient birds are ONE sprite driven by data: each type is a palette + a couple of
// silhouette flags on the SAME fly/peck frames — purely cosmetic, no per-type
// behavior. The art file (art/wildlifeArt.js) reads these to build a texture set per
// type; the spawner picks a type (weighted by rarity) when a bird event fires.
//
// A bird type is:
//   {
//     id:     stable key → texture prefix `bird_<id>` and animation `bird_<id>_fly`
//     name:   friendly label (unused in-world today; handy for a future field guide)
//     weight: relative rarity in the random pick (higher = commoner). The original
//             brown songbird stays the most frequent so the world still reads familiar.
//     body/wing/belly/beak: hex fills (the palette swap)
//     crest:  bool — a little raised head-tuft (cardinal). Silhouette tweak.
//     longTail: bool — a longer, forked tail (barn swallow). Silhouette tweak.
//     eye:    optional eye color override (defaults to near-black)
//   }
// The default `sparrow` reproduces the exact original palette so nothing regresses.
export const BIRD_TYPES = [
  // Common — the everyday little brown songbird (the original look), plus a house sparrow.
  { id: 'sparrow',  name: 'Brown Sparrow', weight: 6, body: 0x6b513a, wing: 0x4f3c2b, belly: 0xc2a47a, beak: 0xe0a838 },
  { id: 'finch',    name: 'House Finch',   weight: 4, body: 0x7a5a44, wing: 0x8a4a3a, belly: 0xd8c39a, beak: 0xd7b24a },
  // Uncommon — a splash of color.
  { id: 'robin',    name: 'Robin',         weight: 3, body: 0x5a5148, wing: 0x3f3a34, belly: 0xc65a33, beak: 0xf0c030 },
  { id: 'bluebird', name: 'Bluebird',      weight: 2, body: 0x3f6bb0, wing: 0x2c4d86, belly: 0xd8a24a, beak: 0x2b2b2b },
  // Rare treats — distinct silhouette + bold color.
  { id: 'cardinal', name: 'Cardinal',      weight: 1, body: 0xc42b2b, wing: 0x9a1f22, belly: 0xd85a4a, beak: 0xe8993a, crest: true, eye: 0x1a0a0a },
  { id: 'swallow',  name: 'Barn Swallow',  weight: 1, body: 0x2f3b6b, wing: 0x20294d, belly: 0xd9a878, beak: 0x22221f, longTail: true },
  { id: 'goldfinch',name: 'Goldfinch',     weight: 1, body: 0xe8c73a, wing: 0x1c1c14, belly: 0xf2e28a, beak: 0xd88a3a, crest: false },
];

// Weighted random pick of a bird type. `roll` is a 0..1 random (injected so the pick
// is deterministic/testable). Falls back to the first (commonest) type for an empty roll.
export function pickBirdType(roll = Math.random(), types = BIRD_TYPES) {
  if (!types.length) return null;
  const total = types.reduce((sum, t) => sum + (t.weight ?? 1), 0);
  let target = roll * total;
  for (const t of types) {
    target -= t.weight ?? 1;
    if (target < 0) return t;
  }
  return types[types.length - 1];
}

// Look up a bird type by id (art builder + any future field-guide use).
export function getBirdType(id, types = BIRD_TYPES) {
  return types.find((t) => t.id === id) ?? types[0];
}
