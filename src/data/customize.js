// Animal customizer schema (#165) — a data table, like COATS (species/horse/coats.js)
// and items.js. Each species declares the parts the general customizer can recolor;
// each part has a palette of named swatches. A swatch carries a hand-authored shading
// ramp (the tones the art uses) plus a display `tone` for the swatch button. The
// generic customizer shell renders one swatch grid per part and threads the chosen
// ramps into the species' art builder as a `look` (see art/index.js reskinAnimal).
//
// The horse is the one exception: its editor is rich (coats/patterns/breeds/markings),
// so instead of a flat part list it points at the bespoke horse section set
// (`sections: 'horse'`, see scenes/customizer/horse.js).
//
// Ramps are HAND-AUTHORED (not algorithmically derived) to match the established
// pixel-art look — derived/high-res ramps read "weird" per the art history.

// A swatch: { key, label, ramp }. `ramp` is the per-part tone object the art expects;
// its shape is part-specific (wool = hi/lit/mid/shad; skin = lit/mid/dk/dkr).
const sw = (key, label, ramp) => ({ key, label, ramp });

// ── Sheep: wool (fleece body) + skin (legs + face + snout) ────────────────────
const SHEEP_WOOL = [
  sw('white', 'White', { hi: 0xfbf9f6, lit: 0xf0ece8, mid: 0xddd8d2, shad: 0xc4bdb5 }),
  sw('cream', 'Cream', { hi: 0xfaf3df, lit: 0xf2e8c8, mid: 0xe6d8a8, shad: 0xd0bf88 }),
  sw('grey',  'Grey',  { hi: 0xd8d8da, lit: 0xc4c4c8, mid: 0xa8a8ae, shad: 0x8a8a90 }),
  sw('brown', 'Brown', { hi: 0xb89a78, lit: 0xa07e5a, mid: 0x856244, shad: 0x664a30 }),
  sw('black', 'Black', { hi: 0x4a4a50, lit: 0x36363c, mid: 0x242428, shad: 0x161618 }),
];
const SHEEP_SKIN = [
  sw('grey', 'Grey', { lit: 0x7d7d7d, mid: 0x6b6b6b, dk: 0x5a5a5a, dkr: 0x4c4c4c }),
  sw('pink', 'Pink', { lit: 0xe8a8a0, mid: 0xd89088, dk: 0xc07870, dkr: 0xa86058 }),
  sw('dark', 'Dark', { lit: 0x4a4038, mid: 0x382f28, dk: 0x28211c, dkr: 0x1a1512 }),
  sw('tan',  'Tan',  { lit: 0xc8a888, mid: 0xb08c68, dk: 0x947050, dkr: 0x77563c }),
];

// ── Cow: coat (white/legs/neck/head base) + spots (Holstein patches) ──────────
const COW_COAT = [
  sw('white', 'White', { hi: 0xffffff, mid: 0xf0ece4, shad: 0xe0dcd4, legFar: 0xdedacf, legNear: 0xf0ece4 }),
  sw('tan',   'Tan',   { hi: 0xf0e0c0, mid: 0xe0cca0, shad: 0xc8b084, legFar: 0xc0a87c, legNear: 0xe0cca0 }),
  sw('brown', 'Brown', { hi: 0xa07850, mid: 0x86603f, shad: 0x6a4c30, legFar: 0x614630, legNear: 0x86603f }),
  sw('grey',  'Grey',  { hi: 0xd8d8d8, mid: 0xb8b8ba, shad: 0x9a9a9c, legFar: 0x909092, legNear: 0xb8b8ba }),
];
const COW_SPOTS = [
  sw('black', 'Black', { mid: 0x1a1818 }),
  sw('brown', 'Brown', { mid: 0x4a3322 }),
  sw('rust',  'Rust',  { mid: 0x7a3b1e }),
  sw('grey',  'Grey',  { mid: 0x5a5a5c }),
];

// ── Pig: body hide (snout/inner-ear stay pink) ────────────────────────────────
const PIG_BODY = [
  sw('pink',  'Pink',  { hi: 0xf8c0c0, mid: 0xf4a0a0, shad: 0xe08080, legFar: 0xd07878, legNear: 0xe08888, tail: 0xe07878, ear: 0xf09a9a }),
  sw('brown', 'Brown', { hi: 0xb08868, mid: 0x926c4d, shad: 0x6f4f38, legFar: 0x614630, legNear: 0x7a5a40, tail: 0x6f4f38, ear: 0x8a6648 }),
  sw('grey',  'Grey',  { hi: 0x6a6668, mid: 0x4e4a4b, shad: 0x343031, legFar: 0x2a2627, legNear: 0x3c3839, tail: 0x343031, ear: 0x4a4647 }),
];

