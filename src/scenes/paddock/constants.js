// Shared tuning constants for PaddockScene and its concern mixins (./paddock/*).
// Centralised here so the scene file and every extracted mixin read one source of
// truth (and so balance/layout values are easy to find and tweak).

// World dimensions.
export const WORLD_W = 1920;
export const WORLD_H = 1600;

// Movement.
export const INTERACT_DIST = 100;
// Reach for the "care" interactions (petting and brushing). Much larger than
// INTERACT_DIST so you can quickly tend a whole crowd of animals — the prompt
// keeps targeting the nearest still-uncared-for one until they're all done,
// without making you stand right on top of each.
export const CARE_DIST = 200;
export const PLAYER_SPEED  = 210;
export const RIDE_SPEED    = 340;

// Press shorter than this (without dragging) is a plain tap → walk all the way to
// the tapped point. Once the press passes this, live "hold-to-move" steering kicks
// in and releasing stops you where you are.
export const HOLD_MS = 250;
// The finger must travel at least this far (screen px) before a press counts as a
// drag — keeps tiny tap jitter from being read as intentional hold-to-move.
export const HOLD_DRAG_PX = 28;

// Wander/spawn bounds and the pasture rectangle.
export const BOUNDS         = { minX: 180, maxX: 1740, minY: 200, maxY: 900 };
export const PLAYER_BOUNDS  = { minX: 40, maxX: 1880, minY: 80, maxY: 1550 };
export const PASTURE_BOUNDS = { minX: 180, maxX: 1740, minY: 910, maxY: 1450 };

// Water trough capacity, in "drinks" (#103). The trough holds a numeric water
// level 0..TROUGH_CAP; each poured bucket raises it by TROUGH_PER_BUCKET and each
// horse drink lowers it by one. CAP/PER_BUCKET = 3 buckets to fill from empty.
export const TROUGH_CAP = 9;
export const TROUGH_PER_BUCKET = 3;

// Gate opening in the top pasture fence (the only gap; gate sits here).
export const GATE_X = 960;
export const GATE_GAP_X0 = 900;
export const GATE_GAP_X1 = 1020;

// Global sprite scale.
export const S = 2;

// ── Horse begging behaviour (horseAI.js) ────────────────────────────────────
// The main "feel" knobs for hungry horses coming to beg / gathering at the gate.
// Tweak here rather than hunting through the AI mixin.
export const BEG = {
  HUNGER:        50,   // start begging when hunger drops below this
  KEEP_HUNGER:   55,   // keep loitering until a feed pushes hunger back over this
  NOTICE_DIST:  520,   // gate shut: only gather if the player is within this
  LINGER_DIST:  480,   // keep waiting only while the player stays within this
  THROTTLE_MS: 8000,   // min gap between a horse re-launching a beg trip
  STANDOFF:     120,   // stop this far from the player (don't pile on)
  AT_PLAYER:    150,   // already close enough to the player → just wait
  AT_GATE:       70,   // already at the gate gap → just wait
};

// ── Herd clustering (creatures.js) ──────────────────────────────────────────
// Buddy pairing (the head-to-tail "fly-swatting" pose) and the gentle drift that
// keeps an idle cluster from collapsing into one overlapping blob.
export const HERD = {
  HAPPY_AT:    60,   // happiness needed before a horse seeks out a buddy
  PAIR_CHANCE: 0.6,  // chance a content horse's wander becomes a buddy pairing
  STAND_GAP:   28,   // how far fore/aft of the buddy to pull up
  SEP_MIN:     28,   // idle horses closer than this gently drift apart
  SEP_PUSH:   0.6,   // max px/frame a horse is nudged to separate (a slow drift)
};

// Cleanliness (issue #26): below DUST_CLEAN_AT grooming the dust overlay starts
// to show, ramping to DUST_MAX_ALPHA opacity at grooming 0. Below STINK_AT a
// very dirty horse also gets wavering "stink" lines above its back.
export const DUST_CLEAN_AT  = 55;
export const DUST_MAX_ALPHA = 0.85;
export const STINK_AT       = 30;

// What the farm stand can sell. Each product type has a sale price (per unit),
// a counter texture (with its own scale), an emoji for the count badge, and the
// floating icon shown when the player stocks it.
export const STAND_DEFS = {
  egg:    { price: 5, tex: 'egg',        scale: S,   emoji: '🥚', floatIcon: 'iconEgg' },
  apple:  { price: 4, tex: 'iconApple',  scale: 0.9, emoji: '🍎', floatIcon: 'iconApple' },
  carrot: { price: 3, tex: 'iconCarrot', scale: 0.9, emoji: '🥕', floatIcon: 'iconCarrot' },
};
export const STAND_TYPES = Object.keys(STAND_DEFS);
