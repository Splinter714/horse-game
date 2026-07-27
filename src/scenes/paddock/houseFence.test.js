import { describe, it, expect } from 'vitest';
import { houseFenceRect } from './houseFence.js';

// #344: the house fence's collision rect was a hardcoded (300,300)-(876,340) box that
// never moved when the posts were dragged elsewhere, so you bumped into an invisible
// fence at the old spot. It's now derived from the live post records.

const run = (x0, y, n = 6, gap = 96) =>
  Array.from({ length: n }, (_, i) => ({ x: x0 + i * gap, y }));

describe('house fence collision span (#344)', () => {
  it('reproduces the original hardcoded rect for the original post positions', () => {
    // 6 posts at x = 300…780 step 96, y = 320 — what the old literal was typed for.
    expect(houseFenceRect(run(300, 320), 96, 40)).toEqual({ x: 300, y: 300, w: 576, h: 40 });
  });

  it('follows the run wherever it has been dragged to', () => {
    // The owner's #337 group-drag, baked in by #343: anchor moved to (-136, 57).
    expect(houseFenceRect(run(-136, 57), 96, 40)).toEqual({ x: -136, y: 37, w: 576, h: 40 });
  });

  it('covers a single post nudged out of line instead of leaving a gap', () => {
    const posts = run(300, 320);
    posts[2] = { x: 900, y: 400 }; // dragged right and down on its own
    const r = houseFenceRect(posts, 96, 40);
    expect(r.x).toBe(300);
    expect(r.x + r.w).toBe(996);  // rightmost post's x + one segment
    expect(r.y).toBe(300);        // topmost post's band edge
    expect(r.y + r.h).toBe(420);  // lowest post's band edge
  });

  it('spans one segment for a single post', () => {
    expect(houseFenceRect([{ x: 10, y: 50 }], 96, 40)).toEqual({ x: 10, y: 30, w: 96, h: 40 });
  });

  it('returns null when there are no posts', () => {
    expect(houseFenceRect([], 96, 40)).toBeNull();
    expect(houseFenceRect(undefined, 96, 40)).toBeNull();
  });
});
