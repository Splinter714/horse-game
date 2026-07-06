// General store owned-inventory (#215) — the persisted { itemKey: count } map and
// the buy contract (buyStoreItem). Covers sanitization (forgiving bad/old data) and
// the money math, mirroring shop.test.js's purchase() coverage.

import { describe, it, expect } from 'vitest';
import { sanitizeStoreInventory, buyStoreItem } from './storeInventory.js';
import { getStoreItem } from './generalStore.js';

describe('sanitizeStoreInventory', () => {
  it('returns an empty map for null/undefined/non-object input', () => {
    expect(sanitizeStoreInventory(null)).toEqual({});
    expect(sanitizeStoreInventory(undefined)).toEqual({});
    expect(sanitizeStoreInventory('nope')).toEqual({});
  });

  it('keeps valid entries for real store items with non-negative counts', () => {
    const out = sanitizeStoreInventory({ fertilizer: 3 });
    expect(out).toEqual({ fertilizer: 3 });
  });

  it('drops entries for unknown item keys', () => {
    const out = sanitizeStoreInventory({ nope: 5, fertilizer: 2 });
    expect(out).toEqual({ fertilizer: 2 });
  });

  it('clamps a corrupt/negative count to 0', () => {
    expect(sanitizeStoreInventory({ fertilizer: -3 })).toEqual({ fertilizer: 0 });
    expect(sanitizeStoreInventory({ fertilizer: 'abc' })).toEqual({ fertilizer: 0 });
  });
});

describe('buyStoreItem() money + inventory math', () => {
  const fertilizer = getStoreItem('fertilizer');

  it('debits exactly the item price and bumps the owned count by 1 when affordable', () => {
    const res = buyStoreItem(20, {}, 'fertilizer');
    expect(res.ok).toBe(true);
    expect(res.cost).toBe(fertilizer.price);
    expect(res.balance).toBe(20 - fertilizer.price);
    expect(res.inventory.fertilizer).toBe(1);
  });

  it('stacks a repeat purchase onto the existing owned count', () => {
    const res = buyStoreItem(20, { fertilizer: 2 }, 'fertilizer');
    expect(res.inventory.fertilizer).toBe(3);
  });

  it('refuses when the player is one coin short and leaves inventory unchanged', () => {
    const res = buyStoreItem(fertilizer.price - 1, { fertilizer: 1 }, 'fertilizer');
    expect(res.ok).toBe(false);
    expect(res.balance).toBe(fertilizer.price - 1);
    expect(res.inventory).toEqual({ fertilizer: 1 });
  });

  it('is a no-op for an unknown item key', () => {
    const res = buyStoreItem(50, {}, 'not-a-real-item');
    expect(res.ok).toBe(false);
    expect(res.inventory).toEqual({});
  });

  it('does not mutate the input inventory object (immutable update)', () => {
    const input = { fertilizer: 1 };
    const res = buyStoreItem(20, input, 'fertilizer');
    expect(input.fertilizer).toBe(1); // unchanged
    expect(res.inventory.fertilizer).toBe(2);
    expect(res.inventory).not.toBe(input);
  });
});
