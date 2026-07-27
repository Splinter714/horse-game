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
    // Enumeration half of the Storage API — resetAllSaveData (#351) scans by prefix.
    get length() { return store.size; },
    key: (i) => [...store.keys()][i] ?? null,
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

  it('gives every horse a sex, with both sexes represented in the herd (#113)', () => {
    const all = save.loadAllHorses();
    const sexes = Object.values(all).map((h) => h.sex);
    expect(sexes.every((s) => s === 'female' || s === 'male')).toBe(true);
    expect(sexes).toContain('female');
    expect(sexes).toContain('male');
    expect(all.horse7.sex).toBe('male'); // Ebony the Friesian (male)
  });
});

describe('loadAllHorses (sex migration, #113)', () => {
  it('backfills sex from the roster for an older save that predates it', () => {
    // A v2 save written before `sex` existed: no sex field on the entry.
    globalThis.localStorage.setItem(HORSES_KEY, JSON.stringify({
      horse3: { id: 'horse-3', name: 'Ash', coat: 'dappleGrey',
        stats: { hunger: 80, thirst: 80, grooming: 80, happiness: 80 }, lastSeen: Date.now() },
    }));
    const all = save.loadAllHorses();
    expect(all.horse3.sex).toBe('male'); // inherited from the roster default
    expect(all.horse3.name).toBe('Ash');  // saved identity still wins
  });

  it('persists sex through a save/reload round-trip', () => {
    const all = save.loadAllHorses();
    save.saveAllHorses(all);
    const raw = JSON.parse(globalThis.localStorage.getItem(HORSES_KEY));
    expect(raw.horse.sex).toBe('female');
    const reloaded = save.loadAllHorses();
    expect(reloaded.horse7.sex).toBe('male');
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
    expect(all.horse.stats.grooming).toBe(100); // grooming is action-only — never decays offline (#123)
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

  it('marks every chicken a hen (female) (#113)', () => {
    const all = save.loadAllChickens();
    expect(Object.values(all).every((c) => c.sex === 'female')).toBe(true);
  });
});

describe('game state (hotbar / carriers)', () => {
  it('returns grouped-carrier defaults when nothing is stored (#75)', () => {
    const gs = save.loadGameState();
    expect(gs.hotbar).toContain('basketGroup');
    expect(gs.hotbar).toContain('bucketGroup');
    expect(gs.hotbar).not.toContain('basket1');           // members are grouped now
    expect(gs.carriers.basket1).toEqual({ content: null, count: 0 }); // storage unchanged
    expect(gs.activeCarrier).toEqual({ basket: 'basket1', bucket: 'bucket1' });
  });

  it('defaults to the trimmed hotbar (2 carriers + brush/saddle/lead/scooper/shears, #118/#232/#254)', () => {
    const gs = save.loadGameState();
    expect(gs.hotbar).toEqual(['basketGroup', 'bucketGroup', 'brush', 'saddle', 'lead', 'scooper', 'shears']);
  });

  it('trims an older over-long grouped save down to the current slot count (#118)', () => {
    globalThis.localStorage.setItem(GAME_STATE_KEY, JSON.stringify({
      hotbar: ['basketGroup', 'bucketGroup', 'brush', 'saddle', 'lead', 'scooper', 'shears', '', '', ''],
      inventory: {}, carriers: {},
    }));
    const gs = save.loadGameState();
    expect(gs.hotbar).toEqual(['basketGroup', 'bucketGroup', 'brush', 'saddle', 'lead', 'scooper', 'shears']);
  });

  it('appends a newly-added default tool (scooper #232, shears #254) to an older grouped save that predates it', () => {
    // A save written before the scooper/shears existed had five grouped slots; loading
    // it should surface the new tools without disturbing the player's arrangement.
    globalThis.localStorage.setItem(GAME_STATE_KEY, JSON.stringify({
      hotbar: ['basketGroup', 'bucketGroup', 'brush', 'saddle', 'lead'],
      inventory: {}, carriers: {},
    }));
    const gs = save.loadGameState();
    expect(gs.hotbar).toEqual(['basketGroup', 'bucketGroup', 'brush', 'saddle', 'lead', 'scooper', 'shears']);
  });

  it('round-trips a saved game state including the active group members (#75)', () => {
    save.saveGameState({
      hotbar: ['basketGroup', 'bucketGroup', 'brush', 'saddle', 'lead', '', '', '', '', ''],
      inventory: {},
      carriers: { basket2: { content: 'hay', count: 3 } },
      activeCarrier: { basket: 'basket2', bucket: 'bucket3' },
    });
    const gs = save.loadGameState();
    expect(gs.carriers.basket2).toEqual({ content: 'hay', count: 3 });
    expect(gs.activeCarrier).toEqual({ basket: 'basket2', bucket: 'bucket3' });
  });

  it('migrates a pre-grouping per-carrier hotbar to the grouped default (#75)', () => {
    globalThis.localStorage.setItem(GAME_STATE_KEY, JSON.stringify({
      hotbar: ['basket1', 'basket2', 'basket3', 'bucket1', 'bucket2', 'bucket3', 'brush', 'saddle', 'lead', ''],
      inventory: {}, carriers: { basket1: { content: 'apple', count: 2 } },
    }));
    const gs = save.loadGameState();
    expect(gs.hotbar).toContain('basketGroup');
    expect(gs.hotbar).not.toContain('basket1');
    // Member contents survive the migration; only the layout changes.
    expect(gs.carriers.basket1).toEqual({ content: 'apple', count: 2 });
    expect(gs.activeCarrier).toEqual({ basket: 'basket1', bucket: 'bucket1' });
  });

  it('discards a stale discrete-item hotbar for the grouped default layout', () => {
    globalThis.localStorage.setItem(GAME_STATE_KEY, JSON.stringify({
      hotbar: ['hay', 'apple', 'carrot', 'water', 'brush'], inventory: {}, carriers: {},
    }));
    const gs = save.loadGameState();
    expect(gs.hotbar).toContain('basketGroup');
  });
});

describe('money persistence (#29)', () => {
  it('seeds the starting stake on a fresh save', () => {
    const gs = save.loadGameState();
    expect(gs.money).toBe(save.DEFAULT_MONEY);
    expect(gs.money).toBeGreaterThan(0);
  });

  it('round-trips a saved balance', () => {
    save.saveGameState({
      hotbar: ['basketGroup', 'bucketGroup', 'brush', 'saddle', 'lead'],
      inventory: {}, carriers: {}, activeCarrier: {}, money: 137,
    });
    expect(save.loadGameState().money).toBe(137);
  });

  it('seeds the starting stake for an older save with no money field', () => {
    globalThis.localStorage.setItem(GAME_STATE_KEY, JSON.stringify({
      hotbar: ['basketGroup', 'bucketGroup', 'brush', 'saddle', 'lead'],
      inventory: {}, carriers: {},
    }));
    expect(save.loadGameState().money).toBe(save.DEFAULT_MONEY);
  });

  it('preserves a legitimately-zero balance (broke, not missing)', () => {
    save.saveGameState({
      hotbar: [], inventory: {}, carriers: {}, activeCarrier: {}, money: 0,
    });
    expect(save.loadGameState().money).toBe(0);
  });

  it('sanitizes a negative or corrupt balance back to the starting stake', () => {
    globalThis.localStorage.setItem(GAME_STATE_KEY, JSON.stringify({
      hotbar: ['basketGroup', 'bucketGroup', 'brush', 'saddle', 'lead'],
      inventory: {}, carriers: {}, money: -50,
    }));
    expect(save.loadGameState().money).toBe(save.DEFAULT_MONEY);
    globalThis.localStorage.setItem(GAME_STATE_KEY, JSON.stringify({
      hotbar: ['basketGroup', 'bucketGroup', 'brush', 'saddle', 'lead'],
      inventory: {}, carriers: {}, money: 'lots',
    }));
    expect(save.loadGameState().money).toBe(save.DEFAULT_MONEY);
  });

  it('floors a fractional saved balance to a whole coin', () => {
    save.saveGameState({
      hotbar: [], inventory: {}, carriers: {}, activeCarrier: {}, money: 42.9,
    });
    expect(save.loadGameState().money).toBe(42);
  });
});

describe('compost + scooper load persistence (#232)', () => {
  it('defaults both to 0 on a fresh save', () => {
    const gs = save.loadGameState();
    expect(gs.scooperLoad).toBe(0);
    expect(gs.compost).toBe(0);
  });

  it('round-trips a saved scooper load and compost store', () => {
    save.saveGameState({
      hotbar: [], inventory: {}, carriers: {}, activeCarrier: {}, money: 0,
      scooperLoad: 4, compost: 12,
    });
    const gs = save.loadGameState();
    expect(gs.scooperLoad).toBe(4);
    expect(gs.compost).toBe(12);
  });

  it('defaults both to 0 for an older save that predates the feature', () => {
    globalThis.localStorage.setItem(GAME_STATE_KEY, JSON.stringify({
      hotbar: ['basketGroup', 'bucketGroup', 'brush', 'saddle', 'lead'],
      inventory: {}, carriers: {}, money: 20,
    }));
    const gs = save.loadGameState();
    expect(gs.scooperLoad).toBe(0);
    expect(gs.compost).toBe(0);
  });

  it('sanitizes negative / corrupt / fractional counts', () => {
    save.saveGameState({
      hotbar: [], inventory: {}, carriers: {}, activeCarrier: {}, money: 0,
      scooperLoad: -3, compost: 8.7,
    });
    const gs = save.loadGameState();
    expect(gs.scooperLoad).toBe(0);  // negative → 0
    expect(gs.compost).toBe(8);      // floored
  });
});

describe('shears wool-load persistence (#254)', () => {
  it('defaults to 0 on a fresh save and for a save that predates the feature', () => {
    expect(save.loadGameState().shearsLoad).toBe(0);
    globalThis.localStorage.setItem(GAME_STATE_KEY, JSON.stringify({
      hotbar: ['basketGroup', 'bucketGroup', 'brush', 'saddle', 'lead'],
      inventory: {}, carriers: {}, money: 20,
    }));
    expect(save.loadGameState().shearsLoad).toBe(0);
  });

  it('round-trips a saved shears wool load, sanitizing corrupt values', () => {
    save.saveGameState({
      hotbar: [], inventory: {}, carriers: {}, activeCarrier: {}, money: 0,
      scooperLoad: 0, compost: 0, shearsLoad: 5,
    });
    expect(save.loadGameState().shearsLoad).toBe(5);
    save.saveGameState({
      hotbar: [], inventory: {}, carriers: {}, activeCarrier: {}, money: 0,
      scooperLoad: 0, compost: 0, shearsLoad: -2,
    });
    expect(save.loadGameState().shearsLoad).toBe(0); // negative → 0
  });
});

describe('tool upgrades persistence (#295)', () => {
  it('defaults to an empty array on a fresh save and for a save predating the feature', () => {
    expect(save.loadGameState().toolUpgrades).toEqual([]);
    globalThis.localStorage.setItem(GAME_STATE_KEY, JSON.stringify({
      hotbar: ['basketGroup', 'bucketGroup', 'brush', 'saddle', 'lead'],
      inventory: {}, carriers: {}, money: 20,
    }));
    expect(save.loadGameState().toolUpgrades).toEqual([]);
  });

  it('round-trips a purchased upgrade id', () => {
    save.saveGameState({
      hotbar: [], inventory: {}, carriers: {}, activeCarrier: {}, money: 0,
      toolUpgrades: ['scooperCapacity1'],
    });
    expect(save.loadGameState().toolUpgrades).toEqual(['scooperCapacity1']);
  });

  it('drops unknown/stale ids and de-duplicates', () => {
    save.saveGameState({
      hotbar: [], inventory: {}, carriers: {}, activeCarrier: {}, money: 0,
      toolUpgrades: ['scooperCapacity1', 'scooperCapacity1', 'notARealUpgrade'],
    });
    expect(save.loadGameState().toolUpgrades).toEqual(['scooperCapacity1']);
  });

  it('tolerates non-array/corrupt data (defaults to empty)', () => {
    globalThis.localStorage.setItem(GAME_STATE_KEY, JSON.stringify({
      hotbar: [], inventory: {}, carriers: {}, money: 20, toolUpgrades: 'nope',
    }));
    expect(save.loadGameState().toolUpgrades).toEqual([]);
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

describe('player look persistence (#44)', () => {
  it('returns {} when nothing is stored (defaults are filled by lookFromKeys)', () => {
    expect(save.loadPlayerLook()).toEqual({});
  });

  it('round-trips a saved key map', () => {
    save.savePlayerLook({ hair: 'black', bottom: 'skirt', sleeves: 'none' });
    expect(save.loadPlayerLook()).toEqual({ hair: 'black', bottom: 'skirt', sleeves: 'none' });
  });

  it('tolerates corrupt JSON, returning {}', () => {
    globalThis.localStorage.setItem('horse-game-player-v1', '{not json');
    expect(save.loadPlayerLook()).toEqual({});
  });
});

describe('resetAllSaveData (#351 — Reset Save)', () => {
  it('clears every horse-game-* and horse-care-* key', () => {
    // One key from each family the game writes, plus a couple of animal rosters.
    save.saveGameState({ money: 500 });
    save.saveAllHorses(save.loadAllHorses());
    save.saveAllChickens(save.loadAllChickens());
    save.saveDevSettings({ startPhase: 'Night' });
    save.saveUiSettings({ showPrompts: false });
    save.savePlayerLook({ hair: 'black' });
    save.savePairBonds([['horse', 'horse2']]);
    save.saveGestations([{ mare: 'horse' }]);
    globalThis.localStorage.setItem('horse-care-save-v1', '{}');   // legacy roster
    globalThis.localStorage.setItem('horse-game-barn-v1', '{}');   // written outside save.js
    globalThis.localStorage.setItem('horse-game-store-inventory-v1', '{}');

    const before = globalThis.localStorage.length;
    expect(before).toBeGreaterThan(8);

    const removed = save.resetAllSaveData();
    expect(removed.length).toBe(before);
    expect(globalThis.localStorage.length).toBe(0);
    expect(save.hasSave()).toBe(false);
    expect(save.loadGameState().money).not.toBe(500);
  });

  it('leaves keys belonging to other apps alone', () => {
    globalThis.localStorage.setItem('some-other-app', 'keep me');
    save.saveGameState({ money: 12 });
    save.resetAllSaveData();
    expect(globalThis.localStorage.getItem('some-other-app')).toBe('keep me');
  });

  it('covers every storage key the game actually writes', () => {
    // Guard: if a new feature adds a key with a different prefix, this fails loudly
    // rather than the wipe quietly leaving part of the save behind.
    save.saveGameState({ money: 1 });
    save.saveAllHorses(save.loadAllHorses());
    save.saveDevSettings({ startPhase: 'Night' });
    for (let i = 0; i < globalThis.localStorage.length; i++) {
      const k = globalThis.localStorage.key(i);
      expect(save.SAVE_KEY_PREFIXES.some((p) => k.startsWith(p))).toBe(true);
    }
  });
});
