import { describe, it, expect } from 'vitest';
import { Pig } from './model.js';
import { speciesEatsContent } from '../../items.js';

describe('Pig', () => {
  it('has hunger/thirst needs that decay, plus a love (happiness) stat', () => {
    const pig = new Pig();
    expect(pig.stats.hunger).toBeGreaterThan(0);
    expect(pig.stats.thirst).toBeGreaterThan(0);
    expect(pig.stats.happiness).toBeGreaterThan(0);
    const h0 = pig.stats.hunger;
    pig.applyDecay(60);
    expect(pig.stats.hunger).toBeLessThan(h0);
  });

  it('feeds, waters and pets through the generic actions', () => {
    const pig = new Pig();
    pig.stats.hunger = 10;
    pig.feed();
    expect(pig.stats.hunger).toBe(45); // +35 feed
  });

  it('does not produce anything (no milk-style harvest)', () => {
    const pig = new Pig();
    expect(pig.readyToProduce).toBeFalsy();
  });

  it('round-trips through save/load keeping its species and name', () => {
    const pig = new Pig({ name: 'Penny' });
    const reloaded = new Pig(pig.toJSON());
    expect(reloaded.species).toBe('pig');
    expect(reloaded.name).toBe('Penny');
  });

  // The whole point of the feature: a pig eats apples and carrots but not hay.
  // The diet lives on the food data (items.js `feeds`), read by the grazing AI.
  it('eats apples and carrots but not hay', () => {
    expect(speciesEatsContent('pig', 'apple')).toBe(true);
    expect(speciesEatsContent('pig', 'carrot')).toBe(true);
    expect(speciesEatsContent('pig', 'hay')).toBe(false);
  });

  it('does not change the horse/cow diet (they still eat all three)', () => {
    for (const sp of ['horse', 'cow']) {
      expect(speciesEatsContent(sp, 'hay')).toBe(true);
      expect(speciesEatsContent(sp, 'apple')).toBe(true);
      expect(speciesEatsContent(sp, 'carrot')).toBe(true);
    }
  });
});
