// localStorage persistence. Saves the horse and applies gentle offline decay on
// load so the horse "missed you" without being punished.

import { Horse } from './horse.js';

const KEY = 'horse-care-save-v1';

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

export function loadHorse() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch (e) {
    // localStorage blocked (e.g. private mode) — fall through to a fresh horse.
  }
  if (!raw) return new Horse();

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return new Horse();
  }

  const horse = new Horse(data);
  const elapsedSeconds = Math.max(0, (Date.now() - horse.lastSeen) / 1000);
  if (elapsedSeconds > 1) {
    horse.applyDecay(elapsedSeconds, true);
  }
  horse.lastSeen = Date.now();
  return horse;
}

export function saveHorse(horse) {
  horse.lastSeen = Date.now();
  try {
    localStorage.setItem(KEY, JSON.stringify(horse.toJSON()));
  } catch (e) {
    // Saving unavailable — ignore; the game still plays this session.
  }
}

export function hasSave() {
  try {
    return !!localStorage.getItem(KEY);
  } catch (e) {
    return false;
  }
}
