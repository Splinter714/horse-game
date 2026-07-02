// Garden plot state — plant → grow → harvest, the #242 core loop (pure logic).

import { describe, it, expect } from 'vitest';
import {
  GARDEN_SLOTS, emptyGarden, sanitizeGarden, plant, advanceDay,
  harvest, slotRipe, firstEmptySlot,
} from './garden.js';
import { GROWTH_STAGES, getCrop } from './crops.js';

// Ripen a single planted garden by advancing enough day cycles.
function ripen(garden) {
  let g = garden;
  for (let i = 0; i < GROWTH_STAGES; i++) g = advanceDay(g);
  return g;
}

describe('empty garden', () => {
  it('has GARDEN_SLOTS empty slots', () => {
    const g = emptyGarden();
    expect(g).toHaveLength(GARDEN_SLOTS);
    expect(g.every((s) => s === null)).toBe(true);
    expect(firstEmptySlot(g)).toBe(0);
  });
});

describe('planting', () => {
  it('plants a crop into an empty slot at stage 0', () => {
    const g = plant(emptyGarden(), 0, 'carrot');
    expect(g[0]).toEqual({ crop: 'carrot', stage: 0 });
    expect(slotRipe(g, 0)).toBe(false);
  });

  it('is immutable — returns a new array, leaves the original untouched', () => {
    const g0 = emptyGarden();
    const g1 = plant(g0, 0, 'wheat');
    expect(g0[0]).toBeNull();
    expect(g1).not.toBe(g0);
  });

  it('refuses to plant into an occupied slot, out of range, or an unknown crop', () => {
    const g = plant(emptyGarden(), 0, 'strawberry');
    expect(plant(g, 0, 'carrot')).toBe(g);       // occupied
    expect(plant(g, 99, 'carrot')).toBe(g);      // out of range
    expect(plant(emptyGarden(), 0, 'nope')).toEqual(emptyGarden()); // unknown crop
  });

  it('firstEmptySlot finds the next gap and returns -1 when full', () => {
    let g = emptyGarden();
    for (let i = 0; i < GARDEN_SLOTS; i++) g = plant(g, i, 'carrot');
    expect(firstEmptySlot(g)).toBe(-1);
  });
});

describe('growth over day/night cycles', () => {
  it('advances every planted slot one stage per day, empties stay empty', () => {
    let g = plant(emptyGarden(), 1, 'strawberry');
    expect(g[1].stage).toBe(0);
    g = advanceDay(g);
    expect(g[1].stage).toBe(1);
    expect(g[0]).toBeNull();
  });

  it('ripens after GROWTH_STAGES-1 advances and then holds at ripe', () => {
    let g = plant(emptyGarden(), 0, 'wheat');
    for (let i = 0; i < GROWTH_STAGES - 1; i++) {
      expect(slotRipe(g, 0)).toBe(false);
      g = advanceDay(g);
    }
    expect(slotRipe(g, 0)).toBe(true);
    g = advanceDay(g); // further days don't overshoot
    expect(g[0].stage).toBe(GROWTH_STAGES - 1);
    expect(slotRipe(g, 0)).toBe(true);
  });
});

describe('harvest', () => {
  it('yields the crop content + amount and clears the slot when ripe', () => {
    const g = ripen(plant(emptyGarden(), 2, 'strawberry'));
    const res = harvest(g, 2);
    expect(res.crop).toBe('strawberry');
    expect(res.yield).toBe(getCrop('strawberry').yield);
    expect(res.garden[2]).toBeNull();          // slot back to empty, ready to replant
    expect(firstEmptySlot(res.garden)).toBe(0);
  });

  it('is a no-op on an empty or still-growing slot', () => {
    const empty = emptyGarden();
    expect(harvest(empty, 0)).toEqual({ garden: empty, crop: null, yield: 0 });

    const growing = plant(emptyGarden(), 0, 'carrot'); // stage 0, not ripe
    const res = harvest(growing, 0);
    expect(res.crop).toBeNull();
    expect(res.yield).toBe(0);
    expect(res.garden[0]).not.toBeNull(); // crop still standing
  });

  it('a harvested slot can be replanted and grown again', () => {
    let g = ripen(plant(emptyGarden(), 0, 'carrot'));
    g = harvest(g, 0).garden;
    g = plant(g, 0, 'wheat');
    expect(g[0]).toEqual({ crop: 'wheat', stage: 0 });
  });
});

describe('sanitizeGarden (forgiving load)', () => {
  it('coerces a valid saved array through unchanged', () => {
    const saved = plant(emptyGarden(), 0, 'wheat');
    expect(sanitizeGarden(saved)).toEqual(saved);
  });

  it('drops malformed / unknown-crop / out-of-range entries to empty', () => {
    const raw = [{ crop: 'wheat', stage: 2 }, { crop: 'nope', stage: 1 }, 'junk', null, 42, {}];
    const g = sanitizeGarden(raw);
    expect(g).toHaveLength(GARDEN_SLOTS);
    expect(g[0]).toEqual({ crop: 'wheat', stage: 2 });
    expect(g[1]).toBeNull(); // unknown crop
    expect(g[2]).toBeNull(); // junk string
  });

  it('returns an empty garden for non-array / null input', () => {
    expect(sanitizeGarden(null)).toEqual(emptyGarden());
    expect(sanitizeGarden('x')).toEqual(emptyGarden());
    expect(sanitizeGarden(undefined)).toEqual(emptyGarden());
  });
});
