// General store — seed shop (#215) + clothing shop (#217). One shop BUILDING,
// structured as a registry of "counters" (tabs), so a second counter was a one-line
// data addition, not a rewrite. Two counters exist today: `seeds` and `clothing`.
//
// Mirrors the market stall's shop.js/ShopScene pattern (buy panel spends gold), but
// what's bought here isn't carrier content:
//   seeds    → a per-crop SEED count + fertilizer, a simple owned-item stock
//              (see storeInventory.js for the persisted counts + the pure
//              purchase/grant logic).
//   clothing → a ONE-TIME permanent unlock at the dresser/customizer (#211) — same
//              owned-count mechanism (storeInventory.js), but the count is only ever
//              read as "owned (>0) or not", never spent/consumed. See customize.js's
//              `unlock` field + `selectableChoices`/`isChoiceUnlocked`.
// Both reuse `purchase()` from data/shop.js for the buy-math (identical contract:
// given money + an item with a `price`, can they afford it).
//
// A counter is `{ id, label, icon, items: [{ key, label, icon, desc, price }] }`.
// The seeds counter's `items` is built from CROP_ORDER (data/crops.js) so a new crop
// automatically gets a seed row here with no edit to this file — plus one flat
// "fertilizer" gardening supply. Prices sit modestly above the shop's existing feed
// prices (a seed is a bigger long-term payoff than one unit of feed) — a first-pass
// balance lever. The clothing counter's items are a small hand-picked list (below);
// prices are pitched a bit higher since they're permanent unlocks, not a per-use
// supply — also a first-pass balance lever.

import { CROP_ORDER, getCrop } from './crops.js';
import { CUSTOMIZE } from './customize.js';

// Seed price per crop: a flat base plus a small per-crop bump so pricier/rarer crops
// (order position) cost a touch more. First-pass balance lever, tune at playtest.
const SEED_BASE_PRICE = 4;

function seedItem(cropId, i) {
  const crop = getCrop(cropId);
  return {
    key: `seed_${cropId}`,
    crop: cropId,
    label: `${crop.label} Seeds`,
    icon: crop.seedIcon,
    desc: `Plant to grow ${crop.label.toLowerCase()}`,
    price: SEED_BASE_PRICE + i,
  };
}

// Fertilizer (#215 first-pass): a simple ownable gardening supply. Its gameplay
// effect (speeding growth / boosting yield) isn't defined elsewhere yet, so this is
// purely a sellable/ownable item for now — buying it stocks a persisted count
// (storeInventory.js), same shape as seeds. Flagged as first-pass per the issue.
const FERTILIZER_ITEM = {
  key: 'fertilizer',
  label: 'Fertilizer',
  icon: 'iconFertilizer',
  desc: 'Gardening supply (first-pass — no effect wired up yet)',
  price: 6,
};

// Clothing counter (#217) — one-time permanent unlocks for the dresser/customizer
// (#211), NOT a consumable. Each item's `key` is exactly the `unlock` value on its
// matching locked swatch in data/customize.js (PLAYER_SHIRT/PLAYER_BOTTOM_COLOR) —
// buying it bumps the item's owned count in storeInventory.js (same registry every
// other store item uses), and the customizer shell filters its swatch grid to
// (starting wardrobe) OR (owned via this counter), so owning it just means it shows
// up as pickable forever, with no separate "equip" step here.
const CLOTHING_ITEMS = [
  { key: 'shirt_gold',     label: 'Gold Shirt',      icon: 'iconShirt',   desc: 'Unlocks a gold shirt colour at the dresser', price: 30 },
  { key: 'shirt_midnight', label: 'Midnight Shirt',  icon: 'iconShirt',   desc: 'Unlocks a midnight shirt colour at the dresser', price: 30 },
  { key: 'bottoms_plum',   label: 'Plum Bottoms',    icon: 'iconBottoms', desc: 'Unlocks a plum bottoms colour at the dresser', price: 25 },
];

export const STORE_COUNTERS = [
  {
    id: 'seeds',
    label: 'Seeds & Supplies',
    icon: 'iconWheat',
    items: [...CROP_ORDER.map(seedItem), FERTILIZER_ITEM],
  },
  {
    id: 'clothing',
    label: 'Clothing',
    icon: 'iconShirt',
    items: CLOTHING_ITEMS,
  },
];

// Dev/test integrity: every clothing item's key must actually correspond to a real
// locked swatch's `unlock` field somewhere in CUSTOMIZE — otherwise buying it would
// unlock nothing. Checked lazily (not at module-eval time) so this file has no
// import-order dependency on customize.js beyond the one static import above.
export function clothingItemUnlocksSomething(key) {
  for (const def of Object.values(CUSTOMIZE)) {
    if (!def.parts) continue;
    for (const part of def.parts) {
      const choices = part.palette ?? part.options ?? [];
      if (choices.some((c) => c.unlock === key)) return true;
    }
  }
  return false;
}

export function getCounter(id) {
  return STORE_COUNTERS.find((c) => c.id === id) || null;
}

// Look up one store item by key, across every counter.
export function getStoreItem(key) {
  for (const counter of STORE_COUNTERS) {
    const item = counter.items.find((i) => i.key === key);
    if (item) return item;
  }
  return null;
}
