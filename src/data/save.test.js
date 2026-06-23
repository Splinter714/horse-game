// Characterization tests for localStorage persistence: default roster, offline
// decay on load, legacy single-horse migration, and game-state round-trip.
//
// save.js reads `localStorage` lazily (inside the functions), so a simple
// in-memory global stub installed before each test is sufficient — no jsdom.

import { describe, it, expect, beforeEach } from 'vitest';

function makeLocalStorageStub() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

const HORSES_KEY = 'horse-care-save-v2';
const LEGACY_KEY = 'horse-care-save-v1';
const GAME_STATE_KEY = 'horse-game-state-v1';

let save;
beforeEach(async () => {
  globalThis.localStorage = makeLocalStorageStub();
  // Fresh import each test so there's no shared module state to leak.
  save = await import('./save.js');
});

describe('loadAllHorses (defaults)', () => {
  it('returns the full 7-horse roster as Horse instances', () => {
    const all = save.loadAllHorses();
    expect(Object.keys(all)).toEqual(['horse', 'horse2', 'horse3', 'horse4', 'horse5', 'horse6', 'horse7']);
    expect(all.horse.name).toBe('Buttercup');
    expect(all.horse7.name).toBe('Ebony');
    expect(typeof all.horse.applyDecay).toBe('function'); // real Horse, not plain object
  });

  it('gives Ebony her fixed attributes', () => {
    const all = save.loadAllHorses();
    expect(all.horse7.health).toBe(95);
    expect(all.horse7.speed).toBe(80);
    expect(all.horse7.stamina).toBe(70);
  });

  it('seeds the v2 save immediately on first load', () => {
    expect(globalThis.localStorage.getItem(HORSES_KEY)).toBeNull();
    save.loadAllHorses();
    expect(globalThis.localStorage.getItem(HORSES_KEY)).not.toBeNull();
  });
});

describe('loadAllHorses (offline decay)', () => {
  it('applies the forgiving floor for a long absence', () => {
    const longAgo = Date.now() - 1000 * 60 * 60 * 24 * 30; // 30 days
    globalThis.localStorage.setItem(HORSES_KEY, JSON.stringify({
      horse: { id: 'horse-1', name: 'Buttercup', coat: 'palomino',
        stats: { hunger: 100, thirst: 100, grooming: 100, happiness: 100 }, lastSeen: longAgo },
    }));
    const all = save.loadAllHorses();
    expect(all.horse.stats.hunger).toBe(30);
    expect(all.horse.stats.thirst).toBe(30);
    expect(all.horse.stats.grooming).toBe(30);
  });

  it('refreshes lastSeen to now on load', () => {
    const before = Date.now();
    const all = save.loadAllHorses();
    expect(all.horse.lastSeen).toBeGreaterThanOrEqual(before);
  });
});

describe('loadAllHorses (legacy migration)', () => {
  it('migrates a legacy single-horse save into the horse slot', () => {
    globalThis.localStorage.setItem(LEGACY_KEY, JSON.stringify({
      id: 'legacy', name: 'OldFriend', coat: 'bay', stats: { hunger: 70, thirst: 70, grooming: 70, happiness: 70 },
      lastSeen: Date.now(),
    }));
    const all = save.loadAllHorses();
    expect(all.horse.name).toBe('OldFriend');
  });

  it('does not migrate legacy when a v2 horse slot already exists', () => {
    globalThis.localStorage.setItem(HORSES_KEY, JSON.stringify({
      horse: { id: 'horse-1', name: 'Current', coat: 'palomino', lastSeen: Date.now() },
    }));
    globalThis.localStorage.setItem(LEGACY_KEY, JSON.stringify({ name: 'OldFriend', lastSeen: Date.now() }));
    const all = save.loadAllHorses();
    expect(all.horse.name).toBe('Current');
  });
});

describe('saveAllHorses / hasSave', () => {
  it('persists toJSON output and stamps lastSeen', () => {
    const all = save.loadAllHorses();
    all.horse.feed();
    save.saveAllHorses(all);
    const raw = JSON.parse(globalThis.localStorage.getItem(HORSES_KEY));
    expect(raw.horse.stats.hunger).toBe(all.horse.stats.hunger);
    expect(raw.horse).not.toHaveProperty('caredToday'); // runtime-only field excluded
  });

  it('hasSave reflects presence of a save', () => {
    expect(save.hasSave()).toBe(false);
    save.loadAllHorses(); // seeds v2
    expect(save.hasSave()).toBe(true);
  });
});

describe('loadAllChickens / saveAllChickens', () => {
  it('returns the 5-chicken flock as Chicken instances with appearance', () => {
    const all = save.loadAllChickens();
    expect(Object.keys(all)).toEqual(['chicken0', 'chicken1', 'chicken2', 'chicken3', 'chicken4']);
    expect(all.chicken0.name).toBe('Daisy');
    expect(all.chicken0.coat).toBe(0);
    expect(all.chicken4.coat).toBe(4);
    expect(all.chicken0.species).toBe('chicken');
  });

  it('persists and reloads chicken identity', () => {
    const all = save.loadAllChickens();
    all.chicken0.name = 'Renamed';
    save.saveAllChickens(all);
    const reloaded = save.loadAllChickens();
    expect(reloaded.chicken0.name).toBe('Renamed');
  });
});

describe('game state (hotbar / carriers)', () => {
  it('returns carrier-layout defaults when nothing is stored', () => {
    const gs = save.loadGameState();
    expect(gs.hotbar).toContain('basket1');
    expect(gs.carriers.basket1).toEqual({ content: null, count: 0 });
  });

  it('round-trips a saved game state', () => {
    save.saveGameState({
      hotbar: ['hand', 'basket1', 'basket2', 'basket3', 'bucket1', 'bucket2', 'brush', 'saddle', 'lead', ''],
      inventory: {},
      carriers: { basket1: { content: 'hay', count: 3 } },
    });
    const gs = save.loadGameState();
    expect(gs.carriers.basket1).toEqual({ content: 'hay', count: 3 });
  });

  it('discards a stale discrete-item hotbar (no basket1) for the default layout', () => {
    globalThis.localStorage.setItem(GAME_STATE_KEY, JSON.stringify({
      hotbar: ['hay', 'apple', 'carrot', 'water', 'brush'], inventory: {}, carriers: {},
    }));
    const gs = save.loadGameState();
    expect(gs.hotbar).toContain('basket1');
  });
});

describe('audio settings', () => {
  it('returns unmuted full-volume defaults when nothing is stored', () => {
    const a = save.loadAudioSettings();
    expect(a.muted).toBe(false);
    expect(a.volumes).toEqual({ master: 1, music: 1, ambient: 1, effects: 1 });
  });

  it('round-trips mute + per-bus volumes', () => {
    save.saveAudioSettings({ muted: true, volumes: { master: 0.5, music: 0, ambient: 0.3, effects: 0.8 } });
    const a = save.loadAudioSettings();
    expect(a.muted).toBe(true);
    expect(a.volumes).toEqual({ master: 0.5, music: 0, ambient: 0.3, effects: 0.8 });
  });

  it('fills missing buses with defaults from a partial save', () => {
    globalThis.localStorage.setItem('horse-game-audio-v1', JSON.stringify({ volumes: { music: 0.2 } }));
    const a = save.loadAudioSettings();
    expect(a.muted).toBe(false);
    expect(a.volumes).toEqual({ master: 1, music: 0.2, ambient: 1, effects: 1 });
  });
});
