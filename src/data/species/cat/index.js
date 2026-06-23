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
  // No survival needs yet, but a love/happiness stat so petting the cat lands on
  // something and completes (#104). No needs to average, so happiness eases toward
  // `baseline` and petting tops it up; slow `driftRate` keeps a pet rewarding (#105).
  needs: {},
  happiness: { default: 65, baseline: 50, driftRate: 0.004, label: 'Happy', color: 0x1d9e75 },
  // A cat takes a bit more winning over — a slightly smaller bump per pet.
  actions: {
    pet: { stat: 'happiness', amount: 12, care: 'loved', label: 'Love', sound: 'chime', icon: 'iconHeart' },
  },
  dailyCare: { track: ['loved'], requiredForContentment: [] },
  mood: [
    [75, 'purring'],
    [50, 'content'],
    [25, 'aloof'],
    [0,  'wants attention'],
  ],
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
