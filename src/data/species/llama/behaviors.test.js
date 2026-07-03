// Pure decision tests for the llama's spit AI (#268). chooseBehavior must pick 'spit'
// exactly when it's daytime, the per-llama cooldown has elapsed, and the random roll
// hits — and null (wander) otherwise. Random rolls are pinned via Math.random mocking
// so the test stays deterministic. The scene-coupled run (llamaGoSpit) is covered by
// the smoke test.
//
// Note: chooseBehavior walks the llama's full `behaviors` list (seekFood/seekWater/
// seekStream/graze/spit — llama/index.js), so a context that would also satisfy an
// earlier (higher-priority) behavior picks that one instead of spit. These tests use a
// content, well-fed/watered context so only spit is in play.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { chooseBehavior } from '../index.js';

// A content, well-fed/watered llama in daytime, never having spat — so only `spit`'s
// own gate (cooldown + random chance) decides. hunger/thirst kept high enough to clear
// graze (< 70), seekFood (< 95), and seekWater (< 95).
const BASE = {
  hunger: 100, thirst: 100, nearestHayDist: Infinity, troughDist: Infinity, streamDist: Infinity,
  isNight: false, lastSpit: null, now: 100000, spitChance: 0.14, spitCooldown: 24000,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('llama chooseBehavior — spit', () => {
  it('content llama, random roll misses → wanders (null)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // above spitChance
    expect(chooseBehavior('llama', BASE)).toBe(null);
  });

  it('content llama, random roll hits, never spat → spit', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01); // below spitChance
    expect(chooseBehavior('llama', BASE)).toBe('spit');
  });

  it('still on cooldown → does not spit even if the roll hits', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
    expect(chooseBehavior('llama', { ...BASE, lastSpit: 90000, now: 100000 })).toBe(null);
  });

  it('cooldown elapsed and roll hits → spits again', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
    expect(chooseBehavior('llama', { ...BASE, lastSpit: 60000, now: 100000 })).toBe('spit');
  });

  it('at night → does not spit even if the roll hits', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
    expect(chooseBehavior('llama', { ...BASE, isNight: true })).toBe(null);
  });

  it('hungry llama with reachable food takes priority over spitting', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
    expect(chooseBehavior('llama', { ...BASE, hunger: 40, nearestHayDist: 200 })).toBe('seekFood');
  });
});
