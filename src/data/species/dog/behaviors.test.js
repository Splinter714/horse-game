// Pure decision tests for the dog AI (#187 charm). chooseBehavior must pick
// 'dogHerdSheep' exactly when a sheep flock is in range, it's daytime, and the
// per-dog cooldown has elapsed — and null (wander) otherwise. The scene-coupled run
// (dogGoHerd) is covered by the smoke test.

import { describe, it, expect } from 'vitest';
import { chooseBehavior } from '../index.js';

// No sheep in range, off cooldown, daytime — the dog just wanders.
const BASE = { isNight: false, nearestSheepDist: Infinity, now: 100000, lastHerd: null, herdCooldown: 22000 };

describe('dog chooseBehavior', () => {
  it('no sheep in range → wanders (null)', () => {
    expect(chooseBehavior('dog', BASE)).toBe(null);
  });

  it('sheep in range, never herded → dogHerdSheep', () => {
    expect(chooseBehavior('dog', { ...BASE, nearestSheepDist: 200 })).toBe('dogHerdSheep');
  });

  it('sheep in range but still on cooldown → does not herd', () => {
    expect(chooseBehavior('dog', { ...BASE, nearestSheepDist: 200, lastHerd: 90000, now: 100000 })).toBe(null);
  });

  it('sheep in range and cooldown elapsed → herds again', () => {
    expect(chooseBehavior('dog', { ...BASE, nearestSheepDist: 200, lastHerd: 50000, now: 100000 })).toBe('dogHerdSheep');
  });

  it('sheep in range but it is night → beds down, does not herd', () => {
    expect(chooseBehavior('dog', { ...BASE, nearestSheepDist: 200, isNight: true })).toBe(null);
  });
});
