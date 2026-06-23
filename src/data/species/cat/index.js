// Cat species definition. Identity-only for now (no needs/decay/care yet, like
// the chicken) — enough to drive a generic Animal model so the cat gets a working
// info panel (#84). Needs/actions/behaviors can be added here later without
// touching the model or scene.

export const CAT = {
  id: 'cat',
  defaults: {
    id: () => `cat-${Math.random().toString(36).slice(2, 9)}`,
    name: 'Mittens', breed: 'Barn Cat', coat: 0, age: 2,
  },
  // Identity-only for now (no needs/decay yet). Needs can be added here later
  // without touching the model.
  needs: {},
  happiness: null,
  actions: {},
  dailyCare: { track: [], requiredForContentment: [] },
  mood: null,
  traits: { personality: 'curious' },
  optionalAttrs: [],
  capabilities: { saddleable: false, rideable: false, leadable: false, laysEggs: false },

  // Paddock "feel" knobs read by the scene movement primitives (creatures.js).
  // Cats are independent loungers: they prowl slowly and rest longer between
  // strolls, so the wander delays run longer than the more restless animals.
  // (No `roll`: only horses roll in the dirt.)
  movement: {
    wanderMin: 6000,
    wanderMax: 14000,
  },

  // Info-panel presentation: animated portrait (the cat has idle frames), an
  // italic personality line, no stat bars or action buttons (identity-only).
  panel: { portrait: 'animated', traitLine: 'personality', fixedAttrs: false },
};
