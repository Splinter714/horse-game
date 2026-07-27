// Dog species definition. A friendly farm dog that trots around the world, can be
// petted (#185), tags along as a companion (#186) — and, as of #347, actually needs
// FEEDING and WATERING like the cat and bunny: it has real hunger/thirst needs and
// its own combined food+water bowl by the doghouse (worldObjects.js buildDogBowl,
// the shared `_addPetBowl` plumbing from #311/#283). A hungry or thirsty dog trots
// to its stocked bowl and eats/drinks straight from it (seekDogFood/seekDogWater,
// ./behaviors.js). Its kibble is the SAME `catFood` content the cat eats, scooped
// from the one Kibble Sack in the yard — one sack feeds both pets (#347 unification),
// so there's no extra source prop to hunt for.
// Everything dog lives in this folder; the procedural art is in src/art/dogArt.js.

export const DOG = {
  id: 'dog',
  defaults: {
    id: () => `dog-${Math.random().toString(36).slice(2, 9)}`,
    name: 'Scout', breed: 'Farm Dog', coat: 0, age: 3, sex: 'male',
  },
  // Hunger + thirst (#347), both restored at the dog's own combined food+water bowl
  // via the shared pet-bowl AI (seekDogFood/seekDogWater, ./behaviors.js) — exactly
  // the cat's shape. Gentle decay (kid-friendly, matching the cat/bunny rather than
  // the horse's steeper curve) and no offline decay (rosters.js) so a dog is never
  // neglected into misery while you're away. With needs present, happiness eases
  // toward how fed+watered the dog is (Animal.recomputeHappiness); petting still tops
  // happiness up and fades (#105), so the dog is loved AND cared for.
  needs: {
    hunger: { decay: 0.05,  default: 78, label: 'Food',  color: 0x63a31d },
    thirst: { decay: 0.045, default: 78, label: 'Water', color: 0x378add },
  },
  happiness: { default: 72, baseline: 58, driftRate: 0.005, label: 'Happy', color: 0x1d9e75 },
  // A waggy, affectionate dog — a generous bump per pet. `feed`/`water` (#347) are
  // applied when the dog reaches a stocked side of its bowl and eats/drinks a serving
  // from it (petEatFromBowl) — same shape/sounds/icons as the cat's and bunny's.
  actions: {
    pet:   { stat: 'happiness', amount: 14, care: 'loved',   label: 'Love',  sound: 'chime', icon: 'iconHeart' },
    feed:  { stat: 'hunger',    amount: 35, care: 'fed',     label: 'Feed',  sound: 'eat',   icon: 'iconFeed'  },
    water: { stat: 'thirst',    amount: 40, care: 'watered', label: 'Water', sound: 'drink', icon: 'iconWater' },
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
  // Personality & preferences (#88 v1) — a farm dog's own vocabulary.
  personality: {
    pools: {
      activity: ['fetching sticks', 'running the fields', 'napping on the porch', 'exploring', 'herding the flock'],
      food: ['kibble', 'a meaty bone', 'leftover scraps'],
      treat: ['a chew stick', 'a belly rub', 'a game of fetch'],
      affinities: ['loves water', 'enjoys company', 'loves sunshine', 'loves a good nap', 'loves a long walk'],
    },
  },
  // `herds` wires the dog's goal-tick at spawn (creatures.js) to the behavior
  // dispatcher — its one charm behavior for now: occasionally nosing the sheep flock
  // into a bunch (#187). A fuller "dog job" (companion-follow, real herding) is #186.
  // `swims` (#231): a GENERIC, species-neutral capability — any species that declares
  // it gets the ambient stream-swim charm behavior (occasionally wander to the bank,
  // wade in, doggy-paddle in place for a bit, then wade out and resume wandering).
  // The dog is the only swimmer for now (fittingly — its personality pool below
  // already lists "loves water"); a future swimmer (ducks, #275) just needs its own
  // `${key}_swim_0/1` art frames + `swims: true` — no changes to the behavior itself.
  capabilities: { saddleable: false, rideable: false, leadable: false, laysEggs: false, herds: true, swims: true },

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
    superSampled: true, // drawn on the ART_SCALE grid — display at S/ART_SCALE
    // `eatFps` registers the head-down eat/drink anim the bowl primitive plays
    // (#347). Dog art has no dedicated eat frames, so creatures.js aliases it to the
    // idle pose automatically — no missing-anim warning, no new art needed.
    shadowScale: 0.5, walkFps: 6, tweenRate: 8, eatFps: 4, bodyR: 11,
    roam: 'world',
    placements: [{ x: 520, y: 760 }],
  },

  // Info-panel presentation: animated portrait (idle frames), an italic personality
  // line, and Food + Water + Love bars (#347 — rendered generically from `needs`).
  // No action buttons — care happens in-world (stock the bowl + the Interact pet).
  panel: { portrait: 'animated', traitLine: 'personality', fixedAttrs: false },

  // AI priority list (#187/#231/#347). Survival first: a hungry or thirsty dog trots
  // to its stocked bowl and eats/drinks from it (seekDogFood/seekDogWater — the same
  // priority the cat/bunny give their bowls). Then herding when sheep are in range,
  // then an occasional, off-cooldown swim in the stream (swimStream, generic —
  // ./../swim.js; dispatched via BEHAVIORS.dog in ../index.js). Otherwise it falls
  // through to its brisk wander.
  behaviors: ['seekDogFood', 'seekDogWater', 'dogHerdSheep', 'swimStream'],
};