// ── Dog: coat (whole pelt) + collar (band + tag) ──────────────────────────────
const DOG_COAT = [
  sw('golden', 'Golden', { hi: 0xe8b054, mid: 0xd4943c, shad: 0xb07828, legNear: 0xc48830, tailHi: 0xd4983c, jaw: 0xc88a30, ear: 0xa86e22, earShad: 0x946018, snout: 0xf0d898, snoutShad: 0xe2c47e }),
  sw('cream',  'Cream',  { hi: 0xfaf2df, mid: 0xeaddc0, shad: 0xcfc0a0, legNear: 0xdcd0b2, tailHi: 0xf0e6cc, jaw: 0xc8b896, ear: 0xc0ad88, earShad: 0xa8946e, snout: 0xfcf6e8, snoutShad: 0xe6d8bc }),
  sw('choco',  'Chocolate', { hi: 0x7a543a, mid: 0x5f4230, shad: 0x4a3326, legNear: 0x553a2a, tailHi: 0x684838, jaw: 0x4a3326, ear: 0x3e2a1e, earShad: 0x2e2016, snout: 0x8a6a4e, snoutShad: 0x6e5238 }),
  sw('black',  'Black',  { hi: 0x4a4848, mid: 0x343232, shad: 0x222020, legNear: 0x2c2a2a, tailHi: 0x3a3838, jaw: 0x282626, ear: 0x1e1c1c, earShad: 0x141212, snout: 0x5a5856, snoutShad: 0x444240 }),
];
const DOG_COLLAR = [
  sw('red',    'Red',    { mid: 0xe03030, shad: 0xc02020 }),
  sw('blue',   'Blue',   { mid: 0x3060e0, shad: 0x2048c0 }),
  sw('green',  'Green',  { mid: 0x30a040, shad: 0x208030 }),
  sw('purple', 'Purple', { mid: 0x8040c0, shad: 0x6028a0 }),
];

// ── Cat: fur (calico's main patch family) + eye colour ────────────────────────
const CAT_FUR = [
  sw('ginger', 'Ginger', { hi: 0xf6b45c, mid: 0xe8943c, lo: 0xc06c20 }),
  sw('grey',   'Grey',   { hi: 0x9a9a9e, mid: 0x76767a, lo: 0x54545a }),
  sw('brown',  'Brown',  { hi: 0x9a6e44, mid: 0x76502e, lo: 0x543820 }),
  sw('cream',  'Cream',  { hi: 0xf4e4c4, mid: 0xe0caa0, lo: 0xc0a878 }),
];
const CAT_EYES = [
  sw('green',  'Green',  { color: 0x74c24a }),
  sw('amber',  'Amber',  { color: 0xe0a030 }),
  sw('blue',   'Blue',   { color: 0x5aa0d8 }),
  sw('copper', 'Copper', { color: 0xc06a28 }),
];

export const CUSTOMIZE = {
  sheep: {
    parts: [
      { id: 'wool', label: 'Wool', palette: SHEEP_WOOL },
      { id: 'skin', label: 'Skin', palette: SHEEP_SKIN },
    ],
  },
  cow: {
    parts: [
      { id: 'coat',  label: 'Coat',  palette: COW_COAT },
      { id: 'spots', label: 'Spots', palette: COW_SPOTS },
    ],
  },
  pig: {
    parts: [
      { id: 'body', label: 'Body', palette: PIG_BODY },
    ],
  },
  dog: {
    parts: [
      { id: 'coat',   label: 'Coat',   palette: DOG_COAT },
      { id: 'collar', label: 'Collar', palette: DOG_COLLAR },
    ],
  },
  cat: {
    parts: [
      { id: 'fur',  label: 'Fur',  palette: CAT_FUR },
      { id: 'eyes', label: 'Eyes', palette: CAT_EYES },
    ],
  },

  // Horse uses its own rich, bespoke section set rather than a flat part list.
  horse: { sections: 'horse' },
};

// The swatch button colour for a swatch (the most representative tone). Covers every
// ramp shape used: body ramps (mid/lit/hi), single-colour parts (color), spots (mid).
export const swatchTone = (ramp) => ramp.mid ?? ramp.lit ?? ramp.hi ?? ramp.color ?? 0x888888;

// Build the default `look` for a species (first swatch of every part), so opening
// the customizer starts from the art's native colours.
export function defaultLook(speciesId) {
  const def = CUSTOMIZE[speciesId];
  if (!def?.parts) return undefined;
  const look = {};
  for (const part of def.parts) look[part.id] = part.palette[0].ramp;
  return look;
}
