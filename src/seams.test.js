// Cross-cutting seam guards (issue #167, Phase B). These keep "adding an animal
// touches ~zero shared files" TRUE over time — they test the architecture itself,
// not a proxy like file size. Two kinds:
//   - import-boundary: the shared loaders/orchestrators import only the registry,
//     never a concrete species (static source check; Phaser doesn't load in node).
//   - fixture-species: a synthetic data-only species round-trips through the generic
//     machinery with ZERO changes to shared files — the permanent "add a goat" test.
// More guards (BootScene import-boundary, the care literal-tripwire) are added as
// the B2/B3 generalizations land.

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./', import.meta.url)); // src/
const read = (rel) => readFileSync(root + rel, 'utf8');
const importedPaths = (src) =>
  [...src.matchAll(/^\s*import\s+[^;]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);

describe('C2 import-boundary: shared loaders name no concrete species', () => {
  it('save.js imports rosters via the registry, not concrete model classes', () => {
    const bad = importedPaths(read('data/save.js')).filter((p) => /model(\.js)?$/.test(p));
    expect(bad, 'save.js should import ./rosters.js, not species/*/model.js').toEqual([]);
  });

  it('BootScene builds textures via the art registry, not per-species builders', () => {
    const bad = importedPaths(read('scenes/BootScene.js'))
      .filter((p) => /art\/(horse|chicken|cat|cow|sheep|pig|dog|portrait)Art/.test(p));
    expect(bad, 'BootScene should import art/index.js, not per-species *Art.js').toEqual([]);
  });

  it('BootScene loads rosters via ROSTER_SPECIES, not per-species loaders', () => {
    const bad = (read('scenes/BootScene.js').match(/\bloadAll(Horses|Chickens|Cows)\b/g)) ?? [];
    expect(bad, 'BootScene should iterate ROSTER_SPECIES, not call loadAllHorses/etc.').toEqual([]);
  });
});

describe('C2 fixture-species: a data-only species round-trips through makeRoster', () => {
  // The permanent "add a goat" acid test. A synthetic species — a minimal
  // Animal-shaped model plus a roster of defaults — persists through the generic
  // factory with ZERO changes to save.js. If a seam regresses to hardcoding, the
  // data-only species silently breaks and this fails.
  let makeRoster;
  beforeEach(async () => {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    };
    ({ makeRoster } = await import('./data/save.js'));
  });

  // The minimal contract every species' model satisfies (stats + applyDecay + toJSON
  // + a lastSeen field). No Phaser, no species registry — pure data.
  class FakeGoat {
    constructor(data) { Object.assign(this, { stats: { hunger: 100 } }, data); }
    applyDecay(secs) { this.stats.hunger = Math.max(0, this.stats.hunger - secs); }
    toJSON() { return { id: this.id, name: this.name, stats: this.stats, lastSeen: this.lastSeen }; }
  }
  const goatCfg = () => ({
    storageKey: 'test-goats-v1', Model: FakeGoat, offlineDecay: true,
    defaultRoster: () => ({ goat1: { id: 'goat-1', name: 'Billy' } }),
  });

  it('loads defaults as model instances, seeds the save, and round-trips a change', () => {
    const goats = makeRoster(goatCfg());
    const loaded = goats.load();
    expect(loaded.goat1).toBeInstanceOf(FakeGoat);
    expect(loaded.goat1.name).toBe('Billy');
    expect(globalThis.localStorage.getItem('test-goats-v1')).not.toBeNull(); // seeded on first load
    loaded.goat1.name = 'Gruff';
    goats.save(loaded);
    expect(goats.load().goat1.name).toBe('Gruff'); // survives reload
  });

  it('applies forgiving offline decay + refreshes lastSeen for a survival species', () => {
    globalThis.localStorage.setItem('test-goats-v1', JSON.stringify({
      goat1: { id: 'goat-1', name: 'Billy', stats: { hunger: 100 }, lastSeen: Date.now() - 5000 },
    }));
    const loaded = makeRoster(goatCfg()).load();
    expect(loaded.goat1.stats.hunger).toBeLessThan(100);            // ~5s of decay applied
    expect(loaded.goat1.lastSeen).toBeGreaterThan(Date.now() - 1000); // stamped to now
  });

  it('an identity-only species (offlineDecay:false) neither decays nor needs lastSeen', () => {
    class FakeBird { constructor(d) { Object.assign(this, d); } toJSON() { return { id: this.id, name: this.name }; } }
    const birds = makeRoster({
      storageKey: 'test-birds-v1', Model: FakeBird, offlineDecay: false,
      defaultRoster: () => ({ bird1: { id: 'bird-1', name: 'Pip' } }),
    });
    const loaded = birds.load();
    expect(loaded.bird1.name).toBe('Pip');
    expect(JSON.parse(globalThis.localStorage.getItem('test-birds-v1')).bird1).not.toHaveProperty('lastSeen');
  });
});
