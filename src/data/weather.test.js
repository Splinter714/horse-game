// Pure weather-logic tests (issue #188, Stage 1). Phaser-free — mirrors the other
// src/data tests. Covers the sun ↔ rain state machine, the faster-dirt-in-rain
// multiplier, the wildlife rain gate, and the PARTIAL trough rain-fill rule.

import { describe, it, expect } from 'vitest';
import {
  WEATHER,
  nextWeather,
  dirtMultiplier,
  wildlifeActiveInWeather,
  rainTroughFill,
  RAIN_DIRT_MULTIPLIER,
  RAIN_TROUGH_CAP_FRACTION,
  WEATHER_DURATION_MS,
} from './weather.js';

const fixedRand = (v) => () => v; // deterministic duration

describe('weather state machine (sun ↔ rain)', () => {
  it('sun mostly stays sunny; a low roll clouds it over to rain', () => {
    expect(nextWeather(WEATHER.SUN, 0.05, fixedRand(1000)).state).toBe(WEATHER.RAIN);
    expect(nextWeather(WEATHER.SUN, 0.9, fixedRand(1000)).state).toBe(WEATHER.SUN);
  });

  it('rain reliably clears back to sun; a high roll keeps it raining', () => {
    expect(nextWeather(WEATHER.RAIN, 0.1, fixedRand(1000)).state).toBe(WEATHER.SUN);
    expect(nextWeather(WEATHER.RAIN, 0.95, fixedRand(1000)).state).toBe(WEATHER.RAIN);
  });

  it('only ever returns the two Stage-1 states', () => {
    for (let roll = 0; roll <= 1; roll += 0.1) {
      expect([WEATHER.SUN, WEATHER.RAIN]).toContain(nextWeather(WEATHER.SUN, roll, fixedRand(1)).state);
      expect([WEATHER.SUN, WEATHER.RAIN]).toContain(nextWeather(WEATHER.RAIN, roll, fixedRand(1)).state);
    }
  });

  it('picks a duration within the entered state\'s configured range', () => {
    const rain = nextWeather(WEATHER.SUN, 0.0); // -> rain, default rand
    expect(rain.state).toBe(WEATHER.RAIN);
    expect(rain.durationMs).toBeGreaterThanOrEqual(WEATHER_DURATION_MS[WEATHER.RAIN].min);
    expect(rain.durationMs).toBeLessThanOrEqual(WEATHER_DURATION_MS[WEATHER.RAIN].max);

    const sun = nextWeather(WEATHER.RAIN, 0.5); // -> sun
    expect(sun.state).toBe(WEATHER.SUN);
    expect(sun.durationMs).toBeGreaterThanOrEqual(WEATHER_DURATION_MS[WEATHER.SUN].min);
    expect(sun.durationMs).toBeLessThanOrEqual(WEATHER_DURATION_MS[WEATHER.SUN].max);
  });

  it('rain spells are shorter than sun spells (mostly-sunny default)', () => {
    expect(WEATHER_DURATION_MS[WEATHER.RAIN].max)
      .toBeLessThanOrEqual(WEATHER_DURATION_MS[WEATHER.SUN].min);
  });
});

describe('rain dirties horses faster (#123 hook)', () => {
  it('sun leaves the dirt rate unchanged (x1)', () => {
    expect(dirtMultiplier(WEATHER.SUN)).toBe(1);
  });

  it('rain multiplies the dirt rate by RAIN_DIRT_MULTIPLIER (> 1)', () => {
    expect(dirtMultiplier(WEATHER.RAIN)).toBe(RAIN_DIRT_MULTIPLIER);
    expect(RAIN_DIRT_MULTIPLIER).toBeGreaterThan(1);
  });

  it('an overnight dirtying of 10 loses more grooming in rain than in sun', () => {
    const base = 10;
    expect(base * dirtMultiplier(WEATHER.RAIN))
      .toBeGreaterThan(base * dirtMultiplier(WEATHER.SUN));
  });
});

describe('wildlife hides in rain (#181/#182/#183 hook)', () => {
  it('is out in the sun and hidden in the rain', () => {
    expect(wildlifeActiveInWeather(WEATHER.SUN)).toBe(true);
    expect(wildlifeActiveInWeather(WEATHER.RAIN)).toBe(false);
  });
});

describe('rain PARTIALLY refills the trough (#103 hook)', () => {
  const CAP = 9;
  const rainCap = Math.floor(CAP * RAIN_TROUGH_CAP_FRACTION); // 4 for cap 9

  it('adds water while below the rain cap', () => {
    expect(rainTroughFill(0, CAP)).toBeGreaterThan(0);
    expect(rainTroughFill(rainCap - 1, CAP)).toBeGreaterThan(0);
  });

  it('stops at the rain cap — never fills the trough on its own', () => {
    expect(rainTroughFill(rainCap, CAP)).toBe(0);
    expect(rainTroughFill(CAP, CAP)).toBe(0);
    expect(rainCap).toBeLessThan(CAP); // the whole point: rain can't top it off
  });

  it('never overshoots the rain cap on the last tick', () => {
    let level = 0;
    for (let i = 0; i < 50; i++) level += rainTroughFill(level, CAP);
    expect(level).toBe(rainCap);
    expect(level).toBeLessThan(CAP);
  });
});
