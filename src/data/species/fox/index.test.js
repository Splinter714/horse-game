// Fox taming counter + persistence tests (#266). A wild fox is befriended by REPEATED
// feeding: each fox-food pile it eats ticks the pure `feedWildFox` counter, and once it
// hits FOX_TAME_FEEDS the fox commits to the roster (paddock/fox.js). The pure counter is
// unit-tested here, plus the roster round-trip that lets a runtime-tamed fox survive a
// reload (makeRoster must restore saved keys that aren't fresh-game defaults, since the
// fox roster starts empty like the bunny's).

import { describe, it, expect, beforeEach } from 'vitest';
import { feedWildFox, FOX_TAME_FEEDS, FOX_CAP, FOX_KEY } from './index.js';

describe('feedWildFox — the taming counter', () => {
  it('a first feed bumps the count and does not tame yet (needs FOX_TAME_FEEDS)', () => {
    const step = feedWildFox(0);
    expect(step.count).toBe(1);
    expect(step.tamed).toBe(false);
  });

  it('tames on exactly the FOX_TAME_FEEDS-th feed', () => {
    let count = 0, tamedAt = null;
    for (let i = 1; i <= FOX_TAME_FEEDS; i++) {
      const step = feedWildFox(count);
      count = step.count;
      if (step.tamed && tamedAt == null) tamedAt = i;
    }
    expect(tamedAt).toBe(FOX_TAME_FEEDS); // not before, exactly on the Nth feed
    expect(count).toBe(FOX_TAME_FEEDS);
  });

  it('does not tame before the threshold', () => {
    // Feeding up to one short of the threshold never reports tamed.
    let count = 0;
    for (let i = 1; i < FOX_TAME_FEEDS; i++) {
      const step = feedWildFox(count);
      count = step.count;
      expect(step.tamed).toBe(false);
    }
  });

  it('a full roster freezes the counter and never re-tames (no duplicate join)', () => {
    // rosterFull short-circuits: an already-tamed fox just gets fed, count unchanged.
    const step = feedWildFox(FOX_TAME_FEEDS, true);
    expect(step.count).toBe(FOX_TAME_FEEDS);
    expect(step.tamed).toBe(false);
  });

  it('respects a custom needFeeds (taming happens on the Nth of that count)', () => {
    expect(feedWildFox(0, false, 2).tamed).toBe(false);
    expect(feedWildFox(1, false, 2).tamed).toBe(true);
  });

  it('the cap is one fox, keyed to the pre-built texture slot', () => {
    expect(FOX_CAP).toBe(1);
    expect(FOX_KEY).toBe('fox0');
  });
});

describe('fox roster persistence — a runtime-tamed fox survives a reload', () => {
  let makeRoster, Fox, ROSTERS;
  beforeEach(async () => {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    };
    ({ makeRoster } = await import('../../save.js'));
    ({ Fox } = await import('./model.js'));
    ({ ROSTERS } = await import('../../rosters.js'));
  });

  it('the fresh fox roster is empty (no default foxes)', () => {
    const foxes = makeRoster(ROSTERS.fox);
    expect(Object.keys(foxes.load())).toEqual([]);
  });

  it('a fox tamed at runtime is restored on the next load (saved-only key)', () => {
    const foxes = makeRoster(ROSTERS.fox);
    const all = foxes.load(); // {} — empty default
    all[FOX_KEY] = new Fox({ name: 'Rusty' }); // committed in play
    foxes.save(all);

    // Reload from storage: the saved-only key (no default under it) must come back.
    const reloaded = foxes.load();
    expect(Object.keys(reloaded)).toEqual([FOX_KEY]);
    expect(reloaded[FOX_KEY]).toBeInstanceOf(Fox);
    expect(reloaded[FOX_KEY].name).toBe('Rusty');
    expect(reloaded[FOX_KEY].species).toBe('fox');
  });
});
