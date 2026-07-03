// Unit tests for the pure incubation logic (incubation.js): hatch timing, the
// next-chick-key roster growth, and the parent-seeded chick look/data. No Phaser,
// no scene — just the data functions. Mirrors breeding.test.js's structure.

import { describe, it, expect } from 'vitest';
import {
  INCUBATION_MS, CHICK_AGE, GROWN_CHICK_AGE,
  nextChickKey, incubationRemaining, isHatchReady, incubationProgress,
  seedChickLook, makeChickData,
} from './incubation.js';

describe('incubation timing', () => {
  it('is not hatch-ready right after starting', () => {
    const start = 1_000_000;
    expect(isHatchReady(start, start)).toBe(false);
    expect(incubationRemaining(start, start)).toBe(INCUBATION_MS);
    expect(incubationProgress(start, start)).toBe(0);
  });

  it('becomes hatch-ready once INCUBATION_MS has elapsed', () => {
    const start = 1_000_000;
    expect(isHatchReady(start, start + INCUBATION_MS)).toBe(true);
    expect(incubationRemaining(start, start + INCUBATION_MS)).toBe(0);
    expect(incubationProgress(start, start + INCUBATION_MS)).toBe(1);
  });

  it('clamps remaining/progress past the finish line', () => {
    const start = 1_000_000;
    const later = start + INCUBATION_MS * 5;
    expect(incubationRemaining(start, later)).toBe(0);
    expect(incubationProgress(start, later)).toBe(1);
    expect(isHatchReady(start, later)).toBe(true);
  });

  it('progresses halfway at the midpoint', () => {
    const start = 0;
    expect(incubationProgress(start, INCUBATION_MS / 2)).toBeCloseTo(0.5, 5);
  });
});

describe('nextChickKey (roster growth)', () => {
  it('picks chick1 when no chicks exist yet', () => {
    expect(nextChickKey(['chicken0', 'chicken1', 'chicken4'])).toBe('chick1');
  });

  it('skips taken chick keys', () => {
    expect(nextChickKey(['chicken0', 'chick1', 'chick2'])).toBe('chick3');
  });

  it('fills a gap in the chick keys', () => {
    expect(nextChickKey(['chicken0', 'chick1', 'chick3'])).toBe('chick2');
  });
});

describe('seedChickLook (parent-seeded, no genetics roll)', () => {
  const hen = { id: 'chicken-1', coat: 2 };
  const rooster = { id: 'rooster-1', coat: 0 };

  it('seeds the coat from the hen parent', () => {
    expect(seedChickLook(hen, rooster).coat).toBe(2);
  });

  it('falls back to the rooster coat when the hen has none', () => {
    expect(seedChickLook({}, rooster).coat).toBe(0);
  });

  it('falls back to coat 0 when neither parent has one', () => {
    expect(seedChickLook({}, {}).coat).toBe(0);
  });

  it('is deterministic — same parents → same seed', () => {
    expect(seedChickLook(hen, rooster)).toEqual(seedChickLook(hen, rooster));
  });
});

describe('makeChickData (newborn roster entry)', () => {
  const hen = { id: 'chicken-1', coat: 3 };
  const rooster = { id: 'rooster-1', coat: 0 };

  it('produces a chick flagged as a baby that stays a baby by default', () => {
    const data = makeChickData(hen, rooster, 'chick1');
    expect(data.isFoal).toBe(true);
    expect(data.stayBaby).toBe(true); // #298: only grows up if the player allows it
    expect(data.age).toBe(CHICK_AGE);
    expect(data.parents).toEqual(['chicken-1', 'rooster-1']);
  });

  it('starts with full, content happiness (a newborn isn\'t instantly lonely)', () => {
    const data = makeChickData(hen, rooster, 'chick1');
    expect(data.stats.happiness).toBeGreaterThanOrEqual(80);
  });

  it('honours an explicitly-passed seed over re-deriving one', () => {
    const seed = { coat: 4 };
    const data = makeChickData(hen, rooster, 'chick1', seed);
    expect(data.coat).toBe(4);
  });

  it('GROWN_CHICK_AGE is older than a newborn', () => {
    expect(GROWN_CHICK_AGE).toBeGreaterThan(CHICK_AGE);
  });
});
