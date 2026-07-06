// General store owned-inventory (#215) — how many of each store item (seeds,
// fertilizer) the player has bought. A plain `{ [itemKey]: count }` map, persisted
// under its own localStorage key (mirrors garden.js / fox-taming's dedicated-key
// pattern in save.js, not the wholesale-rewritten gameState).
//
// Pure + Phaser-free so the buy contract is unit-tested in the `node` env, like
// data/shop.js's purchase(). The GeneralStoreScene owns the sprites/UI; this module
// is just the money math + the persisted counts.

import { purchase } from './shop.js';
import { getStoreItem } from './generalStore.js';

const STORE_KEY = 'horse-game-store-inventory-v1';

// Coerce whatever was loaded into a safe { key: count } map — any non-object, or an
// entry that isn't a real store item or a non-negative integer, is dropped/clamped.
export function sanitizeStoreInventory(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, v] of Object.entries(raw)) {
    if (!getStoreItem(key)) continue;
    const n = Math.floor(Number(v));
    out[key] = Number.isFinite(n) && n >= 0 ? n : 0;
  }
  return out;
}

export function loadStoreInventory() {
  try {
    return sanitizeStoreInventory(JSON.parse(localStorage.getItem(STORE_KEY)));
  } catch {
    return {};
  }
}

export function saveStoreInventory(inventory) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(sanitizeStoreInventory(inventory)));
  } catch {}
}

// Buy one unit of a store item: given the player's money + the current owned-inventory
// map, returns { ok, cost, balance, inventory } — on success `inventory` is a NEW map
// with that item's count bumped by 1; on failure (can't afford / unknown item) the
// inventory is returned unchanged. Reuses shop.js's purchase() for the money math so
// the buy contract stays identical across both shops.
export function buyStoreItem(money, inventory, itemKey) {
  const item = getStoreItem(itemKey);
  const res = purchase(money, item);
  if (!item || !res.ok) return { ...res, inventory };
  const next = { ...inventory, [itemKey]: (inventory[itemKey] ?? 0) + 1 };
  return { ...res, inventory: next };
}
