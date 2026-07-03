// Bird befriending (#223) — pure decision logic for turning a repeat visitor at the
// maintained bird ecosystem props (birdhouse #218, bird bath #219, seed feeder #240)
// into a NAMED, recognizable regular. Mirrors the fox-taming shape (#266,
// data/species/fox/index.js `feedWildFox`): a single incrementing counter per
// individual, tamed once it crosses a threshold, capped roster. Kept Phaser-free and
// unit-tested here; the scene half (paddock/birdFriendship.js) owns the sprite/tween
// wiring and persistence plumbing (data/save.js loadBirdFriendship/saveBirdFriendship).
//
// Simplest data model that still reads as "the same individual building trust": each
// visit beat (a bird landing at a currently-STOCKED/active prop) rolls which bird type
// is "on this visit" (_pickBird, wildlife.js) and bumps that type's running visit
// tally. A type's tally is a stand-in for "this particular bird" — the game doesn't
// track individual sprite identity across visits (nothing does, ambient critters are
// fire-and-forget), so "the same bird keeps coming back" is presented via its
// TYPE + growing tally, exactly how the fox is "the same fox" via one counter rather
// than a tracked entity. Once a type's tally crosses BIRD_FRIEND_VISITS, it commits:
// that type becomes a permanent NAMED bird in the small capped roster and stops
// accumulating (visits after that just feed the ordinary ambient beat).

// How many qualifying visits (landing at a stocked/active bird-ecosystem prop) before
// a bird "warms up" enough to be recognized and named. Small — like the fox's 3 feeds
// — so the payoff lands within a play session, but more than the bunny's instant join
// so it still reads as "won over gradually."
export const BIRD_FRIEND_VISITS = 5;

// How many birds can be befriended at once. A small handful of named regulars reads
// as special without cluttering the yard — mirrors the fox (cap 1) scaled up a bit
// since birds are flock creatures, not a lone den animal.
export const BIRD_FRIEND_CAP = 3;

// Pure visit step (unit-tested in ./birdFriendship.test.js). Given the running visit
// tally for a bird TYPE id and the current befriended roster (array of type ids
// already named), return the state after ONE qualifying visit:
//   { count, befriended }
//     count      — the running visit tally for this type after this visit
//     befriended — true on the visit that crosses BIRD_FRIEND_VISITS (the commit
//                  moment), so the caller names/spawns a new regular exactly once;
//                  false otherwise.
// Already-befriended types and a full roster both short-circuit (no re-taming, no
// overflow past the cap) — mirrors `rosterFull` in feedWildFox.
export function visitBird(count, { alreadyBefriended = false, rosterFull = false } = {}, needVisits = BIRD_FRIEND_VISITS) {
  if (alreadyBefriended || rosterFull) return { count, befriended: false };
  const next = count + 1;
  return { count: next, befriended: next >= needVisits };
}

// Is this visit prop currently "maintained" — i.e. does a visit here count toward
// befriending? The birdhouse is always active (fixed scenery, #218); the bath is
// always active too (no fill/drain, #219); the seed feeder only counts while STOCKED
// (#240) — an empty feeder draws no birds anyway, but this makes the "keep it filled"
// intent explicit and testable.
export function isQualifyingVisit(spot, { feederFilled = false } = {}) {
  if (spot === 'feeder') return feederFilled;
  if (spot === 'birdhouse' || spot === 'bath') return true;
  return false;
}
