// Pure decision tests for chicken AI — pins the same priority the old chickenTick
// if-ladder used: dropped seed → follow a seed-carrying player → crowd the bin.

import { describe, it, expect } from 'vitest';
import { chooseBehavior } from '../index.js';

const BASE = { nearestSeed: null, luring: false, anticipating: false, gateOpen: false };

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

  it('morning, unfed, grain bin present → gatherAtBin', () => {
    expect(chooseBehavior('chicken', { ...BASE, anticipating: true })).toBe('gatherAtBin');
  });

  it('dropped seed wins over luring and anticipating (priority)', () => {
    const c = { ...BASE, nearestSeed: { x: 1, y: 2 }, luring: true, anticipating: true };
    expect(chooseBehavior('chicken', c)).toBe('seekSeed');
  });

  it('luring wins over anticipating', () => {
    expect(chooseBehavior('chicken', { ...BASE, luring: true, anticipating: true })).toBe('followForSeed');
  });
});
