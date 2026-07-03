// Unit tests for the pure breeding logic (breeding.js): gestation timing, the
// next-foal-key roster growth, the parent-seeded foal look/data, and (#114) the
// permanent pair-bond checks. No Phaser, no scene — just the data functions.

import { describe, it, expect } from 'vitest';
import {
  GESTATION_MS, FOAL_AGE, GROWN_AGE,
  nextFoalKey, gestationRemaining, isBornReady, gestationProgress,
  seedFoalLook, makeFoalData,
  isBonded, bondMateKey, canBond,
} from './breeding.js';

describe('gestation timing', () => {
  it('is not born-ready right after pairing', () => {
    const start = 1_000_000;
    expect(isBornReady(start, start)).toBe(false);
    expect(gestationRemaining(start, start)).toBe(GESTATION_MS);
    expect(gestationProgress(start, start)).toBe(0);
  });

  it('becomes born-ready once GESTATION_MS has elapsed', () => {
    const start = 1_000_000;
    expect(isBornReady(start, start + GESTATION_MS)).toBe(true);
    expect(gestationRemaining(start, start + GESTATION_MS)).toBe(0);
    expect(gestationProgress(start, start + GESTATION_MS)).toBe(1);
  });

  it('clamps remaining/progress past the finish line', () => {
    const start = 1_000_000;
    const later = start + GESTATION_MS * 5;
    expect(gestationRemaining(start, later)).toBe(0);
    expect(gestationProgress(start, later)).toBe(1);
    expect(isBornReady(start, later)).toBe(true);
  });

  it('progresses halfway at the midpoint', () => {
    const start = 0;
    expect(gestationProgress(start, GESTATION_MS / 2)).toBeCloseTo(0.5, 5);
  });
});

describe('nextFoalKey (roster growth)', () => {
  it('picks foal1 when no foals exist yet', () => {
    expect(nextFoalKey(['horse', 'horse2', 'horse7'])).toBe('foal1');
  });

  it('skips taken foal keys', () => {
    expect(nextFoalKey(['horse', 'foal1', 'foal2'])).toBe('foal3');
  });

  it('fills a gap in the foal keys', () => {
    // foal1 taken, foal2 free → foal2 (first free index)
    expect(nextFoalKey(['horse', 'foal1', 'foal3'])).toBe('foal2');
  });
});

describe('seedFoalLook (parent-seeded, no genetics roll)', () => {
  const dam = { id: 'horse-1', coat: 'palomino', markings: { dapples: true, star: true, maneColor: 'flaxen' } };
  const sire = { id: 'horse-2', coat: 'bay', markings: { dapples: true } };

  it('seeds the coat from parent A (the dam the player initiated from)', () => {
    expect(seedFoalLook(dam, sire).coat).toBe('palomino');
  });

  it('carries markings BOTH parents share, drops ones only one has', () => {
    const seed = seedFoalLook(dam, sire);
    expect(seed.markings.dapples).toBe(true);   // shared
    expect(seed.markings.star).toBeUndefined(); // only the dam has it
  });

  it('carries the dam mane colour as a starting point', () => {
    expect(seedFoalLook(dam, sire).markings.maneColor).toBe('flaxen');
  });

  it('is deterministic (no Math.random) — same parents → same seed', () => {
    expect(seedFoalLook(dam, sire)).toEqual(seedFoalLook(dam, sire));
  });

  it('produces a valid sex', () => {
    expect(['female', 'male']).toContain(seedFoalLook(dam, sire).sex);
  });

  it('falls back to a default coat when neither parent has one', () => {
    expect(seedFoalLook({}, {}).coat).toBe('bay');
  });
});

describe('makeFoalData (newborn roster entry)', () => {
  const dam = { id: 'horse-1', coat: 'grey', markings: {} };
  const sire = { id: 'horse-2', coat: 'black', markings: {} };

  it('produces a foal flagged as a baby that stays a baby by default', () => {
    const data = makeFoalData(dam, sire, 'foal1');
    expect(data.isFoal).toBe(true);
    expect(data.stayBaby).toBe(true);   // #15: only grows up if the player allows it
    expect(data.age).toBe(FOAL_AGE);
    expect(data.parents).toEqual(['horse-1', 'horse-2']);
  });

  it('starts with full, content stats (a newborn isn\'t instantly hungry)', () => {
    const data = makeFoalData(dam, sire, 'foal1');
    expect(data.stats.hunger).toBeGreaterThanOrEqual(80);
    expect(data.stats.happiness).toBeGreaterThanOrEqual(80);
  });

  it('honours an explicitly-passed seed over re-deriving one', () => {
    const seed = { coat: 'cremello', markings: { pinto: true }, sex: 'male' };
    const data = makeFoalData(dam, sire, 'foal1', seed);
    expect(data.coat).toBe('cremello');
    expect(data.markings.pinto).toBe(true);
    expect(data.sex).toBe('male');
  });

  it('GROWN_AGE is older than a newborn', () => {
    expect(GROWN_AGE).toBeGreaterThan(FOAL_AGE);
  });
});

describe('pair bonds (#114) — permanent, monogamous pairing separate from gestation', () => {
  const horsesByKey = {
    a: { isFoal: false },
    b: { isFoal: false },
    c: { isFoal: false },
    foal: { isFoal: true },
  };

  it('isBonded is false for a horse with no bonds', () => {
    expect(isBonded('a', [])).toBe(false);
  });

  it('isBonded is true for either side of a bond', () => {
    const bonds = [{ aKey: 'a', bKey: 'b' }];
    expect(isBonded('a', bonds)).toBe(true);
    expect(isBonded('b', bonds)).toBe(true);
    expect(isBonded('c', bonds)).toBe(false);
  });

  it('bondMateKey resolves the mate from either side, null if unbonded', () => {
    const bonds = [{ aKey: 'a', bKey: 'b' }];
    expect(bondMateKey('a', bonds)).toBe('b');
    expect(bondMateKey('b', bonds)).toBe('a');
    expect(bondMateKey('c', bonds)).toBeNull();
  });

  it('canBond allows two distinct, unbonded, non-foal horses', () => {
    expect(canBond('a', 'b', [], horsesByKey)).toBe(true);
  });

  it('canBond rejects a horse bonding with itself', () => {
    expect(canBond('a', 'a', [], horsesByKey)).toBe(false);
  });

  it('canBond rejects a horse already bonded to someone else (monogamy)', () => {
    const bonds = [{ aKey: 'a', bKey: 'b' }];
    expect(canBond('a', 'c', bonds, horsesByKey)).toBe(false);
    expect(canBond('c', 'a', bonds, horsesByKey)).toBe(false);
    expect(canBond('c', 'b', bonds, horsesByKey)).toBe(false);
  });

  it('canBond rejects a foal on either side', () => {
    expect(canBond('foal', 'a', [], horsesByKey)).toBe(false);
    expect(canBond('a', 'foal', [], horsesByKey)).toBe(false);
  });

  it('canBond rejects missing horses', () => {
    expect(canBond('a', 'ghost', [], horsesByKey)).toBe(false);
  });

  it('the bond never breaks — the same pair can be checked repeatedly with no re-pair case', () => {
    const bonds = [{ aKey: 'a', bKey: 'b' }];
    // A bonded pair stays bonded; there's no "unbond" helper by design.
    expect(isBonded('a', bonds)).toBe(true);
    expect(canBond('a', 'b', bonds, horsesByKey)).toBe(false); // already bonded to each other
  });
});
