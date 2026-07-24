// Pure decision tests for horse AI. These pin the behavior-neutral contract: given
// a context snapshot, chooseBehavior must pick the same branch the old hand-written
// horseTickForHorse if-ladder would have. (The scene-coupled `run` half is covered
// by the smoke test.)

import { describe, it, expect, vi, afterEach } from 'vitest';
import { chooseBehavior } from '../index.js';
import { WEATHER } from '../../weather.js';

// A content horse with everything topped up and nothing nearby — wanders.
// (buddyDist Infinity + no bond tuning firing keeps seekBuddy out of these cases;
// the herd-bond tests below supply their own bond fields.)
const BASE = {
  hunger: 100, thirst: 100, temperament: 'calm',
  nearestHayDist: Infinity, troughDist: Infinity, streamDist: Infinity,
  hasPlayer: true, gateOpen: false, playerDist: 9999,
  now: 100000, lastSeek: null,
  begHunger: 50, begNoticeDist: 520, begThrottleMs: 8000,
  happiness: 85, buddyDist: Infinity,
  bondHappy: 60, bondLingerGap: 120, bondChance: 0.5, bondCooldown: 14000, lastBond: null,
  weather: WEATHER.SUN,
};

describe('horse chooseBehavior', () => {
  it('content horse with nothing nearby → wanders (null)', () => {
    expect(chooseBehavior('horse', BASE)).toBe(null);
  });

  it('hungry horse with hay in range → seekFood', () => {
    expect(chooseBehavior('horse', { ...BASE, hunger: 60, nearestHayDist: 300 })).toBe('seekFood');
  });

  it('hungry horse but hay too far → not seekFood (grazes instead)', () => {
    // hunger 60 < GRAZE_HUNGER (70) and no player to beg → falls through to graze.
    expect(chooseBehavior('horse', { ...BASE, hunger: 60, nearestHayDist: 800 })).toBe('graze');
  });

  it('peckish with nothing else available → graze', () => {
    expect(chooseBehavior('horse', { ...BASE, hunger: 65 })).toBe('graze');
  });

  it('content horse (hunger at/above graze threshold) does not graze', () => {
    expect(chooseBehavior('horse', { ...BASE, hunger: 70 })).toBe(null);
  });

  it('seekFood still wins over graze when hay is reachable', () => {
    expect(chooseBehavior('horse', { ...BASE, hunger: 60, nearestHayDist: 300 })).toBe('seekFood');
  });

  it('thirsty (not hungry) with filled trough in range → seekWater', () => {
    expect(chooseBehavior('horse', { ...BASE, thirst: 60, troughDist: 500 })).toBe('seekWater');
  });

  it('food wins over water when both available (priority order)', () => {
    const c = { ...BASE, hunger: 60, nearestHayDist: 300, thirst: 60, troughDist: 500 };
    expect(chooseBehavior('horse', c)).toBe('seekFood');
  });

  it('desperately thirsty, no trough, stream in range → seekStream (#99)', () => {
    expect(chooseBehavior('horse', { ...BASE, thirst: 20, streamDist: 400 })).toBe('seekStream');
  });

  it('only mildly thirsty does not trek to the stream (waits for the trough)', () => {
    // thirst 40 is above THIRST_DESPERATE (25): no stream trip, nothing else fires.
    expect(chooseBehavior('horse', { ...BASE, thirst: 40, streamDist: 400 })).toBe(null);
  });

  it('desperately thirsty but the stream is out of range → no seekStream', () => {
    expect(chooseBehavior('horse', { ...BASE, thirst: 20, streamDist: 1500 })).toBe(null);
  });

  it('a filled trough is always preferred over the stream', () => {
    const c = { ...BASE, thirst: 20, troughDist: 600, streamDist: 200 };
    expect(chooseBehavior('horse', c)).toBe('seekWater');
  });

  it('very hungry, no hay, player near, non-lazy → begPlayer', () => {
    const c = { ...BASE, hunger: 40, playerDist: 300 };
    expect(chooseBehavior('horse', c)).toBe('begPlayer');
  });

  it('lazy horse never begs (grazes instead when hungry)', () => {
    const c = { ...BASE, hunger: 40, playerDist: 300, temperament: 'lazy' };
    expect(chooseBehavior('horse', c)).toBe('graze'); // not begPlayer
  });

  it('begs across a shut gate only when player is within notice distance', () => {
    // When too far to beg, a hungry horse falls through to grazing rather than wandering.
    const far  = { ...BASE, hunger: 40, gateOpen: false, playerDist: 600 };
    const near = { ...BASE, hunger: 40, gateOpen: false, playerDist: 400 };
    expect(chooseBehavior('horse', far)).toBe('graze');
    expect(chooseBehavior('horse', near)).toBe('begPlayer');
  });

  it('begging is throttled — recently sought horse holds off (grazes instead)', () => {
    const c = { ...BASE, hunger: 40, playerDist: 300, now: 100000, lastSeek: 95000 };
    expect(chooseBehavior('horse', c)).toBe('graze'); // only 5s since last seek (< 8s) → no beg
    expect(chooseBehavior('horse', { ...c, lastSeek: 90000 })).toBe('begPlayer'); // 10s
  });
});

