import { describe, it, expect } from 'vitest';
import {
  COATS, composeCoat, effectiveMarkings, getCoat, MANE_COLORS, DEFAULT_MANE, explicitLook,
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

// explicitLook decouples coat COLOUR from every other layer: the editor resolves a
// horse's look into fully-explicit fields on open (_custMaterializeSubject), after
// which picking a coat changes only the body pigment (_pickColor). These guard that a
// colour swap never auto-flips face markings, patterns, mane, dark legs or the dorsal.
describe('explicitLook — coat colour decoupled from every other appearance layer', () => {
  // Resolve the look on the OLD coat (editor open), then change ONLY the coat key (what
  // picking a swatch does now that markings are already explicit).
  const recolour = (from, marks, to) => composeCoat(to, explicitLook(from, marks));

  it('spells out every independent layer as its own key (self-contained, no coat fallback)', () => {
    // bay defaults to dark legs + black mane; explicitLook must pin them as keys so the
    // coat is never consulted again. (Seeds from the coat on first resolve.)
    const look = explicitLook('bay', null);
    expect(look.darkLegs).toBe(true);              // bay's points → explicit dark legs
    expect(look.dorsal).toBe(false);               // bay has no dorsal
    expect(look.maneColor).toBe(DEFAULT_MANE.bay); // resolved to the per-coat default
  });

  it('a markings-less horse keeps its bare look when recoloured (no inherited defaults)', () => {
    // palomino default has a star; recolouring to black must NOT sprout black's blaze.
    const before = composeCoat('palomino', null);
    const after = recolour('palomino', null, 'black');
    // No face markings/patterns sneak in from either coat's defaults.
    expect(after.markings.star).toBe(before.markings.star ?? false);
    expect(after.markings.blaze).toBeUndefined();
    expect(after.markings.dapples).toBeUndefined();
  });

  it('preserves dark legs across the swap (no points → bay stays bare; points → palomino keeps dark)', () => {
    expect(recolour('palomino', null, 'bay').points).toBeUndefined();  // bay's points suppressed
    expect(recolour('bay', null, 'palomino').points).toBeDefined();    // bay's dark legs carried over
  });

  it('preserves the dorsal stripe across the swap (dun → chestnut keeps it; chestnut → dun stays off)', () => {
    expect(recolour('dun', null, 'chestnut').dorsal).toBe(true);
    expect(recolour('chestnut', null, 'dun').dorsal).toBe(false);
  });

  it('preserves the resolved mane colour (an untouched palomino mane stays flaxen on black)', () => {
    expect(recolour('palomino', null, 'black').mane).toEqual(MANE_COLORS[DEFAULT_MANE.palomino]);
    expect(recolour('bay', { maneColor: 'silver' }, 'chestnut').mane).toEqual(MANE_COLORS.silver);
  });

  it('keeps an explicit pattern choice and does not pick up the new coat\'s default pattern', () => {
    // chestnut + pinto, recoloured to silverDapple (which defaults to dapples).
    const after = recolour('chestnut', { pinto: true }, 'silverDapple');
    expect(after.markings.pinto).toBe(true);
    expect(after.markings.dapples).toBeUndefined();
  });
});
