// localStorage persistence. Saves every horse and applies gentle offline decay on
// load so the herd "missed you" without being punished.

import { Horse, EBONY_BASE_STATS } from './species/horse/model.js';
import { Chicken } from './species/chicken/model.js';

// Legacy single-horse save (the old "player horse"). Still read once, to migrate
// an existing player's horse into the unified roster below.
const LEGACY_KEY = 'horse-care-save-v1';

// Unified roster save: every horse persists, keyed by its texture/registry key.
const HORSES_KEY = 'horse-care-save-v2';

// The canonical herd. Every horse is equal — same persistence, same decay. The
// only per-horse differences are data (name, coat, age, spawn) plus Ebony's
// optional fixed attributes. The `horse` slot keeps the old fresh-game default.
function defaultHorseRoster() {
  return {
    horse:  { id: 'horse-1', name: 'Buttercup', breed: 'Palomino', coat: 'palomino', age: 3, temperament: 'calm' },
    horse2: { id: 'horse-2', name: 'Clover', breed: 'Bay', coat: 'bay', age: 5, temperament: 'needy',
      stats: { hunger: 90, thirst: 85, grooming: 80, happiness: 92 } },
    horse3: { id: 'horse-3', name: 'Ash', breed: 'Dapple Grey', coat: 'dappleGrey', age: 7, temperament: 'lazy',
      stats: { hunger: 78, thirst: 82, grooming: 95, happiness: 88 } },
    horse4: { id: 'horse-4', name: 'Splash', breed: 'Paint', coat: 'paint', age: 4, temperament: 'spirited',
      stats: { hunger: 85, thirst: 80, grooming: 70, happiness: 90 } },
    horse5: { id: 'horse-5', name: 'Ember', breed: 'Chestnut', coat: 'chestnut', age: 6, temperament: 'spirited',
      stats: { hunger: 82, thirst: 88, grooming: 75, happiness: 86 } },
    horse6: { id: 'horse-6', name: 'Pearl', breed: 'Cremello', coat: 'cremello', age: 2, temperament: 'shy',
      stats: { hunger: 88, thirst: 76, grooming: 90, happiness: 94 } },
    horse7: { id: 'horse-friesian-ebony', name: 'Ebony', breed: 'Friesian', coat: 'friesian', age: 5, temperament: 'calm',
      stats: { hunger: 86, thirst: 82, grooming: 88, happiness: 91 },
      health: EBONY_BASE_STATS.health, speed: EBONY_BASE_STATS.speed, stamina: EBONY_BASE_STATS.stamina },
  };
}

// ── Chickens ─────────────────────────────────────────────────────────────────

// Chickens persist too (identity only for now). Keyed by registry key like horses.
const CHICKENS_KEY = 'horse-care-chickens-v1';

function defaultChickenRoster() {
  return {
    chicken0: { id: 'chicken-1', name: 'Daisy',  coat: 0, personality: 'friendly' },
    chicken1: { id: 'chicken-2', name: 'Ruby',   coat: 1, personality: 'broody' },
    chicken2: { id: 'chicken-3', name: 'Shadow', coat: 2, personality: 'adventurous' },
    chicken3: { id: 'chicken-4', name: 'Sunny',  coat: 3, personality: 'cheerful' },
    chicken4: { id: 'chicken-5', name: 'Pearl',  coat: 4, personality: 'calm' },
  };
}

export function loadAllChickens() {
  const roster = defaultChickenRoster();
  let saved = {};
  try {
    const raw = localStorage.getItem(CHICKENS_KEY);
    if (raw) saved = JSON.parse(raw) ?? {};
  } catch (e) {
    // localStorage blocked or corrupt — fall through to defaults.
  }
  const allChickens = {};
  for (const key of Object.keys(roster)) {
    allChickens[key] = new Chicken(saved[key] ?? roster[key]);
  }
  saveAllChickens(allChickens); // seed immediately
  return allChickens;
}

