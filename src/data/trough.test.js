// Trough drinking-spot geometry + claim logic (#336).

import { describe, it, expect } from 'vitest';
import {
  TROUGH_SPOT_OFFSETS, TROUGH_SPOT_SPACING, troughDrinkSpots, pickTroughSpot,
} from './trough.js';

const TROUGH = { x: 1000, y: 1000 };
const spots = () => troughDrinkSpots(TROUGH);

// Stand-in for the scene's obstacle check: the rotated trough's own footprint is
// a tall, narrow box, so a straight line between a west spot and an east one
// crosses it — exactly what must stop a horse drinking "through" the trough.
const crossesTrough = (from, s) => (from.x - TROUGH.x) * (s.x - TROUGH.x) < 0
  && Math.abs(from.y - TROUGH.y) < 120 && Math.abs(s.y - TROUGH.y) < 120;

describe('troughDrinkSpots', () => {
  it('gives several spots along BOTH long sides (so more than one can drink)', () => {
    const all = spots();
    expect(all.length).toBe(TROUGH_SPOT_OFFSETS.length);
    expect(all.filter(s => s.side === 'west').length).toBeGreaterThanOrEqual(2);
    expect(all.filter(s => s.side === 'east').length).toBeGreaterThanOrEqual(2);
  });

  it('places west spots west of the trough and east spots east of it', () => {
    for (const s of spots()) {
      if (s.side === 'west') expect(s.x).toBeLessThan(TROUGH.x);
      else expect(s.x).toBeGreaterThan(TROUGH.x);
    }
  });

  it('spreads the spots on a side far enough apart to not stack', () => {
    const west = spots().filter(s => s.side === 'west');
    for (let i = 1; i < west.length; i++) {
      expect(Math.abs(west[i].y - west[i - 1].y)).toBeGreaterThanOrEqual(TROUGH_SPOT_SPACING);
    }
  });

  it('returns nothing when there is no trough', () => {
    expect(troughDrinkSpots(null)).toEqual([]);
  });
});

describe('pickTroughSpot', () => {
  it('takes the nearest spot when everything is free', () => {
    const from = { x: 800, y: 1000 }; // due west
    const got = pickTroughSpot(spots(), from);
    expect(got.side).toBe('west');
    expect(got.y).toBe(TROUGH.y);
  });

  it('lets a second drinker take another spot on the same side', () => {
    const from = { x: 800, y: 1000 };
    const first = pickTroughSpot(spots(), from);
    const second = pickTroughSpot(spots(), from, [first]);
    expect(second).not.toBeNull();
    expect(second.i).not.toBe(first.i);
    expect(Math.hypot(second.x - first.x, second.y - first.y)).toBeGreaterThanOrEqual(TROUGH_SPOT_SPACING);
  });

  it('fills every spot before giving up, then returns null', () => {
    const from = { x: 800, y: 1000 };
    const taken = [];
    for (let i = 0; i < TROUGH_SPOT_OFFSETS.length; i++) {
      const s = pickTroughSpot(spots(), from, taken);
      expect(s, `spot ${i} should still be available`).not.toBeNull();
      taken.push(s);
    }
    expect(pickTroughSpot(spots(), from, taken)).toBeNull();
  });

  it('never sends a west-side drinker straight across to an east spot', () => {
    const from = { x: 800, y: 1000 };
    // West side full: the only free spots are east, and the straight line to them
    // crosses the trough — so it may only be taken via a real path around.
    const taken = spots().filter(s => s.side === 'west');
    const walkAround = pickTroughSpot(spots(), from, taken, {
      clearLine: (s) => !crossesTrough(from, s),
    });
    expect(walkAround.side).toBe('east'); // reachable by walking round the end

    const penned = pickTroughSpot(spots(), from, taken, {
      clearLine: (s) => !crossesTrough(from, s),
      canPath: () => false, // fenced in on the west side — no route round
    });
    expect(penned).toBeNull();
  });

  it('prefers a straight-line spot over a nearer one it would have to path to', () => {
    const from = { x: 1005, y: 1200 }; // just south-east of the trough
    const got = pickTroughSpot(spots(), from, [], {
      clearLine: (s) => !crossesTrough(from, s),
    });
    expect(got.side).toBe('east');
  });

  it('only probes a couple of walk-around candidates (A* is expensive)', () => {
    const from = { x: 800, y: 1000 };
    let probes = 0;
    pickTroughSpot(spots(), from, [], {
      clearLine: () => false, // nothing is a straight shot
      canPath: () => { probes++; return false; },
    });
    expect(probes).toBeLessThanOrEqual(2);
  });

  it('skips spots it cannot stand on (blocked by another obstacle)', () => {
    const from = { x: 800, y: 1000 };
    const got = pickTroughSpot(spots(), from, [], {
      canStand: (s) => s.side !== 'west', // whole west side blocked off
    });
    expect(got.side).toBe('east');
  });
});
