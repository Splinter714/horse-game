// Pure decision tests for the generic rain-shelter behavior (#319, generalized to
// every pasture grazer + retargeted at the barn by #349).
//
// Two things are pinned here:
//   1. the module's own test() — fires on rain, nothing else;
//   2. the WIRING — every pasture grazer species actually resolves `seekShelter`
//      through chooseBehavior (registry entry + `behaviors` list), at the right
//      priority: after real needs (food/water), before ambient graze/charm.
// (The scene-coupled `run` half — animalGoToShelter pathing into the barn — is
// covered by the smoke test.)

import { describe, it, expect } from 'vitest';
import { seekShelter } from './shelter.js';
import { chooseBehavior, SPECIES } from './index.js';
import { WEATHER } from '../weather.js';

// The species that shelter: pasture grazers. Yard critters that merely reuse the
// grazer movement primitives (fox, duck, bunny, cat) are deliberately excluded.
const SHELTERING = ['horse', 'cow', 'pig', 'sheep', 'goat', 'llama'];
const NOT_SHELTERING = ['chicken', 'rooster', 'cat', 'dog', 'bunny', 'fox', 'duck'];

// A content animal with everything topped up and nothing nearby — wanders when dry.
const BASE = {
  hunger: 100, thirst: 100, temperament: 'calm',
  nearestHayDist: Infinity, troughDist: Infinity, streamDist: Infinity,
  hasPlayer: true, gateOpen: false, playerDist: 9999,
  now: 100000, lastSeek: null,
  begHunger: 50, begNoticeDist: 520, begThrottleMs: 8000,
  happiness: 85, buddyDist: Infinity,
  bondHappy: 60, bondLingerGap: 120, bondChance: 0, bondCooldown: 14000, lastBond: null,
  isNight: false, lastWallow: null, wallowChance: 0, wallowCooldown: 30000,
  weather: WEATHER.SUN,
};

describe('seekShelter.test (pure)', () => {
  it('fires while it is raining', () => {
    expect(seekShelter.test({ weather: WEATHER.RAIN })).toBe(true);
  });

  it('does not fire in fair weather', () => {
    expect(seekShelter.test({ weather: WEATHER.SUN })).toBe(false);
  });

  it('does not fire with no weather in the context at all', () => {
    expect(seekShelter.test({})).toBe(false);
  });
});

describe('seekShelter wiring — every pasture grazer shelters (#349)', () => {
  for (const id of SHELTERING) {
    it(`${id}: raining and otherwise content → seekShelter`, () => {
      expect(chooseBehavior(id, { ...BASE, weather: WEATHER.RAIN })).toBe('seekShelter');
    });

    it(`${id}: dry and content → wanders (null), not shelter`, () => {
      expect(chooseBehavior(id, BASE)).toBe(null);
    });

    it(`${id}: raining but hungry with hay in range → seekFood still wins`, () => {
      const c = { ...BASE, weather: WEATHER.RAIN, hunger: 60, nearestHayDist: 300 };
      expect(chooseBehavior(id, c)).toBe('seekFood');
    });

    it(`${id}: raining but thirsty with a filled trough in range → seekWater still wins`, () => {
      const c = { ...BASE, weather: WEATHER.RAIN, thirst: 60, troughDist: 500 };
      expect(chooseBehavior(id, c)).toBe('seekWater');
    });

    it(`${id}: raining and peckish with nothing to eat → shelter beats ambient grazing`, () => {
      // hunger 65 is below the graze threshold (70); rain still takes priority.
      expect(chooseBehavior(id, { ...BASE, weather: WEATHER.RAIN, hunger: 65 })).toBe('seekShelter');
    });

    it(`${id}: is a grazer (declares capabilities.grazes; the horse is the implicit one)`, () => {
      // `_grazers()` (scenes/paddock/creatures.js) = the horse roster + every animal
      // whose species declares `grazes`, so the horse itself doesn't carry the flag.
      expect(id === 'horse' || SPECIES[id].capabilities.grazes === true).toBe(true);
    });
  }
});

describe('seekShelter wiring — non-pasture species are left out', () => {
  for (const id of NOT_SHELTERING) {
    it(`${id} does not list seekShelter`, () => {
      expect(SPECIES[id].behaviors ?? []).not.toContain('seekShelter');
    });
  }
});
