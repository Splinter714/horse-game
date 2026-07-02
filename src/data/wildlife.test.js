// Pure decision tests for the ambient raccoon (#181/#191). These guard the
// nocturnal gating, skittish bolt, trash-can rummage, and cosmetic-loot decisions
// without booting Phaser — the scene-coupled sprite/tween wiring (raccoon.js) is
// exercised by the smoke test. Mirrors the species behaviors.test.js style.

import { describe, it, expect } from 'vitest';
import {
  isRaccoonActivePhase, shouldRaccoonSpawn, raccoonVisitDelay,
  shouldRaccoonBolt, shouldRummageTrash, shouldGrabLoot,
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
