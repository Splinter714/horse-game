// Pure decision tests for the tamed duck's AI (#275). The duck rides its own
// `_duckContext` (scenes/paddock/behaviors.js), which carries hunger/thirst plus the
// distance to the nearest reachable dropped duck-food pile (nearestHayDist, diet-gated
// to duckFood), the filled trough (troughDist), and — since the duck also declares the
// `swims` capability — the generic swim fields (streamDist/lastSwim/swimChance/
// swimCooldown, ../swim.js). chooseBehavior must pick 'seekDuckFood' when the duck is
// hungry and a duck-food pile is reachable, 'seekDuckWater' when it's thirsty and the
// trough is in range, 'swimStream' when content/off-cooldown/in range of the stream and
// the random roll hits, and null (wander) otherwise. Food and water take priority over
// the swim (their earlier slots in the `behaviors` list). The scene-coupled `run`s
// (horseGoEat/horseGoDrink/animalGoSwim) and the wild-phase taming approach are covered
// by the smoke test.

import { describe, it, expect } from 'vitest';
import { chooseBehavior } from '../index.js';

// A content, well-fed-and-watered duck with nothing dropped nearby and no stream in
// reach — just wanders.
const BASE = {
  hunger: 100, thirst: 100,
  nearestHayDist: Infinity, troughDist: Infinity,
  isNight: false, now: 0,
  streamDist: Infinity, lastSwim: null, swimChance: 1, swimCooldown: 1000,
};

describe('duck chooseBehavior', () => {
  it('content duck with no stream in reach → wanders (null)', () => {
    expect(chooseBehavior('duck', BASE)).toBe(null);
  });

  it('hungry duck with a reachable dropped duck-food pile → seekDuckFood', () => {
    expect(chooseBehavior('duck', { ...BASE, hunger: 40, nearestHayDist: 200 })).toBe('seekDuckFood');
  });

  it('hungry duck with food out of range → wanders (null)', () => {
    expect(chooseBehavior('duck', { ...BASE, hunger: 40, nearestHayDist: 5000 })).toBe(null);
  });

  it('thirsty duck with the filled trough in range → seekDuckWater', () => {
    expect(chooseBehavior('duck', { ...BASE, thirst: 40, troughDist: 200 })).toBe('seekDuckWater');
  });

  it('thirsty duck with the trough out of range → wanders (null)', () => {
    expect(chooseBehavior('duck', { ...BASE, thirst: 40, troughDist: 5000 })).toBe(null);
  });

  it('hungry AND thirsty with both reachable → food wins (earlier priority)', () => {
    expect(chooseBehavior('duck', {
      ...BASE, hunger: 40, thirst: 40, nearestHayDist: 200, troughDist: 200,
    })).toBe('seekDuckFood');
  });

  it('well-fed but thirsty with only food reachable → wanders (won\'t eat when not hungry)', () => {
    expect(chooseBehavior('duck', { ...BASE, thirst: 40, nearestHayDist: 200 })).toBe(null);
  });

  it('content duck near the stream, off cooldown, chance hits → swimStream', () => {
    expect(chooseBehavior('duck', { ...BASE, streamDist: 100 })).toBe('swimStream');
  });

  it('content duck near the stream but chance misses → wanders (null)', () => {
    expect(chooseBehavior('duck', { ...BASE, streamDist: 100, swimChance: 0 })).toBe(null);
  });

  it('content duck near the stream but still on cooldown → wanders (null)', () => {
    expect(chooseBehavior('duck', {
      ...BASE, streamDist: 100, lastSwim: 500, now: 800, swimCooldown: 1000,
    })).toBe(null);
  });

  it('hungry duck with food AND a swimmable stream → food wins (earlier priority)', () => {
    expect(chooseBehavior('duck', {
      ...BASE, hunger: 40, nearestHayDist: 200, streamDist: 100,
    })).toBe('seekDuckFood');
  });

  it('at night, even in range and off cooldown → wanders (no night swims)', () => {
    expect(chooseBehavior('duck', { ...BASE, streamDist: 100, isNight: true })).toBe(null);
  });
});
