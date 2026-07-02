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
  loadBarnState,
  saveBarnState,
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
