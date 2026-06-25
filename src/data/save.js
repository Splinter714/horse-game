// localStorage persistence. Saves every horse and applies gentle offline decay on
// load so the herd "missed you" without being punished.

import { Horse, EBONY_BASE_STATS } from './species/horse/model.js';
import { Chicken } from './species/chicken/model.js';
import { Cow } from './species/cow/model.js';

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

// ── Chickens ─────────────────────────────────────────────────────────────────

// Chickens persist too (identity only for now). Keyed by registry key like horses.
const CHICKENS_KEY = 'horse-care-chickens-v1';

function defaultChickenRoster() {
  return {
    // All hens (they lay the eggs) — so sex is uniform here on purpose.
    chicken0: { id: 'chicken-1', name: 'Daisy',  coat: 0, personality: 'friendly',    sex: 'female' },
    chicken1: { id: 'chicken-2', name: 'Ruby',   coat: 1, personality: 'broody',      sex: 'female' },
    chicken2: { id: 'chicken-3', name: 'Shadow', coat: 2, personality: 'adventurous', sex: 'female' },
    chicken3: { id: 'chicken-4', name: 'Sunny',  coat: 3, personality: 'cheerful',    sex: 'female' },
    chicken4: { id: 'chicken-5', name: 'Pearl',  coat: 4, personality: 'calm',        sex: 'female' },
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
    // Merge roster defaults under saved data so older saves inherit any newly
    // added identity field (e.g. `sex`, #113) while saved values still win.
    allChickens[key] = new Chicken({ ...roster[key], ...saved[key] });
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

// ── Cows ─────────────────────────────────────────────────────────────────────

// Cows persist like horses (full stats + daily-care + milk readiness). One cow for
// now, keyed `cow`. Nameless to start (the model still carries `name`, so she can
// be named later). Offline decay is applied on load, forgiving like the herd.
// v2: the cow became milkable-at-start (readyAtStart) and a grazer; re-seed so an
// early v1 cow (saved readyToProduce:false) starts fresh with the new defaults.
const COWS_KEY = 'horse-care-cows-v2';

function defaultCowRoster() {
  return {
    cow: { id: 'cow-1', name: '', breed: 'Holstein', coat: 0, age: 4, sex: 'female' },
  };
}

export function loadAllCows() {
  const roster = defaultCowRoster();
  let saved = {};
  try {
    const raw = localStorage.getItem(COWS_KEY);
    if (raw) saved = JSON.parse(raw) ?? {};
  } catch (e) {
    // localStorage blocked or corrupt — fall through to defaults.
  }
  const allCows = {};
  for (const key of Object.keys(roster)) {
    const cow = new Cow({ ...roster[key], ...saved[key] });
    const elapsedSeconds = Math.max(0, (Date.now() - cow.lastSeen) / 1000);
    if (elapsedSeconds > 1) cow.applyDecay(elapsedSeconds, true);
    cow.lastSeen = Date.now();
    allCows[key] = cow;
  }
  saveAllCows(allCows); // seed immediately
  return allCows;
}

export function saveAllCows(allCows) {
  const now = Date.now();
  const out = {};
  for (const key of Object.keys(allCows)) {
    allCows[key].lastSeen = now;
    out[key] = allCows[key].toJSON();
  }
  try {
    localStorage.setItem(COWS_KEY, JSON.stringify(out));
  } catch (e) {
    // Saving unavailable — ignore.
  }
}

// ── Game state (hotbar + inventory) ──────────────────────────────────────────

const GAME_STATE_KEY = 'horse-game-state-v1';

// Grouped carrier hotbar (#75), trimmed to just the slots we use (#118): the
// baskets collapse into one "Basket" slot and the buckets into one "Bucket" slot
// (each a fly-out picker), plus the three tools. Five slots, keys 1–5. Add more as
// new tools/items arrive. No "hand" slot — interacting is the universal default.
const DEFAULT_HOTBAR = ['basketGroup', 'bucketGroup', 'brush', 'saddle', 'lead'];

// Which member of each carrier group is currently active in its grouped slot.
function defaultActiveCarrier() {
  return { basket: 'basket1', bucket: 'bucket1' };
}

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
    basket4: { content: null, count: 0 },
    bucket1: { content: null, count: 0 },
    bucket2: { content: null, count: 0 },
    bucket3: { content: null, count: 0 },
    bucket4: { content: null, count: 0 },
  };
}

export function loadGameState() {
  const fresh = () => ({
    hotbar: [...DEFAULT_HOTBAR], inventory: defaultInventory(),
    carriers: defaultCarriers(), activeCarrier: defaultActiveCarrier(),
  });
  try {
    const raw = localStorage.getItem(GAME_STATE_KEY);
    if (!raw) return fresh();
    const data = JSON.parse(raw);
    // Migrate any pre-grouping layout to the new grouped default (#75): the old
    // per-carrier hotbar (individual basket1…/bucket1… keys), the pre-carrier
    // discrete-item hotbar, or any layout still carrying the retired "hand" tool.
    // A layout that already uses the group keys is kept as the player left it.
    const saved = Array.isArray(data.hotbar) ? data.hotbar : [];
    // Keep a grouped layout as-is, else fall to the default; then trim to the
    // current slot count so older 10-slot saves collapse to 5 (#118).
    const hotbar = (saved.includes('basketGroup') ? saved : [...DEFAULT_HOTBAR]).slice(0, DEFAULT_HOTBAR.length);
    return {
      hotbar,
      inventory:     { ...defaultInventory(),     ...(data.inventory ?? {}) },
      carriers:      { ...defaultCarriers(),      ...(data.carriers ?? {}) },
      activeCarrier: { ...defaultActiveCarrier(), ...(data.activeCarrier ?? {}) },
    };
  } catch {
    return fresh();
  }
}

