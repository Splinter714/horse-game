import { describe, it, expect } from 'vitest';
import { WithDevTooltips, USAGE_TIPS } from './devTooltips.js';
import { WithDevLabels } from './devLabels.js';

// The parts worth testing without Phaser: the name→prose LOOKUP (list members
// arrive as `key[i]` and must fall back to the bare list key), and the FENCE
// pseudo-target (fences are collision rects, not props, so they never come
// through `_devLabelTargets()` and are found separately).
//
// `_devLabelTargets` comes from the #329 mixin on purpose — like the drag tool,
// this one must keep enumerating the world through that single shared function.

const Scene = WithDevTooltips(WithDevLabels(class {}));

describe('dev usage tooltips: prose lookup (#332)', () => {
  it('finds an exact prop-name entry', () => {
    const s = new Scene();
    expect(s._devTipFor('slopMaker')).toContain('slop');
    expect(s._devTipFor('spinningWheel')).toContain('yarn');
  });

  it('falls back to the bare list key for indexed members', () => {
    const s = new Scene();
    expect(s._devTipFor('nests[0]')).toBe(USAGE_TIPS.nests);
    expect(s._devTipFor('flowers[12]')).toBe(USAGE_TIPS.flowers);
  });

  it('matches a gather source by its display label', () => {
    const s = new Scene();
    expect(s._devTipFor('Hay Pile')).toContain('BASKET');
    expect(s._devTipFor('Well')).toContain('BUCKET');
  });

  it('returns null for anything without a written line (no filler)', () => {
    const s = new Scene();
    expect(s._devTipFor('somethingNew')).toBeNull();
    expect(s._devTipFor('somethingNew[3]')).toBeNull();
    expect(s._devTipFor(null)).toBeNull();
  });
});

describe('dev usage tooltips: fence pseudo-target (#317/#332)', () => {
  it('returns the nearest point ON a tie-able rail when close enough', () => {
    const s = new Scene();
    s.obstacles = [
      { x: 300, y: 300, w: 576, h: 40, isFence: true },
      { x: 0, y: 0, w: 100, h: 100 }, // not a fence — ignored
    ];
    const t = s._devTipFenceTarget(500, 350);
    expect(t).toEqual({ name: 'fence', x: 500, y: 340 });
  });

  it('is null when no rail is within range', () => {
    const s = new Scene();
    s.obstacles = [{ x: 300, y: 300, w: 576, h: 40, isFence: true }];
    expect(s._devTipFenceTarget(500, 900)).toBeNull();
  });

  it('is null when there are no obstacles at all', () => {
    const s = new Scene();
    expect(s._devTipFenceTarget(0, 0)).toBeNull();
  });
});
