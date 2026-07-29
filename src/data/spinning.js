// Spinning-wheel wool→yarn timer (#405) — wool no longer converts to yarn
// instantly; spinning it takes a few seconds PER UNIT, so a bigger load takes
// noticeably longer than a small one. The wait is a WALK-AWAY timer, not an
// in-place progress bar: the player starts a spin, can leave to do other chores,
// and comes back later to collect the finished batch. Mirrors the shape of the
// chick incubation clock (data/species/chicken/incubation.js) — pure timing math
// here, wall-clock so it survives a reload, scene plumbing lives in
// scenes/paddock/farmStand.js.

// How many seconds ONE unit of wool takes to spin into yarn. A batch of `amount`
// wool takes `amount * SPIN_SEC_PER_UNIT` seconds total — spinning 5 wool is
// noticeably slower than spinning 1. A first-pass balance lever to tune at
// playtest (mirrors INCUBATION_MS being a first-pass cozy timing).
export const SPIN_SEC_PER_UNIT = 4;

// Total duration (ms) to spin a batch of `amount` wool.
export function spinDurationMs(amount) {
  return Math.max(0, amount) * SPIN_SEC_PER_UNIT * 1000;
}

// Milliseconds left on a spin that began at `startedAt` for `amount` units,
// clamped at 0.
export function spinRemaining(startedAt, amount, now = Date.now()) {
  return Math.max(0, startedAt + spinDurationMs(amount) - (now ?? Date.now()));
}

// Is the spin that began at `startedAt` for `amount` units complete (the yarn
// ready to collect)?
export function isSpinReady(startedAt, amount, now = Date.now()) {
  return spinRemaining(startedAt, amount, now) <= 0;
}

// Fraction of the spin elapsed (0 = just started, 1 = ready). Not currently
// surfaced anywhere (no progress bar, per the walk-away design), but kept for
// parity with incubationProgress in case a future affordance wants it.
export function spinProgress(startedAt, amount, now = Date.now()) {
  const dur = spinDurationMs(amount);
  if (dur <= 0) return 1;
  const elapsed = (now ?? Date.now()) - startedAt;
  return Math.max(0, Math.min(1, elapsed / dur));
}
