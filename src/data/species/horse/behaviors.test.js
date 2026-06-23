// Pure decision tests for horse AI. These pin the behavior-neutral contract: given
// a context snapshot, chooseBehavior must pick the same branch the old hand-written
// horseTickForHorse if-ladder would have. (The scene-coupled `run` half is covered
// by the smoke test.)

import { describe, it, expect } from 'vitest';
import { chooseBehavior } from '../index.js';

// A content horse with everything topped up and nothing nearby — wanders.
const BASE = {
  hunger: 100, thirst: 100, temperament: 'calm',
  nearestHayDist: Infinity, troughDist: Infinity,
  hasPlayer: true, gateOpen: false, playerDist: 9999,
  now: 100000, lastSeek: null,
  begHunger: 50, begNoticeDist: 520, begThrottleMs: 8000,
};

describe('horse chooseBehavior', () => {
  it('content horse with nothing nearby → wanders (null)', () => {
    expect(chooseBehavior('horse', BASE)).toBe(null);
  });

  it('hungry horse with hay in range → seekFood', () => {
    expect(chooseBehavior('horse', { ...BASE, hunger: 60, nearestHayDist: 300 })).toBe('seekFood');
  });

  it('hungry horse but hay too far → not seekFood', () => {
    expect(chooseBehavior('horse', { ...BASE, hunger: 60, nearestHayDist: 800 })).toBe(null);
  });

  it('thirsty (not hungry) with filled trough in range → seekWater', () => {
    expect(chooseBehavior('horse', { ...BASE, thirst: 60, troughDist: 500 })).toBe('seekWater');
  });

  it('food wins over water when both available (priority order)', () => {
    const c = { ...BASE, hunger: 60, nearestHayDist: 300, thirst: 60, troughDist: 500 };
    expect(chooseBehavior('horse', c)).toBe('seekFood');
  });

  it('very hungry, no hay, player near, non-lazy → begPlayer', () => {
    const c = { ...BASE, hunger: 40, playerDist: 300 };
    expect(chooseBehavior('horse', c)).toBe('begPlayer');
  });

  it('lazy horse never begs', () => {
    const c = { ...BASE, hunger: 40, playerDist: 300, temperament: 'lazy' };
    expect(chooseBehavior('horse', c)).toBe(null);
  });

  it('begs across a shut gate only when player is within notice distance', () => {
    const far  = { ...BASE, hunger: 40, gateOpen: false, playerDist: 600 };
    const near = { ...BASE, hunger: 40, gateOpen: false, playerDist: 400 };
    expect(chooseBehavior('horse', far)).toBe(null);
    expect(chooseBehavior('horse', near)).toBe('begPlayer');
  });

  it('begging is throttled — recently sought horse holds off', () => {
    const c = { ...BASE, hunger: 40, playerDist: 300, now: 100000, lastSeek: 95000 };
    expect(chooseBehavior('horse', c)).toBe(null); // only 5s since last seek (< 8s)
    expect(chooseBehavior('horse', { ...c, lastSeek: 90000 })).toBe('begPlayer'); // 10s
  });
});
