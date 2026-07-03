// Pure ripen/harvest tests for the beehive honey (#239). Guards the accumulate-to-cap,
// ready gate, and whole-batch harvest arithmetic without booting Phaser — the scene
// wiring (paddock/birdEcosystem.js) is exercised by the smoke test.

import { describe, it, expect } from 'vitest';
import { HONEY_CAP, HONEY_READY_AT, ripenHoney, honeyReady, harvestHoney } from './hive.js';

describe('beehive honey (#239)', () => {
  it('ripens one jar per tick, never past the cap', () => {
    expect(ripenHoney(0)).toBe(1);
    expect(ripenHoney(HONEY_CAP)).toBe(HONEY_CAP);
    expect(ripenHoney(HONEY_CAP - 1)).toBe(HONEY_CAP);
  });

  it('is ready to harvest only once it reaches the ready threshold', () => {
    expect(honeyReady(0)).toBe(false);
    expect(honeyReady(HONEY_READY_AT)).toBe(true);
    expect(honeyReady(HONEY_CAP)).toBe(true);
  });

  it('harvesting an unripe hive is a no-op', () => {
    expect(harvestHoney(0)).toEqual({ yield: 0, level: 0 });
  });

  it('harvesting takes the whole ripe batch and resets to zero', () => {
    expect(harvestHoney(HONEY_CAP)).toEqual({ yield: HONEY_CAP, level: 0 });
    expect(harvestHoney(HONEY_READY_AT)).toEqual({ yield: HONEY_READY_AT, level: 0 });
  });

  it('accumulates from empty to full over HONEY_CAP ticks', () => {
    let level = 0;
    for (let i = 0; i < HONEY_CAP; i++) level = ripenHoney(level);
    expect(level).toBe(HONEY_CAP);
    expect(harvestHoney(level).yield).toBe(HONEY_CAP);
  });
});
