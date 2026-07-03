import { describe, it, expect } from 'vitest';
import { Goat } from './model.js';

// Mark the goat as fully cared for today (the milk/contentment requirement).
function careForToday(goat) {
  goat.feed();
  goat.water();
  goat.pet();
}

describe('Goat', () => {
  it('carries a name field that persists across save/load', () => {
    const goat = new Goat();
    expect(goat.name).toBe('Gruff');
    goat.name = 'Nanny';
    expect(new Goat(goat.toJSON()).name).toBe('Nanny');
  });

  it('has hunger/thirst needs that decay, plus a love (happiness) stat', () => {
    const goat = new Goat();
    expect(goat.stats.hunger).toBeGreaterThan(0);
    expect(goat.stats.thirst).toBeGreaterThan(0);
    expect(goat.stats.happiness).toBeGreaterThan(0);
    const h0 = goat.stats.hunger;
    goat.applyDecay(60);
    expect(goat.stats.hunger).toBeLessThan(h0);
  });

  it('is milkable on day one (readyAtStart), and stays milkable after a good day', () => {
    const goat = new Goat();
    // Fresh goat can be milked immediately so the mechanic is easy to try.
    expect(goat.readyToProduce).toBe(true);

    // Care for her today, then roll into a new day → still ready to milk.
    careForToday(goat);
    goat.rollNewDay();
    expect(goat.readyToProduce).toBe(true);
    expect(goat.producedToday).toBe(false);
    expect(goat.neglected).toBe(false);
  });

  it('is not milkable (and wakes neglected) after a day of poor care', () => {
    const goat = new Goat();
    careForToday(goat);
    goat.rollNewDay(); // ready after a good day
    expect(goat.readyToProduce).toBe(true);

    // Next day: only pet her, skip food + water → not ready, and neglected.
    goat.pet();
    goat.rollNewDay();
    expect(goat.readyToProduce).toBe(false);
    expect(goat.neglected).toBe(true);
  });

  it('persists milk readiness across save/load', () => {
    const goat = new Goat();
    careForToday(goat);
    goat.rollNewDay();
    goat.producedToday = true; // milked today

    const reloaded = new Goat(goat.toJSON());
    expect(reloaded.readyToProduce).toBe(true);
    expect(reloaded.producedToday).toBe(true);
  });
});
