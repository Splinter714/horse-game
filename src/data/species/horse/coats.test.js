import { describe, it, expect } from 'vitest';
import { COATS, composeCoat, effectiveMarkings, maneRampFor, getCoat } from './coats.js';

// composeCoat is the linchpin of the customizer (#2/#17/#140…): it turns a pure
// colour key + an authoritative `markings` override into the drawable coat the art
// consumes. These guard that override resolution (and the "absent → today's look"
// back-compat that lets old saves render unchanged).

describe('composeCoat — base behaviour', () => {
  it('with no override uses the colour\'s own ramps + default markings', () => {
    const coat = composeCoat('bay', null);
    expect(coat.body).toEqual(COATS.bay.body);
    expect(coat.mane).toEqual(COATS.bay.mane);
    expect(coat.markings).toEqual(COATS.bay.markings);
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

describe('mane colour decoupling (#140)', () => {
  it('maneRampFor returns the colour\'s body ramp', () => {
    expect(maneRampFor('black')).toEqual(COATS.black.body);
    expect(maneRampFor('palomino')).toEqual(COATS.palomino.body);
  });

  it('maneColor recolours the mane to that hue, leaving the body alone', () => {
    const coat = composeCoat('chestnut', { maneColor: 'black' });
    expect(coat.mane).toEqual(COATS.black.body);     // mane took black's hue
    expect(coat.body).toEqual(COATS.chestnut.body);  // body unchanged
  });

  it("maneColor 'natural' (or absent) keeps the coat's own mane", () => {
    expect(composeCoat('chestnut', { maneColor: 'natural' }).mane).toEqual(COATS.chestnut.mane);
    expect(composeCoat('chestnut', {}).mane).toEqual(COATS.chestnut.mane);
  });

  it('an unknown maneColor key falls back to the natural mane', () => {
    expect(composeCoat('bay', { maneColor: 'nope' }).mane).toEqual(COATS.bay.mane);
  });

  it('effectiveMarkings surfaces the maneColor choice for the picker', () => {
    expect(effectiveMarkings('bay', { maneColor: 'grey' }).maneColor).toBe('grey');
  });
});
