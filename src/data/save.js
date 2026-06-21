// localStorage persistence. Saves the horse and applies gentle offline decay on
// load so the horse "missed you" without being punished.

import { Horse } from './horse.js';

const KEY = 'horse-care-save-v1';

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
