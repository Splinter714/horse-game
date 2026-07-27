// Barn stall assignment — pure logic + localStorage persistence (#35).
//
// The barn interior has a fixed row of stalls; the player can assign a horse to a
// stall. An assignment is a plain map { [stallIndex]: horseKey }. A horse lives in
// at most one stall, so assigning it somewhere clears any prior stall it held.
//
// Kept as its own tiny data module (like coats.js / items.js) so the rules are pure
// and unit-tested, and the scene mixin (scenes/paddock/barn.js) just wires input →
// these helpers and persists the result. No Phaser here.

// ── Barn footprint + interior layout (design-grid units) ─────────────────────
// SINGLE SOURCE OF TRUTH for the barn's geometry, shared by the art (art/worldArt.js
// draws the `barnInterior`/`barnFront` textures at exactly this size) and the scene
// mixin (scenes/paddock/barn.js derives world positions from it). They used to be
// two hand-synced copies of 160×132; #349 enlarged the barn a long way, so the
// numbers live here once instead.
//
// #349: 160×132 → 340×230 design units (×2.13 wide, ×1.74 tall; ×3.7 the floor
// area). At the global scale S=2 that's 680×460 world px — a barn you can walk
// around inside, with a full row of stalls and a proper tack room.
export const BARN_W = 340;
export const BARN_H = 230;

// Stall row along the back wall. `STALL_X0` is the left edge of stall 0's divider,
// `STALL_STEP` the pitch; a stall's CENTRE is STALL_X0 + i*STALL_STEP + STALL_STEP/2.
// The left bay (x < STALL_X0) is the tack room.
export const NUM_STALLS = 8;
export const STALL_X0 = 108;
export const STALL_STEP = 28;
// Design-space y of the pieces of a stall: divider posts, the nameboard, the hay
// mound, and where an assigned horse stands (just south of its hay).
export const STALL_TOP = 56;
export const STALL_SIGN_Y = 66;
export const STALL_HAY_Y = 92;
export const STALL_STAND_Y = 118;
// Centre x of stall `i` in design space.
export const stallCenterX = (i) => STALL_X0 + i * STALL_STEP + STALL_STEP / 2;

// Tack room anchor (left bay), for the tack-rack interactable.
export const TACK_X = 52, TACK_Y = 126;

// Ground footprint used for collision + the walk-in interior. The barn art is
// taller than its footprint (the roof overhangs to the north), so the solid box
// starts at WALL_Y0, not at the top of the texture. DOOR_X0..DOOR_X1 is the open
// doorway gap in the south wall — it must line up with the doorway drawn in the
// `barnFront` façade.
export const WALL_X0 = 8, WALL_X1 = BARN_W - 8;
export const WALL_Y0 = 58, WALL_Y1 = BARN_H - 2;
export const DOOR_X0 = 130, DOOR_X1 = 210;

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
