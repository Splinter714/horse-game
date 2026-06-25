// Persistence registry — the per-species roster config that the generic save
// factory (save.js `makeRoster`) consumes. This is the ONE place that names a
// concrete model class and its default individuals; save.js stays species-agnostic
// (the C2 import-boundary seam guard enforces that, issue #167). Adding a persisted
// animal is a single entry here, not a new ~50-line loader.
//
// Each entry: { storageKey, registryKey, Model, defaultRoster, offlineDecay, legacy }
//   storageKey   — localStorage key for the saved roster
//   registryKey  — Phaser registry key the world reads (allHorses / allChickens / …)
//   Model        — the species' Animal subclass (constructed per individual)
//   defaultRoster— () => the keyed map of default individuals (fresh-game herd)
//   offlineDecay — apply forgiving decay on load + stamp lastSeen on save (survival
//                  species); identity-only species (chickens) set this false
//   legacy       — optional one-time migration { key, slot } from an older save

import { Horse, EBONY_BASE_STATS } from './species/horse/model.js';
import { Chicken } from './species/chicken/model.js';
import { Cow } from './species/cow/model.js';
import { Pig } from './species/pig/model.js';
import { Cat } from './species/cat/model.js';

// The canonical herd. Every horse is equal — same persistence, same decay. The
// only per-horse differences are data (name, coat, age, spawn) plus Ebony's
// optional fixed attributes. The `horse` slot keeps the old fresh-game default.
function defaultHorseRoster() {
  return {
    horse:  { id: 'horse-1', name: 'Buttercup', breed: 'Palomino', coat: 'palomino', age: 3, temperament: 'calm', sex: 'female' },
    horse2: { id: 'horse-2', name: 'Clover', breed: 'Bay', coat: 'bay', age: 5, temperament: 'needy', sex: 'female',
      stats: { hunger: 90, thirst: 85, grooming: 80, happiness: 92 } },
    horse3: { id: 'horse-3', name: 'Ash', breed: 'Dapple Grey', coat: 'grey', markings: { dapples: true }, age: 7, temperament: 'lazy', sex: 'male',
      stats: { hunger: 78, thirst: 82, grooming: 95, happiness: 88 } },
    horse4: { id: 'horse-4', name: 'Splash', breed: 'Paint', coat: 'chestnut', markings: { pinto: true }, age: 4, temperament: 'spirited', sex: 'male',
      stats: { hunger: 85, thirst: 80, grooming: 70, happiness: 90 } },
    horse5: { id: 'horse-5', name: 'Ember', breed: 'Chestnut', coat: 'chestnut', age: 6, temperament: 'spirited', sex: 'female',
      stats: { hunger: 82, thirst: 88, grooming: 75, happiness: 86 } },
    horse6: { id: 'horse-6', name: 'Pearl', breed: 'Cremello', coat: 'cremello', age: 2, temperament: 'shy', sex: 'female',
      stats: { hunger: 88, thirst: 76, grooming: 90, happiness: 94 } },
    horse7: { id: 'horse-friesian-ebony', name: 'Ebony', breed: 'Friesian', coat: 'black', markings: { feather: true }, age: 5, temperament: 'calm', sex: 'male',
      stats: { hunger: 86, thirst: 82, grooming: 88, happiness: 91 },
      health: EBONY_BASE_STATS.health, speed: EBONY_BASE_STATS.speed, stamina: EBONY_BASE_STATS.stamina },
  };
}

// Chickens persist too (identity only for now). Keyed by registry key like horses.
// All hens (they lay the eggs) — so sex is uniform here on purpose.
function defaultChickenRoster() {
  return {
    chicken0: { id: 'chicken-1', name: 'Daisy',  coat: 0, personality: 'friendly',    sex: 'female' },
    chicken1: { id: 'chicken-2', name: 'Ruby',   coat: 1, personality: 'broody',      sex: 'female' },
    chicken2: { id: 'chicken-3', name: 'Shadow', coat: 2, personality: 'adventurous', sex: 'female' },
    chicken3: { id: 'chicken-4', name: 'Sunny',  coat: 3, personality: 'cheerful',    sex: 'female' },
    chicken4: { id: 'chicken-5', name: 'Pearl',  coat: 4, personality: 'calm',        sex: 'female' },
  };
}

// Cows persist like horses (full stats + daily-care + milk readiness). One cow for
// now, keyed `cow`. Nameless to start (the model still carries `name`, so she can
// be named later). Offline decay is applied on load, forgiving like the herd.
function defaultCowRoster() {
  return {
    cow: { id: 'cow-1', name: '', breed: 'Holstein', coat: 0, age: 4, sex: 'female' },
  };
}

// One pig for now, keyed `pig`. Full stats + daily-care like the cow, but no milk —
// she just lives in the pasture and eats the apples/carrots you drop. Offline decay
// applies on load, forgiving like the herd.
function defaultPigRoster() {
  return {
    pig: { id: 'pig-1', name: 'Penny', breed: 'Pink', coat: 0, age: 2, sex: 'female' },
  };
}

// One cat for now, keyed `cat` (matches its texture/sprite key). Identity-only like
// the chicken — no survival needs, so no offline decay — but now persisted so its
// customizer look (and happiness) survive reloads. Was an in-memory model before (#84).
function defaultCatRoster() {
  return {
    cat: { id: 'cat-1', name: 'Mittens', breed: 'Barn Cat', coat: 0, age: 2, sex: 'male' },
  };
}

export const ROSTERS = {
  horse: {
    storageKey: 'horse-care-save-v2',
    registryKey: 'allHorses',
    Model: Horse,
    defaultRoster: defaultHorseRoster,
    offlineDecay: true,
    // One-time migration: an existing player's horse (legacy single-horse save)
    // carries into the `horse` slot so their progress isn't lost.
    legacy: { key: 'horse-care-save-v1', slot: 'horse' },
  },
  chicken: {
    storageKey: 'horse-care-chickens-v1',
    registryKey: 'allChickens',
    Model: Chicken,
    defaultRoster: defaultChickenRoster,
    offlineDecay: false,
    legacy: null,
  },
  cow: {
    // v2: the cow became milkable-at-start (readyAtStart) and a grazer; the v2 key
    // re-seeds so an early v1 cow (saved readyToProduce:false) starts fresh.
    storageKey: 'horse-care-cows-v2',
    registryKey: 'allCows',
    Model: Cow,
    defaultRoster: defaultCowRoster,
    offlineDecay: true,
    legacy: null,
  },
  pig: {
    storageKey: 'horse-care-pigs-v1',
    registryKey: 'allPigs',
    Model: Pig,
    defaultRoster: defaultPigRoster,
    offlineDecay: true,
    legacy: null,
  },
  cat: {
    storageKey: 'horse-care-cats-v1',
    registryKey: 'allCats',
    Model: Cat,
    defaultRoster: defaultCatRoster,
    offlineDecay: false, // identity-only (no survival needs) — don't decay offline
    legacy: null,
  },
};
