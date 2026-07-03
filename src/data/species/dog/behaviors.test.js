// Pure decision tests for the dog AI (#187 charm, #231 swim). chooseBehavior must pick
// 'dogHerdSheep' exactly when a sheep flock is in range, it's daytime, and the
// per-dog cooldown has elapsed; otherwise it falls through to the generic
// 'swimStream' (species/swim.js) when a stream is reachable and its own gates pass;
// otherwise null (wander). The scene-coupled runs (dogGoHerd/animalGoSwim) are
// covered by the smoke test.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { chooseBehavior } from '../index.js';

// No sheep in range, no stream reachable, off cooldown, daytime — the dog just wanders.
const BASE = {
  isNight: false, nearestSheepDist: Infinity, now: 100000, lastHerd: null, herdCooldown: 22000,
  streamDist: Infinity, lastSwim: null, swimCooldown: 26000, swimChance: 1,
};

describe('dog chooseBehavior', () => {
  afterEach(() => vi.restoreAllMocks());

  it('no sheep, no stream → wanders (null)', () => {
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

  it('no sheep, stream reachable, roll succeeds → swimStream', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(chooseBehavior('dog', { ...BASE, streamDist: 300 })).toBe('swimStream');
  });

  it('sheep in range AND stream reachable → herding still wins (higher priority)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(chooseBehavior('dog', { ...BASE, nearestSheepDist: 200, streamDist: 300 })).toBe('dogHerdSheep');
  });

  it('stream reachable but night → does not swim', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(chooseBehavior('dog', { ...BASE, streamDist: 300, isNight: true })).toBe(null);
  });
});
