// Pure decision tests for the tamed fox's AI (#266). The fox rides the shared grazer
// context (_horseContext), so its context carries hunger/thirst plus the distance to the
// nearest reachable dropped fox-food pile (nearestHayDist, diet-gated to foxFood) and the
// filled trough (troughDist). chooseBehavior must pick 'seekFoxFood' when the fox is
// hungry and a fox-food pile is reachable, 'seekFoxWater' when it's thirsty and the trough
// is in range, and null (wander) otherwise. Food takes priority over water (its earlier
// slot in the `behaviors` list). The scene-coupled `run`s (horseGoEat/horseGoDrink) and the
// wild-phase taming approach are covered by the smoke test.

import { describe, it, expect } from 'vitest';
import { chooseBehavior } from '../index.js';

// A content, well-fed-and-watered fox with nothing dropped nearby — just wanders.
const BASE = {
  hunger: 100, thirst: 100,
  nearestHayDist: Infinity, troughDist: Infinity, streamDist: Infinity,
  hasPlayer: false,
};

describe('fox chooseBehavior', () => {
  it('content fox → wanders (null)', () => {
    expect(chooseBehavior('fox', BASE)).toBe(null);
  });

  it('hungry fox with a reachable dropped fox-food pile → seekFoxFood', () => {
    expect(chooseBehavior('fox', { ...BASE, hunger: 40, nearestHayDist: 200 })).toBe('seekFoxFood');
  });

  it('hungry fox with food out of range → wanders (null)', () => {
    expect(chooseBehavior('fox', { ...BASE, hunger: 40, nearestHayDist: 5000 })).toBe(null);
  });

  it('thirsty fox with the filled trough in range → seekFoxWater', () => {
    expect(chooseBehavior('fox', { ...BASE, thirst: 40, troughDist: 200 })).toBe('seekFoxWater');
  });

  it('thirsty fox with the trough out of range → wanders (null)', () => {
    expect(chooseBehavior('fox', { ...BASE, thirst: 40, troughDist: 5000 })).toBe(null);
  });

  it('hungry AND thirsty with both reachable → food wins (earlier priority)', () => {
    expect(chooseBehavior('fox', {
      ...BASE, hunger: 40, thirst: 40, nearestHayDist: 200, troughDist: 200,
    })).toBe('seekFoxFood');
  });

  it('well-fed but thirsty with only food reachable → wanders (won\'t eat when not hungry)', () => {
    expect(chooseBehavior('fox', { ...BASE, thirst: 40, nearestHayDist: 200 })).toBe(null);
  });
});
