// Pure late-night forced-sleep tests (issue #300). Phaser-free — mirrors the other
// src/data tests. Covers the progress fraction math and the warn/lock gates.

import { describe, it, expect } from 'vitest';
import {
  nightProgress,
  isLateNightWarning,
  isPastLateNightLock,
  LATE_NIGHT_WARN_FRACTION,
  LATE_NIGHT_LOCK_FRACTION,
} from './lateNight.js';

describe('nightProgress', () => {
  it('is 0 at the start of the phase and 1 at/after the end', () => {
    expect(nightProgress(0, 90_000)).toBe(0);
    expect(nightProgress(90_000, 90_000)).toBe(1);
    expect(nightProgress(120_000, 90_000)).toBe(1); // clamped past the end
  });

  it('is the linear fraction in between', () => {
    expect(nightProgress(45_000, 90_000)).toBeCloseTo(0.5);
    expect(nightProgress(9_000, 90_000)).toBeCloseTo(0.1);
  });

  it('never goes negative and tolerates a zero/invalid duration', () => {
    expect(nightProgress(-10, 90_000)).toBe(0);
    expect(nightProgress(1000, 0)).toBe(0);
  });
});

describe('isLateNightWarning', () => {
  it('is false before the warn fraction, even at Night', () => {
    expect(isLateNightWarning('Night', LATE_NIGHT_WARN_FRACTION - 0.01)).toBe(false);
  });

  it('is true once past the warn fraction and before the lock', () => {
    expect(isLateNightWarning('Night', LATE_NIGHT_WARN_FRACTION)).toBe(true);
    expect(isLateNightWarning('Night', (LATE_NIGHT_WARN_FRACTION + LATE_NIGHT_LOCK_FRACTION) / 2)).toBe(true);
  });

  it('is false once past the lock fraction (the lock cue takes over)', () => {
    expect(isLateNightWarning('Night', LATE_NIGHT_LOCK_FRACTION)).toBe(false);
    expect(isLateNightWarning('Night', 1)).toBe(false);
  });

  it('is false outside the Night phase regardless of progress', () => {
    expect(isLateNightWarning('Evening', 0.99)).toBe(false);
    expect(isLateNightWarning('Morning', 0.99)).toBe(false);
  });
});

describe('isPastLateNightLock', () => {
  it('is false before the lock fraction', () => {
    expect(isPastLateNightLock('Night', LATE_NIGHT_LOCK_FRACTION - 0.01)).toBe(false);
  });

  it('is true at/after the lock fraction, only during Night', () => {
    expect(isPastLateNightLock('Night', LATE_NIGHT_LOCK_FRACTION)).toBe(true);
    expect(isPastLateNightLock('Night', 1)).toBe(true);
    expect(isPastLateNightLock('Evening', 1)).toBe(false);
  });

  it('free roam is untouched before the lock — most of Night is unrestricted', () => {
    // Owls/ambient content have no gate here; this just proves the lock line sits
    // late (well past half the phase), leaving most of Night free.
    expect(LATE_NIGHT_LOCK_FRACTION).toBeGreaterThan(0.75);
    expect(isPastLateNightLock('Night', 0.5)).toBe(false);
  });
});