export function saveAllChickens(allChickens) {
  const out = {};
  for (const key of Object.keys(allChickens)) out[key] = allChickens[key].toJSON();
  try {
    localStorage.setItem(CHICKENS_KEY, JSON.stringify(out));
  } catch (e) {
    // Saving unavailable — ignore.
  }
}

// ── Game state (hotbar + inventory) ──────────────────────────────────────────

const GAME_STATE_KEY = 'horse-game-state-v1';

// Carrier-based hotbar (issue #62): 3 baskets + 2 buckets alongside the tools.
const DEFAULT_HOTBAR = ['hand', 'basket1', 'basket2', 'basket3', 'bucket1', 'bucket2', 'brush', 'saddle', 'lead', ''];

function defaultInventory() {
  // Tools are infinite; carriers track their own contents. Nothing to stock.
  return {};
}

// Each carrier holds one content type at a time: { content, count }. Empty to
// start — the player fills them at gathering sources.
function defaultCarriers() {
  return {
    basket1: { content: null, count: 0 },
    basket2: { content: null, count: 0 },
    basket3: { content: null, count: 0 },
    bucket1: { content: null, count: 0 },
    bucket2: { content: null, count: 0 },
  };
}

export function loadGameState() {
  const fresh = () => ({ hotbar: [...DEFAULT_HOTBAR], inventory: defaultInventory(), carriers: defaultCarriers() });
  try {
    const raw = localStorage.getItem(GAME_STATE_KEY);
    if (!raw) return fresh();
    const data = JSON.parse(raw);
    // Old saves used the discrete-item hotbar; reset to the carrier layout.
    const hotbar = Array.isArray(data.hotbar) && data.hotbar.includes('basket1')
      ? data.hotbar
      : [...DEFAULT_HOTBAR];
    return {
      hotbar,
      inventory: { ...defaultInventory(), ...(data.inventory ?? {}) },
      carriers:  { ...defaultCarriers(),  ...(data.carriers ?? {}) },
    };
  } catch {
    return fresh();
  }
}

export function saveGameState({ hotbar, inventory, carriers }) {
  try {
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify({ hotbar, inventory, carriers }));
  } catch {}
}

// Build the whole herd: saved data where present, defaults otherwise, with gentle
// offline decay applied to each horse so a return after time away is forgiving.
export function loadAllHorses() {
  const roster = defaultHorseRoster();

  let saved = {};
  try {
    const raw = localStorage.getItem(HORSES_KEY);
    if (raw) saved = JSON.parse(raw) ?? {};
  } catch (e) {
    // localStorage blocked or corrupt — fall through to defaults.
  }

  // One-time migration: an existing player's horse (legacy single-horse save)
  // carries into the `horse` slot so their progress isn't lost.
  if (!saved.horse) {
    try {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) saved.horse = JSON.parse(legacy);
    } catch (e) { /* ignore */ }
  }

  const allHorses = {};
  for (const key of Object.keys(roster)) {
    const data = saved[key] ?? roster[key];
    const horse = new Horse(data);
    const elapsedSeconds = Math.max(0, (Date.now() - horse.lastSeen) / 1000);
    if (elapsedSeconds > 1) horse.applyDecay(elapsedSeconds, true);
    horse.lastSeen = Date.now();
    allHorses[key] = horse;
  }

  saveAllHorses(allHorses); // seed v2 immediately
  return allHorses;
}

export function saveAllHorses(allHorses) {
  const now = Date.now();
  const out = {};
  for (const key of Object.keys(allHorses)) {
    const horse = allHorses[key];
    horse.lastSeen = now;
    out[key] = horse.toJSON();
  }
  try {
    localStorage.setItem(HORSES_KEY, JSON.stringify(out));
  } catch (e) {
    // Saving unavailable — ignore; the game still plays this session.
  }
}

export function hasSave() {
  try {
    return !!(localStorage.getItem(HORSES_KEY) || localStorage.getItem(LEGACY_KEY));
  } catch (e) {
    return false;
  }
}
