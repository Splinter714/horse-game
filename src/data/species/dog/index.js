// Dog species definition. Identity-only for now (no survival needs/decay, like the
// cat) — a friendly farm dog that trots around the world and can be petted (#185).
// A real "dog job" (companion-follow, herding strays through the gate) is the bigger
// follow-up #186; this first pass just brings the existing art into the world.
// Everything dog lives in this folder; the procedural art is in src/art/dogArt.js.

export const DOG = {
  id: 'dog',
  defaults: {
    id: () => `dog-${Math.random().toString(36).slice(2, 9)}`,
    name: 'Scout', breed: 'Farm Dog', coat: 0, age: 3, sex: 'male',
  },
  // No survival needs yet, but a love/happiness stat so petting lands on something
  // and completes (#104). With no needs to average, happiness eases toward `baseline`
  // and petting tops it up; a slow `driftRate` keeps a pet rewarding (#105).
  needs: {},
  happiness: { default: 72, baseline: 58, driftRate: 0.005, label: 'Happy', color: 0x1d9e75 },
  // A waggy, affectionate dog — a generous bump per pet.
  actions: {
    pet: { stat: 'happiness', amount: 14, care: 'loved', label: 'Love', sound: 'chime', icon: 'iconHeart' },
  },
  dailyCare: { track: ['loved'], requiredForContentment: [] },
  mood: [
    [75, 'delighted'],
    [50, 'happy'],
    [25, 'restless'],
    [0,  'wants you'],
  ],
  traits: { personality: 'loyal' },
  optionalAttrs: [],
  capabilities: { saddleable: false, rideable: false, leadable: false, laysEggs: false },

  // Paddock "feel" knobs read by the scene movement primitives (creatures.js). A dog
  // is restless and quick — short pauses, brisk trots — unlike the cat's slow prowl.
  movement: {
    wanderMin: 2500,
    wanderMax: 7000,
  },

  // World spawn (#167 B4) — read by creatures.js buildAnimals. Spawns from the
  // persisted allDogs roster so its customizer look + happiness survive reloads.
  // `roam: 'world'` lets it trot the whole farm like the cat. Dog art is 1× (not
  // super-sampled), so it displays at the base S scale. One placement.
  spawn: {
    inWorld: true,
    shadowScale: 0.5, walkFps: 6, tweenRate: 8, bodyR: 11,
    roam: 'world',
    placements: [{ x: 520, y: 760 }],
  },

  // Info-panel presentation: animated portrait (idle frames), an italic personality
  // line, no stat bars or action buttons (identity-only) — same shape as the cat.
  panel: { portrait: 'animated', traitLine: 'personality', fixedAttrs: false },
};
