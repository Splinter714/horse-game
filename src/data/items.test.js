// Characterization tests for the carrier/content item data (issue #62). These
// guard the data-driven inventory contract that the rest of the game reads.

import { describe, it, expect } from 'vitest';
import { CARRIER_DEFS, CONTENT_DEFS, CARRIER_GROUPS, CARRIER_MEMBERS, ALL_ITEMS, ITEM_MAP, ITEMS } from './items.js';

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
  it('exposes the 2 carrier groups + the tools (members are grouped, #75)', () => {
    const groups = ALL_ITEMS.filter((i) => i.type === 'carrierGroup');
    const tools  = ALL_ITEMS.filter((i) => i.type === 'tool');
    expect(groups.map((g) => g.key)).toEqual(['basketGroup', 'bucketGroup']);
    expect(tools.map((t) => t.key)).toEqual(['brush', 'saddle', 'lead']);
    // The individual members aren't listed in the hotbar/inventory any more.
    expect(ALL_ITEMS.some((i) => i.type === 'carrier')).toBe(false);
  });

  it('ITEM_MAP keys every item and ITEMS aliases ALL_ITEMS', () => {
    expect(ITEM_MAP.brush.action).toBe('brush');
    expect(ITEM_MAP.hand).toBeUndefined(); // the hand tool was retired
    expect(ITEMS).toBe(ALL_ITEMS);
  });
});

describe('carrier groups (#75)', () => {
  it('each group maps to its three member carriers', () => {
    expect(CARRIER_GROUPS.basketGroup.members).toEqual(['basket1', 'basket2', 'basket3']);
    expect(CARRIER_GROUPS.bucketGroup.members).toEqual(['bucket1', 'bucket2', 'bucket3']);
    expect(CARRIER_GROUPS.basketGroup.carrier).toBe('basket');
    expect(CARRIER_GROUPS.bucketGroup.carrier).toBe('bucket');
  });

  it('ITEM_MAP still resolves every member key (so a group can resolve to one)', () => {
    for (const m of CARRIER_MEMBERS) {
      expect(ITEM_MAP[m.key]).toBeDefined();
      expect(ITEM_MAP[m.key].type).toBe('carrier');
    }
    // …and the group keys resolve to a group item carrying its member list.
    expect(ITEM_MAP.basketGroup.type).toBe('carrierGroup');
    expect(ITEM_MAP.basketGroup.members).toEqual(['basket1', 'basket2', 'basket3']);
  });
});
