// Cat species definition — minimal for now. The full cat (needs/actions/behaviors,
// model, persistence) is being built separately; this stub exists so the cat's
// paddock "feel" lives as data alongside the other species rather than hardcoded in
// the scene. Flesh out the rest of this def as the cat comes online.

export const CAT = {
  id: 'cat',

  // Paddock "feel" knobs read by the scene movement primitives (creatures.js).
  // Cats are independent loungers: they prowl slowly and rest longer between
  // strolls, so the wander delays run longer than the more restless animals.
  // (No `roll`: only horses roll in the dirt.)
  movement: {
    wanderMin: 6000,
    wanderMax: 14000,
  },
};
