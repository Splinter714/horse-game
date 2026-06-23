// Horse species definition — the data that drives the generic Animal model
// (../../Animal.js) for horses. Everything about a horse lives in this folder:
// this definition, the Horse class (model.js), the coat tables (coats.js), the
// procedural art is the one exception and lives in src/art/horseArt.js.
//
// `behaviors` is the ordered AI priority list walked by the behavior dispatcher
// (src/scenes/paddock/behaviors.js); the modules themselves live in behaviors.js
// next to this file. Numbers below faithfully reproduce the original hand-coded
// Horse model so the data-driven model stays behavior-neutral.

export const HORSE = {
  id: 'horse',
  defaults: { id: 'horse-1', name: 'Buttercup', breed: 'Palomino', coat: 'palomino', age: 3, sex: 'female' },

  // Per-second decay while playing. Tuned gentle (hunger fully depletes in ~30 min
  // of continuous play). `default` is the fresh-animal starting value. `label`/
  // `color` drive the info-panel stat bar.
  needs: {
    hunger:   { decay: 0.05, default: 80, label: 'Food',  color: 0x63a31d },
    thirst:   { decay: 0.06, default: 75, label: 'Water', color: 0x378add },
    grooming: { decay: 0.03, default: 60, label: 'Brush', color: 0xba7517 },
  },
  // Derived: drifts toward the average of the needs above. The drift is gentle
  // (slow) so a pet's happiness bump lingers and feels rewarding instead of being
  // erased within a minute (#105).
  happiness: { default: 85, driftRate: 0.006, label: 'Happy', color: 0x1d9e75 },

  // Care actions: stat to bump, amount, the daily-care flag it satisfies, the UI
  // button label, and the sound/floating-icon feedback. `pet` is special-cased by
  // the UI (heart + hop).
  actions: {
    feed:  { stat: 'hunger',    amount: 35, care: 'fed',     label: 'Feed',  sound: 'eat',   icon: 'iconFeed'  },
    water: { stat: 'thirst',    amount: 40, care: 'watered', label: 'Water', sound: 'drink', icon: 'iconWater' },
    brush: { stat: 'grooming',  amount: 18, care: 'brushed', label: 'Brush', sound: 'brush', icon: 'iconBrush' },
    // Every pet nudges happiness up a little (capped — see #98) and records the
    // day's love so the horse won't wake up grumpy.
    pet:   { stat: 'happiness', amount: 5,  care: 'loved',   label: 'Love',  sound: 'chime', icon: 'iconHeart' },
  },

  // Info-panel presentation: animated portrait, optional fixed-attribute row.
  panel: { portrait: 'animated', fixedAttrs: true },

  // Track these care flags each day; missing any in `requiredForContentment`
  // (yesterday) makes the horse wake up neglected.
  dailyCare: { track: ['fed', 'watered', 'brushed', 'loved'], requiredForContentment: ['fed', 'watered', 'loved'] },

  // Happiness → friendly label (first threshold met wins; highest first).
  mood: [
    [80, 'happy'],
    [55, 'content'],
    [30, 'a bit down'],
    [0,  'needs you'],
  ],

  // Always serialized, with defaults. Temperament shapes paddock behavior; saddled
  // persists and gates riding.
  traits: { temperament: 'calm', saddled: false },
  // Serialized only when present (e.g. Ebony the Friesian).
  optionalAttrs: ['health', 'speed', 'stamina'],

  capabilities: { saddleable: true, rideable: true, leadable: true, laysEggs: false },

  // Paddock "feel" knobs read by the scene movement primitives (creatures.js).
  // `wanderMin`/`wanderMax` are the ms delay range between wanders (bigger = the
  // horse pauses and chills longer between strolls). `roll.<temperament>` is the
  // per-settle chance a relaxed horse flops for a dirt roll (issue #26); higher =
  // gets dusty more often. `default` covers any temperament not listed.
  movement: {
    wanderMin: 4500,
    wanderMax: 9000,
    roll: { spirited: 0.10, lazy: 0.09, default: 0.045 },
  },

  // AI priority list, highest first. The dispatcher walks these in order; the first
  // whose condition fires and successfully claims the horse wins. Wander is the
  // implicit fallback. Modules: ./behaviors.js.
  behaviors: ['seekFood', 'seekWater', 'seekStream', 'begPlayer', 'graze'],
};
