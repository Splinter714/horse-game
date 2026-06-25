// Shared tuning/layout constants for HotbarScene and its concern mixins
// (./hotbar/*). Centralised so the scene file and every extracted mixin read one
// source of truth (issue #167), mirroring paddock/constants.js.

// Gameplay scenes frozen while the pause menu is open.
export const PAUSABLE_SCENES = ['PaddockScene', 'DayNightScene', 'InfoPanelScene'];

// Base slot dimensions. Bigger than before for readability (#119); on narrow /
// portrait screens the whole strip is scaled down by `fit` so it never overflows
// the viewport width.
export const SLOT_SIZE = 84;
export const SLOT_GAP  = 8;
// Only as many slots as we actually use (2 carrier groups + 3 tools). Add more
// here as new tools/items arrive rather than pre-allocating empties (#118).
export const NUM_SLOTS = 5;
export const INV_COLS  = 5;
export const INV_ROWS  = 10;
// The carrier fly-out is now a deliberate "show all instances" picker: a quick
// press/tap just selects or cycles, while a HOLD this long opens the fly-out (#75).
// Kept short so the hold feels responsive — a normal tap/click is well under this.
export const HOLD_FLYOUT_MS = 200;
// Once open, it auto-dismisses after this long if untouched — just a "walked away
// and forgot" fallback, since every cycle while it's open refreshes the timer and
// you normally close it by picking or switching slots.
export const FLYOUT_CLOSE_MS = 2000;
