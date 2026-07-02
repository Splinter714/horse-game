// Crop table + growth-stage helpers (#242).

import { describe, it, expect } from 'vitest';
import {
  CROPS, CROP_ORDER, GROWTH_STAGES, getCrop, nextCrop,
  growStage, isRipe, stageTexture,
} from './crops.js';

describe('crop table', () => {
  it('has the starter set spanning fruit / grain / veg', () => {
    expect(Object.keys(CROPS).sort()).toEqual(['carrot', 'strawberry', 'wheat']);
  });

  it('every crop declares a harvest content, a positive yield, and a seed icon', () => {
    for (const c of Object.values(CROPS)) {
      expect(typeof c.harvest).toBe('string');
      expect(c.yield).toBeGreaterThan(0);
      expect(typeof c.seedIcon).toBe('string');
    }
  });

  it('getCrop resolves a known crop and returns null for an unknown one', () => {
    expect(getCrop('carrot').label).toBe('Carrot');
    expect(getCrop('nope')).toBeNull();
  });
});

describe('growth stages', () => {
  it('a crop ripens after GROWTH_STAGES-1 advances (day/night cycles)', () => {
    let stage = 0;
    expect(isRipe(stage)).toBe(false);
    for (let i = 0; i < GROWTH_STAGES - 1; i++) stage = growStage(stage);
    expect(isRipe(stage)).toBe(true);
  });

  it('growStage clamps at the ripe (final) stage — never overshoots', () => {
    const ripe = GROWTH_STAGES - 1;
    expect(growStage(ripe)).toBe(ripe);
    expect(growStage(ripe + 5)).toBe(ripe);
  });

  it('growStage treats a missing stage as 0', () => {
    expect(growStage(undefined)).toBe(1);
  });

  it('stageTexture names crop_<id>_<stage>, clamped into range', () => {
    expect(stageTexture('wheat', 0)).toBe('crop_wheat_0');
    expect(stageTexture('wheat', GROWTH_STAGES - 1)).toBe(`crop_wheat_${GROWTH_STAGES - 1}`);
    expect(stageTexture('wheat', 99)).toBe(`crop_wheat_${GROWTH_STAGES - 1}`);
    expect(stageTexture('wheat', -3)).toBe('crop_wheat_0');
  });
});

describe('planting rotation', () => {
  it('cycles through CROP_ORDER and wraps', () => {
    let id = CROP_ORDER[0];
    const seen = [id];
    for (let i = 0; i < CROP_ORDER.length; i++) { id = nextCrop(id); seen.push(id); }
    // after a full lap we're back at the start
    expect(seen[seen.length - 1]).toBe(CROP_ORDER[0]);
    // every crop appears in the rotation
    expect(new Set(seen)).toEqual(new Set(CROP_ORDER));
  });

  it('nextCrop(null/unknown) starts at the first crop', () => {
    expect(nextCrop(null)).toBe(CROP_ORDER[0]);
    expect(nextCrop('nope')).toBe(CROP_ORDER[0]);
  });
});
