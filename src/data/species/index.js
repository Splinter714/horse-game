// Species registry — the data that drives the generic Animal model (../Animal.js).
//
// Each species declares: identity defaults, decaying `needs`, an optional derived
// `happiness`, care `actions` (which need each restores + presentation), the daily
// care cycle, mood thresholds, always-present `traits`, `optionalAttrs` (serialized
// only when set), and `capabilities`. Adding a new animal type is a matter of
// adding an entry here (plus art + a behavior list in a later layer).
//
// Numbers below faithfully reproduce the original hand-coded Horse model so the
// move to a data-driven model is behavior-neutral.

const HORSE = {
  id: 'horse',
  defaults: { id: 'horse-1', name: 'Buttercup', breed: 'Palomino', coat: 'palomino', age: 3 },

  // Per-second decay while playing. Tuned gentle (hunger fully depletes in ~30 min
  // of continuous play). `default` is the fresh-animal starting value. `label`/
  // `color` drive the info-panel stat bar.
  needs: {
    hunger:   { decay: 0.05, default: 80, label: 'Food',  color: 0x63a31d },
    thirst:   { decay: 0.06, default: 75, label: 'Water', color: 0x378add },
    grooming: { decay: 0.03, default: 60, label: 'Brush', color: 0xba7517 },
  },
  // Derived: drifts toward the average of the needs above.
  happiness: { default: 85, driftRate: 0.02, label: 'Happy', color: 0x1d9e75 },

  // Care actions: stat to bump, amount, the daily-care flag it satisfies, the UI
  // button label, and the sound/floating-icon feedback. `pet` is special-cased by
  // the UI (heart + hop).
  actions: {
    feed:  { stat: 'hunger',    amount: 35, care: 'fed',     label: 'Feed',  sound: 'eat',   icon: 'iconFeed'  },
    water: { stat: 'thirst',    amount: 40, care: 'watered', label: 'Water', sound: 'drink', icon: 'iconWater' },
    brush: { stat: 'grooming',  amount: 18, care: 'brushed', label: 'Brush', sound: 'brush', icon: 'iconBrush' },
    pet:   { stat: 'happiness', amount: 8,                    label: 'Love',  sound: 'chime', icon: 'iconHeart' },
  },

  // Info-panel presentation: animated portrait, optional fixed-attribute row.
  panel: { portrait: 'animated', fixedAttrs: true },

  // Track these care flags each day; missing any in `requiredForContentment`
  // (yesterday) makes the horse wake up neglected.
  dailyCare: { track: ['fed', 'watered', 'brushed'], requiredForContentment: ['fed', 'watered'] },

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
};

const CHICKEN = {
  id: 'chicken',
  defaults: {
    id: () => `chicken-${Math.random().toString(36).slice(2, 9)}`,
    name: 'Hen', breed: 'Chicken', coat: 0, age: 1,
  },
  // Chickens are currently identity-only (no needs/decay yet). Needs can be added
  // here later without touching the model.
  needs: {},
  happiness: null,
  actions: {},
  dailyCare: { track: [], requiredForContentment: [] },
  mood: null,
  traits: { personality: 'friendly' },
  optionalAttrs: [],
  capabilities: { saddleable: false, rideable: false, leadable: false, laysEggs: true },

  // Info-panel presentation: static portrait, an italic personality line, no stat
  // bars or action buttons (chickens are identity-only for now).
  panel: { portrait: 'static', traitLine: 'personality', fixedAttrs: false },
};

export const SPECIES = {
  horse: HORSE,
  chicken: CHICKEN,
};

export function getSpecies(id) {
  return SPECIES[id] ?? SPECIES.horse;
}
