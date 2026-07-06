// General store — seed shop (#215). One shop BUILDING, structured as a registry of
// "counters" (tabs) so a second counter (clothing, #217) can slot in later as a
// one-line data addition, not a rewrite. Only one counter exists today: `seeds`.
//
// Mirrors the market stall's shop.js/ShopScene pattern (buy panel spends gold), but
// what's bought here isn't carrier content — it's a per-crop SEED count + fertilizer,
// a simple owned-item stock (see storeInventory.js for the persisted counts + the
// pure purchase/grant logic). Reuses `purchase()` from data/shop.js for the buy-math
// (identical contract: given money + an item with a `price`, can they afford it).
//
// A counter is `{ id, label, icon, items: [{ key, label, icon, desc, price }] }`.
// `items` is built from CROP_ORDER (data/crops.js) so a new crop automatically gets a
// seed row here with no edit to this file — plus one flat "fertilizer" gardening
// supply. Prices sit modestly above the shop's existing feed prices (a seed is a
// bigger long-term payoff than one unit of feed) — a first-pass balance lever.

import { CROP_ORDER, getCrop } from './crops.js';

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

export const STORE_COUNTERS = [
  {
    id: 'seeds',
    label: 'Seeds & Supplies',
    icon: 'iconWheat',
    items: [...CROP_ORDER.map(seedItem), FERTILIZER_ITEM],
  },
  // Clothing (#217) slots in here later as another { id, label, icon, items } entry —
  // no change needed to the store building, its interactable, or GeneralStoreScene.
];

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
