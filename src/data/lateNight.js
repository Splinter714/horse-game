// Pure late-night forced-sleep logic (issue #300). Kept Phaser-free and unit-testable,
// mirroring data/weather.js / data/seasons.js (pure decisions, scene does the wiring):
// given how far into the Night phase we are, is it time to warn the player that sleep
// is coming, and is it time to force it?
//
// Scope (locked, #300): a HYBRID model. The player has free roam through all of Night
// (owls #271 and other night-only content stay fully reachable — nothing here touches
// them). Only in the LAST STRETCH of Night does a warning appear, and only past the
// hard-lock threshold does sleep become involuntary. Both thresholds are expressed as
// a FRACTION of the Night phase's duration so they scale automatically if the phase
// length is ever tuned (DayNightScene's PHASES table), rather than a hardcoded ms value
// that could silently drift out of sync.

// Warn starting at 60% into Night (a "getting late..." cue) — well after owls etc.
// would already be out and enjoyed, but with a comfortable lead-in before the lock.
export const LATE_NIGHT_WARN_FRACTION = 0.6;

// Hard-lock (force sleep) at 85% into Night — deep, late, "point of no return", but
// still leaves the last stretch of Night as a real warned countdown rather than an
// ambush.
export const LATE_NIGHT_LOCK_FRACTION = 0.85;

// How far into the Night phase we are, 0..1. `elapsedInPhase`/`phaseDuration` are the
// same units DayNightScene already tracks (ms). Pure — no clamping surprises: a value
// at/after the phase end returns 1.
export function nightProgress(elapsedInPhase, phaseDuration) {
  if (!(phaseDuration > 0)) return 0;
  return Math.min(1, Math.max(0, elapsedInPhase / phaseDuration));
}

// Should the sleepy warning cue be showing? Only during Night, only once we've crossed
// the warn fraction (and only before the hard lock takes over the screen).
export function isLateNightWarning(phase, progress) {
  return phase === 'Night' && progress >= LATE_NIGHT_WARN_FRACTION && progress < LATE_NIGHT_LOCK_FRACTION;
}

// Should sleep be forced right now? Only during Night, once we've crossed the lock
// fraction. The scene is responsible for only firing this once per night (it already
// tracks `_sleeping` / phase state) — this is purely "are we past the line."
export function isPastLateNightLock(phase, progress) {
  return phase === 'Night' && progress >= LATE_NIGHT_LOCK_FRACTION;
}
