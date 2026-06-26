// Cat species definition. A semi-independent barn cat: it can be petted (love stat)
// and now feeds ITSELF by hunting fish at the stream when hungry (#163) — the farmer
// never feeds the cat, so there's no `feed` action and no carrier diet.

export const CAT = {
  id: 'cat',
  defaults: {
    id: () => `cat-${Math.random().toString(36).slice(2, 9)}`,
    name: 'Mittens', breed: 'Barn Cat', coat: 0, age: 2, sex: 'male',
  },
  // A hunger need the cat satisfies ITSELF by fishing (#163) — there's no farmer
  // `feed` action; the catFish behavior restores it. Gentle decay (kid-friendly), and
  // no offline decay (the cat roster is identity-only, rosters.js), so a returning
  // player never finds a starved cat. With a need present, happiness eases toward how
  // fed the cat is (Animal.recomputeHappiness); petting still tops it up and fades (#105).
  needs: {
    hunger: { decay: 0.05, default: 78, label: 'Food', color: 0x63a31d },
  },
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
  // `hunts` wires the cat's goal-tick at spawn (creatures.js) to the behavior
  // dispatcher, so a hungry cat runs its `behaviors` list (below) before a plain
  // wander — the same hook `grazes` uses for the herbivores.
  capabilities: { saddleable: false, rideable: false, leadable: false, laysEggs: false, hunts: true },

  // Paddock "feel" knobs read by the scene movement primitives (creatures.js).
  // Cats are independent loungers: they prowl slowly and rest longer between
  // strolls, so the wander delays run longer than the more restless animals.
  // (No `roll`: only horses roll in the dirt.)
  movement: {
    wanderMin: 6000,
    wanderMax: 14000,
  },

  // World spawn (#167 B4) — read by creatures.js buildAnimals so adding an animal is
  // data, not a hardcoded spawn. Spawns from the persisted `allCats` roster (rosters.js)
  // so its customizer look + happiness survive reloads; visual params drive the
  // shadow/animation; one placement.
  spawn: {
    inWorld: true,
    shadowScale: 0.34, walkFps: 5, tweenRate: 16, bodyR: 11,
    roam: 'world',
    placements: [{ x: 700, y: 600 }], // slow, low-slung prowl
  },

  // Info-panel presentation: animated portrait (the cat has idle frames), an italic
  // personality line, and now a Food + Love bar (the hunger need + happiness). No
  // action buttons — the cat feeds itself (fishing) and is loved via the Interact pet.
  panel: { portrait: 'animated', traitLine: 'personality', fixedAttrs: false },

  // AI priority list (#163). The cat's only goal-driven behavior: when hungry it goes
  // fishing at the stream (catFish, in ./behaviors.js; dispatched via BEHAVIORS.cat in
  // ../index.js). Otherwise it falls through to its ordinary slow prowl/wander.
  behaviors: ['catFish'],
};
