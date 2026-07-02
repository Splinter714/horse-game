// Pure tests for the cat-bowl fill/consume arithmetic (#202 rework). Guards the
// contract the scene plumbing (worldObjects.js fillCatBowl/_setCatBowlLevel, catAI.js
// catEatFromBowl) reads: a refill tops the bowl to the cap, each meal drains one
// serving down to empty, and `bowlHasFood` flips as the level crosses zero — which
// is what swaps the bowl sprite and gates the cat's seek behavior.

import { describe, it, expect } from 'vitest';
import { fillBowlLevel, drainBowlLevel, bowlHasFood } from './bowls.js';

describe('cat bowl fill/consume', () => {
  it('refilling tops the bowl to the cap regardless of what was left', () => {
    expect(fillBowlLevel(4)).toBe(4);
    expect(fillBowlLevel(1)).toBe(1);
  });

  it('each meal drains exactly one serving', () => {
    expect(drainBowlLevel(4)).toBe(3);
    expect(drainBowlLevel(1)).toBe(0);
  });

  it('draining never goes below empty', () => {
    expect(drainBowlLevel(0)).toBe(0);
    expect(drainBowlLevel(-2)).toBe(0);
  });

  it('a full bowl drains to empty in exactly CAP meals', () => {
    const CAP = 4;
    let level = fillBowlLevel(CAP);
    let meals = 0;
    while (bowlHasFood(level)) { level = drainBowlLevel(level); meals++; }
    expect(meals).toBe(CAP);
    expect(level).toBe(0);
  });

  it('bowlHasFood reports whether there is anything to eat/drink', () => {
    expect(bowlHasFood(0)).toBe(false);
    expect(bowlHasFood(1)).toBe(true);
    expect(bowlHasFood(4)).toBe(true);
  });
});
