// Baby chicks via rooster-bred incubation (#274) — the PURE logic behind a hen's
// fertilized egg being incubated and hatching into a chick. Mirrors the SHAPE of
// horse breeding (data/breeding.js) — gestation timing, roster-key growth, a
// parent-seeded look, `stayBaby: true` default — but is its own parallel system
// (chicks are chickens, not horses) and touches none of the horse-breeding files.
//
// Kept renderer-free and side-effect-free so it's unit-testable
// (incubation.test.js): the scene-coupled half (the in-world "incubate" trigger,
// the incubation timer tick, the hatch → roster-growth flow) lives in
// scenes/paddock/incubation.js and calls into these.
//
// Player-initiated only (#270/#273 monogamy/consent constraints still separately
// tracked, but nothing here auto-breeds): the player explicitly starts an
// incubation from a hen's info panel, only when an eligible rooster
// (`breedingPartner` capability, #269) is present in the flock.

// How long a fertilized egg incubates before hatching, in ms. Cozy, kid-scale —
// shorter than the horse's 3-minute gestation since a chick is a smaller "event"
// (mirrors the ~3min-scale cozy timing the issue asks for, tuned a touch quicker
// since eggs already have their own 45s lay timer as a reference point in this
// game). A first-pass balance lever to tune at playtest.
export const INCUBATION_MS = 2 * 60 * 1000; // 2 minutes

// Age (in "years") a newborn chick starts at. 0 reads as a baby in the info panel.
export const CHICK_AGE = 0;

// The age a chick becomes when it grows up (a young hen). Used by the grow-up path
// so a grown chick reads as a real, if young, flock member.
export const GROWN_CHICK_AGE = 1;

// Pick the next free chick roster key. Newborns join the SAME chicken roster the
// flock lives in (allChickens), so they persist through save.js's saved-key merge
// exactly the way an attracted bunny/bred foal does — we just need a key that
// doesn't collide with the existing chickens/hens. `chick<i>` keeps them visually
// distinct in the registry while still being ordinary chicken-roster members.
// `existingKeys` is the current allChickens keys.
export function nextChickKey(existingKeys) {
  const taken = new Set(existingKeys);
  for (let i = 1; i < 1000; i++) {
    const key = `chick${i}`;
    if (!taken.has(key)) return key;
  }
  return `chick${Date.now()}`; // pathological fallback — never expected to hit
}

// Milliseconds left on an incubation that began at `startedAt`, clamped at 0.
export function incubationRemaining(startedAt, now = Date.now()) {
  return Math.max(0, startedAt + INCUBATION_MS - (now ?? Date.now()));
}

// Is the incubation that began at `startedAt` complete (the chick ready to hatch)?
export function isHatchReady(startedAt, now = Date.now()) {
  return incubationRemaining(startedAt, now) <= 0;
}

// Fraction of the incubation elapsed (0 = just started, 1 = ready), for a progress
// read-out. Clamped to [0, 1].
export function incubationProgress(startedAt, now = Date.now()) {
  const elapsed = (now ?? Date.now()) - startedAt;
  return Math.max(0, Math.min(1, elapsed / INCUBATION_MS));
}

// Derive the newborn chick's SEED appearance from its hen parent (and, for
// flavour, the rooster). NOT a genetics roll — mirrors seedFoalLook's spirit but
// simpler since chickens pick a whole coat STYLE rather than per-part markings:
// the chick starts wearing the hen's coat, a sensible jumping-off point.
export function seedChickLook(hen, rooster) {
  const h = hen ?? {};
  const r = rooster ?? {};
  const coat = h.coat ?? r.coat ?? 0;
  return { coat };
}

// Build the roster-data object for a newborn chick, given its hen + rooster
// parents, a fresh key, and the seeded look. This is the plain data a Chicken
// model is constructed from — it joins allChickens like any other hen, but
// flagged `isFoal` (smaller baby art + the grow-up gate, the SAME generic field
// Animal.js already carries for the horse foal) and `stayBaby: true` by default
// per #298. Stats start full so a newborn isn't immediately lonely.
export function makeChickData(hen, rooster, key, seed = null) {
  const s = seed ?? seedChickLook(hen, rooster);
  return {
    id: `${key}-${Date.now()}`,
    name: 'Chick',
    breed: 'Chick',
    coat: s.coat,
    sex: 'female', // chicks grow up into hens (mirrors the default chicken roster)
    age: CHICK_AGE,
    isFoal: true,
    stayBaby: true, // default: a chick stays a baby until the player says otherwise (#298)
    parents: [hen?.id ?? null, rooster?.id ?? null],
    stats: { happiness: 90 },
  };
}
