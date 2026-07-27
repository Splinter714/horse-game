// Pure decision tests for the dog companion charm (#186). companionDecision must:
//   - sit only when the player has been idle past SIT_IDLE_MS AND the dog is already
//     parked near its slot (SIT_NEAR),
//   - follow (trot to catch up) whenever the dog is beyond SLACK from its slot,
//   - otherwise hold (within slack, loose rope, no jitter).
// The scene-coupled application (updateDogCompanion) is exercised by the smoke test.

import { describe, it, expect } from 'vitest';
import { companionDecision } from './companionDecision.js';
import { DOG_COMPANION as C, PLAYER_SPEED } from './constants.js';

describe('dog companionDecision', () => {
  it('player moving, dog far → follow (catch up)', () => {
    expect(companionDecision({ playerMoving: true, playerIdleMs: 0, slotDist: 200 })).toBe('follow');
  });

  it('player moving, dog within slack → hold (does not chase jitter)', () => {
    expect(companionDecision({ playerMoving: true, playerIdleMs: 0, slotDist: C.SLACK - 1 })).toBe('hold');
  });

  it('player just stopped (idle < threshold), near slot → hold, not sit yet', () => {
    expect(companionDecision({ playerMoving: false, playerIdleMs: C.SIT_IDLE_MS - 1, slotDist: 10 }))
      .toBe('hold');
  });

  it('player idle past threshold, dog parked near slot → sit', () => {
    expect(companionDecision({ playerMoving: false, playerIdleMs: C.SIT_IDLE_MS + 1, slotDist: C.SIT_NEAR - 1 }))
      .toBe('sit');
  });

  it('player idle past threshold BUT dog still far from slot → follow first (no sit at range)', () => {
    expect(companionDecision({ playerMoving: false, playerIdleMs: C.SIT_IDLE_MS + 1, slotDist: C.SIT_NEAR + 50 }))
      .toBe('follow');
  });

  it('player moving is enough to prevent a sit even if idleMs is stale', () => {
    expect(companionDecision({ playerMoving: true, playerIdleMs: C.SIT_IDLE_MS + 1, slotDist: 10 }))
      .toBe('hold');
  });
});

// #353: the dog read as glued to the player, so the tuning was loosened. These
// guard the shape of that looseness rather than the exact numbers.
describe('dog companion tuning stays loose but functional (#353)', () => {
  it('holds well beyond the old 34px slack — a real gap opens before it moves', () => {
    expect(C.SLACK).toBeGreaterThanOrEqual(80);
    expect(companionDecision({ playerMoving: true, playerIdleMs: 0, slotDist: 70 })).toBe('hold');
  });

  it('still follows once the player has genuinely walked off', () => {
    expect(C.SLACK).toBeLessThan(200); // not so loose it never follows
    expect(companionDecision({ playerMoving: true, playerIdleMs: 0, slotDist: 260 })).toBe('follow');
  });

  it('can sit anywhere it is allowed to hold (SIT_NEAR covers the slack ring)', () => {
    expect(C.SIT_NEAR).toBeGreaterThanOrEqual(C.SLACK);
    expect(companionDecision({ playerMoving: false, playerIdleMs: C.SIT_IDLE_MS + 1, slotDist: C.SLACK }))
      .toBe('sit');
  });

  it('can still close a gap: the catch-up run outpaces the player', () => {
    expect(C.SPEED * C.RUN_MULT).toBeGreaterThan(PLAYER_SPEED);
  });
});
