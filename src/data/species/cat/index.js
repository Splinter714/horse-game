// Cat species definition. A semi-independent barn cat: it can be petted (love stat)
// and, now that #202 is done, actually feeds itself — a hungry cat prefers walking to
// dropped fish (seekFood, ./behaviors.js; gathered by the player from the fishing
// barrel by the stream, items.js `fish` content) over its old cosmetic fishing loop
// (catFish, #163) — which still never catches anything (#201) and is now just a
// fallback so a hungry cat with no fish out still has somewhere to go.

export const CAT = {
  id: 'cat',
  defaults: {
    id: () => `cat-${Math.random().toString(36).slice(2, 9)}`,
    name: 'Mittens', breed: 'Barn Cat', coat: 0, age: 2, sex: 'male',
  },
  // A hunger need with a real food source now (#202): a dropped fish pile (seekFood,
  // ./behaviors.js) restores it via the shared grazing AI, same as an herbivore's hay.
  // Gentle decay (kid-friendly) and no offline decay (the cat roster is identity-only,
  // rosters.js) keep it from bottoming out instantly / while away. With a need present,
  // happiness eases toward how fed the cat is (Animal.recomputeHappiness); petting
  // still tops happiness up and fades (#105), so the cat is loved AND fed, not starved.
  needs: {
    hunger: { decay: 0.05, default: 78, label: 'Food', color: 0x63a31d },
  },
  happiness: { default: 65, baseline: 50, driftRate: 0.004, label: 'Happy', color: 0x1d9e75 },
  // A cat takes a bit more winning over — a slightly smaller bump per pet.
  // `feed` (#202) is applied by the shared grazing AI when the cat reaches a
  // dropped fish pile (seekFood, ./behaviors.js) — same shape as an herbivore's
  // feed action, sound/icon reused from the established feed convention.
  actions: {
    pet:  { stat: 'happiness', amount: 12, care: 'loved', label: 'Love', sound: 'chime', icon: 'iconHeart' },
    feed: { stat: 'hunger',    amount: 35, care: 'fed',   label: 'Feed', sound: 'eat',   icon: 'iconFeed'  },
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
  // shadow/animation; one placement. `eatFps` now drives a REAL head-down eat pose
  // (catArt.js `drawCatEat`, #198) — creatures.js auto-detects the `cat_eat_0` texture
  // and stops aliasing to idle, so the cat visibly eats when seekFood reaches a
  // dropped fish pile via the shared horseGoEat primitive (#202).
  spawn: {
    inWorld: true,
    superSampled: true, // drawn on the ART_SCALE grid — display at S/ART_SCALE
    shadowScale: 0.34, walkFps: 5, tweenRate: 16, eatFps: 4, bodyR: 11,
    roam: 'world',
    placements: [{ x: 700, y: 600 }], // slow, low-slung prowl
  },

  // Info-panel presentation: animated portrait (the cat has idle frames), an italic
  // personality line, and now a Food + Love bar (the hunger need + happiness). No
  // action buttons — the cat feeds itself (dropped fish, or fishing) and is loved via
  // the Interact pet.
  panel: { portrait: 'animated', traitLine: 'personality', fixedAttrs: false },

  // AI priority list (#163/#202). A hungry cat prefers real food: it walks to the
  // nearest dropped fish pile it can reach (seekFood) before falling back to its
  // cosmetic stream-fishing loop (catFish, in ./behaviors.js; dispatched via
  // BEHAVIORS.cat in ../index.js). Otherwise it falls through to its ordinary slow
  // prowl/wander.
  behaviors: ['seekFood', 'catFish'],
};
