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
  // Day/night phase changed: payload { isNight, phase }.
  PHASE_CHANGE: 'phase-change',

  // Weather state changed (#188): payload { weather } where weather is 'sun' | 'rain'.
  // Emitted by DayNightScene's weather state machine; PaddockScene reacts (dirt rate,
  // wildlife hiding, trough rain-fill) and the UI shows a 'today's weather' indicator.
  WEATHER_CHANGE: 'weather-change',

  // Season changed (#272, v1 VISUAL FIRST): payload { season } where season is one
  // of 'spring' | 'summer' | 'fall' | 'winter'. Emitted by DayNightScene's season
  // cycle (advances a day at each Morning); currently drives only the seasonal tint /
  // snow overlay + on-screen readout, but other systems can react later (crop timing,
  // temperature, animal behaviour) without new wiring.
  SEASON_CHANGE: 'season-change',

  // Player triggered sleep (PaddockScene / HouseInteriorScene → DayNightScene).
  SLEEP: 'sleep',
  // Sleep fade finished (DayNightScene → PaddockScene).
  SLEEP_DONE: 'sleep-done',

  // Player walked into / out of the house interior (#56). ENTER pauses the world
  // scenes and launches HouseInteriorScene; EXIT tears it down and resumes them.
  ENTER_HOUSE: 'enter-house',
  EXIT_HOUSE: 'exit-house',

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
