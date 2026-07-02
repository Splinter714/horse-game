// Pure decision tests for the ambient raccoon (#181/#191). These guard the
// nocturnal gating, skittish bolt, trash-can rummage, and cosmetic-loot decisions
// without booting Phaser — the scene-coupled sprite/tween wiring (raccoon.js) is
// exercised by the smoke test. Mirrors the species behaviors.test.js style.

import { describe, it, expect } from 'vitest';
import {
  isRaccoonActivePhase, shouldRaccoonSpawn, raccoonVisitDelay,
  shouldRaccoonBolt, shouldRummageTrash, shouldGrabLoot,
  BIRD_TYPES, pickBirdType, getBirdType,
} from './wildlife.js';

describe('raccoon nocturnal gating', () => {
  it('Evening and Night are active phases', () => {
    expect(isRaccoonActivePhase('Evening')).toBe(true);
    expect(isRaccoonActivePhase('Night')).toBe(true);
  });

  it('Morning/Afternoon are not active phases', () => {
    expect(isRaccoonActivePhase('Morning')).toBe(false);
    expect(isRaccoonActivePhase('Afternoon')).toBe(false);
  });

  it('always spawns at night (even on an unlucky roll)', () => {
    expect(shouldRaccoonSpawn({ phase: 'Night', sleeping: false, roll: 0.99 })).toBe(true);
  });

  it('by day only a rare cameo (low roll spawns, high roll does not)', () => {
    expect(shouldRaccoonSpawn({ phase: 'Afternoon', sleeping: false, roll: 0.05 })).toBe(true);
    expect(shouldRaccoonSpawn({ phase: 'Afternoon', sleeping: false, roll: 0.5 })).toBe(false);
  });

  it('never spawns while the player is asleep, even at night', () => {
    expect(shouldRaccoonSpawn({ phase: 'Night', sleeping: true, roll: 0.0 })).toBe(false);
  });

  it('schedules more frequent visits at night than by day', () => {
    const rand = (a) => a; // deterministic: return the low bound
    expect(raccoonVisitDelay('Night', rand)).toBe(12000);
    expect(raccoonVisitDelay('Afternoon', rand)).toBe(30000);
  });
});

describe('raccoon skittish bolt', () => {
  const fleeDist = 200;
  it('bolts when the player is within flee distance', () => {
    expect(shouldRaccoonBolt({ fleeing: false, dist: 120, fleeDist })).toBe(true);
  });
  it('does not bolt when the player is far', () => {
    expect(shouldRaccoonBolt({ fleeing: false, dist: 300, fleeDist })).toBe(false);
  });
  it('does not re-trigger once already fleeing', () => {
    expect(shouldRaccoonBolt({ fleeing: true, dist: 10, fleeDist })).toBe(false);
  });
});

describe('raccoon trash-can rummage', () => {
  it('rummages only at the trash can, and only when one exists', () => {
    expect(shouldRummageTrash({ atTrashCan: true, hasTrashCan: true, roll: 0.1 })).toBe(true);
    expect(shouldRummageTrash({ atTrashCan: false, hasTrashCan: true, roll: 0.1 })).toBe(false);
    expect(shouldRummageTrash({ atTrashCan: true, hasTrashCan: false, roll: 0.1 })).toBe(false);
  });
  it('a high roll (past the chance) sniffs past instead of digging in', () => {
    expect(shouldRummageTrash({ atTrashCan: true, hasTrashCan: true, roll: 0.95 })).toBe(false);
  });
});

describe('raccoon cosmetic loot', () => {
  it('grabs a morsel on a low roll, leaves empty-handed on a high one', () => {
    expect(shouldGrabLoot({ roll: 0.2 })).toBe(true);
    expect(shouldGrabLoot({ roll: 0.8 })).toBe(false);
  });
});

describe('bird variety table (#220)', () => {
  it('every type has a stable id, positive weight, and a full palette', () => {
    expect(BIRD_TYPES.length).toBeGreaterThan(1);
    const ids = new Set();
    for (const t of BIRD_TYPES) {
      expect(typeof t.id).toBe('string');
      expect(ids.has(t.id)).toBe(false); // ids unique (they become texture prefixes)
      ids.add(t.id);
      expect(t.weight ?? 1).toBeGreaterThan(0);
      for (const part of ['body', 'wing', 'belly', 'beak']) {
        expect(typeof t[part]).toBe('number'); // a hex fill
      }
    }
  });

  it('keeps the original brown songbird as a common default (sparrow) with the exact old palette', () => {
    const sparrow = getBirdType('sparrow');
    expect(sparrow.id).toBe('sparrow');
    expect(sparrow.body).toBe(0x6b513a);
    expect(sparrow.wing).toBe(0x4f3c2b);
    expect(sparrow.belly).toBe(0xc2a47a);
    expect(sparrow.beak).toBe(0xe0a838);
    // Commonest type — its weight is the max in the table.
    const maxWeight = Math.max(...BIRD_TYPES.map((t) => t.weight ?? 1));
    expect(sparrow.weight).toBe(maxWeight);
  });

  it('some types are rarer than others (weights are not all equal)', () => {
    const weights = BIRD_TYPES.map((t) => t.weight ?? 1);
    expect(new Set(weights).size).toBeGreaterThan(1);
  });

  it('weighted pick: roll 0 → first (commonest) type, roll ~1 → last (rare) type', () => {
    expect(pickBirdType(0).id).toBe(BIRD_TYPES[0].id);
    expect(pickBirdType(0.999).id).toBe(BIRD_TYPES[BIRD_TYPES.length - 1].id);
  });

  it('weighted pick honors weight bands (a common type wins a low roll before a rare one)', () => {
    // With the sparrow (weight 6) first, any roll landing in the first 6/total lands on it.
    const total = BIRD_TYPES.reduce((s, t) => s + (t.weight ?? 1), 0);
    const sparrowShare = (getBirdType('sparrow').weight ?? 1) / total;
    expect(pickBirdType(sparrowShare * 0.5).id).toBe('sparrow');
  });

  it('every roll in [0,1) picks a valid type (never null / out of range)', () => {
    for (let r = 0; r < 1; r += 0.037) {
      const t = pickBirdType(r);
      expect(t).not.toBeNull();
      expect(BIRD_TYPES).toContain(t);
    }
  });

  it('cosmetic-only: no type declares any behavior fields (only palette + silhouette flags)', () => {
    const allowed = new Set(['id', 'name', 'weight', 'body', 'wing', 'belly', 'beak', 'crest', 'longTail', 'eye']);
    for (const t of BIRD_TYPES) {
      for (const k of Object.keys(t)) expect(allowed.has(k)).toBe(true);
    }
  });
});
