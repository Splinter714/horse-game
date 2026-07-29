// Goat species definition (#267) — drives the generic Animal model (../../Animal.js)
// for the dairy goat. Everything about a goat lives in this folder: this definition and
// the Goat class (model.js); the procedural art is the one exception and lives in
// src/art/goatArt.js.
//
// The goat is a cared-for barnyard grazer like the cow — fed/watered by the shared
// herbivore AI, loved by petting — and, like the cow, MILKABLE: once a day, if she was
// well cared for the DAY BEFORE, an empty bucket milks her for goat milk (same daily-
// gated `produces` pattern the cow uses; milk rides the existing bucket → farm-stand
// pipeline, no new content). Her charm quirk is that she eats EVERYTHING: unlike the
// pickier grazers, a goat will trot over to any food the farm drops — hay, apples,
// carrots, even the chickens' seed. That "eats everything" diet isn't declared here —
// it's data on the food itself (items.js CONTENT_DEFS, where every edible pile lists
// 'goat' in its `feeds`), which the shared grazing AI reads when choosing a pile.

export const GOAT = {
  id: 'goat',
  defaults: {
    id: () => `goat-${Math.random().toString(36).slice(2, 9)}`,
    name: 'Gruff', breed: 'Nubian', coat: 0, age: 3, sex: 'female',
  },

  // Per-second decay while playing, tuned like the cow/pig. Grooming is omitted (the
  // brush tool only targets horses), so she has hunger/thirst needs plus derived love.
  // Goats are famous nibblers, so hunger ebbs a touch faster (like the pig).
  needs: {
    hunger: { decay: 0.06, default: 80, label: 'Food',  color: 0x63a31d },
    thirst: { decay: 0.05, default: 75, label: 'Water', color: 0x378add },
  },
  // Derived: drifts toward the average of the needs above; gentle so a pet's happiness
  // bump lingers (mirrors the horse/cow, #105).
  happiness: { default: 85, driftRate: 0.006, label: 'Love', color: 0x1d9e75 },

  // Care actions. Feed and water are applied by the grazing/drinking AI (she walks to
  // dropped food and to the trough/stream) — not by direct carrier use. Pet is the
  // Interact action. The stat/amount/care-flag data is read by those paths the same way.
  actions: {
    feed:  { stat: 'hunger',    amount: 35, care: 'fed',     label: 'Feed',  sound: 'eat',   icon: 'iconFeed'  },
    water: { stat: 'thirst',    amount: 40, care: 'watered', label: 'Water', sound: 'drink', icon: 'iconWater' },
    pet:   { stat: 'happiness', amount: 6,  care: 'loved',   label: 'Love',  sound: 'chime', icon: 'iconHeart' },
  },

  // Daily produce (#267, mirroring the cow's milk #cow): the goat gives one bucket of
  // goat milk per day. Gated on having met the required care the DAY BEFORE (the daily-
  // care cycle below), but `readyAtStart` lets a fresh goat be milked on day one so the
  // mechanic is easy to try. The generic Animal model reads this to drive readyToProduce
  // / producedToday; the generic care dispatch (careActions/useDispatch) reads verb/
  // sound/icon to label the Use prompt, play the harvest sound, and float the icon — all
  // data, no goat-specific code. Reuses the shared `milk` content + bucket carrier.
  produces: { content: 'milk', readyAtStart: true, verb: 'Milk', sound: 'milk', icon: 'iconBucketMilk' },

  // Track these care flags each day; missing any (yesterday) makes her wake up neglected
  // AND leaves her not ready to milk that day.
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
  // Personality & preferences (#88 v1) — a goat's own vocabulary. The eat-everything
  // charm shows up here in the flavour pools; the actual diet mechanic is items.js data.
  personality: {
    pools: {
      activity: ['nibbling on everything', 'headbutting a fencepost', 'climbing on things', 'snuffling for snacks', 'napping in the sun'],
      food: ['literally anything', 'hay', 'apples', 'carrots', 'a stray sock'],
      treat: ['apple slices', 'a juicy carrot', 'a whole cabbage'],
      affinities: ['eats absolutely everything', 'loves to climb', 'endlessly curious', 'enjoys company', 'loves a good nibble'],
    },
  },
  // `grazes` opts her into the shared herbivore feeding/drinking AI (creatures.js /
  // horseAI.js): she walks to dropped food she'll eat, drinks at the trough/stream, and
  // nibbles grass — the same primitives the horses/cow use, now species-generic. Her
  // eat-everything diet (all pile contents) is data on the food, not a capability here.
  capabilities: { saddleable: false, rideable: false, leadable: false, laysEggs: false, milkable: true, grazes: true },

  // Paddock "feel" knobs read by the scene movement primitives (creatures.js). Goats
  // are brisk, busy little foragers — quicker, shorter strolls than the placid cow.
  movement: {
    wanderMin: 3500,
    wanderMax: 8000,
  },

  // World spawn (#167 B4) — read by creatures.js buildAnimals. The model comes from the
  // allGoats roster; `roam: 'pasture'` keeps her in the paddock with the herd; `grazes`
  // (capabilities) wires the shared food/water goal tick at spawn.
  spawn: {
    inWorld: true,
    superSampled: true, // drawn on the ART_SCALE grid — display at S/ART_SCALE
    // tweenRate is ms-per-pixel of travel (higher = slower). The horse pace is 10; the
    // goat is a nimble, busy little animal, so she trots a touch quicker than the horse.
    shadowScale: 0.7, walkFps: 4, tweenRate: 9, eatFps: 6, bodyR: 12,
    // A goat is smaller than a horse/cow — render her a bit under the base scale so she
    // reads as the little animal she is. `scale` is a per-species size multiplier on top
    // of S, applied to her sprite + shadow in creatures.js.
    scale: 0.9,
    roam: 'pasture',
    placements: [{ x: 1330, y: 1300 }], // moved 2026-07-28 — was overlapping the oat sack (world.js)
  },

  // Info-panel presentation: animated portrait (she has idle frames), stat bars from
  // `needs` + the love bar. No trait line, no fixed attrs.
  panel: { portrait: 'animated', fixedAttrs: false },

  // AI priority list, highest first — the goat reuses the horse behavior modules
  // (registered as BEHAVIORS.goat in ../index.js) via the generic dispatcher. She seeks
  // dropped food (of ANY kind — her eat-everything diet), drinks at the trough/stream,
  // and grazes the grass, but she does NOT beg the player (no `begPlayer`).
  // `seekShelter` (#349) sits after the real needs and before ambient grazing: rain
  // sends her into the barn until it clears.
  behaviors: ['seekFood', 'seekWater', 'seekStream', 'seekShelter', 'graze'],
};
