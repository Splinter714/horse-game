// localStorage persistence. Saves the horse and applies gentle offline decay on
// load so the horse "missed you" without being punished.

import { Horse } from './horse.js';

const KEY = 'horse-care-save-v1';

// ── Game state (hotbar + inventory) ──────────────────────────────────────────

const GAME_STATE_KEY = 'horse-game-state-v1';

const DEFAULT_HOTBAR = ['hand', 'apple', 'hay', 'treat', 'seed', 'bucket', 'brush', 'saddle', 'lead', 'basket'];

function defaultInventory() {
  // Food items start with quantities. Tools are infinite (not stored here).
  return { apple: 20, hay: 15, carrot: 10, treat: 5, seed: 30 };
}

export function loadGameState() {
  try {
    const raw = localStorage.getItem(GAME_STATE_KEY);
    if (!raw) return { hotbar: [...DEFAULT_HOTBAR], inventory: defaultInventory() };
    const data = JSON.parse(raw);
    return {
      hotbar:    Array.isArray(data.hotbar) ? data.hotbar : [...DEFAULT_HOTBAR],
      inventory: { ...defaultInventory(), ...(data.inventory ?? {}) },
    };
  } catch {
    return { hotbar: [...DEFAULT_HOTBAR], inventory: defaultInventory() };
  }
}

export function saveGameState({ hotbar, inventory }) {
  try {
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify({ hotbar, inventory }));
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
