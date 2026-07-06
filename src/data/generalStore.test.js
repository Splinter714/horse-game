// General store data (#215) — the STORE_COUNTERS registry: one counter (seeds) sells
// a seed for every crop in CROP_ORDER plus a fertilizer item. Covers the registry's
// integrity and the counter/lookup helpers.

import { describe, it, expect } from 'vitest';
import { STORE_COUNTERS, getCounter, getStoreItem } from './generalStore.js';
import { CROP_ORDER } from './crops.js';

describe('STORE_COUNTERS registry', () => {
  it('has at least the seeds counter', () => {
    expect(STORE_COUNTERS.length).toBeGreaterThan(0);
    expect(STORE_COUNTERS.some((c) => c.id === 'seeds')).toBe(true);
  });

  it('every counter has a non-empty items list with unique keys', () => {
    for (const counter of STORE_COUNTERS) {
      expect(counter.items.length).toBeGreaterThan(0);
      const keys = counter.items.map((i) => i.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('every item has a positive price, a label, and an icon', () => {
    for (const counter of STORE_COUNTERS) {
      for (const item of counter.items) {
        expect(item.price).toBeGreaterThan(0);
        expect(typeof item.label).toBe('string');
        expect(typeof item.icon).toBe('string');
      }
    }
  });

  it('the seeds counter sells one seed per crop in CROP_ORDER, plus fertilizer', () => {
    const seeds = getCounter('seeds');
    for (const cropId of CROP_ORDER) {
      expect(seeds.items.some((i) => i.key === `seed_${cropId}`)).toBe(true);
    }
    expect(seeds.items.some((i) => i.key === 'fertilizer')).toBe(true);
  });
});

describe('getCounter / getStoreItem lookups', () => {
  it('getCounter finds a real counter by id', () => {
    expect(getCounter('seeds')?.id).toBe('seeds');
  });

  it('getCounter returns null for an unknown id', () => {
    expect(getCounter('clothing')).toBeNull();
  });

  it('getStoreItem finds an item across counters', () => {
    expect(getStoreItem('fertilizer')?.key).toBe('fertilizer');
    expect(getStoreItem(`seed_${CROP_ORDER[0]}`)?.crop).toBe(CROP_ORDER[0]);
  });

  it('getStoreItem returns null for an unknown key', () => {
    expect(getStoreItem('nope')).toBeNull();
  });
});
