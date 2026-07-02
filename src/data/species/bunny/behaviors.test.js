// Pure decision tests for the bunny AI (#224). Given a context snapshot,
// chooseBehavior must pick 'seekBunnyFood' when the bunny is hungry and a dropped
// bunny-food pile is reachable, 'seekBunnyWater' when it's thirsty and a dropped
// bunny-water pile is reachable, and null (hop-wander) otherwise. Food takes priority
// over water (its earlier slot in the `behaviors` list). The scene-coupled `run`s
// (horseGoEat) are covered by the smoke test.

import { describe, it, expect } from 'vitest';
import { chooseBehavior } from '../index.js';

// A content, well-fed-and-watered bunny with nothing dropped nearby — just hop-wanders.
const BASE = {
  hunger: 100, thirst: 100,
  nearestFoodDist: Infinity, nearestWaterDist: Infinity,
  isNight: false,
};

describe('bunny chooseBehavior', () => {
  it('content bunny → hop-wanders (null)', () => {
    expect(chooseBehavior('bunny', BASE)).toBe(null);
  });

  it('hungry bunny with a reachable dropped bunny-food pile → seekBunnyFood', () => {
    expect(chooseBehavior('bunny', { ...BASE, hunger: 40, nearestFoodDist: 200 })).toBe('seekBunnyFood');
  });

  it('hungry bunny with food out of range → wanders (null)', () => {
    expect(chooseBehavior('bunny', { ...BASE, hunger: 40, nearestFoodDist: 5000 })).toBe(null);
  });

  it('thirsty bunny with a reachable dropped bunny-water pile → seekBunnyWater', () => {
    expect(chooseBehavior('bunny', { ...BASE, thirst: 40, nearestWaterDist: 200 })).toBe('seekBunnyWater');
  });

  it('thirsty bunny with water out of range → wanders (null)', () => {
    expect(chooseBehavior('bunny', { ...BASE, thirst: 40, nearestWaterDist: 5000 })).toBe(null);
  });

  it('hungry AND thirsty with both reachable → food wins (earlier priority)', () => {
    expect(chooseBehavior('bunny', {
      ...BASE, hunger: 40, thirst: 40, nearestFoodDist: 200, nearestWaterDist: 200,
    })).toBe('seekBunnyFood');
  });

  it('well-fed but thirsty with only food reachable → wanders (won\'t eat when not hungry)', () => {
    expect(chooseBehavior('bunny', { ...BASE, thirst: 40, nearestFoodDist: 200 })).toBe(null);
  });
});
