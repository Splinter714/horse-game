// Pure decision tests for the cat AI (#163/#202). Given a context snapshot,
// chooseBehavior must pick 'seekFood' when the cat is hungry and a dropped cat-food
// pile is reachable, 'seekWater' when it's thirsty and a dropped cat-water pile is
// reachable (both preferred over fishing), 'catFish' when hungry with neither pile
// but a reachable stream (daytime only), and null (wander) otherwise. The
// scene-coupled `run`s (horseGoEat / catGoFish) are covered by the smoke test.

import { describe, it, expect } from 'vitest';
import { chooseBehavior } from '../index.js';

// A content, well-fed-and-watered cat in daytime with the stream reachable and
// nothing out — just wanders.
const BASE = {
  hunger: 100, thirst: 100,
  nearestFoodDist: Infinity, nearestWaterDist: Infinity,
  streamDist: 400, isNight: false,
};

describe('cat chooseBehavior', () => {
  it('content cat → wanders (null)', () => {
    expect(chooseBehavior('cat', BASE)).toBe(null);
  });

  it('hungry cat with a reachable dropped cat-food pile → seekFood', () => {
    expect(chooseBehavior('cat', { ...BASE, hunger: 40, nearestFoodDist: 200 })).toBe('seekFood');
  });

  it('hungry cat with food out of range → falls through to catFish', () => {
    expect(chooseBehavior('cat', { ...BASE, hunger: 40, nearestFoodDist: 5000 })).toBe('catFish');
  });

  it('hungry cat in daytime with a reachable stream (no food out) → catFish', () => {
    expect(chooseBehavior('cat', { ...BASE, hunger: 40 })).toBe('catFish');
  });

  it('hungry cat at night → does not fish (goes home instead)', () => {
    expect(chooseBehavior('cat', { ...BASE, hunger: 40, isNight: true })).toBe(null);
  });

  it('hungry cat but no reachable stream or food → does not fish', () => {
    expect(chooseBehavior('cat', { ...BASE, hunger: 40, streamDist: Infinity })).toBe(null);
  });

  it('only mildly peckish (above both hunt thresholds) → still wanders', () => {
    expect(chooseBehavior('cat', { ...BASE, hunger: 92 })).toBe(null);
  });

  it('thirsty cat with a reachable dropped cat-water pile → seekWater', () => {
    expect(chooseBehavior('cat', { ...BASE, thirst: 40, nearestWaterDist: 200 })).toBe('seekWater');
  });

  it('thirsty cat with water out of range → wanders (thirst has no fishing fallback)', () => {
    expect(chooseBehavior('cat', { ...BASE, thirst: 40, nearestWaterDist: 5000 })).toBe(null);
  });

  it('seekFood outranks seekWater when both are hungry/thirsty and reachable (priority order)', () => {
    expect(chooseBehavior('cat', {
      ...BASE, hunger: 40, thirst: 40, nearestFoodDist: 200, nearestWaterDist: 200,
    })).toBe('seekFood');
  });

  it('only mildly thirsty (above the seek threshold) → still wanders', () => {
    expect(chooseBehavior('cat', { ...BASE, thirst: 95 })).toBe(null);
  });
});
