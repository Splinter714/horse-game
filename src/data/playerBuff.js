// Player meal buff (#277) — eating a cooked meal (at the house pantry, once cooked
// at the stove, #41) grants the player a short, cozy pick-me-up: a modest boost to
// move speed and to how much a pet/brush action restores ("chore energy"). Reviewed
// with the owner 2026-07-02: "a temporary boost (e.g. move faster / more chore
// energy) for a while" — scoped here as a couple of minutes of noticeable-but-modest
// hustle, not an overpowered stat stick.
//
// Single buff slot, no stacking: eating another meal while one is active just
// REFRESHES it (see startMealBuff) rather than compounding. Kept as its own small
// pure module (mirrors cooking.js/pantry.js) so the shape is unit-testable without
// Phaser. The live buff itself is stashed on the shared game registry (`playerBuff`
// key, mirrors `viewingAnimal`) so it survives the PaddockScene ⇄ HouseInteriorScene
// handoff — HouseInteriorScene's cooking mixin sets it on eating a pantry dish;
// PaddockScene's `playerBuff.js` mixin reads it for the live multipliers + HUD.

export const MEAL_BUFF_DURATION_MS = 2 * 60 * 1000; // 2 minutes of game time — a short treat
export const MEAL_BUFF_SPEED_MULT  = 1.25; // noticeable but modest hustle
export const MEAL_BUFF_CHORE_MULT  = 1.25; // pet/brush restore ~25% more while buffed

// A fresh buff starting at `now`. Eating another meal while one is already active
// should just call this again (replace, not stack) — see callers.
export function startMealBuff(now = Date.now()) {
  return {
    speedMult: MEAL_BUFF_SPEED_MULT,
    choreMult: MEAL_BUFF_CHORE_MULT,
    expiresAt: now + MEAL_BUFF_DURATION_MS,
  };
}

export function isBuffActive(buff, now = Date.now()) {
  return !!buff && now < buff.expiresAt;
}

// Multiplier helpers — always 1 (no-op) once the buff is missing or has expired,
// so call sites never need their own active-check.
export function speedMult(buff, now = Date.now()) {
  return isBuffActive(buff, now) ? buff.speedMult : 1;
}

export function choreMult(buff, now = Date.now()) {
  return isBuffActive(buff, now) ? buff.choreMult : 1;
}

// Whole seconds remaining on the buff, for a status readout (0 once inactive).
export function buffSecondsLeft(buff, now = Date.now()) {
  if (!isBuffActive(buff, now)) return 0;
  return Math.ceil((buff.expiresAt - now) / 1000);
}
