// Duck taming counter + persistence tests (#275). A wild duck is befriended by REPEATED
// feeding: each duck-food pile it eats ticks the pure `feedWildDuck` counter, and once it
// hits DUCK_TAME_FEEDS the duck commits to the roster (paddock/duck.js). The pure counter
// is unit-tested here, plus the roster round-trip that lets a runtime-tamed duck survive a
// reload (makeRoster must restore saved keys that aren't fresh-game defaults, since the
// duck roster starts empty like the fox's). Mirrors fox/index.test.js exactly.

import { describe, it, expect, beforeEach } from 'vitest';
import { feedWildDuck, DUCK_TAME_FEEDS, DUCK_CAP, DUCK_KEY } from './index.js';

describe('feedWildDuck — the taming counter', () => {
  it('a first feed bumps the count and does not tame yet (needs DUCK_TAME_FEEDS)', () => {
    const step = feedWildDuck(0);
    expect(step.count).toBe(1);
    expect(step.tamed).toBe(false);
  });

  it('tames on exactly the DUCK_TAME_FEEDS-th feed', () => {
    let count = 0, tamedAt = null;
    for (let i = 1; i <= DUCK_TAME_FEEDS; i++) {
      const step = feedWildDuck(count);
      count = step.count;
      if (step.tamed && tamedAt == null) tamedAt = i;
    }
    expect(tamedAt).toBe(DUCK_TAME_FEEDS); // not before, exactly on the Nth feed
    expect(count).toBe(DUCK_TAME_FEEDS);
  });

  it('does not tame before the threshold', () => {
    let count = 0;
    for (let i = 1; i < DUCK_TAME_FEEDS; i++) {
      const step = feedWildDuck(count);
      count = step.count;
      expect(step.tamed).toBe(false);
    }
  });

  it('a full roster freezes the counter and never re-tames (no duplicate join)', () => {
    const step = feedWildDuck(DUCK_TAME_FEEDS, true);
    expect(step.count).toBe(DUCK_TAME_FEEDS);
    expect(step.tamed).toBe(false);
  });

  it('respects a custom needFeeds (taming happens on the Nth of that count)', () => {
    expect(feedWildDuck(0, false, 2).tamed).toBe(false);
    expect(feedWildDuck(1, false, 2).tamed).toBe(true);
  });

  it('the cap is one duck, keyed to the pre-built texture slot', () => {
    expect(DUCK_CAP).toBe(1);
    expect(DUCK_KEY).toBe('duck0');
  });
});

describe('duck roster persistence — a runtime-tamed duck survives a reload', () => {
  let makeRoster, Duck, ROSTERS;
  beforeEach(async () => {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    };
    ({ makeRoster } = await import('../../save.js'));
    ({ Duck } = await import('./model.js'));
    ({ ROSTERS } = await import('../../rosters.js'));
  });

  it('the fresh duck roster is empty (no default ducks)', () => {
    const ducks = makeRoster(ROSTERS.duck);
    expect(Object.keys(ducks.load())).toEqual([]);
  });

  it('a duck tamed at runtime is restored on the next load (saved-only key)', () => {
    const ducks = makeRoster(ROSTERS.duck);
    const all = ducks.load(); // {} — empty default
    all[DUCK_KEY] = new Duck({ name: 'Puddle' }); // committed in play
    ducks.save(all);

    // Reload from storage: the saved-only key (no default under it) must come back.
    const reloaded = ducks.load();
    expect(Object.keys(reloaded)).toEqual([DUCK_KEY]);
    expect(reloaded[DUCK_KEY]).toBeInstanceOf(Duck);
    expect(reloaded[DUCK_KEY].name).toBe('Puddle');
    expect(reloaded[DUCK_KEY].species).toBe('duck');
  });
});
