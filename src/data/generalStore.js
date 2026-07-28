// The unified store (#312) — ONE shop building (moved out of the farm, into town;
// see paddock/generalStore.js), self-serve — the shopkeeper NPC that briefly
// staffed it (#244) was removed per #388 — structured as a registry of "counters"
// (tabs) per the owner's confirmed decision: keep the
// existing tab-per-category UI, don't replace it with a single grid. Four counters
// exist today: `seeds` (#215), `clothing` (#217), `pets` (#222), and `food` (#312 —
// folded in from the market stall's old feed stock, data/shop.js SHOP_STOCK).
//
// Before #312 these were separate buildings/scenes: the general store (seeds +
// clothing) in the farm, the pet store in town (#222), and the market stall's feed
// counter (ShopScene, #29). All four now live in this one registry and one building
// (GeneralStoreScene reads STORE_COUNTERS directly — adding a counter here is a
// data-only change, no UI edit). The market stall itself still exists for tool
// upgrades only (#295) — a separate, non-shop purchase (see scenes/ShopScene.js).
//
// Mirrors the market stall's shop.js purchase() pattern (buy panel spends gold), but
// what's bought here isn't carrier content for three of the four counters:
//   seeds    → a per-crop SEED count + fertilizer, a simple owned-item stock
//              (see storeInventory.js for the persisted counts + the pure
//              purchase/grant logic).
//   clothing → a ONE-TIME permanent unlock at the dresser/customizer (#211) — same
//              owned-count mechanism (storeInventory.js), but the count is only ever
//              read as "owned (>0) or not", never spent/consumed. See customize.js's
//              `unlock` field + `selectableChoices`/`isChoiceUnlocked`.
//   pets     → cosmetic/care owned items (storeInventory.js), same mechanism.
//   food     → THE ONE EXCEPTION: reuses data/shop.js's SHOP_STOCK feed rows as-is
//              (same `content`/`carrier` fields), because feed deposits into the
//              player's active carrier (fillActiveCarrier), not an owned count.
//              GeneralStoreScene's buy handler branches on `item.content` to tell
//              the two purchase shapes apart.
// All reuse `purchase()` from data/shop.js for the buy-math (identical contract:
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
import { SHOP_STOCK } from './shop.js';

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

// Pet store counter (#222) — a NEW town building, not a second counter at the
// general store. Cosmetic/care items only for v1 (first-pass scope per the issue —
// "sells new animals" is a much bigger separate feature, explicitly out of scope
// here): a decorative pet bed, a toy, and a grooming brush. Same owned-count
// mechanism as every other store item (storeInventory.js) — no gameplay effect
// wired up yet, mirroring how fertilizer shipped (flagged for playtest).
const PET_ITEMS = [
  { key: 'pet_bed',   label: 'Pet Bed',       icon: 'iconPetBed',   desc: 'A cozy decorative bed (first-pass — no effect wired up yet)', price: 20 },
  { key: 'pet_toy',   label: 'Pet Toy',       icon: 'iconPetToy',   desc: 'A bouncy toy for playtime (cosmetic)', price: 8 },
  { key: 'pet_brush', label: 'Grooming Brush', icon: 'iconPetBrush', desc: 'A small brush for a pet’s coat (cosmetic)', price: 10 },
];

export const STORE_COUNTERS = [
  {
    id: 'seeds',
    label: 'Seeds & Supplies',
    icon: 'iconWheat',
    items: [...CROP_ORDER.map(seedItem), FERTILIZER_ITEM],
  },
  {
    id: 'food',
    label: 'Food & Feed',
    icon: 'iconBasketHay',
    // Same rows as the old market-stall feed stock (data/shop.js) — `content` +
    // `carrier` fields intact, so GeneralStoreScene's buy handler can tell these
    // apart from the owned-count counters and deposit into the carrier instead.
    items: SHOP_STOCK,
  },
  {
    id: 'clothing',
    label: 'Clothing',
    icon: 'iconShirt',
    items: CLOTHING_ITEMS,
  },
  {
    id: 'pets',
    label: 'Pet Supplies',
    icon: 'iconPetBed',
    items: PET_ITEMS,
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
