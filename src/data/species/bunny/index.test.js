// Bunny attraction/cap + persistence tests (#224). Bunnies arrive via bunny food
// (paddock/bunny.js `attractBunny`), capped at one per coat colour, coat assigned
// randomly on arrival. The pure cap/coat picker (`nextBunny`) is unit-tested here,
// plus the roster round-trip that lets a runtime-attracted bunny survive a reload
// (makeRoster must restore saved keys that aren't fresh-game defaults, since the
// bunny roster starts empty).

import { describe, it, expect, beforeEach } from 'vitest';
import { nextBunny, BUNNY_COATS, BUNNY_CAP } from './index.js';

describe('nextBunny — coat assignment + cap', () => {
  it('an empty roster can attract any of the 4 coats', () => {
    // With no coats taken, a deterministic rng of 0 picks the first free colour.
    const pick = nextBunny([], () => 0);
    expect(pick).toEqual({ key: 'bunny0', coat: BUNNY_COATS[0], index: 0 });
  });

  it('assigns a still-free coat, keyed to that coat\'s slot', () => {
    // grey taken → the next pick (rng 0) is the first *free* colour (white, slot 1).
    const pick = nextBunny(['grey'], () => 0);
    expect(pick).toEqual({ key: 'bunny1', coat: 'white', index: 1 });
  });

  it('never repeats a coat already in the roster', () => {
    const taken = ['grey', 'white'];
    for (let r = 0; r < 1; r += 0.1) {
      const pick = nextBunny(taken, () => r);
      expect(taken).not.toContain(pick.coat);
    }
  });

  it('picks randomly among the free coats (rng selects the index)', () => {
    // Nothing taken, rng just below 1 → the LAST free colour (black, slot 3).
    const pick = nextBunny([], () => 0.99);
    expect(pick.coat).toBe(BUNNY_COATS[BUNNY_COATS.length - 1]);
    expect(pick.key).toBe(`bunny${BUNNY_COATS.length - 1}`);
  });

  it('returns null once the cap (one per coat) is reached', () => {
    expect(nextBunny([...BUNNY_COATS])).toBeNull();
    expect(BUNNY_CAP).toBe(BUNNY_COATS.length);
  });

  it('the key always matches the coat slot, so a coat maps to a stable texture', () => {
    for (let i = 0; i < BUNNY_COATS.length; i++) {
      const taken = BUNNY_COATS.filter((_, j) => j !== i); // only slot i free
      const pick = nextBunny(taken, () => 0);
      expect(pick.key).toBe(`bunny${i}`);
      expect(pick.coat).toBe(BUNNY_COATS[i]);
    }
  });
});

describe('bunny roster persistence — runtime-attracted bunnies survive a reload', () => {
  let makeRoster, Bunny, ROSTERS;
  beforeEach(async () => {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    };
    ({ makeRoster } = await import('../../save.js'));
    ({ Bunny } = await import('./model.js'));
    ({ ROSTERS } = await import('../../rosters.js'));
  });

  it('the fresh bunny roster is empty (no default bunnies)', () => {
    const bunnies = makeRoster(ROSTERS.bunny);
    expect(Object.keys(bunnies.load())).toEqual([]);
  });

  it('a bunny added at runtime is restored on the next load (saved-only key)', () => {
    const bunnies = makeRoster(ROSTERS.bunny);
    const all = bunnies.load(); // {} — empty default
    all.bunny2 = new Bunny({ coat: 'brown', name: 'Thumper' }); // attracted in play
    bunnies.save(all);

    // Reload from storage: the saved-only key (no default under it) must come back.
    const reloaded = bunnies.load();
    expect(Object.keys(reloaded)).toEqual(['bunny2']);
    expect(reloaded.bunny2).toBeInstanceOf(Bunny);
    expect(reloaded.bunny2.coat).toBe('brown');
    expect(reloaded.bunny2.name).toBe('Thumper');
    expect(reloaded.bunny2.species).toBe('bunny');
  });

  it('multiple attracted bunnies (one per coat) all persist', () => {
    const bunnies = makeRoster(ROSTERS.bunny);
    const all = bunnies.load();
    all.bunny0 = new Bunny({ coat: 'grey' });
    all.bunny1 = new Bunny({ coat: 'white' });
    all.bunny3 = new Bunny({ coat: 'black' });
    bunnies.save(all);
    const reloaded = bunnies.load();
    expect(Object.keys(reloaded).sort()).toEqual(['bunny0', 'bunny1', 'bunny3']);
    expect(reloaded.bunny1.coat).toBe('white');
  });
});
