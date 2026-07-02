// Tests for the personality & preferences system (#88 v1): deterministic assignment,
// persistence stability, the no-negative-traits guard, and the game-wide reach.

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_POOLS, BANNED_WORDS, SINGLE_KEYS, AFFINITY_COUNT,
  poolsFor, assignPersonality,
} from './personality.js';
import { SPECIES } from './species/index.js';
import { Animal } from './Animal.js';

// Every pool a species can actually surface (shared defaults merged with its
// override) — the full vocabulary a player might ever see.
function allWordsForSpecies(spec) {
  const pools = poolsFor(spec);
  return Object.values(pools).flat();
}

describe('personality pools — no negative traits (hard rule)', () => {
  it('the shared default pools contain no banned words', () => {
    const words = Object.values(DEFAULT_POOLS).flat().join(' ').toLowerCase();
    for (const bad of BANNED_WORDS) {
      expect(words).not.toMatch(new RegExp(`\\b${bad}\\b`));
    }
  });

  it('no species override pool contains a banned word', () => {
    for (const [id, spec] of Object.entries(SPECIES)) {
      const words = allWordsForSpecies(spec).join(' ').toLowerCase();
      for (const bad of BANNED_WORDS) {
        expect(words, `species ${id} pool contains banned word "${bad}"`)
          .not.toMatch(new RegExp(`\\b${bad}\\b`));
      }
    }
  });
});

describe('assignPersonality — deterministic & complete', () => {
  it('same seed + species always yields the same personality', () => {
    const a = assignPersonality(SPECIES.horse, 'horse-1');
    const b = assignPersonality(SPECIES.horse, 'horse-1');
    expect(a).toEqual(b);
  });

  it('different seeds generally yield different personalities', () => {
    const results = new Set(
      ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7'].map(
        (s) => JSON.stringify(assignPersonality(SPECIES.horse, s)),
      ),
    );
    // Not all identical — the seed actually varies the outcome.
    expect(results.size).toBeGreaterThan(1);
  });

  it('assigns every single-pick category plus a set of affinities', () => {
    const p = assignPersonality(SPECIES.horse, 'horse-1');
    for (const key of SINGLE_KEYS) {
      expect(typeof p[key]).toBe('string');
      expect(p[key].length).toBeGreaterThan(0);
    }
    expect(Array.isArray(p.affinities)).toBe(true);
    expect(p.affinities).toHaveLength(AFFINITY_COUNT);
    // Affinities are distinct.
    expect(new Set(p.affinities).size).toBe(p.affinities.length);
  });

  it('picks only from the species pools', () => {
    for (const spec of Object.values(SPECIES)) {
      const pools = poolsFor(spec);
      const p = assignPersonality(spec, `${spec.id}-seed`);
      for (const key of SINGLE_KEYS) {
        if (p[key] !== undefined) expect(pools[key]).toContain(p[key]);
      }
      for (const a of p.affinities ?? []) expect(pools.affinities).toContain(a);
    }
  });

  it('works for every registered species (game-wide reach)', () => {
    for (const spec of Object.values(SPECIES)) {
      const p = assignPersonality(spec, `${spec.id}-1`);
      expect(p.temperament).toBeTruthy();
      expect(p.affinities?.length).toBe(AFFINITY_COUNT);
    }
  });
});

describe('Animal — personality assignment & persistence', () => {
  it('every animal gets a profile assigned from its id', () => {
    for (const spec of Object.values(SPECIES)) {
      const a = new Animal(spec, { id: `${spec.id}-x` });
      expect(a.profile).toBeTruthy();
      expect(a.profile.temperament).toBeTruthy();
    }
  });

  it('the profile does not clobber a species\' single-word `traits.personality`', () => {
    // Chicken/cat/dog/bunny declare `traits: { personality: '<word>' }`. The new
    // profile OBJECT lives on `profile`, so both coexist.
    const c = new Animal(SPECIES.chicken, { id: 'chicken-1', personality: 'friendly' });
    expect(c.personality).toBe('friendly');       // legacy single-word trait intact
    expect(typeof c.profile).toBe('object');       // new profile is a distinct object
    expect(c.profile.temperament).toBeTruthy();
  });

  it('a persisted profile round-trips through toJSON and is stable', () => {
    const a = new Animal(SPECIES.horse, { id: 'horse-1' });
    const json = a.toJSON();
    expect(json.profile).toEqual(a.profile);

    const reloaded = new Animal(SPECIES.horse, json);
    expect(reloaded.profile).toEqual(a.profile);
  });

  it('assignment is stable across reloads even without a stored profile', () => {
    // No `profile` in data → re-derived from the id, must match every time.
    const a = new Animal(SPECIES.horse, { id: 'horse-42' });
    const b = new Animal(SPECIES.horse, { id: 'horse-42' });
    expect(a.profile).toEqual(b.profile);
  });

  it('an explicitly stored profile wins over the derived default', () => {
    const custom = { temperament: 'brave', food: 'apples', affinities: ['loves water'] };
    const a = new Animal(SPECIES.horse, { id: 'horse-1', profile: custom });
    expect(a.profile).toEqual(custom);
  });
});
