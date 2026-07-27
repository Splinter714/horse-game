// Barn stall-assignment logic + persistence tests (#35). Pure functions plus a
// localStorage round-trip (stubbed the same way as save.test.js — barn.js reads
// localStorage lazily inside the load/save functions).

import { describe, it, expect, beforeEach } from 'vitest';
import {
  NUM_STALLS,
  stallOfHorse,
  assignStall,
  unassignStall,
  nextStallOccupant,
  isInsideBarn,
  BARN_DOOR_APRON,
  loadBarnState,
  saveBarnState,
  isBehindWall,
  wallTargetAlpha,
  WALL_SEE_THROUGH_ALPHA,
} from './barn.js';

function makeLocalStorageStub() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

const HORSES = ['horse', 'horse2', 'horse3'];

describe('stall assignment (pure)', () => {
  it('assigns a horse to a stall without mutating the input', () => {
    const a0 = {};
    const a1 = assignStall(a0, 0, 'horse');
    expect(a0).toEqual({});           // input untouched
    expect(a1).toEqual({ 0: 'horse' });
  });

  it('a horse lives in only one stall — re-assigning clears the old one', () => {
    let a = assignStall({}, 0, 'horse');
    a = assignStall(a, 2, 'horse');   // move Buttercup from stall 0 → 2
    expect(a).toEqual({ 2: 'horse' });
    expect(stallOfHorse(a, 'horse')).toBe(2);
  });

  it('two horses can share the barn in different stalls', () => {
    let a = assignStall({}, 0, 'horse');
    a = assignStall(a, 1, 'horse2');
    expect(a).toEqual({ 0: 'horse', 1: 'horse2' });
  });

  it('assigning a stall that already holds another horse replaces the occupant', () => {
    let a = assignStall({}, 0, 'horse');
    a = assignStall(a, 0, 'horse2');
    expect(a).toEqual({ 0: 'horse2' });
    expect(stallOfHorse(a, 'horse')).toBeNull();
  });

  it('unassign empties a stall', () => {
    let a = assignStall({}, 3, 'horse');
    a = unassignStall(a, 3);
    expect(a).toEqual({});
    expect(stallOfHorse(a, 'horse')).toBeNull();
  });

  it('stallOfHorse returns null for an unstalled horse', () => {
    expect(stallOfHorse({ 0: 'horse' }, 'horse2')).toBeNull();
  });
});

describe('nextStallOccupant (in-world cycle)', () => {
  it('cycles empty → first free horse → next → … → back to empty', () => {
    const a = {};
    expect(nextStallOccupant(a, 0, HORSES)).toBe('horse');
    const a1 = assignStall(a, 0, 'horse');
    expect(nextStallOccupant(a1, 0, HORSES)).toBe('horse2');
    const a2 = assignStall(a1, 0, 'horse3');
    expect(nextStallOccupant(a2, 0, HORSES)).toBeNull(); // wraps back to empty
  });

  it('does not offer a horse that already occupies a DIFFERENT stall', () => {
    // horse2 is parked in stall 1; cycling stall 0 skips it.
    const a = assignStall({}, 1, 'horse2');
    expect(nextStallOccupant(a, 0, HORSES)).toBe('horse'); // horse, not horse2
    const a1 = assignStall(a, 0, 'horse');
    expect(nextStallOccupant(a1, 0, HORSES)).toBe('horse3'); // skips the taken horse2
  });
});

describe('persistence round-trip', () => {
  beforeEach(() => {
    globalThis.localStorage = makeLocalStorageStub();
  });

  it('defaults to empty stalls when nothing is saved', () => {
    expect(loadBarnState()).toEqual({ stalls: {} });
  });

  it('saves and reloads stall assignments', () => {
    saveBarnState({ stalls: { 0: 'horse', 2: 'horse3' } });
    expect(loadBarnState()).toEqual({ stalls: { 0: 'horse', 2: 'horse3' } });
  });

  it('survives malformed saved data', () => {
    globalThis.localStorage.setItem('horse-game-barn-v1', '{not json');
    expect(loadBarnState()).toEqual({ stalls: {} });
  });

  it('exposes a sane stall count', () => {
    expect(NUM_STALLS).toBeGreaterThanOrEqual(2);
  });
});

// ── Cutaway trigger (#35) ────────────────────────────────────────────────────
// The façade may only fade once the player is genuinely inside the barn or in its
// doorway. Playtest 2026-07-06 (re-raised 2026-07-26): the old inline check padded
// the interior rect on all four sides, so walking past the barn outside cut the
// front wall away. These lock the boundary in.
describe('#35 barn cutaway inside-check', () => {
  // Mirrors the real geometry from scenes/paddock/barn.js at the baked anchor.
  const interior = { x0: 1441, y0: 1007, x1: 1705, y1: 1139 };
  const doorway = { x0: 1529, x1: 1617 };
  const inside = (x, y) => isInsideBarn(interior, doorway, x, y);

  it('fades when the player is standing in the middle of the barn', () => {
    expect(inside(1573, 1070)).toBe(true);
  });

  it('fades while walking in through the doorway, just south of the room', () => {
    expect(inside(1573, 1145)).toBe(true);
    expect(inside(1573, interior.y1 + BARN_DOOR_APRON - 1)).toBe(true);
  });

  it('does NOT fade standing outside along the front wall, off the doorway', () => {
    expect(inside(1460, 1145)).toBe(false); // in front of the left half
    expect(inside(1690, 1145)).toBe(false); // in front of the right half
  });

  it('does NOT fade standing outside past either side wall', () => {
    expect(inside(1430, 1070)).toBe(false); // west of the barn
    expect(inside(1715, 1070)).toBe(false); // east of the barn
  });

  it('does NOT fade standing behind (north of) the barn', () => {
    expect(inside(1573, 1000)).toBe(false);
  });

  it('does NOT fade once the player has walked well clear of the doorway', () => {
    expect(inside(1573, interior.y1 + BARN_DOOR_APRON + 1)).toBe(false);
    expect(inside(1573, 1300)).toBe(false);
  });

  it('is safe before the barn is built', () => {
    expect(isInsideBarn(null, null, 0, 0)).toBe(false);
    expect(isInsideBarn(interior, null, 1573, 1145)).toBe(false);
  });
});

describe('#362 generic behind-wall check (reusable by any walled building)', () => {
  // A wall's face: its world-x span and the world-y line of its south (interior-
  // facing) side — mirrors the barn's own back wall at the baked anchor.
  const wall = { x0: 1441, x1: 1705, y: 962 };

  it('is behind the wall when north of its face, within its x-span', () => {
    expect(isBehindWall(wall, 1573, 900)).toBe(true);
  });

  it('is NOT behind the wall when south of its face (in front of/inside)', () => {
    expect(isBehindWall(wall, 1573, 1000)).toBe(false);
  });

  it('is NOT behind the wall when north of it but outside its x-span', () => {
    expect(isBehindWall(wall, 1400, 900)).toBe(false);
    expect(isBehindWall(wall, 1750, 900)).toBe(false);
  });

  it('is safe with no wall', () => {
    expect(isBehindWall(null, 0, 0)).toBe(false);
  });

  it('target alpha: a light see-through dip when behind, fully opaque otherwise', () => {
    expect(wallTargetAlpha(true)).toBe(WALL_SEE_THROUGH_ALPHA);
    expect(wallTargetAlpha(false)).toBe(1);
    expect(wallTargetAlpha(true)).toBeGreaterThan(0.12); // distinct from the deeper cutaway fade
  });
});
