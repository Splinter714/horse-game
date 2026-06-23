// Characterization tests for the Horse model. These lock in TODAY'S behavior
// (numbers, decay, daily-care, mood thresholds) so the upcoming generalization
// to a data-driven Animal model can be verified as behavior-neutral.

import { describe, it, expect } from 'vitest';
import { Horse, EBONY_BASE_STATS } from './horse.js';

describe('Horse construction', () => {
  it('applies sensible defaults', () => {
    const h = new Horse();
    expect(h.name).toBe('Buttercup');
    expect(h.breed).toBe('Palomino');
    expect(h.coat).toBe('palomino');
    expect(h.temperament).toBe('calm');
    expect(h.stats).toEqual({ hunger: 80, thirst: 75, grooming: 60, happiness: 85 });
    expect(h.saddled).toBe(false);
    expect(h.caredToday).toEqual({ fed: false, watered: false, brushed: false });
    expect(h.neglected).toBe(false);
  });

  it('merges provided stats over defaults', () => {
    const h = new Horse({ stats: { hunger: 10 } });
    expect(h.stats).toEqual({ hunger: 10, thirst: 75, grooming: 60, happiness: 85 });
  });

  it('only attaches optional fixed attributes when provided', () => {
    const plain = new Horse();
    expect(plain.health).toBeUndefined();
    const ebony = new Horse({ ...EBONY_BASE_STATS });
    expect(ebony.health).toBe(95);
    expect(ebony.speed).toBe(80);
    expect(ebony.stamina).toBe(70);
  });
});

describe('Horse care actions', () => {
  it('feed/water/brush/pet bump the right stat and record care', () => {
    const h = new Horse({ stats: { hunger: 0, thirst: 0, grooming: 0, happiness: 0 } });
    h.feed();  expect(h.stats.hunger).toBe(35);   expect(h.caredToday.fed).toBe(true);
    h.water(); expect(h.stats.thirst).toBe(40);   expect(h.caredToday.watered).toBe(true);
    h.brush(); expect(h.stats.grooming).toBe(30); expect(h.caredToday.brushed).toBe(true);
    h.pet();   expect(h.stats.happiness).toBe(8);
  });

  it('clamps stats at 100', () => {
    const h = new Horse({ stats: { hunger: 90, thirst: 90, grooming: 90, happiness: 99 } });
    h.feed();  expect(h.stats.hunger).toBe(100);
    h.water(); expect(h.stats.thirst).toBe(100);
    h.brush(); expect(h.stats.grooming).toBe(100);
    h.pet();   expect(h.stats.happiness).toBe(100);
  });

  it('any care clears the neglected flag', () => {
    const h = new Horse();
    h.neglected = true;
    h.pet();
    expect(h.neglected).toBe(false);
  });
});

describe('Horse.applyDecay', () => {
  it('decays at the documented per-second rates while playing', () => {
    const h = new Horse({ stats: { hunger: 100, thirst: 100, grooming: 100, happiness: 100 } });
    h.applyDecay(10); // 10 seconds
    expect(h.stats.hunger).toBeCloseTo(99.5, 5);   // 0.05/s
    expect(h.stats.thirst).toBeCloseTo(99.4, 5);   // 0.06/s
    expect(h.stats.grooming).toBeCloseTo(99.7, 5); // 0.03/s
  });

  it('never falls below 0 while playing', () => {
    const h = new Horse({ stats: { hunger: 1, thirst: 1, grooming: 1, happiness: 1 } });
    h.applyDecay(10000);
    expect(h.stats.hunger).toBe(0);
    expect(h.stats.thirst).toBe(0);
    expect(h.stats.grooming).toBe(0);
  });

  it('offline decay is capped at the forgiving floor of 30', () => {
    const h = new Horse({ stats: { hunger: 100, thirst: 100, grooming: 100, happiness: 100 } });
    h.applyDecay(10_000_000, true); // ages forever, offline
    expect(h.stats.hunger).toBe(30);
    expect(h.stats.thirst).toBe(30);
    expect(h.stats.grooming).toBe(30);
    expect(h.stats.happiness).toBe(30);
  });

  it('offline absence floors a below-30 stat back UP to the forgiving floor', () => {
    // Current behavior: offline uses Math.max(floor, next), so a stat that was
    // below 30 comes back up to 30 on return — absence settles everyone at >= 30.
    const h = new Horse({ stats: { hunger: 10, thirst: 10, grooming: 10, happiness: 10 } });
    h.applyDecay(5, true);
    expect(h.stats.hunger).toBe(30);
    expect(h.stats.thirst).toBe(30);
    expect(h.stats.grooming).toBe(30);
  });
});

describe('Horse.rollNewDay', () => {
  it('wakes neglected if it missed food OR water yesterday', () => {
    const h = new Horse();
    h.caredToday = { fed: true, watered: false, brushed: true };
    h.rollNewDay();
    expect(h.neglected).toBe(true);
    expect(h.caredToday).toEqual({ fed: false, watered: false, brushed: false });
  });

  it('wakes content if it got both food and water', () => {
    const h = new Horse();
    h.caredToday = { fed: true, watered: true, brushed: false };
    h.rollNewDay();
    expect(h.neglected).toBe(false);
  });
});

describe('Horse.mood', () => {
  it('maps happiness to a friendly label', () => {
    const at = (happiness) => new Horse({ stats: { happiness } }).mood();
    expect(at(90)).toBe('happy');
    expect(at(80)).toBe('happy');
    expect(at(60)).toBe('content');
    expect(at(40)).toBe('a bit down');
    expect(at(10)).toBe('needs you');
  });
});

describe('Horse.toJSON', () => {
  it('round-trips identity, stats and saddle but omits runtime-only fields', () => {
    const h = new Horse({ id: 'x', name: 'Test', saddled: true });
    const json = h.toJSON();
    expect(json.id).toBe('x');
    expect(json.saddled).toBe(true);
    expect(json).not.toHaveProperty('caredToday');
    expect(json).not.toHaveProperty('neglected');
    // optional attributes only present when set
    expect(json).not.toHaveProperty('health');
  });

  it('includes optional fixed attributes when present', () => {
    const h = new Horse({ health: 95, speed: 80, stamina: 70 });
    expect(h.toJSON()).toMatchObject({ health: 95, speed: 80, stamina: 70 });
  });
});
