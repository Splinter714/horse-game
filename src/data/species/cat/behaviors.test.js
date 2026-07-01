// Pure decision tests for the cat AI (#163/#202). Given a context snapshot,
// chooseBehavior must pick 'seekFood' when the cat is hungry and a dropped fish pile
// is reachable (preferred over fishing), 'catFish' when hungry with no fish pile but
// a reachable stream (daytime only), and null (wander) otherwise. The scene-coupled
// `run`s (horseGoEat / catGoFish) are covered by the smoke test.

import { describe, it, expect } from 'vitest';
import { chooseBehavior } from '../index.js';

// A content, well-fed cat in daytime with the stream reachable and no fish out —
// just wanders.
const BASE = { hunger: 100, nearestFishDist: Infinity, streamDist: 400, isNight: false };

describe('cat chooseBehavior', () => {
  it('content cat → wanders (null)', () => {
    expect(chooseBehavior('cat', BASE)).toBe(null);
  });

  it('hungry cat with a reachable dropped fish pile → seekFood', () => {
    expect(chooseBehavior('cat', { ...BASE, hunger: 40, nearestFishDist: 200 })).toBe('seekFood');
  });

  it('hungry cat with fish out of range → falls through to catFish', () => {
    expect(chooseBehavior('cat', { ...BASE, hunger: 40, nearestFishDist: 5000 })).toBe('catFish');
  });

  it('hungry cat in daytime with a reachable stream (no fish out) → catFish', () => {
    expect(chooseBehavior('cat', { ...BASE, hunger: 40 })).toBe('catFish');
  });

  it('hungry cat at night → does not fish (goes home instead)', () => {
    expect(chooseBehavior('cat', { ...BASE, hunger: 40, isNight: true })).toBe(null);
  });

  it('hungry cat but no reachable stream or fish → does not fish', () => {
    expect(chooseBehavior('cat', { ...BASE, hunger: 40, streamDist: Infinity })).toBe(null);
  });

  it('only mildly peckish (above both hunt thresholds) → still wanders', () => {
    expect(chooseBehavior('cat', { ...BASE, hunger: 92 })).toBe(null);
  });
});
