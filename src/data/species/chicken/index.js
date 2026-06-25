// Chicken species definition — drives the generic Animal model (../../Animal.js)
// for chickens. Everything about a chicken lives in this folder: this definition,
// the Chicken class (model.js), and the AI behavior modules (behaviors.js). The
// procedural art is the one exception and lives in src/art/animalArt.js.

export const CHICKEN = {
  id: 'chicken',
  defaults: {
    id: () => `chicken-${Math.random().toString(36).slice(2, 9)}`,
    name: 'Hen', breed: 'Chicken', coat: 0, age: 1, sex: 'female', // hens — they lay the eggs
  },
  // Chickens have no survival needs (no hunger/thirst decay yet), but they do have
  // a love/happiness stat so petting lands on something and the interaction
  // completes (#104). With no needs to average, happiness eases toward `baseline`
  // and petting tops it up — slow `driftRate` so a pet stays rewarding (#105).
  needs: {},
  happiness: { default: 70, baseline: 55, driftRate: 0.004, label: 'Happy', color: 0x1d9e75 },
  // Petting raises happiness a good chunk (chickens have nothing else to satisfy).
  actions: {
    pet: { stat: 'happiness', amount: 14, care: 'loved', label: 'Love', sound: 'chime', icon: 'iconHeart' },
  },
  // Track 'loved' so the pet records (chickens never go grumpy — nothing required).
  dailyCare: { track: ['loved'], requiredForContentment: [] },
  mood: [
    [75, 'delighted'],
    [50, 'content'],
    [25, 'a bit lonely'],
    [0,  'wants attention'],
  ],
  traits: { personality: 'friendly' },
  optionalAttrs: [],
  // `pecks` adds the occasional idle ground-peck; `roosts` makes the flock spawn
  // hidden and emerge from the coop in the morning (both wired at spawn in
  // creatures.js from these capability flags, #167 B4).
  capabilities: { saddleable: false, rideable: false, leadable: false, laysEggs: true, pecks: true, roosts: true },

  // Paddock "feel" knobs read by the scene movement primitives (creatures.js).
  // ms delay range between wanders — shortened so the flock potters around more
  // often and feels livelier (#130). (No `roll`: only horses roll in the dirt.)
  movement: {
    wanderMin: 2500,
    wanderMax: 6500,
  },

  // World spawn (#167 B4) — read by creatures.js buildAnimals. Models come from the
  // allChickens roster (one per placement, by index); the coop is home with a wide
  // roam radius (#130). `pecks`/`roosts` capabilities wire the idle peck + coop entry.
  spawn: {
    inWorld: true,
    shadowScale: 0.25, walkFps: 8, tweenRate: 10, eatFps: 6, bodyR: 11,
    roam: 'world',
    placements: [
      { x: 520, y: 740, home: { x: 560, y: 760 }, wanderRadius: 220 },
      { x: 590, y: 730, home: { x: 560, y: 760 }, wanderRadius: 220 },
      { x: 560, y: 790, home: { x: 560, y: 760 }, wanderRadius: 220 },
      { x: 500, y: 780, home: { x: 560, y: 760 }, wanderRadius: 220 },
      { x: 610, y: 770, home: { x: 560, y: 760 }, wanderRadius: 220 },
    ],
  },

  // Info-panel presentation: static portrait, an italic personality line, no stat
  // bars or action buttons (chickens are identity-only for now).
  panel: { portrait: 'static', traitLine: 'personality', fixedAttrs: false },

  // AI priority list walked per-tick by the dispatcher (modules: ./behaviors.js).
  // Note: egg laying (eggLayTick, 45s timer) and roosting are scheduler-driven, not
  // per-tick decisions, so they stay in the scene mixins and are NOT listed here.
  behaviors: ['seekSeed', 'followForSeed', 'followWhenHungry', 'gatherAtBin'],
};
