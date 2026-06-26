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

import { CHICKEN_COATS } from '../art/chickenArt.js';

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

// ── Chicken: whole-coat STYLE picker (the 5 existing feather coats) ───────────
// Unlike the recolour parts above, the chicken just selects one of its pre-authored
// CHICKEN_COATS; the swatch shows that coat's body feather colour. The chosen coat is
// threaded straight into buildChickenTextures (which already takes a coat).
const CHICKEN_LABELS = ['White', 'Rhode Island Red', 'Black', 'Buff', 'Grey'];
const CHICKEN_STYLES = CHICKEN_COATS.map((coat, i) => sw(String(i), CHICKEN_LABELS[i] || `Style ${i + 1}`, coat));

// ── Player character (#44) ────────────────────────────────────────────────────
// The player is just another data-driven "parts" subject, but with two flavours of
// part: colour parts (a swatch grid) and shape OPTION parts (mutually-exclusive
// pills). Option parts carry `options: [{key,label}]` instead of a `palette`, and
// resolve to the chosen KEY (a string) rather than a colour ramp — the art reads the
// string to pick a body shape (see art/playerArt.js).
//
// Colour ramps here are `{ main }` (single-tone parts: hair/skin), `{ main, shad }`
// (clothing, with a hand-authored shadow), or `{ color }` (eyes — matches CAT_EYES).
// The FIRST entry of every part is today's look, so the defaults reproduce the
// current sprite exactly (shoes stay fixed, so there's no shoe part).
const opt = (key, label) => ({ key, label });

const PLAYER_HAIR = [
  sw('auburn',   'Auburn',   { main: 0xc8844a }), // today
  sw('brown',    'Brown',    { main: 0x6b4a2a }),
  sw('chestnut', 'Chestnut', { main: 0x8a4a2a }),
  sw('red',      'Red',      { main: 0xb5532a }),
  sw('blonde',   'Blonde',   { main: 0xe6c878 }),
  sw('black',    'Black',    { main: 0x2a2424 }),
  sw('grey',     'Grey',     { main: 0xb0b0b4 }),
  sw('white',    'White',    { main: 0xeceae6 }),
];
const PLAYER_SKIN = [
  sw('peach', 'Peach', { main: 0xf5c48a }), // today
  sw('fair',  'Fair',  { main: 0xfcdcb4 }),
  sw('tan',   'Tan',   { main: 0xe0a878 }),
  sw('olive', 'Olive', { main: 0xc89860 }),
  sw('brown', 'Brown', { main: 0xa6754a }),
  sw('deep',  'Deep',  { main: 0x7a4f30 }),
  sw('dark',  'Dark',  { main: 0x523524 }),
];
const PLAYER_EYES = [
  sw('dark',  'Dark',  { color: 0x1a0a04 }), // today
  sw('brown', 'Brown', { color: 0x5a3a1e }),
  sw('hazel', 'Hazel', { color: 0x8a6a3a }),
  sw('green', 'Green', { color: 0x4a8a4a }),
  sw('blue',  'Blue',  { color: 0x4a78b0 }),
  sw('grey',  'Grey',  { color: 0x707078 }),
];
const PLAYER_SHIRT = [
  sw('teal',   'Teal',   { main: 0x5aab8a, shad: 0x3d8a6c }), // today
  sw('red',    'Red',    { main: 0xd05a4a, shad: 0xaa4034 }),
  sw('blue',   'Blue',   { main: 0x5a7fd0, shad: 0x4060aa }),
  sw('green',  'Green',  { main: 0x5aac4a, shad: 0x408a34 }),
  sw('yellow', 'Yellow', { main: 0xe6c24a, shad: 0xc09a2e }),
  sw('purple', 'Purple', { main: 0x9a5ac0, shad: 0x7840a0 }),
  sw('pink',   'Pink',   { main: 0xe890b0, shad: 0xc86a90 }),
  sw('white',  'White',  { main: 0xeef0f0, shad: 0xc8ccce }),
];
const PLAYER_BOTTOM_COLOR = [
  sw('brown', 'Brown', { main: 0x7a5a38, shad: 0x5a4028 }), // today
  sw('denim', 'Denim', { main: 0x4a5a80, shad: 0x36446a }),
  sw('black', 'Black', { main: 0x3a3636, shad: 0x282424 }),
  sw('grey',  'Grey',  { main: 0x8a8a90, shad: 0x6a6a70 }),
  sw('green', 'Green', { main: 0x5a7a4a, shad: 0x426034 }),
  sw('red',   'Red',   { main: 0xb05040, shad: 0x8a3a2e }),
  sw('tan',   'Tan',   { main: 0xc8a878, shad: 0xa88858 }),
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
  chicken: {
    parts: [
      { id: 'style', label: 'Style', palette: CHICKEN_STYLES },
    ],
  },

  // Player avatar (#44): a mix of shape OPTION parts and colour parts. Shoes are not
  // editable, so there's no shoe part. Order here = top-to-bottom order in the panel.
  player: {
    parts: [
      { id: 'hairStyle',   label: 'Hairstyle', options: [opt('short', 'Short'), opt('long', 'Long'), opt('bun', 'Bun')] },
      { id: 'hair',        label: 'Hair',      palette: PLAYER_HAIR },
      { id: 'skin',        label: 'Skin',      palette: PLAYER_SKIN },
      { id: 'eyes',        label: 'Eyes',      palette: PLAYER_EYES },
      { id: 'sleeves',     label: 'Sleeves',   options: [opt('long', 'Long'), opt('short', 'Short'), opt('none', 'Sleeveless')] },
      { id: 'shirt',       label: 'Shirt',     palette: PLAYER_SHIRT },
      { id: 'bottom',      label: 'Bottoms',   options: [opt('pants', 'Pants'), opt('skirt', 'Skirt')] },
      { id: 'bottomColor', label: 'Bottom colour', palette: PLAYER_BOTTOM_COLOR },
    ],
  },

  // Horse + foal share the rich, bespoke section set (the foal is just a young horse,
  // same coat system) rather than a flat part list. See scenes/customizer/horse.js.
  horse: { sections: 'horse' },
  foal: { sections: 'horse' },
};

