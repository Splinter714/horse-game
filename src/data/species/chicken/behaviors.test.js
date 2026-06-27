// Pure decision tests for chicken AI — pins the priority the chickenTick dispatcher
// walks: dropped seed → follow a seed-carrying player → (hungry & player near) follow
// even without seeds → crowd the bin.

import { describe, it, expect } from 'vitest';
import { chooseBehavior } from '../index.js';

const BASE = {
  nearestSeed: null, luring: false, anticipating: false, gateOpen: false,
  playerDist: Infinity, hungryFollowDist: 200,
  dogDist: Infinity, scatterDist: 96, // #187: no dog around by default
};

describe('chicken chooseBehavior', () => {
  it('nothing pulling at it → null (wanders)', () => {
    expect(chooseBehavior('chicken', BASE)).toBe(null);
  });

  it('dropped seed → seekSeed', () => {
    expect(chooseBehavior('chicken', { ...BASE, nearestSeed: { x: 1, y: 2 } })).toBe('seekSeed');
  });

  it('seed-carrying player → followForSeed', () => {
    expect(chooseBehavior('chicken', { ...BASE, luring: true })).toBe('followForSeed');
  });

  it('unfed + player far → gatherAtBin (waits at the bin)', () => {
    expect(chooseBehavior('chicken', { ...BASE, anticipating: true, playerDist: 500 })).toBe('gatherAtBin');
  });

  it('unfed + player near (no seeds) → followWhenHungry (#128)', () => {
    expect(chooseBehavior('chicken', { ...BASE, anticipating: true, playerDist: 120 })).toBe('followWhenHungry');
  });

  it('fed for the day → no follow even when the player is right there', () => {
    expect(chooseBehavior('chicken', { ...BASE, anticipating: false, playerDist: 30 })).toBe(null);
  });

  it('dropped seed wins over luring and anticipating (priority)', () => {
    const c = { ...BASE, nearestSeed: { x: 1, y: 2 }, luring: true, anticipating: true, playerDist: 50 };
    expect(chooseBehavior('chicken', c)).toBe('seekSeed');
  });

  it('held seeds win over a hungry near-follow', () => {
    const c = { ...BASE, luring: true, anticipating: true, playerDist: 50 };
    expect(chooseBehavior('chicken', c)).toBe('followForSeed');
  });

  it('a dog trotting close → fleeDog (#187)', () => {
    expect(chooseBehavior('chicken', { ...BASE, dogDist: 60 })).toBe('fleeDog');
  });

  it('a dog at a comfortable distance → no scatter', () => {
    expect(chooseBehavior('chicken', { ...BASE, dogDist: 200 })).toBe(null);
  });

  it('fleeing the dog wins over everything (highest priority)', () => {
    const c = { ...BASE, dogDist: 50, nearestSeed: { x: 1, y: 2 }, luring: true, anticipating: true, playerDist: 30 };
    expect(chooseBehavior('chicken', c)).toBe('fleeDog');
  });
});
