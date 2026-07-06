// Pantry / fridge storage (#212) — a brand-new, separate indoor stockpile for
// food/crops/animal products, distinct from the farm-stand stock (items sold to
// customers) and the player's carried inventory/carriers (baskets/buckets). It
// lives inside the house (HouseInteriorScene's `pantry` station) and is meant to
// feed cooking (#41) once that lands — #213's stove/oven stub reads from it.
//
// Storable contents: any CONTENT_DEFS key that's actually food or a raw/processed
// farm product a kitchen would want (excludes tool-ish/ambient contents like
// water/nectar/compost). Kept as its own small allow-list here (not merged into
// CONTENT_DEFS) since "storable in the pantry" is a pantry-specific question, not
// a property of the content itself.
export const PANTRY_STORABLE = [
  'hay', 'apple', 'carrot', 'seed', 'egg', 'eggBrown', 'milk', 'wool', 'yarn',
  'strawberry', 'wheat', 'jam', 'flour', 'pigFeed', 'honey', 'catFood', 'bunnyFood',
  'foxFood', 'duckFood', 'orange', 'berry',
  // Cooking (#41): cooked dishes can be stocked in the pantry like any other
  // produce, in case there's no active carrier free to hold the stove's output.
  'vegetableStew', 'berryPie', 'honeyBread',
];

export function isPantryStorable(content) {
  return PANTRY_STORABLE.includes(content);
}

// Pantry storage is a simple keyed quantity map: { [content]: count }. Pure
// helpers so the shape is unit-testable without Phaser/localStorage.
export function sanitizePantry(raw) {
  const out = {};
  if (raw && typeof raw === 'object') {
    for (const [content, count] of Object.entries(raw)) {
      if (!isPantryStorable(content)) continue;
      const n = Math.floor(Number(count));
      if (Number.isFinite(n) && n > 0) out[content] = n;
    }
  }
  return out;
}

// Add `amount` of `content` to a pantry map, returning a NEW map (immutable —
// mirrors the rest of data/* pure-helper style). No-ops (returns the same
// reference) for a non-storable content or a non-positive amount.
export function addToPantry(pantry, content, amount = 1) {
  if (!isPantryStorable(content) || !(amount > 0)) return pantry;
  const next = { ...pantry };
  next[content] = (next[content] ?? 0) + Math.floor(amount);
  return next;
}

// Take up to `amount` of `content` out of a pantry map. Returns { pantry, taken }
// where `pantry` is a NEW map with the amount removed (key deleted at zero) and
// `taken` is how much was actually available (0 if none).
export function takeFromPantry(pantry, content, amount = 1) {
  const have = pantry?.[content] ?? 0;
  const taken = Math.min(have, Math.max(0, Math.floor(amount)));
  if (taken <= 0) return { pantry, taken: 0 };
  const next = { ...pantry };
  const left = have - taken;
  if (left > 0) next[content] = left; else delete next[content];
  return { pantry: next, taken };
}

export function pantryHas(pantry, content, amount = 1) {
  return (pantry?.[content] ?? 0) >= amount;
}
