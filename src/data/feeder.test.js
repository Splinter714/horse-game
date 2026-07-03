// Pure fill/drain tests for the seed bird feeder (#240). Guards the refill-to-cap,
// nibble-down, and empty-state arithmetic without booting Phaser — the scene-coupled
// sprite/attraction wiring (paddock/birdEcosystem.js) is exercised by the smoke test.

import { describe, it, expect } from 'vitest';
import { FEEDER_CAP, fillFeederLevel, drainFeederLevel, feederHasSeed } from './feeder.js';

describe('seed feeder fill/drain (#240)', () => {
  it('a refill tops the feeder to the cap regardless of starting level', () => {
    expect(fillFeederLevel()).toBe(FEEDER_CAP);
    expect(fillFeederLevel(FEEDER_CAP)).toBe(FEEDER_CAP);
  });

  it('each bird feeding drains one, never below zero', () => {
    expect(drainFeederLevel(FEEDER_CAP)).toBe(FEEDER_CAP - 1);
    expect(drainFeederLevel(1)).toBe(0);
    expect(drainFeederLevel(0)).toBe(0);
  });

  it('feederHasSeed is true only while stocked', () => {
    expect(feederHasSeed(FEEDER_CAP)).toBe(true);
    expect(feederHasSeed(1)).toBe(true);
    expect(feederHasSeed(0)).toBe(false);
  });

  it('drains from full to empty in exactly FEEDER_CAP feedings', () => {
    let level = fillFeederLevel();
    let feedings = 0;
    while (feederHasSeed(level)) { level = drainFeederLevel(level); feedings++; }
    expect(feedings).toBe(FEEDER_CAP);
  });
});
