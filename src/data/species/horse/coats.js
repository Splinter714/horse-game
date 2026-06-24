// Coat definitions. A coat is pure data: swapping these values changes how the
// horse is drawn (palette + markings), so a whole stable of distinct horses costs
// no new code — this is the "one body, many coats" system from the plan.
//
// Real-world horse appearance has FIVE independent layers, and keeping them
// separate is what makes the customization vocabulary accurate (#2):
//   1. Coat COLOR    — the base pigment (this COATS table). Pure colour only.
//   2. MARKINGS      — small white bits on the face/legs (star/stripe/snip/blaze,
//                      and per-leg socks/stockings).
//   3. PATTERNS      — whole-body effects (dapples, roan, pinto, appaloosa).
//   4. FEATHERING    — long hair on the lower legs (a hair trait, not a colour).
//   5. BREED         — not a colour at all: a *package* of the above. Since the
//                      game has one body shape, a breed = a one-tap PRESET (BREEDS).
//
// Each colour group is a 3-tone ramp: hi (highlight), mid (base), lo (shadow).
// `points` (optional) is the colour of the lower legs — real bays/buckskins/duns
// have black "points" (legs + mane + tail darker than the body). `dorsal: true`
// adds the dun gene's dark stripe down the spine.

export const COATS = {
  palomino: {
    label: 'Palomino',
    body: { hi: 0xe0b850, mid: 0xc89830, lo: 0xa87820 },
    mane: { hi: 0xece0b0, mid: 0xd8c890, lo: 0xc8b878 },
    hoof: 0x3a2a10,
    eye: 0x1a0e00,
    markings: { star: true }
  },
  bay: {
    label: 'Bay',
    body: { hi: 0xb86c34, mid: 0x9a5424, lo: 0x7a4018 },
    mane: { hi: 0x2a1810, mid: 0x1a0e08, lo: 0x140a04 },
    points: 0x140a04, // black legs (real bays have black points)
    hoof: 0x0a0604,
    eye: 0x0a0604,
    markings: {}
  },
  black: {
    label: 'Black',
    body: { hi: 0x3a3838, mid: 0x262424, lo: 0x161414 },
    mane: { hi: 0x161414, mid: 0x0a0808, lo: 0x000000 },
    hoof: 0x000000,
    eye: 0x000000,
    markings: { blaze: true }
  },
  chestnut: {
    label: 'Chestnut',
    body: { hi: 0xc86030, mid: 0xa84820, lo: 0x843414 },
    mane: { hi: 0xd08050, mid: 0xb86030, lo: 0x984020 },
    hoof: 0x2a1408,
    eye: 0x1a0804,
    markings: { star: true }
  },
  cremello: {
    label: 'Cremello',
    body: { hi: 0xf4ead0, mid: 0xe8d8b0, lo: 0xd0bc8c },
    mane: { hi: 0xfffaf0, mid: 0xf4ead4, lo: 0xe0d0b0 },
    hoof: 0xc0a878,
    eye: 0x6090b0,
    markings: {}
  },
  buckskin: {
    label: 'Buckskin',
    body: { hi: 0xd8b466, mid: 0xc09a48, lo: 0x9c7c34 },
    mane: { hi: 0x241810, mid: 0x120a04, lo: 0x040200 }, // black points
    points: 0x120a04, // black legs
    hoof: 0x161008, eye: 0x0a0604,
    markings: {}
  },
  grey: {
    label: 'Grey',
    body: { hi: 0xcacac6, mid: 0xb2b2ae, lo: 0x919190 },
    mane: { hi: 0xbcbcb8, mid: 0xa2a2a0, lo: 0x868684 },
    hoof: 0x33322f, eye: 0x1a1a18,
    markings: {}
  },
  sealBrown: {
    label: 'Seal Brown',
    body: { hi: 0x4a3826, mid: 0x342416, lo: 0x1e140a },
    mane: { hi: 0x1a1410, mid: 0x0c0805, lo: 0x020100 },
    points: 0x120c06, // dark legs
    hoof: 0x0a0604, eye: 0x0a0402,
    markings: { star: true }
  },
  flaxenChestnut: {
    label: 'Flaxen Chestnut',
    body: { hi: 0xb86838, mid: 0x9c5226, lo: 0x7c3c18 },
    mane: { hi: 0xe8d8b0, mid: 0xd0bc90, lo: 0xb09c70 }, // pale flaxen mane
    hoof: 0x2a1408, eye: 0x1a0804,
    markings: { star: true, stripe: true }
  },
  // ── Dun-gene colours (#2): carry a dark dorsal stripe down the spine ─────────
  dun: {
    label: 'Dun',
    body: { hi: 0xcdb079, mid: 0xb89a5e, lo: 0x947b46 },
    mane: { hi: 0x2a1e12, mid: 0x18100a, lo: 0x080402 }, // black points
    points: 0x18100a, dorsal: true,
    hoof: 0x161008, eye: 0x0a0604,
    markings: {}
  },
  grullo: {
    label: 'Grullo',
    body: { hi: 0x8a877e, mid: 0x726f66, lo: 0x55534c },
    mane: { hi: 0x18171a, mid: 0x0c0b0e, lo: 0x030204 }, // black points
    points: 0x0c0b0e, dorsal: true,
    hoof: 0x100f12, eye: 0x080608,
    markings: {}
  },
  silverDapple: {
    label: 'Silver Dapple',
    body: { hi: 0x7a5d4a, mid: 0x614636, lo: 0x4a3328 }, // chocolate body
    mane: { hi: 0xe8e2d8, mid: 0xcfc8bc, lo: 0xb0a89c },  // silvery mane/tail
    hoof: 0x2a2018, eye: 0x1a1008,
    markings: { dapples: true }
  }
};

