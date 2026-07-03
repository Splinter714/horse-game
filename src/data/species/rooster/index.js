// Rooster species definition (#269) — a sibling of the chicken (../chicken/index.js).
// Drives the generic Animal model (../../Animal.js). Everything about a rooster lives
// in this folder: this definition, the Rooster class (model.js), and the AI behavior
// modules (behaviors.js). Procedural art is the one exception (src/art/roosterArt.js).
//
// A rooster is a chicken-like flock bird: it potters the yard, pecks, and roosts in the
// coop at night alongside the hens — the SAME coop/flock machinery, wired off the shared
// `roosts`/`pecks` capabilities (creatures.js / dayNight.js / flock.js check the
// capability now, not a `chicken` key, so a rooster joins the flock with no per-species
// hardcoding). What makes it a ROOSTER and not a hen:
//   • it CROWS at dawn (day/night flavor) — the `crowAtDawn` behavior, fired by the
//     Morning PHASE_CHANGE (paddock/dayNight.js), not a per-tick decision;
//   • it does NOT lay eggs (`laysEggs: false`), so eggLayTick skips it;
//   • it is the BREEDING PARTNER for baby chicks — see `breedingPartner` below (#274).

export const ROOSTER = {
  id: 'rooster',
  defaults: {
    id: () => `rooster-${Math.random().toString(36).slice(2, 9)}`,
    name: 'Rooster', breed: 'Rooster', coat: 0, age: 2, sex: 'male', // roosters — the cockerels
  },
  // Like the hen: no survival needs, just a love/happiness stat so petting lands and
  // the interaction completes. Eases toward baseline; petting tops it up.
  needs: {},
  happiness: { default: 72, baseline: 55, driftRate: 0.004, label: 'Happy', color: 0x1d9e75 },
  actions: {
    pet: { stat: 'happiness', amount: 14, care: 'loved', label: 'Love', sound: 'chime', icon: 'iconHeart' },
  },
  dailyCare: { track: ['loved'], requiredForContentment: [] },
  mood: [
    [75, 'proud and strutting'],
    [50, 'content'],
    [25, 'a bit restless'],
    [0,  'wants attention'],
  ],
  traits: { personality: 'proud' },
  optionalAttrs: [],
  // Personality & preferences (#88 v1) — a rooster's own vocabulary (prouder than a hen).
  personality: {
    pools: {
      activity: ['strutting the yard', 'crowing at the sky', 'scratching for grubs', 'guarding the flock', 'puffing his chest'],
      food: ['seed', 'grain', 'corn', 'fresh greens'],
      treat: ['a handful of mealworms', 'sweet corn', 'a leafy scrap'],
      affinities: ['loves to crow', 'watches over the hens', 'loves a proud strut', 'loves the sunrise', 'loves scratching about'],
    },
  },
  // Capabilities:
  //   pecks/roosts  — flock behaviour, SAME as the hen (idle ground-peck + coop at night).
  //   laysEggs:false — a rooster does NOT lay (eggLayTick filters on laysEggs).
  //   crows         — declares the dawn-crow hook (paddock/dayNight.js listens for it on
  //                   the Morning phase and runs the `crowAtDawn` behavior primitive).
  //   breedingPartner — the marker #274's chick-hatching will hook into: a hen only
  //                   produces a fertilised egg / a chick can only hatch when a
  //                   breedingPartner rooster is present in the flock. Purely a data flag
  //                   here (nothing consumes it yet); #274 reads it to gate hatching.
  capabilities: {
    saddleable: false, rideable: false, leadable: false,
    laysEggs: false, pecks: true, roosts: true, crows: true, breedingPartner: true,
  },

  // Paddock "feel" — same potter-about cadence as the hen.
  movement: {
    wanderMin: 2500,
    wanderMax: 6500,
  },

  // World spawn (#167 B4) — one rooster, placed near the hens by the coop. Same visual
  // knobs as the chicken (super-sampled art, shown at S/ART_SCALE). `pecks`/`roosts`
  // wire the idle peck + coop entry from the capability flags (creatures.js).
  spawn: {
    inWorld: true,
    superSampled: true,
    shadowScale: 0.28, walkFps: 8, tweenRate: 10, eatFps: 6, bodyR: 12,
    roam: 'world',
    placements: [
      { x: 560, y: 720, home: { x: 560, y: 760 }, wanderRadius: 220 },
    ],
  },

  // Info-panel presentation: static portrait, an italic personality line, no stat bars.
  panel: { portrait: 'static', traitLine: 'personality', fixedAttrs: false },

  // AI priority list walked per-tick by the dispatcher (modules: ./behaviors.js).
  // Shares the hen's flock behaviors (flee a dog, chase seed, follow a seed-carrier,
  // crowd the bin when hungry) so the rooster mills with the flock. `crowAtDawn` is a
  // top-priority interrupt but its `test` only ever fires when the scene arms it (dawn),
  // so it stays dormant during normal ticks — the crow itself is scheduler-driven
  // (Morning PHASE_CHANGE), same pattern as egg-laying/roosting on the hen.
  behaviors: ['crowAtDawn', 'fleeDog', 'seekSeed', 'followForSeed', 'followWhenHungry', 'gatherAtBin'],
};
