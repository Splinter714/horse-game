// Pure decision tests for horse AI. These pin the behavior-neutral contract: given
// a context snapshot, chooseBehavior must pick the same branch the old hand-written
// horseTickForHorse if-ladder would have. (The scene-coupled `run` half is covered
// by the smoke test.)

import { describe, it, expect } from 'vitest';
import { chooseBehavior } from '../index.js';

// A content horse with everything topped up and nothing nearby — wanders.
const BASE = {
  hunger: 100, thirst: 100, temperament: 'calm',
  nearestHayDist: Infinity, troughDist: Infinity, streamDist: Infinity,
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

  it('hungry horse but hay too far → not seekFood (grazes instead)', () => {
    // hunger 60 < GRAZE_HUNGER (70) and no player to beg → falls through to graze.
    expect(chooseBehavior('horse', { ...BASE, hunger: 60, nearestHayDist: 800 })).toBe('graze');
  });

  it('peckish with nothing else available → graze', () => {
    expect(chooseBehavior('horse', { ...BASE, hunger: 65 })).toBe('graze');
  });

  it('content horse (hunger at/above graze threshold) does not graze', () => {
    expect(chooseBehavior('horse', { ...BASE, hunger: 70 })).toBe(null);
  });

  it('seekFood still wins over graze when hay is reachable', () => {
    expect(chooseBehavior('horse', { ...BASE, hunger: 60, nearestHayDist: 300 })).toBe('seekFood');
  });

  it('thirsty (not hungry) with filled trough in range → seekWater', () => {
    expect(chooseBehavior('horse', { ...BASE, thirst: 60, troughDist: 500 })).toBe('seekWater');
  });

  it('food wins over water when both available (priority order)', () => {
    const c = { ...BASE, hunger: 60, nearestHayDist: 300, thirst: 60, troughDist: 500 };
    expect(chooseBehavior('horse', c)).toBe('seekFood');
  });

  it('desperately thirsty, no trough, stream in range → seekStream (#99)', () => {
    expect(chooseBehavior('horse', { ...BASE, thirst: 20, streamDist: 400 })).toBe('seekStream');
  });

  it('only mildly thirsty does not trek to the stream (waits for the trough)', () => {
    // thirst 40 is above THIRST_DESPERATE (25): no stream trip, nothing else fires.
    expect(chooseBehavior('horse', { ...BASE, thirst: 40, streamDist: 400 })).toBe(null);
  });

  it('desperately thirsty but the stream is out of range → no seekStream', () => {
    expect(chooseBehavior('horse', { ...BASE, thirst: 20, streamDist: 1500 })).toBe(null);
  });

  it('a filled trough is always preferred over the stream', () => {
    const c = { ...BASE, thirst: 20, troughDist: 600, streamDist: 200 };
    expect(chooseBehavior('horse', c)).toBe('seekWater');
  });

  it('very hungry, no hay, player near, non-lazy → begPlayer', () => {
    const c = { ...BASE, hunger: 40, playerDist: 300 };
    expect(chooseBehavior('horse', c)).toBe('begPlayer');
  });

  it('lazy horse never begs (grazes instead when hungry)', () => {
    const c = { ...BASE, hunger: 40, playerDist: 300, temperament: 'lazy' };
    expect(chooseBehavior('horse', c)).toBe('graze'); // not begPlayer
  });

  it('begs across a shut gate only when player is within notice distance', () => {
    // When too far to beg, a hungry horse falls through to grazing rather than wandering.
    const far  = { ...BASE, hunger: 40, gateOpen: false, playerDist: 600 };
    const near = { ...BASE, hunger: 40, gateOpen: false, playerDist: 400 };
    expect(chooseBehavior('horse', far)).toBe('graze');
    expect(chooseBehavior('horse', near)).toBe('begPlayer');
  });

  it('begging is throttled — recently sought horse holds off (grazes instead)', () => {
    const c = { ...BASE, hunger: 40, playerDist: 300, now: 100000, lastSeek: 95000 };
    expect(chooseBehavior('horse', c)).toBe('graze'); // only 5s since last seek (< 8s) → no beg
    expect(chooseBehavior('horse', { ...c, lastSeek: 90000 })).toBe('begPlayer'); // 10s
  });
});
