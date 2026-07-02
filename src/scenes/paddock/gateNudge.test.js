import { describe, it, expect } from 'vitest';
import { gateNudgeY } from './gateNudge.js';

// Mirrors the live geometry (world.js): gate obstacle spans y∈[884,920] (h=36),
// fence line = PASTURE_BOUNDS.minY = 910. That line — not the gate footprint's
// center or an offset — is the true north(farm)/south(pasture) divide (#117).
const GATE = { y: 884, h: 36 };
const FENCE = 910;

describe('gateNudgeY — gate-close side decision (#117)', () => {
  it('pushes north when the entity is north of the fence line', () => {
    // Just north of the line → should go to the farm side (above the gate).
    expect(gateNudgeY(905, GATE, FENCE)).toBe(GATE.y - 15); // 869
    // Well north.
    expect(gateNudgeY(870, GATE, FENCE)).toBe(GATE.y - 15);
  });

  it('pushes south when the entity is south of the fence line', () => {
    // Just south of the line → should go to the pasture side (below the gate).
    expect(gateNudgeY(915, GATE, FENCE)).toBe(GATE.y + GATE.h + 15); // 935
    // Well south.
    expect(gateNudgeY(919, GATE, FENCE)).toBe(GATE.y + GATE.h + 15);
  });

  it('switches over exactly at the fence line, not an offset point', () => {
    // Regression guard: the old threshold was g.y + g.h*0.8 = 912.8, so an entity
    // at y=911 (already south of the fence) was wrongly shoved NORTH into the farm.
    // With the fence-line midline it now goes south, the natural direction.
    expect(gateNudgeY(911, GATE, FENCE)).toBe(GATE.y + GATE.h + 15); // south, not north
    // On the line itself counts as south (>=), consistent with _settleAtGate.
    expect(gateNudgeY(FENCE, GATE, FENCE)).toBe(GATE.y + GATE.h + 15);
    // One pixel north of the line stays north.
    expect(gateNudgeY(FENCE - 1, GATE, FENCE)).toBe(GATE.y - 15);
  });

  it('honours a custom margin', () => {
    expect(gateNudgeY(915, GATE, FENCE, 30)).toBe(GATE.y + GATE.h + 30);
    expect(gateNudgeY(905, GATE, FENCE, 30)).toBe(GATE.y - 30);
  });
});
