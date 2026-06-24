import { describe, it, expect } from 'vitest';
import {
  COATS, composeCoat, effectiveMarkings, getCoat, MANE_COLORS, DEFAULT_MANE,
} from './coats.js';

// composeCoat is the linchpin of the customizer (#2/#17/#140…): it turns a pure
// colour key + an authoritative `markings` override into the drawable coat the art
// consumes. These guard that override resolution (and the "absent → today's look"
// back-compat that lets old saves render unchanged).

describe('composeCoat — base behaviour', () => {
  it('with no override uses the colour\'s body ramp + default markings', () => {
    const coat = composeCoat('bay', null);
    expect(coat.body).toEqual(COATS.bay.body);
    expect(coat.markings).toEqual(COATS.bay.markings);
    expect(coat.points).toBe(COATS.bay.points); // coat keeps its built-in leg points
  });

  it('a markings override is authoritative (replaces, does not merge with defaults)', () => {
    // flaxenChestnut defaults to { star, stripe }; an override of {} must win.
    const coat = composeCoat('flaxenChestnut', {});
    expect(coat.markings.star).toBeUndefined();
    expect(coat.markings.stripe).toBeUndefined();
  });

  it('getCoat(key) equals composeCoat(key, null)', () => {
    expect(getCoat('grey')).toEqual(composeCoat('grey', null));
  });
});

describe('mane colour — curated realistic palette with per-coat default (#155)', () => {
  it('with no choice, the mane uses the per-coat default from MANE_COLORS', () => {
    expect(composeCoat('chestnut', {}).mane).toEqual(MANE_COLORS[DEFAULT_MANE.chestnut]);
    expect(composeCoat('palomino', null).mane).toEqual(MANE_COLORS[DEFAULT_MANE.palomino]);
  });

  it('maneColor sets the mane to that curated colour, leaving the body alone', () => {
    const coat = composeCoat('chestnut', { maneColor: 'flaxen' });
    expect(coat.mane).toEqual(MANE_COLORS.flaxen);   // mane took the flaxen ramp
    expect(coat.body).toEqual(COATS.chestnut.body);  // body unchanged
  });

  it('an unknown/invalid maneColor falls back to the per-coat default', () => {
    expect(composeCoat('bay', { maneColor: 'nope' }).mane).toEqual(MANE_COLORS[DEFAULT_MANE.bay]);
  });

  it('effectiveMarkings surfaces the maneColor choice for the picker', () => {
    expect(effectiveMarkings('bay', { maneColor: 'silver' }).maneColor).toBe('silver');
  });
});

describe('primitive markings: dark legs + dorsal stripe (decoupled, follow-up)', () => {
  it('default to the coat (bay has dark legs, chestnut does not; dun has a dorsal)', () => {
    expect(composeCoat('bay', {}).points).toBe(COATS.bay.points);
    expect(composeCoat('chestnut', {}).points).toBeUndefined();
    expect(composeCoat('dun', {}).dorsal).toBe(true);
    expect(!!composeCoat('chestnut', {}).dorsal).toBe(false);
  });

  it('darkLegs toggles the points independently of the coat', () => {
    expect(composeCoat('bay', { darkLegs: false }).points).toBeUndefined();   // remove a bay's
    expect(composeCoat('chestnut', { darkLegs: true }).points).toBeDefined(); // add to a chestnut
  });

  it('dorsal toggles the stripe independently of the coat', () => {
    expect(composeCoat('dun', { dorsal: false }).dorsal).toBe(false);
    expect(composeCoat('chestnut', { dorsal: true }).dorsal).toBe(true);
  });
});

describe('feathering (#155: on/off only, colour auto-derived per leg in the art)', () => {
  it('feather is a plain boolean flag — no featherColor data', () => {
    expect(composeCoat('black', { feather: true }).markings.feather).toBe(true);
    expect(composeCoat('black', { feather: true }).markings.featherColor).toBeUndefined();
  });

  it('breed presets no longer carry a featherColor (auto-derived now)', () => {
    expect(composeCoat('bay', { feather: true, legs: { foreNear: 'stocking' } }).markings.featherColor).toBeUndefined();
  });
});
