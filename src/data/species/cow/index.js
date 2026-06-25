// Cow species definition — drives the generic Animal model (../../Animal.js) for
// the dairy cow. Everything about a cow lives in this folder: this definition, the
// Cow class (model.js); the procedural art is the one exception and lives in
// src/art/cowArt.js.
//
// The cow has full survival needs like a horse (hunger / thirst / love), but it is
// cared for by DIRECT interaction in the world rather than the herd's grazing AI:
// a food basket feeds her, a water-filled bucket waters her, and petting loves her
// (see PaddockScene.feedCow/waterCow + petAnimal). The payoff is milk: once a day,
// if she was well cared for the DAY BEFORE, an empty bucket can milk her (#cow).

export const COW = {
  id: 'cow',
  // No name to start (the owner wanted her nameless for now) — the model still
  // carries a `name` field, so she can be named later without any code change.
  defaults: {
    id: () => `cow-${Math.random().toString(36).slice(2, 9)}`,
    name: '', breed: 'Holstein', coat: 0, age: 4, sex: 'female',
  },

  // Per-second decay while playing, tuned gentle like the horse's. Grooming is
  // omitted: the cow isn't brushed (the brush tool only targets horses), so a
  // grooming bar would never move. She is fed/watered/loved by direct care.
  needs: {
    hunger: { decay: 0.05, default: 80, label: 'Food',  color: 0x63a31d },
    thirst: { decay: 0.06, default: 75, label: 'Water', color: 0x378add },
  },
  // Derived: drifts toward the average of the needs above. Gentle drift so a pet's
  // happiness bump lingers (mirrors the horse, #105).
  happiness: { default: 85, driftRate: 0.006, label: 'Love', color: 0x1d9e75 },

  // Care actions: feed (food basket), water (water bucket), and pet (love).
  actions: {
    feed:  { stat: 'hunger',    amount: 35, care: 'fed',     label: 'Feed',  sound: 'eat',   icon: 'iconFeed'  },
    water: { stat: 'thirst',    amount: 40, care: 'watered', label: 'Water', sound: 'drink', icon: 'iconWater' },
    pet:   { stat: 'happiness', amount: 6,  care: 'loved',   label: 'Love',  sound: 'chime', icon: 'iconHeart' },
  },

  // Daily produce (#cow): the cow gives one bucket of milk per day. Normally gated
  // on having met the required care the DAY BEFORE (the daily-care cycle below), but
  // `readyAtStart` lets a fresh cow be milked on day one so the mechanic is easy to
  // try. The generic Animal model reads this to drive readyToProduce / producedToday.
  produces: { content: 'milk', readyAtStart: true },

  // Track these care flags each day; missing any (yesterday) makes her wake up
  // neglected AND leaves her not ready to milk that day.
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
  // horseAI.js): she eats dropped hay/apple/carrot, drinks at the trough/stream, and
  // nibbles grass — the same primitives the horses use, now species-generic.
  capabilities: { saddleable: false, rideable: false, leadable: false, laysEggs: false, milkable: true, grazes: true },

  // Paddock "feel" knobs read by the scene movement primitives (creatures.js).
  // Cows are slow, placid wanderers that rest a good while between strolls.
  movement: {
    wanderMin: 6000,
    wanderMax: 13000,
  },

  // Info-panel presentation: animated portrait (she has idle frames), stat bars
  // from `needs` + the love bar. No trait line, no fixed attrs.
  panel: { portrait: 'animated', fixedAttrs: false },

  // AI priority list, highest first — the cow reuses the horse behavior modules
  // (registered as BEHAVIORS.cow in ../index.js) via the generic dispatcher. She
  // seeks dropped food, drinks at the trough/stream, and grazes the grass, but she
  // does NOT beg the player (no `begPlayer`) — she's placid, not pushy.
  behaviors: ['seekFood', 'seekWater', 'seekStream', 'graze'],
};
