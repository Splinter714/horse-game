// Pure decision tests for the dog AI (#187 charm, #231 swim). chooseBehavior must pick
// 'dogHerdSheep' exactly when a sheep flock is in range, it's daytime, and the
// per-dog cooldown has elapsed; otherwise it falls through to the generic
// 'swimStream' (species/swim.js) when a stream is reachable and its own gates pass;
// otherwise null (wander). The scene-coupled runs (dogGoHerd/animalGoSwim) are
// covered by the smoke test.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { chooseBehavior } from '../index.js';

// No sheep in range, no stream reachable, off cooldown, daytime, well fed and watered
// with an empty bowl (#347: an empty side reads as Infinity) — the dog just wanders.
const BASE = {
  isNight: false, nearestSheepDist: Infinity, now: 100000, lastHerd: null, herdCooldown: 22000,
  streamDist: Infinity, lastSwim: null, swimCooldown: 26000, swimChance: 1,
  hunger: 100, thirst: 100, nearestFoodDist: Infinity, nearestWaterDist: Infinity,
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

  // ── Feeding (#347) — the dog's own combined food + water bowl ────────────────

  it('hungry with a stocked food bowl in range → seekDogFood', () => {
    expect(chooseBehavior('dog', { ...BASE, hunger: 40, nearestFoodDist: 300 })).toBe('seekDogFood');
  });

  it('hungry but the food bowl is empty (Infinity) → does not seek', () => {
    expect(chooseBehavior('dog', { ...BASE, hunger: 40 })).toBe(null);
  });

  it('hungry but the stocked bowl is too far away → does not seek', () => {
    expect(chooseBehavior('dog', { ...BASE, hunger: 40, nearestFoodDist: 5000 })).toBe(null);
  });

  it('well fed with a stocked bowl → does not seek', () => {
    expect(chooseBehavior('dog', { ...BASE, nearestFoodDist: 300 })).toBe(null);
  });

  it('thirsty with a stocked water bowl in range → seekDogWater', () => {
    expect(chooseBehavior('dog', { ...BASE, thirst: 40, nearestWaterDist: 300 })).toBe('seekDogWater');
  });

  it('hungry AND thirsty → food wins (listed first)', () => {
    expect(chooseBehavior('dog', {
      ...BASE, hunger: 40, thirst: 40, nearestFoodDist: 300, nearestWaterDist: 300,
    })).toBe('seekDogFood');
  });

  it('hungry with a stocked bowl AND sheep in range → eating wins over herding', () => {
    expect(chooseBehavior('dog', {
      ...BASE, hunger: 40, nearestFoodDist: 300, nearestSheepDist: 200,
    })).toBe('seekDogFood');
  });
});
