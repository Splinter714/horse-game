// Characterization tests for the carrier/content item data (issue #62). These
// guard the data-driven inventory contract that the rest of the game reads.

import { describe, it, expect } from 'vitest';
import { CARRIER_DEFS, CONTENT_DEFS, CARRIER_GROUPS, CARRIER_MEMBERS, ALL_ITEMS, ITEM_MAP, ITEMS, foodDemand,
  SCOOPER, scoopAmount, scooperHasLoad, dumpScooper, emptyCarrier,
  SHEARS, shearAmount, dumpShears,
  TOOL_UPGRADES, ALL_TOOL_UPGRADES, getToolUpgrade, upgradedStat } from './items.js';

describe('carrier definitions', () => {
  it('baskets hold solids, buckets hold liquids', () => {
    // Basket cap is intentionally large (effectively unlimited): a gather only pulls
    // what's needed (#136), so the cap is just a safety ceiling, not a play limit.
    expect(CARRIER_DEFS.basket.capacity).toBeGreaterThanOrEqual(99);
    // wool/yarn added with shearing (#233) — solids, so they ride in the basket;
    // bunnyFood added with bunnies (#224).
    // eggBrown added with colored eggs (#276) — brown/gold hens lay brown eggs.
    // compost added with poop-pickup (#232) — a solid that rides in the basket for
    // future crop use, even though the scoop/dump loop uses the scooper's own load.
    // strawberry/wheat added with crop farming (#242) — harvested crops ride the basket
    // → farm-stand → sell pipeline (carrots reuse the existing 'carrot' content). honey
    // added with the beehive (#239) — harvested into a basket, then sold at the stand.
    // foxFood added with foxes (#266) — gathered at the fox den, dropped as a pile to
    // befriend/feed the fox (the only ground-drop pet food; cat/bunny food fill bowls).
    // duckFood added with ducks (#275) — same ground-drop taming shape as the fox,
    // gathered at the duck feeder by the stream.
    // jam/flour/pigFeed added with crop processing (#40) — the kitchen counter's
    // processed forms of strawberry/wheat/carrot. blueberry/potato added with crop
    // variety (#216) — a regrowing bush crop and a one-and-done root veg. orange/berry
    // added with more tree/bush fruit (#228) — a second gatherable tree (orange) and
    // a gatherable bush (berry), both feeding into jam like strawberries.
    expect(CARRIER_DEFS.basket.accepts).toEqual(['hay', 'apple', 'carrot', 'seed', 'catFood', 'bunnyFood', 'foxFood', 'duckFood', 'egg', 'eggBrown', 'wool', 'yarn', 'compost', 'strawberry', 'wheat', 'honey', 'jam', 'flour', 'pigFeed', 'blueberry', 'potato', 'orange', 'berry']);
    expect(CARRIER_DEFS.bucket.capacity).toBe(1);
    // milk added with the cow (#cow). catWater removed with the #202 rework, bunnyWater
    // removed with #283 — pet water bowls (cat's and the bunny's) both fill from a plain
    // bucket of water; there's no per-species water content anymore. nectar added with the
    // hummingbird feeder (#226) — sugar water gathered at the nectar station into a bucket.
    expect(CARRIER_DEFS.bucket.accepts).toEqual(['water', 'milk', 'nectar']);
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
    // Seed feeds the chickens — and the goat, who eats everything (#267).
    expect(CONTENT_DEFS.seed.feeds).toEqual(['chicken', 'goat']);
    // Cat food (#202 rework): scooped into a basket, poured into the cat's FOOD BOWL
    // (`stocks: 'catFood'` marks it as a bowl-fill content), never dropped on the
    // ground — so it has no `ground` texture. Still feeds only the cat.
    expect(CONTENT_DEFS.catFood.feeds).toEqual(['cat']);
    expect(CONTENT_DEFS.catFood.stocks).toBe('catFood');
    expect(CONTENT_DEFS.catFood.ground).toBeUndefined();
    // catWater was removed with the #202 rework — the water bowl fills from plain water.
    expect(CONTENT_DEFS.catWater).toBeUndefined();
    // Bunny food (#224, reworked #283): stocks the bunny's FOOD BOWL (bowl-fill content,
    // like cat food), never dropped on the ground. bunnyWater was removed with #283 — the
    // bunny drinks from the shared pet water bowl, filled with plain water.
    expect(CONTENT_DEFS.bunnyFood.feeds).toEqual(['bunny']);
    expect(CONTENT_DEFS.bunnyFood.stocks).toBe('bunnyFood');
    expect(CONTENT_DEFS.bunnyWater).toBeUndefined();
    // Wool and yarn are sellable produce (#233); wool also spins INTO yarn (craftsTo).
    expect(CONTENT_DEFS.wool.action).toBe('sell');
    expect(CONTENT_DEFS.wool.craftsTo).toBe('yarn');
    expect(CONTENT_DEFS.yarn.action).toBe('sell');
    expect(CONTENT_DEFS.yarn.craftsTo).toBeUndefined(); // yarn is the end product
  });

  it('crop processing (#40): strawberry/wheat/carrot each craft into one processed good', () => {
    // Mirrors wool → yarn (#233): each raw crop's craftsTo names the kitchen counter's
    // processed output. Strawberry/wheat are still sellable raw too; the processed
    // forms (jam/flour) sell for more (constants.js STAND_DEFS) — the payoff for the
    // extra step. Ground pig feed isn't sellable — it's a feed, not a stand product.
    expect(CONTENT_DEFS.strawberry.craftsTo).toBe('jam');
    expect(CONTENT_DEFS.wheat.craftsTo).toBe('flour');
    expect(CONTENT_DEFS.carrot.craftsTo).toBe('pigFeed');
    expect(CONTENT_DEFS.jam.action).toBe('sell');
    expect(CONTENT_DEFS.flour.action).toBe('sell');
    expect(CONTENT_DEFS.pigFeed.action).toBe('feed');
    expect(CONTENT_DEFS.pigFeed.feeds).toEqual(['pig']);
    expect(CONTENT_DEFS.pigFeed.ground).toBe('pigFeedPile');
  });

  it('the goat eats every dropped food (#267 eat-everything quirk)', () => {
    // Every food that can be dropped as a ground pile lists 'goat' in its diet — the
    // goat is the one grazer that will trot over to any pile the farm drops.
    for (const key of ['hay', 'apple', 'carrot', 'seed']) {
      expect(CONTENT_DEFS[key].feeds, `${key} should feed the goat`).toContain('goat');
    }
  });

  it('every feed-action content lists the species that eat it; egg/plain-water don\'t', () => {
    for (const [key, def] of Object.entries(CONTENT_DEFS)) {
      if (def.action === 'feed') expect(Array.isArray(def.feeds)).toBe(true);
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
    // scooper added with poop-pickup (#232); shears added with #254 (multi-use tool).
    expect(tools.map((t) => t.key)).toEqual(['brush', 'saddle', 'lead', 'scooper', 'shears']);
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

describe('scooper + compost (#232)', () => {
  it('compost is a stored content — no diet, no ground drop, no sale', () => {
    expect(CONTENT_DEFS.compost).toBeDefined();
    expect(CONTENT_DEFS.compost.action).toBe('store');
    expect(CONTENT_DEFS.compost.feeds).toBeUndefined();  // nobody eats it
    expect(CONTENT_DEFS.compost.ground).toBeUndefined(); // it doesn't drop as food
  });

  it('the scooper is a load-carrying tool with a small capacity', () => {
    const scooper = ITEM_MAP.scooper;
    expect(scooper.type).toBe('tool');
    expect(scooper.action).toBe('scoop');
    expect(SCOOPER.capacity).toBeGreaterThan(0);
    expect(SCOOPER.content).toBe('compost');
  });

  it('scoopAmount adds one per scoop until full, then nothing', () => {
    expect(scoopAmount(0)).toBe(1);
    expect(scoopAmount(SCOOPER.capacity - 1)).toBe(1);
    expect(scoopAmount(SCOOPER.capacity)).toBe(0);   // full → can't scoop
    expect(scoopAmount(SCOOPER.capacity + 5)).toBe(0);
    // honours an explicit cap
    expect(scoopAmount(2, 2)).toBe(0);
    expect(scoopAmount(1, 2)).toBe(1);
  });

  it('scooperHasLoad reflects whether there is anything to dump', () => {
    expect(scooperHasLoad(0)).toBe(false);
    expect(scooperHasLoad(1)).toBe(true);
    expect(scooperHasLoad(SCOOPER.capacity)).toBe(true);
  });

  it('dumpScooper moves the whole load into the compost store, emptying the scooper', () => {
    expect(dumpScooper(3, 10)).toEqual({ load: 0, compost: 13 });
    expect(dumpScooper(SCOOPER.capacity, 0)).toEqual({ load: 0, compost: SCOOPER.capacity });
  });

  it('dumpScooper is a no-op when the scooper is empty', () => {
    expect(dumpScooper(0, 7)).toEqual({ load: 0, compost: 7 });
  });

  it('a full scoop → dump cycle nets one compost per scoop', () => {
    let load = 0, compost = 0;
    for (let i = 0; i < 3; i++) load += scoopAmount(load); // scoop three droppings
    expect(load).toBe(3);
    ({ load, compost } = dumpScooper(load, compost));
    expect(load).toBe(0);
    expect(compost).toBe(3);
  });
});

// Shears (#254) — a MULTI-USE cut/clip tool: shear sheep/llama into its own wool load
// (like the scooper's compost load) AND trim horse coats (grooming). The pure load
// helpers mirror the scooper's so the two load-tools share one verified contract.
describe('shears + wool load (#254)', () => {
  it('the shears are a load-carrying tool with a small wool capacity', () => {
    const shears = ITEM_MAP.shears;
    expect(shears.type).toBe('tool');
    expect(shears.action).toBe('shear');
    expect(SHEARS.capacity).toBeGreaterThan(0);
    expect(SHEARS.content).toBe('wool');
  });

  it('has its own procedural icon, distinct from the other tools', () => {
    expect(ITEM_MAP.shears.icon).toBe('iconShears');
    expect(ITEM_MAP.shears.icon).not.toBe(ITEM_MAP.scooper.icon);
  });

  it('shearAmount adds one per shear until full, then nothing', () => {
    expect(shearAmount(0)).toBe(1);
    expect(shearAmount(SHEARS.capacity - 1)).toBe(1);
    expect(shearAmount(SHEARS.capacity)).toBe(0);   // full → can't shear
    expect(shearAmount(SHEARS.capacity + 5)).toBe(0);
    // honours an explicit cap
    expect(shearAmount(2, 2)).toBe(0);
    expect(shearAmount(1, 2)).toBe(1);
  });

  it('dumpShears moves the whole wool load into the stand stock, emptying the shears', () => {
    expect(dumpShears(3, 10)).toEqual({ load: 0, stock: 13 });
    expect(dumpShears(SHEARS.capacity, 0)).toEqual({ load: 0, stock: SHEARS.capacity });
  });

  it('dumpShears is a no-op when the shears are empty', () => {
    expect(dumpShears(0, 7)).toEqual({ load: 0, stock: 7 });
  });

  it('a full shear → dump cycle nets one wool per shear', () => {
    let load = 0, stock = 0;
    for (let i = 0; i < 3; i++) load += shearAmount(load); // shear three fleeces
    expect(load).toBe(3);
    ({ load, stock } = dumpShears(load, stock));
    expect(load).toBe(0);
    expect(stock).toBe(3);
  });

  it('sheared wool reuses the existing sellable wool content (#233), no new content type', () => {
    // The shears land the same `wool` produce as basket-shearing — it sells at the
    // stand (STAND_DEFS.wool) and spins into yarn (craftsTo). No parallel content.
    expect(CONTENT_DEFS.wool.action).toBe('sell');
    expect(CONTENT_DEFS.wool.craftsTo).toBe('yarn');
  });
});

// Emptying a carrier into the trash can (#284) — discard the whole load in one Use,
// generic over any content. The pure emptyCarrier helper is the discard contract.
describe('emptyCarrier (trash-can discard, #284)', () => {
  it('discards the whole load and reverts the carrier to empty', () => {
    expect(emptyCarrier({ content: 'egg', count: 5 }))
      .toEqual({ state: { content: null, count: 0 }, discarded: 5 });
    // works the same for any content — no per-type special-casing
    expect(emptyCarrier({ content: 'water', count: 1 }))
      .toEqual({ state: { content: null, count: 0 }, discarded: 1 });
    expect(emptyCarrier({ content: 'wool', count: 12 }))
      .toEqual({ state: { content: null, count: 0 }, discarded: 12 });
  });

  it('is a no-op for an already-empty carrier (nothing discarded)', () => {
    expect(emptyCarrier({ content: null, count: 0 }))
      .toEqual({ state: { content: null, count: 0 }, discarded: 0 });
    // tolerant of a missing/undefined state
    expect(emptyCarrier(undefined))
      .toEqual({ state: { content: null, count: 0 }, discarded: 0 });
  });

  it('never leaves stale content behind after a discard', () => {
    const { state } = emptyCarrier({ content: 'hay', count: 3 });
    expect(state.content).toBeNull();
    expect(state.count).toBe(0);
  });
});

describe('tool upgrades (#295) — generic gold-bought tiers', () => {
  it('has a non-empty starter upgrade for at least one tool', () => {
    expect(ALL_TOOL_UPGRADES.length).toBeGreaterThan(0);
  });

  it('every upgrade has unique ids, a positive integer price, and a real effect stat', () => {
    const ids = new Set();
    for (const u of ALL_TOOL_UPGRADES) {
      expect(ids.has(u.id)).toBe(false);
      ids.add(u.id);
      expect(typeof u.label).toBe('string');
      expect(typeof u.desc).toBe('string');
      expect(u.price).toBeGreaterThan(0);
      expect(Number.isInteger(u.price)).toBe(true);
      expect(typeof u.effect?.stat).toBe('string');
      expect(typeof u.effect?.value).toBe('number');
      expect(typeof u.tool).toBe('string');
    }
  });

  it('flattens TOOL_UPGRADES into ALL_TOOL_UPGRADES with the owning tool tagged', () => {
    for (const [tool, tiers] of Object.entries(TOOL_UPGRADES)) {
      for (const tier of tiers) {
        const flat = ALL_TOOL_UPGRADES.find((u) => u.id === tier.id);
        expect(flat).toBeDefined();
        expect(flat.tool).toBe(tool);
      }
    }
  });

  it('getToolUpgrade resolves a known id and returns null for an unknown one', () => {
    const first = ALL_TOOL_UPGRADES[0];
    expect(getToolUpgrade(first.id)).toEqual(first);
    expect(getToolUpgrade('nope')).toBeNull();
  });

  it('the scooper capacity upgrade increases capacity over the base SCOOPER.capacity', () => {
    const upgrade = getToolUpgrade('scooperCapacity1');
    expect(upgrade.tool).toBe('scooper');
    expect(upgrade.effect.stat).toBe('capacity');
    expect(upgrade.effect.value).toBeGreaterThan(SCOOPER.capacity);
  });

  describe('upgradedStat', () => {
    it('returns the fallback when nothing is owned', () => {
      expect(upgradedStat('scooper', 'capacity', [], SCOOPER.capacity)).toBe(SCOOPER.capacity);
      expect(upgradedStat('scooper', 'capacity', new Set(), SCOOPER.capacity)).toBe(SCOOPER.capacity);
    });

    it('returns the purchased tier value when owned (array or Set of ids)', () => {
      expect(upgradedStat('scooper', 'capacity', ['scooperCapacity1'], SCOOPER.capacity)).toBe(18);
      expect(upgradedStat('scooper', 'capacity', new Set(['scooperCapacity1']), SCOOPER.capacity)).toBe(18);
    });

    it('ignores upgrades for a different tool or a different stat', () => {
      expect(upgradedStat('brush', 'capacity', ['scooperCapacity1'], 99)).toBe(99);
      expect(upgradedStat('scooper', 'speed', ['scooperCapacity1'], 5)).toBe(5);
    });

    it('is unaffected by unknown/stale ids in the owned set', () => {
      expect(upgradedStat('scooper', 'capacity', ['staleUpgradeId'], SCOOPER.capacity)).toBe(SCOOPER.capacity);
    });
  });
});
