// Pure-logic tests for the horse body-language posture selector (#69). horsePosture()
// maps the mood/care state the behavior layer already computes onto which idle pose a
// standing horse shows. The art drawing itself (drawHorse / drawHorseRoll) is verified
// by eye in the preview; this pins the state → posture-id contract.

import { describe, it, expect } from 'vitest';
import { horsePosture, HORSE_POSTURE_IDS, POSTURE_FRAMES } from './horseArt.js';

describe('horsePosture (mood → idle posture, #69)', () => {
  it('neglected horse → pinned-ear "neglected" posture (wins over happiness)', () => {
    expect(horsePosture({ neglected: true, happiness: 100 })).toBe('neglected');
    expect(horsePosture({ neglected: true, happiness: 0 })).toBe('neglected');
  });

  it('low happiness (not neglected) → drooped "content" posture', () => {
    expect(horsePosture({ neglected: false, happiness: 40 })).toBe('content');
    expect(horsePosture({ neglected: false, happiness: 54 })).toBe('content');
  });

  it('happy / neutral horse → default alert idle (empty id)', () => {
    expect(horsePosture({ neglected: false, happiness: 55 })).toBe('');
    expect(horsePosture({ neglected: false, happiness: 90 })).toBe('');
  });

  it('defaults to the alert idle when no mood data is given', () => {
    expect(horsePosture()).toBe('');
    expect(horsePosture({})).toBe('');
  });

  it('every non-default posture id has matching frame data', () => {
    // The paddock registers idle_<id>_<key> anims from HORSE_POSTURE_IDS; each id must
    // be produced by a POSTURE_FRAMES entry, or the anim would reference missing frames.
    for (const id of ['neglected', 'content']) {
      expect(HORSE_POSTURE_IDS).toContain(id);
      expect(POSTURE_FRAMES.some((p) => p.id === id)).toBe(true);
    }
  });

  it('posture ids are exactly the two mood variants (no stray/default entry)', () => {
    expect([...HORSE_POSTURE_IDS].sort()).toEqual(['content', 'neglected']);
  });
});
