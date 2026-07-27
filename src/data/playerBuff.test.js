// Characterization tests for the player meal buff (#277) — pure helpers only.
// Mirrors cooking.test.js's style for the sibling cooking feature (#41).

import { describe, it, expect } from 'vitest';
import {
  MEAL_BUFF_DURATION_MS, MEAL_BUFF_SPEED_MULT, MEAL_BUFF_CHORE_MULT,
  startMealBuff, isBuffActive, speedMult, choreMult, buffSecondsLeft,
} from './playerBuff.js';

describe('player meal buff (#277)', () => {
  it('is a modest, short-lived treat, not overpowered', () => {
    expect(MEAL_BUFF_DURATION_MS).toBeGreaterThan(0);
    expect(MEAL_BUFF_DURATION_MS).toBeLessThanOrEqual(5 * 60 * 1000); // a few minutes, tops
    expect(MEAL_BUFF_SPEED_MULT).toBeGreaterThan(1);
    expect(MEAL_BUFF_SPEED_MULT).toBeLessThan(1.75); // noticeable, not a sprint hack
    expect(MEAL_BUFF_CHORE_MULT).toBeGreaterThan(1);
    expect(MEAL_BUFF_CHORE_MULT).toBeLessThan(1.75);
  });

  it('starts active and expires after its duration', () => {
    const now = 1_000_000;
    const buff = startMealBuff(now);
    expect(isBuffActive(buff, now)).toBe(true);
    expect(isBuffActive(buff, now + MEAL_BUFF_DURATION_MS - 1)).toBe(true);
    expect(isBuffActive(buff, now + MEAL_BUFF_DURATION_MS)).toBe(false);
    expect(isBuffActive(buff, now + MEAL_BUFF_DURATION_MS + 1)).toBe(false);
  });

  it('missing/null buff is simply inactive, never throws', () => {
    expect(isBuffActive(null)).toBe(false);
    expect(isBuffActive(undefined)).toBe(false);
    expect(speedMult(null)).toBe(1);
    expect(choreMult(undefined)).toBe(1);
    expect(buffSecondsLeft(null)).toBe(0);
  });

  it('multiplier helpers are 1 (no-op) once expired, live values while active', () => {
    const now = 0;
    const buff = startMealBuff(now);
    expect(speedMult(buff, now)).toBe(MEAL_BUFF_SPEED_MULT);
    expect(choreMult(buff, now)).toBe(MEAL_BUFF_CHORE_MULT);
    const later = now + MEAL_BUFF_DURATION_MS + 1;
    expect(speedMult(buff, later)).toBe(1);
    expect(choreMult(buff, later)).toBe(1);
  });

  it('eating again just refreshes the buff (single slot, no stacking)', () => {
    const first = startMealBuff(0);
    const second = startMealBuff(1000);
    // Refreshing doesn't compound the multipliers — same shape/magnitude either way.
    expect(second.speedMult).toBe(first.speedMult);
    expect(second.choreMult).toBe(first.choreMult);
    expect(second.expiresAt).toBeGreaterThan(first.expiresAt);
  });

  it('counts down whole seconds remaining, 0 once inactive', () => {
    const now = 0;
    const buff = startMealBuff(now);
    expect(buffSecondsLeft(buff, now)).toBe(Math.ceil(MEAL_BUFF_DURATION_MS / 1000));
    expect(buffSecondsLeft(buff, now + MEAL_BUFF_DURATION_MS)).toBe(0);
  });
});
