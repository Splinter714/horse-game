import { describe, it, expect } from 'vitest';
import { Cow } from './model.js';

// Mark the cow as fully cared for today (the milk/contentment requirement).
function careForToday(cow) {
  cow.feed();
  cow.water();
  cow.pet();
}

describe('Cow', () => {
  it('starts nameless but carries a name field that can be set later', () => {
    const cow = new Cow();
    expect(cow.name).toBe('');
    cow.name = 'Clarabelle';
    expect(new Cow(cow.toJSON()).name).toBe('Clarabelle');
  });

  it('has hunger/thirst needs that decay, plus a love (happiness) stat', () => {
    const cow = new Cow();
    expect(cow.stats.hunger).toBeGreaterThan(0);
    expect(cow.stats.thirst).toBeGreaterThan(0);
    expect(cow.stats.happiness).toBeGreaterThan(0);
    const h0 = cow.stats.hunger;
    cow.applyDecay(60);
    expect(cow.stats.hunger).toBeLessThan(h0);
  });

  it('is not milkable until cared for the day before', () => {
    const cow = new Cow();
    // Fresh cow: no prior day → not ready.
    expect(cow.readyToProduce).toBe(false);

    // Care for her today, then roll into a new day → ready to milk.
    careForToday(cow);
    cow.rollNewDay();
    expect(cow.readyToProduce).toBe(true);
    expect(cow.producedToday).toBe(false);
    expect(cow.neglected).toBe(false);
  });

  it('is not milkable (and wakes neglected) after a day of poor care', () => {
    const cow = new Cow();
    careForToday(cow);
    cow.rollNewDay(); // ready after a good day
    expect(cow.readyToProduce).toBe(true);

    // Next day: only pet her, skip food + water → not ready, and neglected.
    cow.pet();
    cow.rollNewDay();
    expect(cow.readyToProduce).toBe(false);
    expect(cow.neglected).toBe(true);
  });

  it('persists milk readiness across save/load', () => {
    const cow = new Cow();
    careForToday(cow);
    cow.rollNewDay();
    cow.producedToday = true; // milked today

    const reloaded = new Cow(cow.toJSON());
    expect(reloaded.readyToProduce).toBe(true);
    expect(reloaded.producedToday).toBe(true);
  });
});
