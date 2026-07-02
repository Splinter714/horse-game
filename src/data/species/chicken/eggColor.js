// Egg colour by chicken coat (#276). Owner's rule: brown & gold chickens lay brown
// eggs; every other coat lays a white/default egg. Kept as a small data table so the
// mapping is easy to read and extend (add a coat index → colour entry). Pure — no
// Phaser, unit-tested in eggColor.test.js.
//
// Coat indices match CHICKEN_COATS in src/art/chickenArt.js:
//   0 white · 1 rhode-island-red (brown) · 2 black · 3 buff/golden (gold) · 4 grey
//
// Each egg colour resolves to a carrier CONTENT type (items.js): white eggs use the
// plain `egg`, brown eggs the `eggBrown` variant, so colour rides the existing
// basket → farm-stand → sell pipeline with no special-casing.

// Coat index → egg colour. Any coat not listed falls through to the default (white).
export const EGG_COLOR_BY_COAT = {
  1: 'brown', // rhode island red — a brown hen
  3: 'brown', // buff / golden — a gold hen
};

export const DEFAULT_EGG_COLOR = 'white';

// Egg colour → the carrier content type that colour is carried/sold as.
export const EGG_CONTENT_BY_COLOR = {
  white: 'egg',
  brown: 'eggBrown',
};

// The egg colour a chicken of the given coat index lays. Unknown/undefined coats
// (older saves, odd data) lay the default white egg.
export function eggColorForCoat(coatIndex) {
  return EGG_COLOR_BY_COAT[coatIndex] ?? DEFAULT_EGG_COLOR;
}

// A chicken model's effective coat index: its customized style if the player recoloured
// it, else its roster `coat` default. Mirrors chickenCoatIndex() in art/index.js so the
// egg colour tracks whatever coat the hen is actually wearing on screen.
export function chickenCoatIndex(chicken) {
  const style = chicken?.look?.style;
  return style != null ? Number(style) : (chicken?.coat ?? 0);
}

// The carrier content type a given chicken lays (e.g. 'egg' or 'eggBrown'). This is
// what flock.js stocks the nest/basket with, and what the farm stand sells.
export function eggContentForChicken(chicken) {
  const color = eggColorForCoat(chickenCoatIndex(chicken));
  return EGG_CONTENT_BY_COLOR[color] ?? EGG_CONTENT_BY_COLOR[DEFAULT_EGG_COLOR];
}