// The swatch button colour for a swatch (the most representative tone). Covers every
// ramp shape used: body ramps (mid/lit/hi), single-colour parts (color/main), spots
// (mid), and a whole chicken coat (its `body` feather colour).
export const swatchTone = (ramp) => ramp.mid ?? ramp.lit ?? ramp.hi ?? ramp.color ?? ramp.main ?? ramp.body ?? 0x888888;

// A part's choice list, regardless of flavour: colour parts carry `palette`, shape
// OPTION parts carry `options`. Both are arrays of `{ key, label, … }`.
const partChoices = (part) => part.palette ?? part.options;

// The default KEY per part (first choice). Keys (not ramps) are what gets persisted on
// the model, so the look survives reloads (the art is rebuilt from them on boot).
// e.g. cow → { coat: 'white', spots: 'black' }, chicken → { style: '0' },
// player → { hairStyle: 'short', hair: 'auburn', … }.
export function defaultKeys(speciesId) {
  const def = CUSTOMIZE[speciesId];
  if (!def?.parts) return undefined;
  const keys = {};
  for (const part of def.parts) keys[part.id] = partChoices(part)[0].key;
  return keys;
}

// Resolve a persisted key map to the `look` the art builders consume. Colour parts
// resolve to their ramp; shape OPTION parts resolve to the chosen KEY (a string the
// art reads to pick a body shape). Unknown/missing keys fall back to each part's first
// choice, so a stale save never throws — it just shows the default for that part.
export function lookFromKeys(speciesId, keyMap) {
  const def = CUSTOMIZE[speciesId];
  if (!def?.parts) return undefined;
  const look = {};
  for (const part of def.parts) {
    const choices = partChoices(part);
    const choice = choices.find((c) => c.key === keyMap?.[part.id]) || choices[0];
    look[part.id] = part.options ? choice.key : choice.ramp;
  }
  return look;
}

// The default ramp `look` for a species (first swatch of every part), so opening the
// customizer with no saved look starts from the art's native colours.
export function defaultLook(speciesId) {
  return lookFromKeys(speciesId, defaultKeys(speciesId));
}
