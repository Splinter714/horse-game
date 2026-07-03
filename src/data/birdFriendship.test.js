// Bird befriending (#223) — pure visit-counter + qualifying-visit tests. Mirrors the
// rigor of the fox-taming tests (data/species/fox/index.test.js): the counter ticks up
// per qualifying visit, commits exactly on the Nth visit, freezes once already
// befriended or the roster is full, and the "is this a qualifying visit" gate is
// exercised for each of the three maintained props.

import { describe, it, expect, beforeEach } from 'vitest';
import { visitBird, isQualifyingVisit, BIRD_FRIEND_VISITS, BIRD_FRIEND_CAP } from './birdFriendship.js';

describe('visitBird — the per-type relationship counter', () => {
  it('a first qualifying visit bumps the count and does not befriend yet', () => {
    const step = visitBird(0, {});
    expect(step.count).toBe(1);
    expect(step.befriended).toBe(false);
  });

  it('befriends on exactly the BIRD_FRIEND_VISITS-th visit', () => {
    let count = 0, befriendedAt = null;
    for (let i = 1; i <= BIRD_FRIEND_VISITS; i++) {
      const step = visitBird(count, {});
      count = step.count;
      if (step.befriended && befriendedAt == null) befriendedAt = i;
    }
    expect(befriendedAt).toBe(BIRD_FRIEND_VISITS); // not before, exactly on the Nth
    expect(count).toBe(BIRD_FRIEND_VISITS);
  });

  it('does not befriend before the threshold', () => {
    let count = 0;
    for (let i = 1; i < BIRD_FRIEND_VISITS; i++) {
      const step = visitBird(count, {});
      count = step.count;
      expect(step.befriended).toBe(false);
    }
  });

  it('an already-befriended type freezes the counter (no re-befriending)', () => {
    const step = visitBird(BIRD_FRIEND_VISITS, { alreadyBefriended: true });
    expect(step.count).toBe(BIRD_FRIEND_VISITS);
    expect(step.befriended).toBe(false);
  });

  it('a full roster freezes the counter (no overflow past the cap)', () => {
    const step = visitBird(BIRD_FRIEND_VISITS - 1, { rosterFull: true });
    expect(step.count).toBe(BIRD_FRIEND_VISITS - 1);
    expect(step.befriended).toBe(false);
  });

  it('respects a custom needVisits (befriends on the Nth of that count)', () => {
    expect(visitBird(0, {}, 2).befriended).toBe(false);
    expect(visitBird(1, {}, 2).befriended).toBe(true);
  });

  it('the cap is a small handful of regulars', () => {
    expect(BIRD_FRIEND_CAP).toBe(3);
    expect(BIRD_FRIEND_VISITS).toBeGreaterThan(1); // gradual, not instant like the bunny
  });
});

describe('isQualifyingVisit — which maintained prop counts', () => {
  it('the birdhouse always qualifies (fixed scenery, always active)', () => {
    expect(isQualifyingVisit('birdhouse')).toBe(true);
  });

  it('the bird bath always qualifies (no fill/drain, always active)', () => {
    expect(isQualifyingVisit('bath')).toBe(true);
  });

  it('the seed feeder only qualifies while stocked', () => {
    expect(isQualifyingVisit('feeder', { feederFilled: true })).toBe(true);
    expect(isQualifyingVisit('feeder', { feederFilled: false })).toBe(false);
  });

  it('an unknown spot never qualifies', () => {
    expect(isQualifyingVisit('nectarFeeder')).toBe(false);
  });
});

describe('bird-friendship persistence — visit tallies + named roster survive a reload', () => {
  let loadBirdFriendship, saveBirdFriendship;

  beforeEach(async () => {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    };
    ({ loadBirdFriendship, saveBirdFriendship } = await import('./save.js'));
  });

  it('starts empty on a fresh save', () => {
    const state = loadBirdFriendship();
    expect(state.counts).toEqual({});
    expect(state.roster).toEqual([]);
  });

  it('round-trips a running tally and a named regular', () => {
    saveBirdFriendship({ counts: { sparrow: 3, robin: 1 }, roster: [{ typeId: 'cardinal', name: 'Ruby' }] });
    const reloaded = loadBirdFriendship();
    expect(reloaded.counts).toEqual({ sparrow: 3, robin: 1 });
    expect(reloaded.roster).toEqual([{ typeId: 'cardinal', name: 'Ruby' }]);
  });

  it('is forgiving of corrupt/missing data', () => {
    localStorage.setItem('horse-game-bird-friendship-v1', '{not json');
    const state = loadBirdFriendship();
    expect(state.counts).toEqual({});
    expect(state.roster).toEqual([]);
  });
});
