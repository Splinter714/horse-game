// Pure decision tests for the dog companion charm (#186). companionDecision must:
//   - sit only when the player has been idle past SIT_IDLE_MS AND the dog is already
//     parked near its slot (SIT_NEAR),
//   - follow (trot to catch up) whenever the dog is beyond SLACK from its slot,
//   - otherwise hold (within slack, loose rope, no jitter).
// The scene-coupled application (updateDogCompanion) is exercised by the smoke test.

import { describe, it, expect } from 'vitest';
import { companionDecision } from './companionDecision.js';
import { DOG_COMPANION as C } from './constants.js';

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
