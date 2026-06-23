// Tests for the chicken/cat love stat (#104/#105): petting raises a happiness
// stat that completes the interaction, and with no survival needs the happiness
// eases toward a resting baseline so a pet fades slowly and stays renewable.

import { describe, it, expect } from 'vitest';
import { Chicken } from './model.js';
import { Animal } from '../../Animal.js';
import { SPECIES } from '../index.js';

describe('Chicken love stat', () => {
  it('starts at the species default happiness and untended', () => {
    const c = new Chicken();
    expect(c.stats.happiness).toBe(70);
    expect(c.caredToday).toEqual({ loved: false });
  });

  it('petting raises happiness and records love so the interaction completes', () => {
    const c = new Chicken({ stats: { happiness: 50 } });
    expect(c.actionDef('pet')).toBeTruthy();
    expect(c.applyAction('pet')).toBe(true);
    expect(c.stats.happiness).toBe(64); // +14
    expect(c.caredToday.loved).toBe(true);
  });

  it('clamps happiness at 100', () => {
    const c = new Chicken({ stats: { happiness: 95 } });
    c.applyAction('pet');
    expect(c.stats.happiness).toBe(100);
  });

  it('happiness eases down toward the resting baseline when above it', () => {
    const c = new Chicken({ stats: { happiness: 100 } });
    c.applyDecay(10); // 10s of drift toward baseline 55 at driftRate 0.004
    expect(c.stats.happiness).toBeLessThan(100);
    expect(c.stats.happiness).toBeGreaterThan(55);
  });

  it('happiness eases up toward the baseline when below it', () => {
    const c = new Chicken({ stats: { happiness: 30 } });
    c.applyDecay(10);
    expect(c.stats.happiness).toBeGreaterThan(30);
    expect(c.stats.happiness).toBeLessThan(55);
  });
});

describe('Cat love stat', () => {
  it('can be petted and eases toward its own baseline', () => {
    const cat = new Animal(SPECIES.cat, { stats: { happiness: 50 } });
    expect(cat.applyAction('pet')).toBe(true);
    expect(cat.stats.happiness).toBe(62); // +12
    cat.stats.happiness = 100;
    cat.applyDecay(10);
    expect(cat.stats.happiness).toBeLessThan(100);
    expect(cat.stats.happiness).toBeGreaterThan(50);
  });
});
