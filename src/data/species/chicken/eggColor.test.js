// Egg-colour mapping (#276): brown & gold chickens lay brown eggs, others white.
import { describe, it, expect } from 'vitest';
import {
  EGG_COLOR_BY_COAT, DEFAULT_EGG_COLOR, EGG_CONTENT_BY_COLOR,
  eggColorForCoat, chickenCoatIndex, eggContentForChicken,
} from './eggColor.js';

describe('eggColorForCoat (#276 — coat → egg colour)', () => {
  it('brown (rhode island red, coat 1) and gold (buff, coat 3) lay brown eggs', () => {
    expect(eggColorForCoat(1)).toBe('brown');
    expect(eggColorForCoat(3)).toBe('brown');
  });

  it('white (0), black (2) and grey (4) lay the default white egg', () => {
    expect(eggColorForCoat(0)).toBe('white');
    expect(eggColorForCoat(2)).toBe('white');
    expect(eggColorForCoat(4)).toBe('white');
  });

  it('unknown / undefined coats fall through to the default white egg', () => {
    expect(eggColorForCoat(99)).toBe(DEFAULT_EGG_COLOR);
    expect(eggColorForCoat(undefined)).toBe('white');
  });

  it('the table only marks the two brown-laying coats', () => {
    expect(EGG_COLOR_BY_COAT).toEqual({ 1: 'brown', 3: 'brown' });
  });
});

describe('chickenCoatIndex (customized style overrides roster coat)', () => {
  it('uses the roster coat when uncustomized', () => {
    expect(chickenCoatIndex({ coat: 3 })).toBe(3);
  });

  it('prefers the customizer style index when set', () => {
    expect(chickenCoatIndex({ coat: 0, look: { style: 1 } })).toBe(1);
    expect(chickenCoatIndex({ coat: 3, look: { style: '0' } })).toBe(0); // string coerced
  });

  it('defaults to coat 0 for empty data', () => {
    expect(chickenCoatIndex({})).toBe(0);
    expect(chickenCoatIndex(undefined)).toBe(0);
  });
});

describe('eggContentForChicken (colour → carrier content)', () => {
  it('brown/gold hens lay eggBrown, others lay egg', () => {
    expect(eggContentForChicken({ coat: 1 })).toBe('eggBrown'); // brown
    expect(eggContentForChicken({ coat: 3 })).toBe('eggBrown'); // gold
    expect(eggContentForChicken({ coat: 0 })).toBe('egg');      // white
    expect(eggContentForChicken({ coat: 2 })).toBe('egg');      // black
    expect(eggContentForChicken({ coat: 4 })).toBe('egg');      // grey
  });

  it('respects a recoloured hen (white hen restyled brown lays brown)', () => {
    expect(eggContentForChicken({ coat: 0, look: { style: 1 } })).toBe('eggBrown');
    expect(eggContentForChicken({ coat: 1, look: { style: 0 } })).toBe('egg');
  });

  it('every colour maps to a defined content type', () => {
    for (const content of Object.values(EGG_CONTENT_BY_COLOR)) {
      expect(typeof content).toBe('string');
    }
  });
});
