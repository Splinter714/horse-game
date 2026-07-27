// localStorage persistence. Saves every animal roster and applies gentle offline
// decay on load so the herd "missed you" without being punished.
//
// The per-species roster config (storage keys, model classes, default herds) lives
// in ./rosters.js so THIS file stays species-agnostic — adding a persisted animal is
// a single entry there, not a new ~50-line loader. The C2 import-boundary seam guard
// (src/seams.test.js) checks this file names no concrete model (issue #167).
// `makeRoster` is the generic load/save factory all species share.

import { ROSTERS } from './rosters.js';
import { sanitizeGarden } from './garden.js';
import { sanitizePantry } from './pantry.js';
import { DEFAULT_SADDLE_TYPE, SADDLE_TYPES, ALL_TOOL_UPGRADES } from './items.js';

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
    // Union of default keys and saved keys: default individuals AND any member the
    // player added at runtime that isn't a fresh-game default (e.g. an attracted
    // bunny, #224 — its roster starts empty and grows in play). Defaults first so
    // their order is stable; saved-only keys follow. Restoring saved-only keys is
    // what lets a runtime-added animal survive a reload.
    const keys = [...Object.keys(roster), ...Object.keys(saved).filter((k) => !(k in roster))];
    for (const key of keys) {
      // Merge roster defaults UNDER saved data so older saves inherit any newly
      // added identity field (e.g. `sex`, #113) while saved values still win. A
      // saved-only key has no default to merge under — just the saved data.
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

// Every persisted species as { id, registryKey, load, save } so BootScene can seed
// the Phaser registry generically and the persistence mixin can save any roster by
// species id — no per-species wiring in either (#167 B1/B3).
export const ROSTER_SPECIES = Object.entries(ROSTERS).map(([id, cfg]) => ({
  id, registryKey: cfg.registryKey, load: ROSTER_API[id].load, save: ROSTER_API[id].save,
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
const DEFAULT_HOTBAR = ['basketGroup', 'bucketGroup', 'brush', 'saddle', 'lead', 'scooper', 'shears'];

// Which member of each carrier group is currently active in its grouped slot.
function defaultActiveCarrier() {
  return { basket: 'basket1', bucket: 'bucket1' };
}

// Coerce a persisted saddle-type key into a known SADDLE_TYPES id, falling back
// to the default for a missing/corrupt/unknown value (#134 follow-up to #21).
function sanitizeSaddleType(v) {
  return typeof v === 'string' && SADDLE_TYPES[v] ? v : DEFAULT_SADDLE_TYPE;
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

// Starting gold — a small float so the shop is usable from a fresh save (#29).
export const DEFAULT_MONEY = 20;

// Coerce a persisted money value into a safe non-negative integer, falling back
// to the starting stake for a missing/corrupt value (older saves had no money).
function sanitizeMoney(v) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_MONEY;
}

// Coerce a persisted non-negative counter (scooper load, compost store — #232) into
// a safe integer, defaulting to 0 for a missing/corrupt value.
function sanitizeCount(v) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

// Coerce a persisted tool-upgrades list (#295) into a de-duplicated array of known
// upgrade ids, dropping anything unrecognized (a stale id from a removed upgrade,
// corrupt data, etc.) — mirrors the other sanitize* forgiving-load helpers.
function sanitizeToolUpgrades(v) {
  if (!Array.isArray(v)) return [];
  const known = new Set(ALL_TOOL_UPGRADES.map((u) => u.id));
  return [...new Set(v.filter((id) => typeof id === 'string' && known.has(id)))];
}

export function loadGameState() {
  const fresh = () => ({
    hotbar: [...DEFAULT_HOTBAR], inventory: defaultInventory(),
    carriers: defaultCarriers(), activeCarrier: defaultActiveCarrier(),
    money: DEFAULT_MONEY,
    scooperLoad: 0, compost: 0, shearsLoad: 0,
    activeSaddleType: DEFAULT_SADDLE_TYPE,
    toolUpgrades: [],
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
    let hotbar = (saved.includes('basketGroup') ? saved : [...DEFAULT_HOTBAR]).slice(0, DEFAULT_HOTBAR.length);
    // Ensure any tool added to the default hotbar since the save was written shows
    // up (e.g. the scooper, #232): append missing default tools so an existing
    // player gets the new slot without losing their arrangement.
    for (const key of DEFAULT_HOTBAR) {
      if (!hotbar.includes(key)) hotbar = [...hotbar, key].slice(0, DEFAULT_HOTBAR.length);
    }
    return {
      hotbar,
      inventory:     { ...defaultInventory(),     ...(data.inventory ?? {}) },
      carriers:      { ...defaultCarriers(),      ...(data.carriers ?? {}) },
      activeCarrier: { ...defaultActiveCarrier(), ...(data.activeCarrier ?? {}) },
      // Money persists across sessions (#29); an older save with no money field
      // seeds the starting stake so the shop is immediately usable.
      money:         'money' in data ? sanitizeMoney(data.money) : DEFAULT_MONEY,
      // Compost mechanic (#232): the scooper's current load and the farm's compost
      // store. Both default to 0 for a save written before the feature existed.
      scooperLoad:   sanitizeCount(data.scooperLoad),
      compost:       sanitizeCount(data.compost),
      // Shears mechanic (#254): the shears' current wool load. Defaults to 0 for a
      // save written before the feature existed.
      shearsLoad:    sanitizeCount(data.shearsLoad),
      // Tack rack (#134 follow-up to #21): which saddle type is currently selected
      // at the rack — the type the saddle tool equips next. Defaults to western
      // for a save written before the feature existed.
      activeSaddleType: sanitizeSaddleType(data.activeSaddleType),
      // Purchased tool upgrades (#295): a gold-bought, permanent tier per tool —
      // defaults to none for a save written before the feature existed.
      toolUpgrades: sanitizeToolUpgrades(data.toolUpgrades),
    };
  } catch {
    return fresh();
  }
}

export function saveGameState({ hotbar, inventory, carriers, activeCarrier, money, scooperLoad, compost, shearsLoad, activeSaddleType, toolUpgrades }) {
  try {
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify({
      hotbar, inventory, carriers, activeCarrier, money: sanitizeMoney(money),
      scooperLoad: sanitizeCount(scooperLoad), compost: sanitizeCount(compost),
      activeSaddleType: sanitizeSaddleType(activeSaddleType),
      shearsLoad: sanitizeCount(shearsLoad),
      toolUpgrades: sanitizeToolUpgrades(toolUpgrades),
    }));
  } catch {}
}

// ── Garden plot (#242) ────────────────────────────────────────────────────────
// The crop garden's slot array (data/garden.js): each slot null or { crop, stage }.
// Its own storage key (not the wholesale-rewritten gameState) so it persists cleanly,
// like the player look. sanitizeGarden makes the load forgiving (old/corrupt → empty).
const GARDEN_KEY = 'horse-game-garden-v1';

export function loadGarden() {
  try {
    return sanitizeGarden(JSON.parse(localStorage.getItem(GARDEN_KEY)));
  } catch {
    return sanitizeGarden(null);
  }
}

export function saveGarden(garden) {
  try {
    localStorage.setItem(GARDEN_KEY, JSON.stringify(sanitizeGarden(garden)));
  } catch {}
}

// ── Pantry storage (#212) ────────────────────────────────────────────────────
// The house interior's pantry/fridge station's stockpile: a keyed quantity map
// { [content]: count }, distinct from the farm-stand stock and carried carrier
// inventory. Its own storage key, like the garden plot, so it persists cleanly.
const PANTRY_KEY = 'horse-game-pantry-v1';

export function loadPantry() {
  try {
    return sanitizePantry(JSON.parse(localStorage.getItem(PANTRY_KEY)));
  } catch {
    return sanitizePantry(null);
  }
}

export function savePantry(pantry) {
  try {
    localStorage.setItem(PANTRY_KEY, JSON.stringify(sanitizePantry(pantry)));
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

// ── Player appearance (#44) ───────────────────────────────────────────────────
// The customizer look = a map of per-part keys ({ hairStyle, hair, skin, eyes,
// sleeves, shirt, bottom, bottomColor }). Its own storage key (not the hotbar
// gameState, which saveGameState rewrites wholesale and would drop it). Stored as raw
// keys; lookFromKeys('player', …) fills any missing/stale key with that part's default,
// so this file stays species-agnostic (no customize import needed).
const PLAYER_KEY = 'horse-game-player-v1';

export function loadPlayerLook() {
  try {
    const data = JSON.parse(localStorage.getItem(PLAYER_KEY));
    return (data && typeof data === 'object') ? data : {};
  } catch {
    return {};
  }
}

export function savePlayerLook(keys) {
  try {
    localStorage.setItem(PLAYER_KEY, JSON.stringify(keys || {}));
  } catch {}
}

// ── Fox taming progress (#266) ────────────────────────────────────────────────
// The wild fox is befriended by repeated feeding: each fox-food pile it eats bumps a
// counter, and once it's high enough the fox joins the roster (paddock/fox.js). That
// running count needs to survive a reload so befriending is gradual across sessions —
// its own tiny storage key (not the wholesale-rewritten gameState). Just an integer;
// once the fox is tamed the roster itself carries it, so this only tracks the pre-tame
// warm-up. Stays species-agnostic in spirit (a plain number keyed by feature).
const FOX_TAMING_KEY = 'horse-game-fox-taming-v1';

export function loadFoxTaming() {
  try {
    const n = Number(JSON.parse(localStorage.getItem(FOX_TAMING_KEY)));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function saveFoxTaming(count) {
  try {
    localStorage.setItem(FOX_TAMING_KEY, JSON.stringify(Math.max(0, count | 0)));
  } catch {}
}

// ── Duck taming progress (#275) ───────────────────────────────────────────────
// Same shape as the fox taming counter above — the wild duck is befriended by
// repeated feeding at the stream; each duck-food pile it eats bumps a counter, and
// once it's high enough the duck joins the roster (paddock/duck.js). Its own tiny
// storage key so befriending is gradual across sessions, mirroring FOX_TAMING_KEY.
const DUCK_TAMING_KEY = 'horse-game-duck-taming-v1';

export function loadDuckTaming() {
  try {
    const n = Number(JSON.parse(localStorage.getItem(DUCK_TAMING_KEY)));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function saveDuckTaming(count) {
  try {
    localStorage.setItem(DUCK_TAMING_KEY, JSON.stringify(Math.max(0, count | 0)));
  } catch {}
}

// ── Drivable tractor (#264) ───────────────────────────────────────────────────
// Just the chosen paint color survives a reload — the tractor itself is a fixed
// world object (always parked at the same spot), not a roster. Its own tiny
// storage key, mirroring the taming counters above.
const TRACTOR_KEY = 'horse-game-tractor-v1';

export function loadTractorState() {
  try {
    const data = JSON.parse(localStorage.getItem(TRACTOR_KEY));
    return { color: typeof data?.color === 'string' ? data.color : undefined };
  } catch {
    return {};
  }
}

export function saveTractorState({ color }) {
  try {
    localStorage.setItem(TRACTOR_KEY, JSON.stringify({ color }));
  } catch {}
}

// ── Bird befriending progress (#223) ──────────────────────────────────────────
// Mirrors the fox-taming persistence shape above, but per BIRD TYPE (data/wildlife.js
// BIRD_TYPES id) rather than a single counter — several types can be warming up (or
// already named) at once. Shape: { counts: { [typeId]: visitTally }, roster: [{
// typeId, name }] }. `counts` is the pre-befriended running tally per type (visitBird,
// data/birdFriendship.js); `roster` is the small capped list of named regulars, in the
// order they were won over. Its own tiny storage key (not the wholesale-rewritten
// gameState) so this stays a self-contained, easily-reset feature.
const BIRD_FRIENDSHIP_KEY = 'horse-game-bird-friendship-v1';

export function loadBirdFriendship() {
  try {
    const data = JSON.parse(localStorage.getItem(BIRD_FRIENDSHIP_KEY));
    const counts = (data?.counts && typeof data.counts === 'object') ? data.counts : {};
    const roster = Array.isArray(data?.roster) ? data.roster.filter((r) => r?.typeId) : [];
    return { counts, roster };
  } catch {
    return { counts: {}, roster: [] };
  }
}

export function saveBirdFriendship({ counts = {}, roster = [] }) {
  try {
    localStorage.setItem(BIRD_FRIENDSHIP_KEY, JSON.stringify({ counts, roster }));
  } catch {}
}

// ── Neighbor relationship (#294) ──────────────────────────────────────────────
// Mirrors the bird-friendship persistence shape above, but simpler: a single running
// gift-count score (data/neighbor.js giftNeighbor) rather than a per-type tally +
// roster, since there's only one neighbor for v1. Its own tiny storage key (not the
// wholesale-rewritten gameState) so this stays a self-contained, easily-reset feature.
const NEIGHBOR_FRIENDSHIP_KEY = 'horse-game-neighbor-friendship-v1';

export function loadNeighborFriendship() {
  try {
    const data = JSON.parse(localStorage.getItem(NEIGHBOR_FRIENDSHIP_KEY));
    const n = Number(data?.score);
    return { score: Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0 };
  } catch {
    return { score: 0 };
  }
}

export function saveNeighborFriendship({ score = 0 } = {}) {
  try {
    localStorage.setItem(NEIGHBOR_FRIENDSHIP_KEY, JSON.stringify({ score: Math.max(0, score | 0) }));
  } catch {}
}

// ── Breeding gestations (#15) ─────────────────────────────────────────────────
// In-flight pregnancies: an array of { aKey, bKey, startedAt, seed } that must
// survive a reload so a foal paired before closing the game is still born on time
// (the gestation clock runs in wall time, like offline decay). Its own tiny storage
// key (not the wholesale-rewritten gameState). Stays species-agnostic in spirit — a
// plain list keyed by the breeding feature. The foals themselves, once born, live in
// the ordinary horse roster and persist there.
const GESTATIONS_KEY = 'horse-game-gestations-v1';

export function loadGestations() {
  try {
    const data = JSON.parse(localStorage.getItem(GESTATIONS_KEY));
    return Array.isArray(data) ? data.filter((g) => g && typeof g.startedAt === 'number') : [];
  } catch {
    return [];
  }
}

export function saveGestations(list) {
  try {
    localStorage.setItem(GESTATIONS_KEY, JSON.stringify(Array.isArray(list) ? list : []));
  } catch {}
}

// ── Ready-to-birth holding queue (#299) ─────────────────────────────────────────
// A gestation whose timer has completed doesn't birth live — it moves here and
// waits to be revealed at the player's next wake-up (see WithBreeding.
// flushReadyBirths), so every birth reads as a "while you were sleeping" surprise
// rather than a mid-play interruption. Same shape as a gestation entry minus
// startedAt ({ aKey, bKey, seed }); persisted separately so a completed-but-not-
// yet-revealed pregnancy survives a reload and is still held (not re-birthed, not
// lost) until the player next sleeps and wakes.
const READY_BIRTHS_KEY = 'horse-game-ready-births-v1';

export function loadReadyBirths() {
  try {
    const data = JSON.parse(localStorage.getItem(READY_BIRTHS_KEY));
    return Array.isArray(data) ? data.filter((g) => g && g.aKey && g.bKey) : [];
  } catch {
    return [];
  }
}

export function saveReadyBirths(list) {
  try {
    localStorage.setItem(READY_BIRTHS_KEY, JSON.stringify(Array.isArray(list) ? list : []));
  } catch {}
}

// ── Pair bonds (#114) ───────────────────────────────────────────────────────────
// A PERMANENT mom+dad bond record, separate from any in-flight gestation: an array
// of { aKey, bKey }. Formed once via the "Pair"/"Bond" panel action and never
// broken (no death, no re-pairing — monogamous by design). A gestation no longer
// starts automatically when a bond forms; the separate "Breed" action reads this
// list to find a horse's mate and can be used repeatedly over time to start new
// gestations. Kept as its own tiny storage key, mirroring GESTATIONS_KEY/
// READY_BIRTHS_KEY above.
const PAIR_BONDS_KEY = 'horse-game-pair-bonds-v1';

export function loadPairBonds() {
  try {
    const data = JSON.parse(localStorage.getItem(PAIR_BONDS_KEY));
    return Array.isArray(data) ? data.filter((p) => p && p.aKey && p.bKey) : [];
  } catch {
    return [];
  }
}

export function savePairBonds(list) {
  try {
    localStorage.setItem(PAIR_BONDS_KEY, JSON.stringify(Array.isArray(list) ? list : []));
  } catch {}
}

// ── Chick incubations (#274) ──────────────────────────────────────────────────
// In-flight fertilized eggs: an array of { henKey, roosterKey, startedAt, seed }
// that must survive a reload so an egg started incubating before closing the game
// is still hatched on time (the incubation clock runs in wall time, like offline
// decay and the horse gestation above). Its own tiny storage key, kept separate
// from GESTATIONS_KEY on purpose — chicks are a parallel system to horse breeding,
// not sharing its files (#274 builds alongside #114's horse-breeding UX rework
// without touching it). The chicks themselves, once hatched, live in the ordinary
// chicken roster and persist there.
const INCUBATIONS_KEY = 'horse-game-incubations-v1';

export function loadIncubations() {
  try {
    const data = JSON.parse(localStorage.getItem(INCUBATIONS_KEY));
    return Array.isArray(data) ? data.filter((g) => g && typeof g.startedAt === 'number') : [];
  } catch {
    return [];
  }
}

export function saveIncubations(list) {
  try {
    localStorage.setItem(INCUBATIONS_KEY, JSON.stringify(Array.isArray(list) ? list : []));
  } catch {}
}

// ── Dev settings (pause-menu dev tools) ──────────────────────────────────────
// Persisted "start state" knobs so the owner can test things without replaying
// from scratch: which time-of-day the day/night clock boots into, and whether
// the appearance editor auto-opens on a chosen horse. TEMP testing scaffolding —
// applied on the next reload. Remove with the rest of the dev tools before a real
// release.
const DEV_KEY = 'horse-game-dev-v1';

const DEFAULT_DEV = { startPhase: null, startEditor: null, startLocation: null, showFps: true, showDevLabels: false };

export function loadDevSettings() {
  try {
    const raw = localStorage.getItem(DEV_KEY);
    if (!raw) return { ...DEFAULT_DEV };
    const data = JSON.parse(raw) ?? {};
    return {
      startPhase:    typeof data.startPhase    === 'string' ? data.startPhase    : DEFAULT_DEV.startPhase,
      startEditor:   typeof data.startEditor   === 'string' ? data.startEditor   : DEFAULT_DEV.startEditor,
      startLocation: typeof data.startLocation === 'string' ? data.startLocation : DEFAULT_DEV.startLocation,
      // FPS counter overlay (#325) — opt-in, works in production builds too.
      showFps:       typeof data.showFps       === 'boolean' ? data.showFps      : DEFAULT_DEV.showFps,
      // World-object labels + coordinate grid overlay (#329) — dev aid, default OFF.
      showDevLabels: typeof data.showDevLabels === 'boolean' ? data.showDevLabels : DEFAULT_DEV.showDevLabels,
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
