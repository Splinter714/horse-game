// Breeding & foals (#15, redesigned by #114) — the PURE logic behind pairing two
// horses and a foal being born after a gestation wait. Kept renderer-free and
// side-effect-free so it's unit-testable (breeding.test.js): the scene-coupled half
// (the in-world pairing interaction, the gestation timer, the birth → name →
// customizer flow, growing the horse roster) lives in scenes/paddock/breeding.js
// and calls into these.
//
// #114 split the original single "pair → instant gestation" action into two
// deliberate steps: a PERMANENT pair-bond (`isBonded`/`bondMateKey`/`canBond`
// below) formed once via "Pair", and a separate, repeatable "Breed" action that
// starts a new gestation on an already-bonded pair. The bond list itself
// (`{ aKey, bKey }`) is persisted by save.js's load/savePairBonds — these helpers
// are the pure reads/checks over that list, kept alongside the rest of the
// breeding logic so they're unit-testable without a scene.
//
// Deliberately NO genetic/coat-inheritance logic (that was dropped in triage). The
// foal is born with a parent-SEEDED look — a sensible jumping-off point the player
// then edits in the existing horse customizer at birth. `seedFoalLook` just derives
// that starting appearance; it is not a genetics roll.

// How long a foal gestates after a pairing, in ms. A cozy, kid-scale wait — long
// enough to feel like an event, short enough that a young player sees the payoff in
// one sitting. A first-pass balance lever to tune at playtest.
export const GESTATION_MS = 3 * 60 * 1000; // 3 minutes

// Age (in "years") a newborn foal starts at. 0 reads as a baby in the info panel.
export const FOAL_AGE = 0;

// The age a foal becomes when it grows up (a young adult horse). Used by the grow-up
// path so a grown foal reads as a real, if young, member of the herd.
export const GROWN_AGE = 1;

// Pick the next free foal roster key. Newborns join the SAME horse roster the herd
// lives in (allHorses), so they persist through save.js's saved-key merge exactly the
// way an attracted bunny does — we just need a key that doesn't collide with the
// existing horses. `foal<i>` keeps them visually distinct in the registry while still
// being ordinary horse-roster members. `existingKeys` is the current allHorses keys.
export function nextFoalKey(existingKeys) {
  const taken = new Set(existingKeys);
  for (let i = 1; i < 1000; i++) {
    const key = `foal${i}`;
    if (!taken.has(key)) return key;
  }
  return `foal${Date.now()}`; // pathological fallback — never expected to hit
}

// Milliseconds left on a gestation that began at `startedAt`, clamped at 0. A pure
// helper so the scene's per-frame check and the tests agree.
export function gestationRemaining(startedAt, now = Date.now()) {
  return Math.max(0, startedAt + GESTATION_MS - (now ?? Date.now()));
}

// Is the gestation that began at `startedAt` complete (the foal ready to be born)?
export function isBornReady(startedAt, now = Date.now()) {
  return gestationRemaining(startedAt, now) <= 0;
}

// Fraction of the gestation elapsed (0 = just paired, 1 = ready), for a progress
// read-out. Clamped to [0, 1].
export function gestationProgress(startedAt, now = Date.now()) {
  const elapsed = (now ?? Date.now()) - startedAt;
  return Math.max(0, Math.min(1, elapsed / GESTATION_MS));
}

// Derive the newborn foal's SEED appearance from its two parents — the jumping-off
// point the player then edits at birth. NOT a genetics roll: we just take one
// parent's coat as the base and carry a light blend of both parents' markings, so
// the foal plausibly resembles its family without any random inheritance. The player
// is expected to open the customizer and make it their own.
//
// Rules (deterministic given the parents, so it's testable):
//   • coat     — parent A's coat (the "dam" the player initiated from). Simple and
//                predictable; the player re-picks in the editor anyway.
//   • markings — the shared markings both parents have (the family resemblance),
//                plus parent A's pattern/face if A has one. Kept conservative so the
//                seed reads clean rather than busy.
//   • sex      — random-free: alternates by a stable hash of the parents so a pair's
//                foals aren't all the same; the player can flip it in the editor.
export function seedFoalLook(parentA, parentB) {
  const a = parentA ?? {};
  const b = parentB ?? {};
  const coat = a.coat ?? b.coat ?? 'bay';

  const ma = a.markings ?? {};
  const mb = b.markings ?? {};
  const markings = {};

  // Shared boolean markings (both parents have them on) carry to the foal — the
  // family resemblance. Only simple on/off flags; complex nested markings (legs)
  // are left to the editor.
  for (const key of Object.keys(ma)) {
    if (ma[key] === true && mb[key] === true) markings[key] = true;
  }
  // Carry parent A's mane colour if set, as a starting point.
  if (ma.maneColor && !markings.maneColor) markings.maneColor = ma.maneColor;

  // Sex: a stable, deterministic pick from the parents' ids so a given pair's foals
  // vary but reproducibly (no Math.random → testable). Player can change it.
  const seedStr = `${a.id ?? ''}|${b.id ?? ''}|${coat}`;
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) | 0;
  const sex = (h & 1) === 0 ? 'female' : 'male';

  return { coat, markings, sex };
}

// Build the roster-data object for a newborn foal, given its parents, a fresh key,
// and the seeded look. This is the plain data a Horse model is constructed from — it
// joins allHorses like any other horse, but flagged `isFoal` (smaller art + the
// grow-up gate) and `stayBaby:true` by default (the important "kids get attached"
// setting — a foal only grows up if the player allows it). Stats start full so a
// newborn isn't immediately hungry.
export function makeFoalData(parentA, parentB, key, seed = null) {
  const s = seed ?? seedFoalLook(parentA, parentB);
  return {
    id: `${key}-${Date.now()}`,
    name: 'Foal',
    breed: 'Foal',
    coat: s.coat,
    markings: s.markings,
    sex: s.sex,
    age: FOAL_AGE,
    isFoal: true,
    stayBaby: true, // default: a foal stays a baby until the player says otherwise (#15)
    parents: [parentA?.id ?? null, parentB?.id ?? null],
    stats: { hunger: 90, thirst: 90, grooming: 90, happiness: 95 },
  };
}

// ── Pair bonds (#114) — pure reads/checks over the persisted bond list ─────────
// `bonds` is the plain array save.js persists: [{ aKey, bKey }, …]. Permanent once
// formed — nothing here ever removes an entry (no death, no re-pairing).

// Is `key` already bonded to anyone? (monogamy check)
export function isBonded(key, bonds) {
  return (bonds ?? []).some((p) => p.aKey === key || p.bKey === key);
}

// The mate key for an already-bonded horse, or null if unbonded.
export function bondMateKey(key, bonds) {
  const pair = (bonds ?? []).find((p) => p.aKey === key || p.bKey === key);
  if (!pair) return null;
  return pair.aKey === key ? pair.bKey : pair.aKey;
}

// Can these two horses form a NEW bond together? Both must exist, be distinct,
// not foals, and neither already bonded to anyone (monogamy enforced at bond time,
// not just gestation exclusivity — matches #114's locked scope).
export function canBond(aKey, bKey, bonds, horsesByKey) {
  if (!aKey || !bKey || aKey === bKey) return false;
  const a = horsesByKey?.[aKey];
  const b = horsesByKey?.[bKey];
  if (!a || !b) return false;
  if (a.isFoal || b.isFoal) return false;
  if (isBonded(aKey, bonds) || isBonded(bKey, bonds)) return false;
  return true;
}
