import { describe, it, expect } from 'vitest';
import { Sheep } from './model.js';
import { SHEEP } from './index.js';

// Shearing (#233): unlike the cow's once-a-DAY milk gated on daily care, wool is on
// a REGROWTH TIMER (produces.mode === 'cooldown'). These cover the generic cooldown
// produce path on the Animal model as exercised by the sheep.

const COOLDOWN = SHEEP.produces.cooldownMs;

describe('Sheep — shearing / wool produce (#233)', () => {
  it('declares a cooldown-mode wool produce sheared into a basket', () => {
    expect(SHEEP.produces.content).toBe('wool');
    expect(SHEEP.produces.mode).toBe('cooldown');
    expect(SHEEP.produces.carrier).toBe('basket');
    expect(SHEEP.produces.cooldownMs).toBeGreaterThan(0);
  });

  it('is shearable at the start (readyAtStart) and not yet shorn', () => {
    const s = new Sheep();
    const t0 = 1_000_000;
    expect(s.canProduce(t0)).toBe(true);   // fresh sheep can be sheared right away
    expect(s.isShorn(t0)).toBe(false);     // full fleece to begin with
    expect(s.lastProducedAt).toBe(0);      // never sheared → no timestamp
  });

  it('cannot be re-sheared until the regrowth timer elapses, then can again', () => {
    const s = new Sheep();
    const t0 = 1_000_000;
    s.markProduced(t0);                     // shear now

    expect(s.canProduce(t0)).toBe(false);               // just sheared → not ready
    expect(s.canProduce(t0 + COOLDOWN - 1)).toBe(false); // still regrowing
    expect(s.canProduce(t0 + COOLDOWN)).toBe(true);      // fully regrown → ready again
  });

  it('looks shorn only while the fleece is regrowing', () => {
    const s = new Sheep();
    const t0 = 1_000_000;
    s.markProduced(t0);

    expect(s.isShorn(t0)).toBe(true);                    // freshly shorn
    expect(s.isShorn(t0 + COOLDOWN / 2)).toBe(true);     // half regrown → still shorn
    expect(s.isShorn(t0 + COOLDOWN)).toBe(false);        // regrown → full fleece again
  });

  it('reports regrowth progress from 0 (just shorn) to 1 (regrown)', () => {
    const s = new Sheep();
    const t0 = 1_000_000;
    s.markProduced(t0);
    expect(s.regrowthProgress(t0)).toBe(0);
    expect(s.regrowthProgress(t0 + COOLDOWN / 2)).toBeCloseTo(0.5, 5);
    expect(s.regrowthProgress(t0 + COOLDOWN * 2)).toBe(1); // clamped at fully grown
  });

  it('persists the shear timestamp across save/load (regrowth survives a reload)', () => {
    const s = new Sheep();
    const t0 = 1_000_000;
    s.markProduced(t0);

    const json = s.toJSON();
    expect(json.lastProducedAt).toBe(t0);
    // Daily-produce fields are not used in cooldown mode.
    expect(json.producedToday).toBeUndefined();
    expect(json.readyToProduce).toBeUndefined();

    const reloaded = new Sheep(json);
    expect(reloaded.lastProducedAt).toBe(t0);
    expect(reloaded.canProduce(t0 + COOLDOWN - 1)).toBe(false); // still counting down
    expect(reloaded.canProduce(t0 + COOLDOWN)).toBe(true);
    expect(reloaded.isShorn(t0 + 1)).toBe(true);                // reloads visibly shorn
  });

  it('regrowth is independent of the daily-care cycle (rollNewDay leaves it alone)', () => {
    const s = new Sheep();
    const t0 = 1_000_000;
    s.markProduced(t0);
    s.rollNewDay();                          // a day passes — should NOT reset the timer
    expect(s.lastProducedAt).toBe(t0);       // shear clock untouched by the day roll
    expect(s.canProduce(t0 + COOLDOWN)).toBe(true);
  });
});