// ── Vocabulary for the customization panel (#2), split by real-world category ──
// Face/leg white markings (legs are handled by the per-leg `legs` model below).
export const FACE_MARKING_LABELS = {
  star: 'Star', stripe: 'Stripe', snip: 'Snip', blaze: 'Blaze',
};
// Whole-body patterns.
export const PATTERN_LABELS = {
  dapples: 'Dapples', roan: 'Roan', pinto: 'Pinto', appaloosa: 'Appaloosa',
};
// Hair feature.
export const FEATHER_LABEL = 'Feathering';
// Feathering colour options (shown when feathering is on). 'natural' tracks the
// mane (the default); 'white'/'black' are fixed overrides. Swatch colours below.
export const FEATHER_COLOR_LABELS = { natural: 'Natural', white: 'White', black: 'Black' };
export const FEATHER_SWATCH = { white: 0xf0ead0, black: 0x1a1614 };

// The four legs (side-view sprite), in display order. Each can be bare, 'sock'
// (short white) or 'stocking' (tall white). Labels drive the per-leg UI.
export const LEG_IDS = ['foreNear', 'foreFar', 'hindNear', 'hindFar'];
export const LEG_LABELS = {
  foreNear: 'Front', foreFar: 'Front (far)', hindNear: 'Back', hindFar: 'Back (far)',
};

// Breed presets (#2): one-tap combos that set colour + pattern + markings at once.
// `label` becomes the horse's displayed breed.
export const BREEDS = {
  friesian:    { label: 'Friesian',     color: 'black',    markings: { feather: true } },
  clydesdale:  { label: 'Clydesdale',   color: 'bay',      markings: { feather: true, featherColor: 'white', legs: allLegs('stocking') } },
  gypsyVanner: { label: 'Gypsy Vanner', color: 'black',    markings: { pinto: true, feather: true, featherColor: 'white' } },
  appaloosa:   { label: 'Appaloosa',    color: 'chestnut', markings: { appaloosa: true } },
  paintHorse:  { label: 'Paint Horse',  color: 'chestnut', markings: { pinto: true, blaze: true } },
  shire:       { label: 'Shire',        color: 'grey',     markings: { feather: true, featherColor: 'white', legs: allLegs('stocking') } },
  mustang:     { label: 'Mustang',      color: 'dun',      markings: {} },
  lipizzaner:  { label: 'Lipizzaner',   color: 'grey',     markings: {} },
};

function allLegs(kind) {
  return { foreNear: kind, foreFar: kind, hindNear: kind, hindFar: kind };
}

// Shallow-clone a markings object (with its per-leg `legs` map) so callers and the
// art never mutate a COATS default in place.
function cloneMarks(mk) {
  if (!mk) return {};
  const out = { ...mk };
  if (out.legs) out.legs = { ...out.legs };
  return out;
}

// Resolve a coat colour key into { colorKey, colorEntry }. Unknown keys fall back
// to palomino. (Horses always store a pure colour key — breeds are applied by
// writing colour + markings, never stored as a coat key.)
function resolveColor(key) {
  if (COATS[key]) return { colorKey: key, colorEntry: COATS[key] };
  return { colorKey: 'palomino', colorEntry: COATS.palomino };
}

// The pure base-colour key behind a coat key (so the panel can highlight the
// right swatch). Unknown keys resolve to palomino.
export function colorKeyOf(coatKey) {
  return resolveColor(coatKey).colorKey;
}

export function getCoat(key) {
  return composeCoat(key, null);
}

// A colour's representative 3-tone ramp when used as *hair* (mane/tail, feathering).
// We reuse the colour's body ramp — that's the recognizable hue a player picks from
// the palette (#140/#143). Unknown keys fall back to palomino.
export function maneRampFor(colorKey) {
  return (COATS[colorKey] || COATS.palomino).body;
}

// Compose a horse's drawable coat from its colour key plus optional per-animal
// marking overrides (the customization panel, #2/#17). A markings override is
// AUTHORITATIVE — it fully defines the markings (it doesn't merge with the
// colour's defaults), so applying a breed or toggling produces exactly what the
// player chose. With no override, the colour's own default markings are used.
export function composeCoat(colorKey, markingsOverride) {
  const { colorEntry } = resolveColor(colorKey);
  const finalMarks = cloneMarks(markingsOverride == null ? colorEntry.markings : markingsOverride);
  const out = { ...colorEntry, markings: finalMarks };

  // Mane colour is independent of the coat (#140): 'natural'/undefined keeps the
  // colour's own mane ramp; any coat key recolours the mane to that hue.
  const mc = finalMarks.maneColor;
  if (mc && mc !== 'natural' && COATS[mc]) out.mane = maneRampFor(mc);

  return out;
}

// The full effective markings for a horse (used by the panel to show what's on).
export function effectiveMarkings(colorKey, markingsOverride) {
  return composeCoat(colorKey, markingsOverride).markings;
}
