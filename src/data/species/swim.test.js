// Pure decision tests for the generic stream-swim charm behavior (#231). swimStream
// must fire exactly when: daytime, a reachable stream point exists, the per-agent
// cooldown has elapsed, and the random roll lands under swimChance — and never
// otherwise. Deterministic here by pinning Math.random.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { swimStream } from './swim.js';

const BASE = {
  isNight: false, streamDist: 300, now: 100000, lastSwim: null, swimCooldown: 26000, swimChance: 1,
};

describe('swimStream.test', () => {
  afterEach(() => vi.restoreAllMocks());

  it('daytime, stream reachable, never swum, roll succeeds → fires', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(swimStream.test(BASE)).toBe(true);
  });

  it('no reachable stream (Infinity) → never fires', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(swimStream.test({ ...BASE, streamDist: Infinity })).toBe(false);
  });

  it('night → does not fire even with everything else favourable', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(swimStream.test({ ...BASE, isNight: true })).toBe(false);
  });

  it('still on cooldown → does not fire', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(swimStream.test({ ...BASE, lastSwim: 90000, now: 100000 })).toBe(false);
  });

  it('cooldown elapsed → fires again', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(swimStream.test({ ...BASE, lastSwim: 50000, now: 100000 })).toBe(true);
  });

  it('random roll misses (>= swimChance) → does not fire', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    expect(swimStream.test({ ...BASE, swimChance: 0.1 })).toBe(false);
  });
});
