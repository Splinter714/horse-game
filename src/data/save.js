// localStorage persistence. Saves every animal roster and applies gentle offline
// decay on load so the herd "missed you" without being punished.
//
// The per-species roster config (storage keys, model classes, default herds) lives
// in ./rosters.js so THIS file stays species-agnostic — adding a persisted animal is
// a single entry there, not a new ~50-line loader. The C2 import-boundary seam guard
// (src/seams.test.js) checks this file names no concrete model (issue #167).
// `makeRoster` is the generic load/save factory all species share.

import { ROSTERS } from './rosters.js';

// Build a { load, save } pair for one species' roster from its config. Collapses the
// three formerly-duplicated loaders into one generic implementation:
//   load()    — defaults merged UNDER saved data (so older saves inherit new fields),
//               constructed as Model instances, forgiving offline decay applied for
//               survival species, then seeded back immediately.
//   save(all) — toJSON each, stamping lastSeen for survival species, then persisted.
export function makeRoster({ storageKey, Model, defaultRoster, offlineDecay = false, legacy = null }) {
  function readSaved() {
    let saved = {};
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) saved = JSON.parse(raw) ?? {};
    } catch (e) {
      // localStorage blocked or corrupt — fall through to defaults.
    }
    // One-time migration from an older save into a specific slot (e.g. the legacy
    // single-horse save → the `horse` slot), only when that slot isn't set yet.
    if (legacy && !saved[legacy.slot]) {
      try {
        const old = localStorage.getItem(legacy.key);
        if (old) saved[legacy.slot] = JSON.parse(old);
      } catch (e) { /* ignore */ }
    }
    return saved;
  }

  function save(all) {
    const now = Date.now();
    const out = {};
    for (const key of Object.keys(all)) {
      // Survival species stamp lastSeen so offline decay is measured from "now" on
      // the next load; identity-only species (chickens) have no lastSeen logic.
      if (offlineDecay) all[key].lastSeen = now;
      out[key] = all[key].toJSON();
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(out));
    } catch (e) {
      // Saving unavailable — ignore; the game still plays this session.
    }
  }

  function load() {
    const roster = defaultRoster();
    const saved = readSaved();
    const all = {};
    for (const key of Object.keys(roster)) {
      // Merge roster defaults UNDER saved data so older saves inherit any newly
      // added identity field (e.g. `sex`, #113) while saved values still win.
      const model = new Model({ ...roster[key], ...saved[key] });
      if (offlineDecay) {
        const elapsedSeconds = Math.max(0, (Date.now() - model.lastSeen) / 1000);
        if (elapsedSeconds > 1) model.applyDecay(elapsedSeconds, true);
        model.lastSeen = Date.now();
      }
      all[key] = model;
    }
    save(all); // seed immediately
    return all;
  }

  return { load, save };
}

// One generic API per species, built from the registry. Adding an animal type adds
// an entry to ./rosters.js and it gets load/save for free.
const ROSTER_API = Object.fromEntries(
  Object.entries(ROSTERS).map(([id, cfg]) => [id, makeRoster(cfg)]));

// Every persisted species as { id, registryKey, load } so BootScene can seed the
// Phaser registry generically (no per-species wiring there either).
export const ROSTER_SPECIES = Object.entries(ROSTERS).map(([id, cfg]) => ({
  id, registryKey: cfg.registryKey, load: ROSTER_API[id].load,
}));

// Back-compat named loaders/savers (call sites unchanged) — thin wrappers over the
// generic factory above.
export const loadAllHorses   = () => ROSTER_API.horse.load();
export const saveAllHorses   = (all) => ROSTER_API.horse.save(all);
export const loadAllChickens = () => ROSTER_API.chicken.load();
export const saveAllChickens = (all) => ROSTER_API.chicken.save(all);
export const loadAllCows     = () => ROSTER_API.cow.load();
export const saveAllCows     = (all) => ROSTER_API.cow.save(all);

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
    localStorage.removeItem(ROSTERS.horse.storageKey);
    localStorage.removeItem(ROSTERS.horse.legacy.key);
  } catch (e) {
    // localStorage unavailable — nothing to clear.
  }
}

export function hasSave() {
  try {
    return !!(localStorage.getItem(ROSTERS.horse.storageKey) || localStorage.getItem(ROSTERS.horse.legacy.key));
  } catch (e) {
    return false;
  }
}
