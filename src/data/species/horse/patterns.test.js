import { describe, it, expect } from 'vitest';
import {
  PATTERN_VARIANT_COUNT, dappleCircles, roanFlecks, pintoSpec, appaloosaSpec,
} from './patterns.js';

// Numbered pattern variants (#139): variant 1 must equal the original look (so old
// saves render unchanged), higher variants vary density, and everything is
// deterministic (seeded) so a re-skin never reshuffles the pattern.

describe('pattern variants (#139)', () => {
  it('declares a variant count for every pattern', () => {
    expect(Object.keys(PATTERN_VARIANT_COUNT).sort()).toEqual(['appaloosa', 'dapples', 'pinto', 'roan']);
  });

  it('variant 1 is the original look', () => {
    expect(dappleCircles(1)).toHaveLength(4);
    expect(roanFlecks(1)).toHaveLength(18);
    expect(pintoSpec(1).patches).toHaveLength(4);
    expect(appaloosaSpec(1).spots).toHaveLength(9);
  });

  it('higher variants change density', () => {
    expect(dappleCircles(5).length).toBeGreaterThan(dappleCircles(1).length);
    expect(roanFlecks(5).length).toBeGreaterThan(roanFlecks(2).length);
    expect(appaloosaSpec(3).spots.length).toBeGreaterThan(appaloosaSpec(4).spots.length);
  });

  it('is deterministic (same variant → identical geometry)', () => {
    expect(dappleCircles(3)).toEqual(dappleCircles(3));
    expect(roanFlecks(4)).toEqual(roanFlecks(4));
    expect(appaloosaSpec(2).spots).toEqual(appaloosaSpec(2).spots);
  });

  it('an out-of-range variant falls back to the original', () => {
    expect(pintoSpec(99)).toEqual(pintoSpec(1));
    expect(appaloosaSpec(0)).toEqual(appaloosaSpec(1));
  });
});
