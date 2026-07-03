import { describe, it, expect } from 'vitest';
import { Llama } from './model.js';
import { LLAMA } from './index.js';

// Shearing (#268, mirrors the sheep #233): the llama/alpaca is a fleece producer on a
// REGROWTH TIMER (produces.mode === 'cooldown'). These cover the generic cooldown
// produce path on the Animal model as exercised by the llama, plus the appearance
// `variant` (llama | alpaca) round-tripping through save/load.

const COOLDOWN = LLAMA.produces.cooldownMs;

describe('Llama — shearing / wool produce (#268)', () => {
  it('declares a cooldown-mode wool produce sheared into a basket', () => {
    expect(LLAMA.produces.content).toBe('wool');
    expect(LLAMA.produces.mode).toBe('cooldown');
    expect(LLAMA.produces.carrier).toBe('basket');
    expect(LLAMA.produces.cooldownMs).toBeGreaterThan(0);
  });

  it('is shearable at the start (readyAtStart) and not yet shorn', () => {
    const l = new Llama();
    const t0 = 1_000_000;
    expect(l.canProduce(t0)).toBe(true);   // fresh llama can be sheared right away
    expect(l.isShorn(t0)).toBe(false);     // full fleece to begin with
    expect(l.lastProducedAt).toBe(0);      // never sheared → no timestamp
  });

  it('cannot be re-sheared until the regrowth timer elapses, then can again', () => {
    const l = new Llama();
    const t0 = 1_000_000;
    l.markProduced(t0);                     // shear now
    expect(l.canProduce(t0)).toBe(false);
    expect(l.canProduce(t0 + COOLDOWN - 1)).toBe(false);
    expect(l.canProduce(t0 + COOLDOWN)).toBe(true);
  });

  it('looks shorn only while the fleece is regrowing', () => {
    const l = new Llama();
    const t0 = 1_000_000;
    l.markProduced(t0);
    expect(l.isShorn(t0)).toBe(true);
    expect(l.isShorn(t0 + COOLDOWN / 2)).toBe(true);
    expect(l.isShorn(t0 + COOLDOWN)).toBe(false);
  });

  it('persists the shear timestamp across save/load (regrowth survives a reload)', () => {
    const l = new Llama();
    const t0 = 1_000_000;
    l.markProduced(t0);
    const json = l.toJSON();
    expect(json.lastProducedAt).toBe(t0);
    const reloaded = new Llama(json);
    expect(reloaded.lastProducedAt).toBe(t0);
    expect(reloaded.canProduce(t0 + COOLDOWN - 1)).toBe(false);
    expect(reloaded.canProduce(t0 + COOLDOWN)).toBe(true);
  });
});

describe('Llama — appearance variant (#268)', () => {
  it('round-trips the variant (llama | alpaca) through save/load', () => {
    const alpaca = new Llama({ variant: 'alpaca', coat: 1 });
    expect(alpaca.variant).toBe('alpaca');
    const reloaded = new Llama(alpaca.toJSON());
    expect(reloaded.variant).toBe('alpaca');
  });

  it('omits the variant field when unset (defaults to the llama silhouette in art)', () => {
    const l = new Llama();
    expect(l.variant).toBe(null);
    expect(l.toJSON()).not.toHaveProperty('variant');
  });
});
