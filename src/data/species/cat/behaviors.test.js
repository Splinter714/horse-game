// Pure decision tests for the cat AI (#163). Given a context snapshot, chooseBehavior
// must pick 'catFish' exactly when the cat is hungry, it's daytime, and a stream is
// reachable — and null (wander) otherwise. The scene-coupled `run` (catGoFish) is
// covered by the smoke test.

import { describe, it, expect } from 'vitest';
import { chooseBehavior } from '../index.js';

// A content, well-fed cat in daytime with the stream reachable — just wanders.
const BASE = { hunger: 100, streamDist: 400, isNight: false };

describe('cat chooseBehavior', () => {
  it('content cat → wanders (null)', () => {
    expect(chooseBehavior('cat', BASE)).toBe(null);
  });

  it('hungry cat in daytime with a reachable stream → catFish', () => {
    expect(chooseBehavior('cat', { ...BASE, hunger: 40 })).toBe('catFish');
  });

  it('hungry cat at night → does not fish (goes home instead)', () => {
    expect(chooseBehavior('cat', { ...BASE, hunger: 40, isNight: true })).toBe(null);
  });

  it('hungry cat but no reachable stream → does not fish', () => {
    expect(chooseBehavior('cat', { ...BASE, hunger: 40, streamDist: Infinity })).toBe(null);
  });

  it('only mildly peckish (above the hunt threshold) → still wanders', () => {
    expect(chooseBehavior('cat', { ...BASE, hunger: 60 })).toBe(null);
  });
});
