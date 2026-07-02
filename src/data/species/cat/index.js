// Cat species definition. A semi-independent barn cat: it can be petted (love stat)
// and, as of #202, actually feeds and waters itself — a hungry cat walks to its FOOD
// BOWL and eats straight from it (seekFood, ./behaviors.js), a thirsty cat to its
// WATER BOWL (seekWater). The player's job is to keep the bowls stocked — scoop cat
// food from the kibble sack into a basket and pour it into the food bowl, pour a
// bucket of water into the water bowl (worldObjects.js fillCatBowl). When the food
// bowl runs empty a hungry cat falls back to its cosmetic fishing loop (catFish, #163)
// — which still never catches anything (#201), just a distraction until it's refilled.

export const CAT = {
  id: 'cat',
  defaults: {
    id: () => `cat-${Math.random().toString(36).slice(2, 9)}`,
    name: 'Mittens', breed: 'Barn Cat', coat: 0, age: 2, sex: 'male',
  },
  // Hunger + thirst, both with real food/water sources (#202): dropped piles
  // (seekFood/seekWater, ./behaviors.js) restore them via the shared grazing AI,
  // same as an herbivore's hay/trough. Gentle decay (kid-friendly, a touch gentler
  // than the horse's — the cat has no daily-care nag to keep up with) and no
  // offline decay (the cat roster is identity-only, rosters.js) keep them from
  // bottoming out instantly / while away. With needs present, happiness eases
  // toward how fed+watered the cat is (Animal.recomputeHappiness); petting still
  // tops happiness up and fades (#105), so the cat is loved AND cared for, not
  // starved.
  needs: {
    hunger: { decay: 0.05,  default: 78, label: 'Food',  color: 0x63a31d },
    thirst: { decay: 0.045, default: 78, label: 'Water', color: 0x378add },
  },
  happiness: { default: 65, baseline: 50, driftRate: 0.004, label: 'Happy', color: 0x1d9e75 },
  // A cat takes a bit more winning over — a slightly smaller bump per pet.
  // `feed`/`water` (#202) are applied when the cat reaches a stocked bowl and eats/
  // drinks a serving from it (catEatFromBowl, seekFood/seekWater) — same shape as an
  // herbivore's feed/water actions, sound/icon reused from the established conventions.
  actions: {
    pet:   { stat: 'happiness', amount: 12, care: 'loved',    label: 'Love',  sound: 'chime', icon: 'iconHeart' },
    feed:  { stat: 'hunger',    amount: 35, care: 'fed',      label: 'Feed',  sound: 'eat',   icon: 'iconFeed'  },
    water: { stat: 'thirst',    amount: 40, care: 'watered',  label: 'Water', sound: 'drink', icon: 'iconWater' },
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
  // and stops aliasing to idle, so the cat visibly eats/drinks when seekFood/seekWater
  // reaches a stocked bowl (catEatFromBowl, #202 rework).
  spawn: {
    inWorld: true,
    superSampled: true, // drawn on the ART_SCALE grid — display at S/ART_SCALE
    shadowScale: 0.34, walkFps: 5, tweenRate: 16, eatFps: 4, bodyR: 11,
    roam: 'world',
    placements: [{ x: 700, y: 600 }], // slow, low-slung prowl
  },

  // Info-panel presentation: animated portrait (the cat has idle frames), an italic
  // personality line, and a Food + Water + Love bar (the hunger/thirst needs +
  // happiness — InfoPanelScene renders these generically from `needs`, no scene
  // code needed). No action buttons — the cat feeds/waters itself from its bowls
  // (or fishes) and is loved via the Interact pet.
  panel: { portrait: 'animated', traitLine: 'personality', fixedAttrs: false },

  // AI priority list (#163/#202). A hungry or thirsty cat heads to its bowl: it walks
  // to the stocked food bowl and eats from it (seekFood) or the water bowl and drinks
  // (seekWater) before falling back to its cosmetic stream-fishing loop (catFish, in
  // ./behaviors.js; dispatched via BEHAVIORS.cat in ../index.js). Otherwise it falls
  // through to its ordinary slow prowl/wander.
  behaviors: ['seekFood', 'seekWater', 'catFish'],
};
