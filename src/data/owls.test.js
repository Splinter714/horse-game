// Pure tests for the ambient NOCTURNAL OWL decisions (issue #271). Owls are ambient
// wildlife active ONLY at night; these guard that night-only rule (the whole feature's
// hook) and the visit cadence, Phaser-free. The scene-coupled spawn/hoot/glide is
// exercised by the smoke test (owls present at night, absent by day, no console errors).

import { describe, it, expect } from 'vitest';
import {
  OWL_ACTIVE_PHASE, isOwlActivePhase, shouldOwlAppear, owlVisitDelay,
} from './owls.js';

describe('owls are active only at night', () => {
  it('the active phase is Night', () => {
    expect(OWL_ACTIVE_PHASE).toBe('Night');
  });

  it('isOwlActivePhase is true only for Night', () => {
    expect(isOwlActivePhase('Night')).toBe(true);
    expect(isOwlActivePhase('Morning')).toBe(false);
    expect(isOwlActivePhase('Afternoon')).toBe(false);
    // Distinct from the raccoon's "nocturnal" (Evening+Night): owls are stricter and
    // do NOT come out at dusk — only full night.
    expect(isOwlActivePhase('Evening')).toBe(false);
  });
});

describe('shouldOwlAppear', () => {
  it('appears at night when awake', () => {
    expect(shouldOwlAppear({ phase: 'Night', sleeping: false })).toBe(true);
  });

  it('never appears during the day', () => {
    for (const phase of ['Morning', 'Afternoon', 'Evening']) {
      expect(shouldOwlAppear({ phase, sleeping: false })).toBe(false);
    }
  });

  it('never appears while the player is asleep, even at night', () => {
    expect(shouldOwlAppear({ phase: 'Night', sleeping: true })).toBe(false);
  });
});

describe('owlVisitDelay', () => {
  // A deterministic stub for Phaser.Math.Between so the branch is testable.
  const rand = (min, max) => (min + max) / 2;

  it('schedules a gentle cadence at night', () => {
    expect(owlVisitDelay('Night', rand)).toBe((12000 + 26000) / 2);
  });

  it('schedules a long dormant wait outside night', () => {
    expect(owlVisitDelay('Afternoon', rand)).toBe((30000 + 60000) / 2);
    // The daytime wait is strictly longer than the night cadence.
    expect(owlVisitDelay('Afternoon', rand)).toBeGreaterThan(owlVisitDelay('Night', rand));
  });
});
