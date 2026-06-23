// Central catalog of cross-scene game-event names.
//
// These are the events passed through Phaser's GLOBAL emitter (`this.game.events`)
// to communicate between scenes. Using constants instead of bare strings gives
// one source of truth and avoids silent typos when wiring emit/on/off. (Phaser's
// per-scene/built-in events like 'resize', 'down', 'connected', pointer events
// are NOT listed here — those are framework events, not our vocabulary.)
//
// String values are intentionally unchanged from the originals so this is a
// behavior-neutral rename.
export const EVENTS = {
  // An action performed on an animal: payload { type, horseKey }.
  // type ∈ 'feed' | 'water' | 'brush' | 'pet'. (Legacy name 'horse-action'.)
  ANIMAL_ACTION: 'horse-action',

  // Day/night phase changed: payload { isNight, phase }.
  PHASE_CHANGE: 'phase-change',

  // Player triggered sleep (PaddockScene → DayNightScene).
  SLEEP: 'sleep',
  // Sleep fade finished (DayNightScene → PaddockScene).
  SLEEP_DONE: 'sleep-done',

  // An animal's stats changed and any open UI should refresh.
  STATS_CHANGED: 'stats-changed',

  // Player money changed: payload = new amount.
  MONEY_CHANGED: 'money-changed',

  // Inventory / carrier contents changed (consumed by inventory UI).
  INVENTORY_CHANGED: 'inventory-changed',
  BASKET_CHANGED: 'basket-changed',

  // Show/hide contextual control prompts toggled: payload = boolean (show).
  PROMPTS_CHANGED: 'prompts-changed',

  // Active input device changed: payload = 'key' | 'pad' | 'touch'. Lets the UI
  // (e.g. the on-screen Use button) show only for touch players.
  INPUT_MODE_CHANGED: 'input-mode-changed',

  // The set of currently-possible contextual actions changed: payload
  // { interact, info, use } where each is a label string or null. Drives the
  // touch on-screen action buttons (Interact / Info / Use), each shown only
  // when its label is non-null.
  ACTIONS_CHANGED: 'actions-changed',
};
