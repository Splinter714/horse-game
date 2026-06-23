// Chicken species definition — drives the generic Animal model (../../Animal.js)
// for chickens. Everything about a chicken lives in this folder: this definition,
// the Chicken class (model.js), and the AI behavior modules (behaviors.js). The
// procedural art is the one exception and lives in src/art/animalArt.js.

export const CHICKEN = {
  id: 'chicken',
  defaults: {
    id: () => `chicken-${Math.random().toString(36).slice(2, 9)}`,
    name: 'Hen', breed: 'Chicken', coat: 0, age: 1,
  },
  // Chickens are currently identity-only (no needs/decay yet). Needs can be added
  // here later without touching the model.
  needs: {},
  happiness: null,
  actions: {},
  dailyCare: { track: [], requiredForContentment: [] },
  mood: null,
  traits: { personality: 'friendly' },
  optionalAttrs: [],
  capabilities: { saddleable: false, rideable: false, leadable: false, laysEggs: true },

  // Paddock "feel" knobs read by the scene movement primitives (creatures.js).
  // ms delay range between wanders — chickens potter around their coop fairly
  // often. (No `roll`: only horses roll in the dirt.)
  movement: {
    wanderMin: 4000,
    wanderMax: 10000,
  },

  // Info-panel presentation: static portrait, an italic personality line, no stat
  // bars or action buttons (chickens are identity-only for now).
  panel: { portrait: 'static', traitLine: 'personality', fixedAttrs: false },

  // AI priority list walked per-tick by the dispatcher (modules: ./behaviors.js).
  // Note: egg laying (eggLayTick, 45s timer) and roosting are scheduler-driven, not
  // per-tick decisions, so they stay in the scene mixins and are NOT listed here.
  behaviors: ['seekSeed', 'followForSeed', 'gatherAtBin'],
};
