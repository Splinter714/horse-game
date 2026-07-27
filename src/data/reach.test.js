import { describe, it, expect } from 'vitest';
import { reachedGoal, ARRIVE_TOL } from './reach.js';

// #346: a horse was drinking from the trough while standing inside the barn. The
// barn's wall rects DO enclose it and the pathfinder DOES refuse to route through
// them — the leak was that the arrival callback fired anyway when there was no
// route, so the drink landed from wherever the horse stood. reachedGoal is the
// predicate that now gates every eat/drink effect on actually being there.
//
// The numbers below are the live world geometry (paddock/barn.js + world.js at
// S=2): barn anchored at (1573,1151) → walls x 1429..1717, y 991..1147, doorway
// gap x 1529..1617; trough at (1130,992) with drink ends at x 1024 / 1236.
const BARN = { x0: 1429, x1: 1717, y0: 991, y1: 1147 };
const TROUGH_EAST_END = { x: 1236, y: 992 };

describe('reachedGoal — an animal only acts on a goal it actually reached (#346)', () => {
  it('counts standing on the goal as reached', () => {
    expect(reachedGoal(1236, 992, 1236, 992)).toBe(true);
  });

  it('tolerates the pathfinder stopping a cell or two short', () => {
    // Grid CELL is 24px; a blocked goal snaps to the nearest free cell.
    expect(reachedGoal(1236 + 24, 992 - 24, 1236, 992)).toBe(true);
    expect(reachedGoal(1236 + 48, 992, 1236, 992)).toBe(true);
  });

  it('rejects a horse standing inside the barn — the actual #346 bug', () => {
    // Every stall stand-spot (dy(74) = 1035, dx(55..145)) is well outside tolerance
    // of the trough's east drink end, so none of them can ever drink through the wall.
    for (const stallX of [1523, 1583, 1643, 1703]) {
      expect(reachedGoal(stallX, 1035, TROUGH_EAST_END.x, TROUGH_EAST_END.y)).toBe(false);
    }
    // …and so is the barn interior generally, at every corner of the walled box.
    for (const x of [BARN.x0, BARN.x1]) {
      for (const y of [BARN.y0, BARN.y1]) {
        expect(reachedGoal(x, y, TROUGH_EAST_END.x, TROUGH_EAST_END.y)).toBe(false);
      }
    }
  });

  it('rejects a horse parked at the pasture gate instead of the trough', () => {
    // A trip abandoned at a shut gate (GATE_X 960, fence line y 910) settles there;
    // it must not count as having arrived at the trough.
    expect(reachedGoal(960, 940, TROUGH_EAST_END.x, TROUGH_EAST_END.y)).toBe(false);
  });

  it('is symmetric about the tolerance boundary', () => {
    expect(reachedGoal(0, 0, ARRIVE_TOL, 0)).toBe(true);
    expect(reachedGoal(0, 0, ARRIVE_TOL + 1, 0)).toBe(false);
  });

  it('tolerance stays far below any through-a-wall distance', () => {
    // The closest point of the barn to the trough's east drink end.
    const gap = Math.hypot(BARN.x0 - TROUGH_EAST_END.x, 0);
    expect(gap).toBeGreaterThan(ARRIVE_TOL * 2);
  });
});