// Covered shelter (#319): rain sends an otherwise-idle horse to shelter — but
// real needs (food/water/begging) still win first.
describe('horse chooseBehavior — seekShelter (rain #319)', () => {
  it('sunny and content → wanders (null), not shelter', () => {
    expect(chooseBehavior('horse', BASE)).toBe(null);
  });

  it('raining and otherwise content → seekShelter', () => {
    expect(chooseBehavior('horse', { ...BASE, weather: WEATHER.RAIN })).toBe('seekShelter');
  });

  it('raining but hungry with hay in range → seekFood still wins', () => {
    const c = { ...BASE, weather: WEATHER.RAIN, hunger: 60, nearestHayDist: 300 };
    expect(chooseBehavior('horse', c)).toBe('seekFood');
  });

  it('raining but thirsty with a filled trough in range → seekWater still wins', () => {
    const c = { ...BASE, weather: WEATHER.RAIN, thirst: 60, troughDist: 500 };
    expect(chooseBehavior('horse', c)).toBe('seekWater');
  });

  it('raining and peckish with nothing to eat nearby → seekShelter over graze', () => {
    // hunger 65 < GRAZE_HUNGER (70) would normally graze; rain takes priority.
    expect(chooseBehavior('horse', { ...BASE, weather: WEATHER.RAIN, hunger: 65 })).toBe('seekShelter');
  });

  it('raining, content, buddy drifted apart → seekShelter over the cosmetic bond amble', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // would hit seekBuddy's roll if reached
    const c = { ...BASE, weather: WEATHER.RAIN, buddyDist: 300, lastBond: null };
    expect(chooseBehavior('horse', c)).toBe('seekShelter');
    vi.restoreAllMocks();
  });
});

// Cosmetic herd bond (#31): a content horse ambles back to its favoured companion
// once they've drifted apart. Lowest priority (below graze), so any need wins first.
// Random roll pinned via Math.random mocking to stay deterministic.
describe('horse chooseBehavior — seekBuddy (herd bonds #31)', () => {
  // A content horse with everything topped up, a bonded buddy drifted well away,
  // off cooldown — so only seekBuddy's own gate (linger gap + roll) decides.
  const BONDED = { ...BASE, happiness: 85, buddyDist: 300, lastBond: null };

  afterEach(() => { vi.restoreAllMocks(); });

  it('content horse, buddy drifted apart, roll hits → seekBuddy', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // below bondChance
    expect(chooseBehavior('horse', BONDED)).toBe('seekBuddy');
  });

  it('roll misses → wanders (null)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9); // above bondChance
    expect(chooseBehavior('horse', BONDED)).toBe(null);
  });

  it('buddy already close (within linger gap) → does not amble over', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    expect(chooseBehavior('horse', { ...BONDED, buddyDist: 80 })).toBe(null);
  });

  it('no bonded buddy (buddyDist Infinity) → does not seek', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    expect(chooseBehavior('horse', { ...BONDED, buddyDist: Infinity })).toBe(null);
  });

  it('unhappy horse does not seek out its buddy', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    expect(chooseBehavior('horse', { ...BONDED, happiness: 40 })).toBe(null);
  });

  it('still on cooldown → does not re-amble even if the roll hits', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    expect(chooseBehavior('horse', { ...BONDED, lastBond: 90000, now: 100000 })).toBe(null);
  });

  it('cooldown elapsed and roll hits → ambles over again', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    expect(chooseBehavior('horse', { ...BONDED, lastBond: 80000, now: 100000 })).toBe('seekBuddy');
  });

  it('any real need (hunger) outranks the cosmetic bond amble', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const c = { ...BONDED, hunger: 60, nearestHayDist: 300 };
    expect(chooseBehavior('horse', c)).toBe('seekFood');
  });
});
