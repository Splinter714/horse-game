// Characterization tests for the carrier/content item data (issue #62). These
// guard the data-driven inventory contract that the rest of the game reads.

import { describe, it, expect } from 'vitest';
import { CARRIER_DEFS, CONTENT_DEFS, ALL_ITEMS, ITEM_MAP, ITEMS } from './items.js';

describe('carrier definitions', () => {
  it('baskets hold solids, buckets hold liquids', () => {
    expect(CARRIER_DEFS.basket.capacity).toBe(5);
    expect(CARRIER_DEFS.basket.accepts).toEqual(['hay', 'apple', 'carrot', 'seed', 'egg']);
    expect(CARRIER_DEFS.bucket.capacity).toBe(1);
    expect(CARRIER_DEFS.bucket.accepts).toEqual(['water']);
  });

  it('every content a basket accepts has a content definition', () => {
    for (const c of CARRIER_DEFS.basket.accepts) expect(CONTENT_DEFS[c]).toBeDefined();
    for (const c of CARRIER_DEFS.bucket.accepts) expect(CONTENT_DEFS[c]).toBeDefined();
  });
});

describe('content definitions', () => {
  it('maps each content to an action', () => {
    expect(CONTENT_DEFS.hay.action).toBe('feed');
    expect(CONTENT_DEFS.water.action).toBe('water');
    expect(CONTENT_DEFS.egg.action).toBe('egg');
    expect(CONTENT_DEFS.seed.feeds).toBe('chicken');
  });
});

describe('hotbar items', () => {
  it('exposes 3 baskets + 2 buckets + the tools', () => {
    const carriers = ALL_ITEMS.filter((i) => i.type === 'carrier');
    const tools = ALL_ITEMS.filter((i) => i.type === 'tool');
    expect(carriers.map((c) => c.key)).toEqual(['basket1', 'basket2', 'basket3', 'bucket1', 'bucket2']);
    expect(tools.map((t) => t.key)).toEqual(['brush', 'saddle', 'lead', 'hand']);
  });

  it('ITEM_MAP keys every item and ITEMS aliases ALL_ITEMS', () => {
    expect(ITEM_MAP.brush.action).toBe('brush');
    expect(ITEM_MAP.hand.action).toBe('interact');
    expect(ITEMS).toBe(ALL_ITEMS);
  });
});
