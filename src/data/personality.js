// Personality & preference traits (#88 v1) — positively-framed, data-driven, and
// applied game-wide (every species). This is the shared vocabulary + the pure,
// deterministic per-animal assignment; each species picks which pools apply and can
// override any of them with its own vocabulary (co-located in its species def under
// a `personality` block).
//
// HARD RULE: every trait here reads as endearing or neutral-positive. No negative
// framing — no 'needy'/'lazy'/'stubborn'/'shy'. (An automated guard in
// personality.test.js fails the build if a banned word ever slips into a pool.)
//
// v1 is display-only: the info panel surfaces these; no behavior effects yet (the
// favorite-food follow + happiness bonuses are deferred, see the issue).

// Shared default pools. A species def may override any of these keys with its own
// array (e.g. the cat hunts instead of grazing, the pig loves mud). Order/contents
// are stable so a given seed always resolves the same trait across reloads.
export const DEFAULT_POOLS = {
  // Temperament — the animal's overall vibe.
  temperament: ['gentle', 'playful', 'curious', 'brave', 'mellow', 'social', 'cheerful', 'easygoing'],
  // What the animal most loves to do.
  activity: ['running', 'rolling in the grass', 'napping in the sun', 'exploring', 'playing'],
  // Favorite food (the everyday meal it likes best).
  food: ['hay', 'fresh grass', 'apples', 'carrots'],
  // Favorite treat (the special snack).
  treat: ['apple slices', 'carrot sticks', 'sugar cubes', 'sweet oats'],
  // Affinities — endearing likes. Assigned as a small set (see AFFINITY_COUNT).
  affinities: ['loves water', 'loves brushing', 'enjoys company', 'loves sunshine', 'loves a good nap'],
};

// How many affinities each animal gets (a couple, so it feels like an individual
// without listing everything).
export const AFFINITY_COUNT = 2;

// The single-pick trait categories, in display order.
export const SINGLE_KEYS = ['temperament', 'activity', 'food', 'treat'];

// Words that must never appear in any pool — the positivity guard (test-enforced).
export const BANNED_WORDS = [
  'needy', 'lazy', 'stubborn', 'shy', 'grumpy', 'timid', 'nervous', 'aggressive',
  'anxious', 'clingy', 'dumb', 'stupid', 'mean', 'greedy', 'fussy', 'picky',
  'slow', 'fat', 'skittish', 'moody', 'sullen', 'dull', 'boring',
];

// Resolve a species' personality pools: its `personality.pools` overrides merged
// over the shared defaults. `spec.personality` may be:
//   • undefined            → use all shared defaults
//   • { pools: {...} }     → override the named pools, keep the rest
export function poolsFor(spec) {
  const override = spec?.personality?.pools ?? {};
  return { ...DEFAULT_POOLS, ...override };
}

// A tiny deterministic string hash (FNV-1a) → unsigned 32-bit. Stable across
// reloads/platforms so an animal's traits never change once assigned.
function hashStr(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Deterministically pick one item from `arr` for a given seed + salt.
function pick(arr, seed, salt) {
  if (!arr || arr.length === 0) return undefined;
  return arr[hashStr(`${seed}:${salt}`) % arr.length];
}

// Deterministically pick `n` distinct items from `arr` for a seed + salt.
function pickMany(arr, seed, salt, n) {
  if (!arr || arr.length === 0) return [];
  const pool = arr.slice();
  const out = [];
  for (let i = 0; i < n && pool.length; i++) {
    const idx = hashStr(`${seed}:${salt}:${i}`) % pool.length;
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

// Assign a full personality object for one animal, deterministically from a stable
// `seed` (the animal's id) and the species' pools. Same seed + species ⇒ same
// personality every time, so traits persist across reloads even for animals that
// aren't explicitly seeded in the roster.
export function assignPersonality(spec, seed) {
  const pools = poolsFor(spec);
  const s = String(seed ?? 'anon');
  const out = {};
  for (const key of SINGLE_KEYS) {
    const v = pick(pools[key], s, key);
    if (v !== undefined) out[key] = v;
  }
  const aff = pickMany(pools.affinities, s, 'affinities', AFFINITY_COUNT);
  if (aff.length) out.affinities = aff;
  return out;
}
