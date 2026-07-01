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
// Range at which a horse voices its mood as you walk up (squeal if neglected,
// nicker if content) — a touch wider than CARE_DIST so the greeting reads before
// you're right on top of it.
export const GREET_DIST = 260;
// Minimum gap between petting nickers, so rapidly petting one horse doesn't
// machine-gun the sound (each pet still lands its happiness + heart).
export const PET_SOUND_MS = 500;
// In-place reach for using a tool on an animal (brush/saddle/lead, cow care). Use
// never walks you anywhere — the animal has to already be within this range.
export const USE_REACH = 110;
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

// ── Hungry chickens (behaviors.js / creatures.js) ───────────────────────────
// While a chicken is unfed for the day it crowds the grain bin and, when the
// player wanders within this range, trails them hoping to be fed — even with no
// seeds out yet (#128). Reset to ordinary behaviour once fed (#129).
export const CHICKEN_HUNGRY_FOLLOW_DIST = 200;

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

// ── Cross-animal charm behaviors (#187) ─────────────────────────────────────
// Low-frequency "aww" moments layered on top of the need-driven AI: the dog
// noses the sheep into a bunch, chickens scatter from a passing dog, the pig
// flops for a sunbathe, the barnyard beds down together at night, and the cat
// curls up by a companion. All purely cosmetic (no stat/mood effects) and lower
// priority than any need, so they never get in the way of care. Tuned to read as
// occasional special beats rather than constant motion.
export const CHARM = {
  // Dog ↔ sheep: the dog ambles over to a nearby sheep and the flock bunches up.
  HERD_RANGE:    280,   // dog notices sheep within this many px and trots over
  HERD_COOLDOWN: 22000, // min ms between herding bouts (keeps it occasional)
  HERD_STANDOFF: 70,    // dog pulls up this far short of the flock centre
  SHEEP_BUNCH:   28,    // px a startled sheep hops in toward the flock centre
  // Chickens scatter when the dog trots close.
  SCATTER_DIST:  96,    // a chicken this close to the dog bolts
  SCATTER_RUN:  140,    // how far away it darts before settling
  // Pig sunbathe flop (an onSettle nap, like the horse roll / chicken peck).
  PIG_NAP_CHANCE: 0.22, // odds a pig naps when it finishes a wander (daytime only)
  NAP_MS: [4000, 7000], // how long a sunbathe / curl-up lasts
  // Pig wallow (#197): an occasional charm behavior in the AI priority list — a
  // content, not-hungry-or-thirsty pig sometimes flops and rolls in a muddy spot,
  // like the horse roll but its own dedicated art + its own low-priority behavior
  // module (rather than an onSettle hook) so it competes with (but never overrides)
  // seekFood/seekWater/graze.
  WALLOW_CHANCE:   0.18,  // odds a wallow-eligible pig wallows on a given AI tick
  WALLOW_COOLDOWN: 20000, // min ms between wallows (keeps it occasional)
  WALLOW_MS: 1800,        // how long the flop/roll lasts
  // Night settling: non-horse pasture animals drift in to bed down with the herd;
  // the dog beds down near the barn; the cat curls by a companion or the barn.
  CLUSTER_CHANCE: 0.7,  // odds an animal drifts to the night huddle (else rests put)
  CAT_CURL_CHANCE: 0.5, // odds the cat curls outside instead of going into the barn
};

// Cleanliness (issue #26): below DUST_CLEAN_AT grooming the dust overlay starts
// to show, ramping to DUST_MAX_ALPHA opacity at grooming 0. Below STINK_AT a
// very dirty horse also gets wavering "stink" lines above its back.
export const DUST_CLEAN_AT  = 55;
export const DUST_MAX_ALPHA = 0.85;
export const STINK_AT       = 33;

// What the farm stand can sell. Each product type has a sale price (per unit),
// a counter texture (with its own scale), an emoji for the count badge, and the
// floating icon shown when the player stocks it.
export const STAND_DEFS = {
  egg:    { price: 5, tex: 'egg',        scale: S,   emoji: '🥚', floatIcon: 'iconEgg' },
  apple:  { price: 4, tex: 'iconApple',  scale: 0.9, emoji: '🍎', floatIcon: 'iconApple' },
  carrot: { price: 3, tex: 'iconCarrot', scale: 0.9, emoji: '🥕', floatIcon: 'iconCarrot' },
  milk:   { price: 8, tex: 'iconMilk',   scale: 0.9, emoji: '🥛', floatIcon: 'iconMilk' },
};
export const STAND_TYPES = Object.keys(STAND_DEFS);
