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

// ── Cutaway trigger geometry (#35) ───────────────────────────────────────────
// The barn's front façade fades out only once the player is actually inside the
// building (or standing in its doorway walking in). Kept pure + unit-tested here
// because the original inline check was too generous: it padded the interior rect
// outward on every side, so walking PAST the barn — along the front, behind it, or
// past either side wall — cut the façade away while the player was still outside
// (playtest 2026-07-06, re-raised 2026-07-26).

// How far south of the interior rect the doorway approach counts as "entering",
// in world px. Only inside the doorway COLUMN — not along the whole front wall.
export const BARN_DOOR_APRON = 28;
// Lateral slack on the doorway column, so you don't have to be pixel-centred.
const DOOR_PAD = 8;

// interior: { x0, y0, x1, y1 } walkable rect; doorway: { x0, x1 } world-x span of
// the gap in the south wall. Both must be in the barn's LIVE world coordinates.
export function isInsideBarn(interior, doorway, px, py, apron = BARN_DOOR_APRON) {
  if (!interior) return false;
  const inRoom = px > interior.x0 && px < interior.x1
              && py > interior.y0 && py < interior.y1;
  if (inRoom) return true;
  if (!doorway) return false;
  // Doorway apron: strictly the doorway column, strictly south of the room.
  return px > doorway.x0 - DOOR_PAD && px < doorway.x1 + DOOR_PAD
      && py >= interior.y1 && py < interior.y1 + apron;
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
