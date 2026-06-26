// Sheep species definition — drives the generic Animal model (../../Animal.js) for
// the paddock flock. Everything about a sheep lives in this folder: this definition
// and the Sheep class (model.js); the procedural art is the one exception and lives
// in src/art/sheepArt.js (already present — this issue #184 just brings it into the
// world).
//
// The sheep is a grazer like the cow/pig (it opts into the shared herbivore food/
// water AI via the `grazes` capability). Its diet is data on the food itself
// (items.js `CONTENT_DEFS[...].feeds`): hay lists 'sheep', so a sheep walks to dropped
// hay and otherwise nibbles the grass — it ignores apples/carrots/seed.

export const SHEEP = {
  id: 'sheep',
  defaults: {
    id: () => `sheep-${Math.random().toString(36).slice(2, 9)}`,
    name: 'Cloud', breed: 'Wooly', coat: 0, age: 3, sex: 'female',
  },

  // Per-second decay while playing. Placid grazers — gentle hunger/thirst, between
  // the cow and the pig. Grooming is omitted (the brush only targets horses), like
  // the cow/pig — the sheep is fed/watered by the grazing AI and loved via Interact.
  needs: {
    hunger: { decay: 0.05,  default: 80, label: 'Food',  color: 0x63a31d },
    thirst: { decay: 0.045, default: 78, label: 'Water', color: 0x378add },
  },
  // Derived: drifts toward the average of the needs above, gentle so a pet's bump
  // lingers (mirrors the horse/cow/pig, #105).
  happiness: { default: 85, driftRate: 0.006, label: 'Love', color: 0x1d9e75 },

  // Care actions. Feed and water are applied by the grazing/drinking AI (she walks to
  // dropped hay and to the trough/stream) — not by direct carrier use. Pet is the
  // Interact action. No daily produce (no `produces`) — wool shearing is a future idea.
  actions: {
    feed:  { stat: 'hunger',    amount: 35, care: 'fed',     label: 'Feed',  sound: 'eat',   icon: 'iconFeed'  },
    water: { stat: 'thirst',    amount: 40, care: 'watered', label: 'Water', sound: 'drink', icon: 'iconWater' },
    pet:   { stat: 'happiness', amount: 7,  care: 'loved',   label: 'Love',  sound: 'chime', icon: 'iconHeart' },
  },

  // Track these care flags each day; missing any (yesterday) makes her wake neglected.
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
  // horseAI.js): she walks to dropped food she'll eat (hay — NOT apples/carrots/seed,
  // per her diet), drinks at the trough/stream, and nibbles grass — the same
  // primitives the horses/cow/pig use.
  capabilities: { saddleable: false, rideable: false, leadable: false, laysEggs: false, milkable: false, grazes: true },

  // Paddock "feel" knobs read by the scene movement primitives (creatures.js).
  // Sheep amble in a placid flock — unhurried, medium strolls.
  movement: {
    wanderMin: 4000,
    wanderMax: 9000,
  },

  // World spawn (#167 B4) — read by creatures.js buildAnimals. Models come from the
  // allSheep roster; `roam: 'pasture'` keeps the flock in the paddock; `grazes`
  // (capabilities) wires the shared food/water goal tick at spawn. The sheep art is
  // super-sampled (drawn on the ART_SCALE grid like the horse), so `superSampled`
  // tells the spawn to display it at S/ART_SCALE. No dedicated eat frames, so eatFps
  // aliases the idle pose (like the cow/pig).
  spawn: {
    inWorld: true,
    superSampled: true,
    shadowScale: 0.55, walkFps: 5, tweenRate: 9, eatFps: 6, bodyR: 14,
    roam: 'pasture',
    placements: [
      { x: 480, y: 1040 },
      { x: 600, y: 1110 },
      { x: 520, y: 1180 },
    ],
  },

  // Info-panel presentation: animated portrait (idle frames), stat bars from `needs`
  // + the love bar. No trait line, no fixed attrs.
  panel: { portrait: 'animated', fixedAttrs: false },

  // AI priority list, highest first — the sheep reuses the horse behavior modules
  // (registered as BEHAVIORS.sheep in ../index.js) via the generic dispatcher: seek
  // dropped hay, drink at the trough/stream, graze the grass. No begging the player.
  behaviors: ['seekFood', 'seekWater', 'seekStream', 'graze'],
};
