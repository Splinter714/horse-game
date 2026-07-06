// Garden plot state (#242) — the pure model behind the dedicated garden plot: a fixed
// grid of plantable SLOTS, each either empty or holding a growing crop `{ crop, stage }`.
//
// Everything here is plain data + pure functions (no Phaser), so the plant → grow →
// harvest loop is unit-testable in the `node` env. The garden mixin
// (scenes/paddock/garden.js) owns the sprites and wires these into the world; save.js
// persists the slot array under its own localStorage key.
//
//   plant  → set an empty slot to a crop at stage 0
//   advance→ every planted slot grows one stage per day/night cycle (dawn roll) IF it
//            was watered that cycle (#245) — otherwise it holds (no backward growth)
//   harvest→ a ripe slot yields its crop's `yield`, then EITHER regrows (resets to an
//            earlier growth stage, still planted — #216) OR empties (one-and-done),
//            per that crop's own `regrows` flag in crops.js
//
// Watering (#245): each planted slot carries its own `watered` flag (default false —
// a freshly-planted crop needs its first watering like any other day). Watering is a
// Use-dispatch interaction with a filled water bucket (mirrors the trough/pet-bowl fill
// pattern, see scenes/paddock/garden.js `waterSlot`). `resetWateredFlags` is called each
// dawn (alongside advanceDay) so yesterday's watering doesn't carry forward.

import {
  CROPS, GROWTH_STAGES, REGROW_STAGE, getCrop, growIfWatered, isRipe, nextCrop,
} from './crops.js';

// How many plantable slots the garden plot has (a small tidy patch, not a mega-farm).
export const GARDEN_SLOTS = 6;

// A fresh, empty garden: GARDEN_SLOTS empty slots. An empty slot is `null`.
export function emptyGarden() {
  return Array.from({ length: GARDEN_SLOTS }, () => null);
}

// Coerce whatever was loaded from storage into a valid slot array: right length, and
// each entry either null or a `{ crop, stage, watered }` naming a real crop at a valid
// stage. Anything malformed (old save, corrupt) becomes an empty slot — forgiving,
// never throws. A missing `watered` (old #242-era save, pre-#245) defaults to false —
// same as a fresh morning — so an existing save doesn't secretly skip a watering.
export function sanitizeGarden(raw) {
  const out = emptyGarden();
  if (!Array.isArray(raw)) return out;
  for (let i = 0; i < GARDEN_SLOTS; i++) {
    const s = raw[i];
    if (s && typeof s === 'object' && CROPS[s.crop]) {
      out[i] = { crop: s.crop, stage: clampStage(s.stage), watered: !!s.watered };
    }
  }
  return out;
}

function clampStage(stage) {
  const n = Math.floor(Number(stage));
  return Number.isFinite(n) && n >= 0 ? Math.min(n, GROWTH_STAGES - 1) : 0;
}

// The first empty slot index, or -1 if the plot is full. Pure.
export function firstEmptySlot(garden) {
  return garden.findIndex((s) => s == null);
}

// Plant a crop into slot `i` (must be empty). Returns a NEW garden array (immutable
// update) with the crop at stage 0, unwatered, or the same array unchanged if the slot
// is taken, out of range, or the crop is unknown. `cropId` defaults to the
// planting-rotation's first entry.
export function plant(garden, i, cropId) {
  if (i < 0 || i >= garden.length || garden[i] != null) return garden;
  const crop = getCrop(cropId);
  if (!crop) return garden;
  const next = garden.slice();
  next[i] = { crop: crop.id, stage: 0, watered: false };
  return next;
}

// Is slot `i` watered for today's growth tick?
export function slotWatered(garden, i) {
  return !!garden[i]?.watered;
}

// Water slot `i` (must hold a growing crop). Returns a NEW garden array with that
// slot's `watered` flag set, or the same array unchanged if the slot is empty or
// already watered (so re-watering a slot is a harmless no-op, not extra state).
export function waterSlot(garden, i) {
  const s = garden[i];
  if (!s || s.watered) return garden;
  const next = garden.slice();
  next[i] = { ...s, watered: true };
  return next;
}

// Advance the whole garden one day/night cycle: every planted slot that was watered
// grows one stage (clamped at ripe); an unwatered slot holds at its current stage —
// growth stalls, it never goes backward (#245). Empty slots stay empty. Returns a NEW
// array. This is the day-roll hook — called once per dawn so sleeping advances growth
// (no real-time timers). Does NOT reset the watered flags — call resetWateredFlags
// separately so "watered yesterday" can still gate today's growth at the moment of
// the roll, then the flags clear for the fresh day.
export function advanceDay(garden) {
  return garden.map((s) => (s == null
    ? null
    : { crop: s.crop, stage: growIfWatered(s.stage, s.watered), watered: s.watered }));
}

// Reset every planted slot's `watered` flag to false — called once per dawn (after
// advanceDay, so the flag that gated last night's growth is still readable during the
// roll) so each new day starts un-watered and requires fresh tending. Empty slots stay
// empty. Returns a NEW array.
export function resetWateredFlags(garden) {
  return garden.map((s) => (s == null ? null : { ...s, watered: false }));
}

// Is slot `i` ripe (a planted crop at its final stage, ready to harvest)?
export function slotRipe(garden, i) {
  const s = garden[i];
  return !!s && isRipe(s.stage);
}

// Harvest slot `i`: if it holds a ripe crop, returns `{ garden, crop, yield }` with the
// crop id + unit count it yielded, and the slot set per that crop's `regrows` flag
// (#216) — a regrowing crop (berries, tomatoes) resets to REGROW_STAGE, still planted
// and unwatered (needs tending again before its next growth tick); a one-and-done crop
// (root veg like carrots/potatoes) is cleared back to empty (replant from scratch). If
// the slot isn't ripe (empty or still growing), returns `{ garden, crop: null, yield: 0 }`
// unchanged.
export function harvest(garden, i) {
  if (!slotRipe(garden, i)) return { garden, crop: null, yield: 0 };
  const def = getCrop(garden[i].crop);
  const next = garden.slice();
  next[i] = def.regrows ? { crop: def.id, stage: REGROW_STAGE, watered: false } : null;
  return { garden: next, crop: def.id, yield: def.yield };
}

// Re-export the rotation helper so the mixin can pick "the next crop to plant" from one
// import without also reaching into crops.js.
export { nextCrop };
