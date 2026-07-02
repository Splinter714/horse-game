// Garden plot state (#242) — the pure model behind the dedicated garden plot: a fixed
// grid of plantable SLOTS, each either empty or holding a growing crop `{ crop, stage }`.
//
// Everything here is plain data + pure functions (no Phaser), so the plant → grow →
// harvest loop is unit-testable in the `node` env. The garden mixin
// (scenes/paddock/garden.js) owns the sprites and wires these into the world; save.js
// persists the slot array under its own localStorage key.
//
//   plant  → set an empty slot to a crop at stage 0
//   advance→ every planted slot grows one stage per day/night cycle (dawn roll)
//   harvest→ a ripe slot yields its crop's `yield`, then goes back to empty (replant)

import { CROPS, getCrop, growStage, isRipe, nextCrop } from './crops.js';

// How many plantable slots the garden plot has (a small tidy patch, not a mega-farm).
export const GARDEN_SLOTS = 6;

// A fresh, empty garden: GARDEN_SLOTS empty slots. An empty slot is `null`.
export function emptyGarden() {
  return Array.from({ length: GARDEN_SLOTS }, () => null);
}

// Coerce whatever was loaded from storage into a valid slot array: right length, and
// each entry either null or a `{ crop, stage }` naming a real crop at a valid stage.
// Anything malformed (old save, corrupt) becomes an empty slot — forgiving, never throws.
export function sanitizeGarden(raw) {
  const out = emptyGarden();
  if (!Array.isArray(raw)) return out;
  for (let i = 0; i < GARDEN_SLOTS; i++) {
    const s = raw[i];
    if (s && typeof s === 'object' && CROPS[s.crop]) {
      out[i] = { crop: s.crop, stage: clampStage(s.stage) };
    }
  }
  return out;
}

function clampStage(stage) {
  const n = Math.floor(Number(stage));
  return Number.isFinite(n) && n >= 0 ? Math.min(n, growStage(growStage(growStage(0)))) : 0;
}

// The first empty slot index, or -1 if the plot is full. Pure.
export function firstEmptySlot(garden) {
  return garden.findIndex((s) => s == null);
}

// Plant a crop into slot `i` (must be empty). Returns a NEW garden array (immutable
// update) with the crop at stage 0, or the same array unchanged if the slot is taken,
// out of range, or the crop is unknown. `cropId` defaults to the planting-rotation's
// first entry.
export function plant(garden, i, cropId) {
  if (i < 0 || i >= garden.length || garden[i] != null) return garden;
  const crop = getCrop(cropId);
  if (!crop) return garden;
  const next = garden.slice();
  next[i] = { crop: crop.id, stage: 0 };
  return next;
}

// Advance the whole garden one day/night cycle: every planted slot grows one stage
// (clamped at ripe). Empty slots stay empty. Returns a NEW array. This is the day-roll
// hook — called once per dawn so sleeping advances growth (no real-time timers).
export function advanceDay(garden) {
  return garden.map((s) => (s == null ? null : { crop: s.crop, stage: growStage(s.stage) }));
}

// Is slot `i` ripe (a planted crop at its final stage, ready to harvest)?
export function slotRipe(garden, i) {
  const s = garden[i];
  return !!s && isRipe(s.stage);
}

// Harvest slot `i`: if it holds a ripe crop, returns `{ garden, crop, yield }` with the
// slot cleared back to empty and the crop id + unit count it yielded. If the slot isn't
// ripe (empty or still growing), returns `{ garden, crop: null, yield: 0 }` unchanged.
export function harvest(garden, i) {
  if (!slotRipe(garden, i)) return { garden, crop: null, yield: 0 };
  const def = getCrop(garden[i].crop);
  const next = garden.slice();
  next[i] = null;
  return { garden: next, crop: def.id, yield: def.yield };
}

// Re-export the rotation helper so the mixin can pick "the next crop to plant" from one
// import without also reaching into crops.js.
export { nextCrop };
