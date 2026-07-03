// Pure season-logic tests (issue #272, v1 visual-first). Phaser-free — mirrors the
// other src/data tests. Covers the season cycle order, which season a given day
// maps to (with wrap-around), the palette lookup, and the winter-snow flag.

import { describe, it, expect } from 'vitest';
import {
  SEASON,
  SEASON_ORDER,
  DAYS_PER_SEASON,
  SEASON_PALETTE,
  seasonForDay,
  nextSeason,
  seasonPalette,
} from './seasons.js';

describe('season cycle order', () => {
  it('is the four seasons in spring→summer→fall→winter order', () => {
    expect(SEASON_ORDER).toEqual([
      SEASON.SPRING, SEASON.SUMMER, SEASON.FALL, SEASON.WINTER,
    ]);
  });

  it('nextSeason walks the cycle and wraps winter→spring', () => {
    expect(nextSeason(SEASON.SPRING)).toBe(SEASON.SUMMER);
    expect(nextSeason(SEASON.SUMMER)).toBe(SEASON.FALL);
    expect(nextSeason(SEASON.FALL)).toBe(SEASON.WINTER);
    expect(nextSeason(SEASON.WINTER)).toBe(SEASON.SPRING);
  });

  it('nextSeason falls back to spring for an unknown value', () => {
    expect(nextSeason('nonsense')).toBe(SEASON.SPRING);
  });
});

describe('seasonForDay', () => {
  it('maps the first block of days to spring, then advances each block', () => {
    // With DAYS_PER_SEASON = 3: 0..2 spring, 3..5 summer, 6..8 fall, 9..11 winter.
    expect(seasonForDay(0)).toBe(SEASON.SPRING);
    expect(seasonForDay(DAYS_PER_SEASON - 1)).toBe(SEASON.SPRING);
    expect(seasonForDay(DAYS_PER_SEASON)).toBe(SEASON.SUMMER);
    expect(seasonForDay(DAYS_PER_SEASON * 2)).toBe(SEASON.FALL);
    expect(seasonForDay(DAYS_PER_SEASON * 3)).toBe(SEASON.WINTER);
  });

  it('wraps back to spring after a full year', () => {
    expect(seasonForDay(DAYS_PER_SEASON * 4)).toBe(SEASON.SPRING);
    expect(seasonForDay(DAYS_PER_SEASON * 5)).toBe(SEASON.SUMMER);
  });

  it('handles a negative day gracefully (stays within the cycle)', () => {
    expect(SEASON_ORDER).toContain(seasonForDay(-1));
  });

  it('honours a custom daysPerSeason', () => {
    expect(seasonForDay(0, 1)).toBe(SEASON.SPRING);
    expect(seasonForDay(1, 1)).toBe(SEASON.SUMMER);
    expect(seasonForDay(2, 1)).toBe(SEASON.FALL);
    expect(seasonForDay(3, 1)).toBe(SEASON.WINTER);
    expect(seasonForDay(4, 1)).toBe(SEASON.SPRING);
  });
});

describe('season palette', () => {
  it('has an entry for every season with a tint/alpha/label/icon', () => {
    for (const s of SEASON_ORDER) {
      const p = SEASON_PALETTE[s];
      expect(p).toBeDefined();
      expect(typeof p.tint).toBe('number');
      expect(p.alpha).toBeGreaterThanOrEqual(0);
      expect(p.alpha).toBeLessThanOrEqual(1);
      expect(typeof p.label).toBe('string');
      expect(typeof p.icon).toBe('string');
    }
  });

  it('flags only winter for snow', () => {
    expect(seasonPalette(SEASON.WINTER).snow).toBe(true);
    expect(seasonPalette(SEASON.SPRING).snow).toBe(false);
    expect(seasonPalette(SEASON.SUMMER).snow).toBe(false);
    expect(seasonPalette(SEASON.FALL).snow).toBe(false);
  });

  it('seasonPalette falls back to spring for an unknown season', () => {
    expect(seasonPalette('nonsense')).toBe(SEASON_PALETTE[SEASON.SPRING]);
  });
});
