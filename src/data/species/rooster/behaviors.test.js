// Pure decision tests for rooster AI (#269) — pins the priority the dispatcher walks:
// an armed dawn-crow interrupts everything; otherwise the rooster falls back to the
// shared chicken flock behaviors (flee dog → seed → follow → gather at bin).

import { describe, it, expect } from 'vitest';
import { chooseBehavior } from '../index.js';

const BASE = {
  crowing: false, // dawn crow not armed by default
  nearestSeed: null, luring: false, anticipating: false, gateOpen: false,
  playerDist: Infinity, hungryFollowDist: 200,
  dogDist: Infinity, scatterDist: 96,
};

describe('rooster chooseBehavior', () => {
  it('nothing pulling at it → null (wanders)', () => {
    expect(chooseBehavior('rooster', BASE)).toBe(null);
  });

  it('dawn arms the crow → crowAtDawn', () => {
    expect(chooseBehavior('rooster', { ...BASE, crowing: true })).toBe('crowAtDawn');
  });

  it('crowing outranks EVERYTHING (highest priority)', () => {
    const c = { ...BASE, crowing: true, dogDist: 40, nearestSeed: { x: 1, y: 2 }, luring: true, anticipating: true, playerDist: 20 };
    expect(chooseBehavior('rooster', c)).toBe('crowAtDawn');
  });

  it('reuses the flock behaviors: dropped seed → seekSeed', () => {
    expect(chooseBehavior('rooster', { ...BASE, nearestSeed: { x: 1, y: 2 } })).toBe('seekSeed');
  });

  it('reuses the flock behaviors: seed-carrying player → followForSeed', () => {
    expect(chooseBehavior('rooster', { ...BASE, luring: true })).toBe('followForSeed');
  });

  it('reuses the flock behaviors: unfed + player far → gatherAtBin', () => {
    expect(chooseBehavior('rooster', { ...BASE, anticipating: true, playerDist: 500 })).toBe('gatherAtBin');
  });

  it('reuses the flock behaviors: a dog trotting close → fleeDog', () => {
    expect(chooseBehavior('rooster', { ...BASE, dogDist: 60 })).toBe('fleeDog');
  });

  it('a settled rooster (fed, no dog, no crow) just wanders', () => {
    expect(chooseBehavior('rooster', { ...BASE, anticipating: false, playerDist: 30 })).toBe(null);
  });
});
