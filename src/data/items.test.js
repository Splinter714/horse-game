// Characterization tests for the carrier/content item data (issue #62). These
// guard the data-driven inventory contract that the rest of the game reads.

import { describe, it, expect } from 'vitest';
import { CARRIER_DEFS, CONTENT_DEFS, CARRIER_GROUPS, CARRIER_MEMBERS, ALL_ITEMS, ITEM_MAP, ITEMS, foodDemand } from './items.js';

describe('carrier definitions', () => {
  it('baskets hold solids, buckets hold liquids', () => {
    // Basket cap is intentionally large (effectively unlimited): a gather only pulls
    // what's needed (#136), so the cap is just a safety ceiling, not a play limit.
    expect(CARRIER_DEFS.basket.capacity).toBeGreaterThanOrEqual(99);
    // wool/yarn added with shearing (#233) — solids, so they ride in the basket;
    // bunnyFood added with bunnies (#224).
    expect(CARRIER_DEFS.basket.accepts).toEqual(['hay', 'apple', 'carrot', 'seed', 'catFood', 'bunnyFood', 'egg', 'wool', 'yarn']);
    expect(CARRIER_DEFS.bucket.capacity).toBe(1);
    // milk added with the cow (#cow); bunnyWater with bunnies (#224). catWater removed
    // with the #202 rework — the cat's water bowl is filled from a plain bucket of water.
    expect(CARRIER_DEFS.bucket.accepts).toEqual(['water', 'bunnyWater', 'milk']);
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
    expect(CONTENT_DEFS.seed.feeds).toEqual(['chicken']);
    // Cat food (#202 rework): scooped into a basket, poured into the cat's FOOD BOWL
    // (`stocks: 'catFood'` marks it as a bowl-fill content), never dropped on the
    // ground — so it has no `ground` texture. Still feeds only the cat.
    expect(CONTENT_DEFS.catFood.feeds).toEqual(['cat']);
    expect(CONTENT_DEFS.catFood.stocks).toBe('catFood');
    expect(CONTENT_DEFS.catFood.ground).toBeUndefined();
    // catWater was removed with the #202 rework — the water bowl fills from plain water.
    expect(CONTENT_DEFS.catWater).toBeUndefined();
    // Bunny food/water (#224): bunnyFood feeds the bunny (and attracts it); bunnyWater
    // is its per-species dropped drink.
    expect(CONTENT_DEFS.bunnyFood.feeds).toEqual(['bunny']);
    expect(CONTENT_DEFS.bunnyWater.action).toBe('water');
    expect(CONTENT_DEFS.bunnyWater.feeds).toEqual(['bunny']);
    // Wool and yarn are sellable produce (#233); wool also spins INTO yarn (craftsTo).
    expect(CONTENT_DEFS.wool.action).toBe('sell');
    expect(CONTENT_DEFS.wool.craftsTo).toBe('yarn');
    expect(CONTENT_DEFS.yarn.action).toBe('sell');
    expect(CONTENT_DEFS.yarn.craftsTo).toBeUndefined(); // yarn is the end product
  });

  it('every feed-action content lists the species that eat it; egg/plain-water don\'t', () => {
    for (const [key, def] of Object.entries(CONTENT_DEFS)) {
      if (def.action === 'feed' || key === 'bunnyWater') expect(Array.isArray(def.feeds)).toBe(true);
      else expect(def.feeds).toBeUndefined(); // plain water/egg/sellables aren't tied to a diet
    }
  });
});

describe('foodDemand (#136 — gather one per animal that eats it)', () => {
  const counts = { horse: 7, chicken: 5 };

  it('horse foods pull one per horse', () => {
    expect(foodDemand('hay', counts)).toBe(7);
    expect(foodDemand('apple', counts)).toBe(7);
    expect(foodDemand('carrot', counts)).toBe(7);
  });

  it('seed pulls one per chicken', () => {
    expect(foodDemand('seed', counts)).toBe(5);
  });

  it('counts only the species in the food\'s diet, ignoring others', () => {
    // Apples are horse food today → chickens don't count toward an apple gather,
    // and seed (chicken food) ignores horses. When apples later gain a second eater
    // (e.g. `feeds: ['horse','pig']`), foodDemand sums both — see the reduce below.
    expect(foodDemand('apple', counts)).toBe(7);
    expect(foodDemand('seed', counts)).toBe(5);
  });

  it('is zero for non-food contents and unknown contents', () => {
    expect(foodDemand('water', counts)).toBe(0);
    expect(foodDemand('egg', counts)).toBe(0);
    expect(foodDemand('nope', counts)).toBe(0);
  });

  it('treats a missing species count as zero', () => {
    expect(foodDemand('hay', {})).toBe(0);
    expect(foodDemand('seed', { horse: 7 })).toBe(0);
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
  it('each group maps to its four member carriers', () => {
    expect(CARRIER_GROUPS.basketGroup.members).toEqual(['basket1', 'basket2', 'basket3', 'basket4']);
    expect(CARRIER_GROUPS.bucketGroup.members).toEqual(['bucket1', 'bucket2', 'bucket3', 'bucket4']);
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
    expect(ITEM_MAP.basketGroup.members).toEqual(['basket1', 'basket2', 'basket3', 'basket4']);
  });
});
