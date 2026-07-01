// Pure decision tests for the pig's wallow AI (#197). chooseBehavior must pick
// 'wallow' exactly when it's daytime, the per-pig cooldown has elapsed, and the
// random roll hits — and null (wander) otherwise. Random rolls are pinned via
// Math.random mocking so the test stays deterministic. The scene-coupled run
// (pigGoWallow) is covered by the smoke test.
//
// Note: chooseBehavior walks the pig's full `behaviors` list (seekFood/seekWater/
// seekStream/graze/wallow — pig/index.js), so a context that would also satisfy an
// earlier (higher-priority) behavior picks that one instead of wallow. These tests
// use a content, well-fed/watered context so only wallow is in play.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { chooseBehavior } from '../index.js';

// A content, well-fed/watered pig in daytime, never having wallowed — so only
// `wallow`'s own gate (cooldown + random chance) decides.
const BASE = {
  hunger: 100, thirst: 100, nearestHayDist: Infinity, troughDist: Infinity, streamDist: Infinity,
  isNight: false, lastWallow: null, now: 100000, wallowChance: 0.18, wallowCooldown: 20000,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('pig chooseBehavior — wallow', () => {
  it('content pig, random roll misses → wanders (null)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // above wallowChance
    expect(chooseBehavior('pig', BASE)).toBe(null);
  });

  it('content pig, random roll hits, never wallowed → wallow', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01); // below wallowChance
    expect(chooseBehavior('pig', BASE)).toBe('wallow');
  });

  it('still on cooldown → does not wallow even if the roll hits', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
    expect(chooseBehavior('pig', { ...BASE, lastWallow: 90000, now: 100000 })).toBe(null);
  });

  it('cooldown elapsed and roll hits → wallows again', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
    expect(chooseBehavior('pig', { ...BASE, lastWallow: 50000, now: 100000 })).toBe('wallow');
  });

  it('at night → does not wallow even if the roll hits', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
    expect(chooseBehavior('pig', { ...BASE, isNight: true })).toBe(null);
  });

  it('hungry pig with reachable food takes priority over wallowing', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
    expect(chooseBehavior('pig', { ...BASE, hunger: 40, nearestHayDist: 200 })).toBe('seekFood');
  });
});
