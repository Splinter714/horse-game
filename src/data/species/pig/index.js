// Pig species definition — drives the generic Animal model (../../Animal.js) for
// the paddock pig. Everything about a pig lives in this folder: this definition and
// the Pig class (model.js); the procedural art is the one exception and lives in
// src/art/pigArt.js.
//
// The pig is a grazer like the cow (it opts into the shared herbivore food/water AI
// via the `grazes` capability), but with a pickier diet: pigs love apples and
// carrots and turn their snouts up at hay. That diet isn't declared here — it's
// data on the food itself (items.js `CONTENT_DEFS[...].feeds`): apple and carrot
// list 'pig', hay does not. The grazing AI reads that diet when choosing which
// dropped pile to walk to, so a pig strolls right past a hay pile (see
// behaviors.js `_nearestReachableHay` + items.js `speciesEatsContent`).

export const PIG = {
  id: 'pig',
  defaults: {
    id: () => `pig-${Math.random().toString(36).slice(2, 9)}`,
    name: 'Penny', breed: 'Pink', coat: 0, age: 2, sex: 'female',
  },

  // Per-second decay while playing. Pigs are famously hungry, so hunger ebbs a
  // touch faster than the cow's; thirst is gentle. Grooming is omitted (the brush
  // only targets horses), like the cow — the pig is fed and watered by the grazing/
  // drinking AI and loved via the Interact action, not by direct carrier use.
  needs: {
    hunger: { decay: 0.06, default: 80, label: 'Food',  color: 0x63a31d },
    thirst: { decay: 0.05, default: 75, label: 'Water', color: 0x378add },
  },
  // Derived: drifts toward the average of the needs above, gentle so a pet's bump
  // lingers (mirrors the horse/cow, #105).
  happiness: { default: 85, driftRate: 0.006, label: 'Love', color: 0x1d9e75 },

  // Care actions. Feed and water are applied by the grazing/drinking AI (she walks to
  // dropped apples/carrots and to the trough/stream) — not by direct carrier use. Pet
  // is the Interact action. The pig has no daily produce (unlike the cow's milk), so
  // there's no `produces`.
  actions: {
    feed:  { stat: 'hunger',    amount: 35, care: 'fed',     label: 'Feed',  sound: 'eat',   icon: 'iconFeed'  },
    water: { stat: 'thirst',    amount: 40, care: 'watered', label: 'Water', sound: 'drink', icon: 'iconWater' },
    pet:   { stat: 'happiness', amount: 6,  care: 'loved',   label: 'Love',  sound: 'chime', icon: 'iconHeart' },
  },

  // Track these care flags each day; missing any (yesterday) makes her wake up
  // neglected. No produce gating since the pig doesn't produce anything.
  dailyCare: { track: ['fed', 'watered', 'loved'], requiredForContentment: ['fed', 'watered', 'loved'] },

  // Happiness → friendly label (highest threshold met wins).
  mood: [
    [80, 'happy'],
    [55, 'content'],
    [30, 'a bit down'],
    [0,  'needs you'],
  ],

  traits: {},
  optionalAttrs: [],
  // `grazes` opts her into the shared herbivore feeding/drinking AI (creatures.js /
  // horseAI.js): she walks to dropped food she'll eat (apples/carrots — NOT hay,
  // per her diet), drinks at the trough/stream, and nibbles grass — the same
  // primitives the horses and cow use, now species-generic.
  capabilities: { saddleable: false, rideable: false, leadable: false, laysEggs: false, milkable: false, grazes: true },

  // Paddock "feel" knobs read by the scene movement primitives (creatures.js).
  // Pigs are brisk little foragers — quicker, shorter strolls than the placid cow.
  movement: {
    wanderMin: 3500,
    wanderMax: 8000,
  },

  // World spawn (#167 B4) — read by creatures.js buildAnimals. The model comes from
  // the allPigs roster; `roam: 'pasture'` keeps her in the paddock with the herd;
  // `grazes` (capabilities) wires the shared food/water goal tick at spawn. The pig
  // art has no dedicated eat frames, so eatFps aliases the idle pose (like the cow).
  spawn: {
    inWorld: true,
    superSampled: true, // drawn on the ART_SCALE grid — display at S/ART_SCALE
    shadowScale: 0.7, walkFps: 4, tweenRate: 11, eatFps: 6, bodyR: 12,
    roam: 'pasture',
    placements: [{ x: 1280, y: 1240 }],
  },

  // Info-panel presentation: animated portrait (idle frames), stat bars from
  // `needs` + the love bar. No trait line, no fixed attrs.
  panel: { portrait: 'animated', fixedAttrs: false },

  // AI priority list, highest first — the pig reuses the horse behavior modules
  // (registered as BEHAVIORS.pig in ../index.js) via the generic dispatcher. She
  // seeks dropped food she'll eat, drinks at the trough/stream, and grazes the
  // grass, but she does NOT beg the player (no `begPlayer`).
  behaviors: ['seekFood', 'seekWater', 'seekStream', 'graze'],
};
