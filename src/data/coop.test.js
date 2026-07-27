import { describe, it, expect } from 'vitest';
import {
  COOP_TETHER, coopMoveVector, coopFacing, tetherPull, coopCameraFocus, nearestWithin,
} from './coop.js';

describe('coopMoveVector', () => {
  it('is still when nothing is pressed', () => {
    expect(coopMoveVector()).toEqual({ vx: 0, vy: 0 });
  });

  it('maps arrow keys to unit axes', () => {
    expect(coopMoveVector({ left: true })).toEqual({ vx: -1, vy: 0 });
    expect(coopMoveVector({ right: true })).toEqual({ vx: 1, vy: 0 });
    expect(coopMoveVector({ up: true })).toEqual({ vx: 0, vy: -1 });
    expect(coopMoveVector({ down: true })).toEqual({ vx: 0, vy: 1 });
  });

  it('cancels opposite keys', () => {
    expect(coopMoveVector({ left: true, right: true })).toEqual({ vx: 0, vy: 0 });
  });

  it('scales diagonals so they are not faster than straight lines', () => {
    const { vx, vy } = coopMoveVector({ right: true, down: true });
    expect(Math.hypot(vx, vy)).toBeCloseTo(1, 2);
  });

  it('ignores stick noise inside the deadzone', () => {
    expect(coopMoveVector({ stickX: 0.1, stickY: -0.1 })).toEqual({ vx: 0, vy: 0 });
  });

  it('reads the stick past the deadzone and clamps to 1', () => {
    expect(coopMoveVector({ stickX: 0.8 }).vx).toBeCloseTo(0.8, 5);
    expect(coopMoveVector({ stickX: 1, right: true }).vx).toBe(1);
  });
});

describe('coopFacing', () => {
  it('is null while standing still', () => {
    expect(coopFacing(0, 0)).toBe(null);
  });
  it('picks the dominant axis', () => {
    expect(coopFacing(-1, 0.2)).toBe('left');
    expect(coopFacing(1, -0.2)).toBe('right');
    expect(coopFacing(0.2, -1)).toBe('up');
    expect(coopFacing(-0.2, 1)).toBe('down');
  });
  it('breaks ties horizontally (same as player 1)', () => {
    expect(coopFacing(1, 1)).toBe('right');
  });
});

describe('tetherPull', () => {
  it('leaves player 2 alone inside the leash', () => {
    const r = tetherPull(100, 100, 0, 0, 300);
    expect(r).toEqual({ x: 100, y: 100, pulled: false });
  });

  it('pulls player 2 back onto the leash circle when player 1 walks off', () => {
    const r = tetherPull(1000, 0, 0, 0, 300);
    expect(r.pulled).toBe(true);
    expect(r.x).toBeCloseTo(300, 5);
    expect(r.y).toBeCloseTo(0, 5);
  });

  it('keeps the direction of the gap when pulling', () => {
    const r = tetherPull(300, 400, 0, 0, 100); // gap 500 → scale 1/5
    expect(r.x).toBeCloseTo(60, 5);
    expect(r.y).toBeCloseTo(80, 5);
    expect(Math.hypot(r.x, r.y)).toBeCloseTo(100, 5);
  });

  it('never divides by zero when the bodies overlap', () => {
    expect(tetherPull(50, 50, 50, 50, 300)).toEqual({ x: 50, y: 50, pulled: false });
  });

  it('defaults to the shared COOP_TETHER distance', () => {
    expect(tetherPull(10000, 0, 0, 0).x).toBeCloseTo(COOP_TETHER, 5);
  });
});

describe('coopCameraFocus', () => {
  it('follows player 1 exactly when solo', () => {
    expect(coopCameraFocus({ x: 40, y: 90 }, null)).toEqual({ x: 40, y: 90 });
  });
  it('follows the midpoint in co-op so both players stay framed', () => {
    expect(coopCameraFocus({ x: 0, y: 0 }, { x: 100, y: 50 })).toEqual({ x: 50, y: 25 });
  });
});

describe('nearestWithin', () => {
  const items = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 100, y: 0 }, { id: 'c', x: 30, y: 40 }];

  it('finds the nearest item in range', () => {
    expect(nearestWithin(items, 0, 0, 200).id).toBe('a');
    expect(nearestWithin(items, 90, 0, 200).id).toBe('b');
  });
  it('returns null when nothing is in range', () => {
    expect(nearestWithin(items, 0, 0, -1)).toBe(null);
    expect(nearestWithin([], 0, 0, 100)).toBe(null);
  });
  it('measures distance, not axis offsets', () => {
    expect(nearestWithin([{ id: 'c', x: 30, y: 40 }], 0, 0, 49)).toBe(null);
    expect(nearestWithin([{ id: 'c', x: 30, y: 40 }], 0, 0, 51).id).toBe('c');
  });
});