export function saveGameState({ hotbar, inventory, carriers, activeCarrier }) {
  try {
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify({ hotbar, inventory, carriers, activeCarrier }));
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
    // Merge roster defaults under saved data so older saves inherit any newly
    // added identity field (e.g. `sex`, #113) while saved values still win.
    const data = { ...roster[key], ...saved[key] };
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

// ── Audio settings (mute + per-bus volumes) ──────────────────────────────────

const AUDIO_KEY = 'horse-game-audio-v1';

// On the dev server, default music off (it's distracting while iterating); the
// production build still defaults music on. Only the *default* changes — a saved
// setting always wins, so toggling music in dev sticks.
const DEFAULT_MUSIC = import.meta.env?.MODE === 'development' ? 0 : 1;

const DEFAULT_AUDIO = { muted: false, volumes: { master: 1, music: DEFAULT_MUSIC, ambient: 1, effects: 1 } };

export function loadAudioSettings() {
  try {
    const raw = localStorage.getItem(AUDIO_KEY);
    if (!raw) return { muted: DEFAULT_AUDIO.muted, volumes: { ...DEFAULT_AUDIO.volumes } };
    const data = JSON.parse(raw) ?? {};
    return {
      muted: typeof data.muted === 'boolean' ? data.muted : DEFAULT_AUDIO.muted,
      volumes: { ...DEFAULT_AUDIO.volumes, ...(data.volumes ?? {}) },
    };
  } catch {
    return { muted: DEFAULT_AUDIO.muted, volumes: { ...DEFAULT_AUDIO.volumes } };
  }
}

export function saveAudioSettings(settings) {
  try {
    localStorage.setItem(AUDIO_KEY, JSON.stringify(settings));
  } catch {}
}

// ── UI settings (control-prompt visibility, …) ───────────────────────────────

const UI_KEY = 'horse-game-ui-v1';

const DEFAULT_UI = { showPrompts: true };

export function loadUiSettings() {
  try {
    const raw = localStorage.getItem(UI_KEY);
    if (!raw) return { ...DEFAULT_UI };
    const data = JSON.parse(raw) ?? {};
    return {
      showPrompts: typeof data.showPrompts === 'boolean' ? data.showPrompts : DEFAULT_UI.showPrompts,
    };
  } catch {
    return { ...DEFAULT_UI };
  }
}

export function saveUiSettings(settings) {
  try {
    localStorage.setItem(UI_KEY, JSON.stringify(settings));
  } catch {}
}

// ── Dev settings (pause-menu dev tools) ──────────────────────────────────────
// Persisted "start state" knobs so the owner can test things without replaying
// from scratch: which time-of-day the day/night clock boots into, and whether
// the appearance editor auto-opens on a chosen horse. TEMP testing scaffolding —
// applied on the next reload. Remove with the rest of the dev tools before a real
// release.
const DEV_KEY = 'horse-game-dev-v1';

const DEFAULT_DEV = { startPhase: null, startEditor: null, startLocation: null };

export function loadDevSettings() {
  try {
    const raw = localStorage.getItem(DEV_KEY);
    if (!raw) return { ...DEFAULT_DEV };
    const data = JSON.parse(raw) ?? {};
    return {
      startPhase:    typeof data.startPhase    === 'string' ? data.startPhase    : DEFAULT_DEV.startPhase,
      startEditor:   typeof data.startEditor   === 'string' ? data.startEditor   : DEFAULT_DEV.startEditor,
      startLocation: typeof data.startLocation === 'string' ? data.startLocation : DEFAULT_DEV.startLocation,
    };
  } catch {
    return { ...DEFAULT_DEV };
  }
}

// Merge-on-write so callers can flip one knob without clobbering the other.
export function saveDevSettings(patch) {
  try {
    const next = { ...loadDevSettings(), ...patch };
    localStorage.setItem(DEV_KEY, JSON.stringify(next));
  } catch {}
}

// TEMP dev tool: wipe the saved herd so the next load re-seeds the defaults.
// Caller should reload the page afterward. Remove with the dev-tools UI later.
export function resetAllHorses() {
  try {
    localStorage.removeItem(HORSES_KEY);
    localStorage.removeItem(LEGACY_KEY);
  } catch (e) {
    // localStorage unavailable — nothing to clear.
  }
}

export function hasSave() {
  try {
    return !!(localStorage.getItem(HORSES_KEY) || localStorage.getItem(LEGACY_KEY));
  } catch (e) {
    return false;
  }
}
