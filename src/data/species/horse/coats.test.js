import { describe, it, expect } from 'vitest';
import {
  COATS, composeCoat, effectiveMarkings, maneRampFor, getCoat,
  featherToneFor, sockToneFor, SOCK_COLORS, FEATHER_SWATCH,
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

describe('mane colour decoupling (#140 + follow-up: no coat-bundled mane)', () => {
  it('maneRampFor returns the colour\'s body ramp', () => {
    expect(maneRampFor('black')).toEqual(COATS.black.body);
    expect(maneRampFor('palomino')).toEqual(COATS.palomino.body);
  });

  it('by default the mane matches the coat colour (its body ramp)', () => {
    expect(composeCoat('chestnut', {}).mane).toEqual(COATS.chestnut.body);
    expect(composeCoat('bay', null).mane).toEqual(COATS.bay.body);
  });

  it('maneColor recolours the mane to that hue, leaving the body alone', () => {
    const coat = composeCoat('chestnut', { maneColor: 'black' });
    expect(coat.mane).toEqual(COATS.black.body);     // mane took black's hue
    expect(coat.body).toEqual(COATS.chestnut.body);  // body unchanged
  });

  it('an unknown maneColor key falls back to the coat colour', () => {
    expect(composeCoat('bay', { maneColor: 'nope' }).mane).toEqual(COATS.bay.body);
  });

  it('effectiveMarkings surfaces the maneColor choice for the picker', () => {
    expect(effectiveMarkings('bay', { maneColor: 'grey' }).maneColor).toBe('grey');
  });
});

describe('sock/stocking colour (#141 follow-up)', () => {
  it('defaults to white, and resolves white/black/tan', () => {
    expect(sockToneFor({})).toBe(SOCK_COLORS.white);
    expect(sockToneFor({ sockColor: 'black' })).toBe(SOCK_COLORS.black);
    expect(sockToneFor({ sockColor: 'tan' })).toBe(SOCK_COLORS.tan);
  });

  it("the coat's built-in leg points are unaffected (no separate leg colour)", () => {
    expect(composeCoat('bay', { sockColor: 'tan' }).points).toBe(COATS.bay.points);
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

describe('feathering colour — full palette, matching the mane (#143)', () => {
  it('is undefined when feathering is off', () => {
    expect(featherToneFor(composeCoat('black', {}))).toBeUndefined();
  });

  it("'natural'/absent tracks the (possibly overridden) mane", () => {
    // Mane now defaults to the coat's body, so natural feathering matches that.
    expect(featherToneFor(composeCoat('black', { feather: true }))).toBe(COATS.black.body.mid);
    expect(featherToneFor(composeCoat('black', { feather: true, maneColor: 'grey' }))).toBe(COATS.grey.body.mid);
  });

  it('a coat key recolours the feathering to that hue', () => {
    expect(featherToneFor(composeCoat('black', { feather: true, featherColor: 'palomino' }))).toBe(COATS.palomino.body.mid);
  });

  it("legacy 'white'/'black' values still resolve (breed presets)", () => {
    expect(featherToneFor(composeCoat('black', { feather: true, featherColor: 'white' }))).toBe(FEATHER_SWATCH.white);
    expect(featherToneFor(composeCoat('black', { feather: true, featherColor: 'black' }))).toBe(FEATHER_SWATCH.black);
  });
});
