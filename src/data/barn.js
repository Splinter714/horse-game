// Barn stall assignment — pure logic + localStorage persistence (#35).
//
// The barn interior has a fixed row of stalls; the player can assign a horse to a
// stall. An assignment is a plain map { [stallIndex]: horseKey }. A horse lives in
// at most one stall, so assigning it somewhere clears any prior stall it held.
//
// Kept as its own tiny data module (like coats.js / items.js) so the rules are pure
// and unit-tested, and the scene mixin (scenes/paddock/barn.js) just wires input →
// these helpers and persists the result. No Phaser here.

// How many stalls the barn interior draws (worldArt `barnInterior`). Keep in sync
// with the divider count there and the stall geometry in scenes/paddock/barn.js.
export const NUM_STALLS = 4;

const STORAGE_KEY = 'horse-game-barn-v1';

// Which stall (index) a horse is currently assigned to, or null if unstalled.
export function stallOfHorse(assignments, horseKey) {
  for (const [idx, key] of Object.entries(assignments || {})) {
    if (key === horseKey) return Number(idx);
  }
  return null;
}

// Assign `horseKey` to `stallIndex`. A horse only lives in one stall, so it's first
// cleared from any other stall it held. Passing a null/empty horseKey empties the
// stall. Returns a NEW assignments object (never mutates the input).
export function assignStall(assignments, stallIndex, horseKey) {
  const next = { ...(assignments || {}) };
  // Clear this horse from wherever it was.
  if (horseKey) {
    for (const idx of Object.keys(next)) {
      if (next[idx] === horseKey) delete next[idx];
    }
  }
  if (horseKey) next[stallIndex] = horseKey;
  else delete next[stallIndex];
  return next;
}

// Empty a stall. Returns a new assignments object.
export function unassignStall(assignments, stallIndex) {
  return assignStall(assignments, stallIndex, null);
}

// The in-world "assign" interaction cycles a stall's occupant through the sequence
// [empty, horse0, horse1, …] so tapping a stall repeatedly walks the roster. Given
// the stall's current occupant and the ordered list of horse keys, return the next
// occupant (null = empty). Only horses not already in ANOTHER stall are offered, so
// the cycle never proposes an assignment the assign step would just bounce elsewhere.
export function nextStallOccupant(assignments, stallIndex, horseKeys) {
  const current = (assignments || {})[stallIndex] ?? null;
  // Candidates: empty + any horse that's free or already in THIS stall.
  const free = horseKeys.filter((k) => {
    const at = stallOfHorse(assignments, k);
    return at === null || at === stallIndex;
  });
  const seq = [null, ...free];
  const i = seq.indexOf(current);
  // If the current occupant isn't in the free list (shouldn't happen), start from empty.
  return seq[(i + 1) % seq.length];
}

// ── Persistence ──────────────────────────────────────────────────────────────

export function loadBarnState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { stalls: {} };
    const data = JSON.parse(raw) ?? {};
    const stalls = (data.stalls && typeof data.stalls === 'object') ? data.stalls : {};
    return { stalls };
  } catch {
    return { stalls: {} };
  }
}

export function saveBarnState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ stalls: state?.stalls || {} }));
  } catch {}
}
