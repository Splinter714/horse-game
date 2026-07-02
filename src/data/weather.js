// Pure weather logic (issue #188, Stage 1). Kept Phaser-free and unit-testable
// (mirrors data/wildlife.js splitting pure *decisions* from the scene wiring): the
// weather state machine, how much faster rain dirties horses, and how slowly rain
// tops up the trough all live here. DayNightScene owns the timer, tint, particles,
// and WEATHER_CHANGE event; it calls these to decide *what* happens.
//
// Stage-1 scope: two states, sun ↔ rain. Storms/wind/seasons are deferred.

export const WEATHER = {
  SUN: 'sun',
  RAIN: 'rain',
};

// How long a given weather state lasts before we roll for the next one, in ms.
// Sun spells run longer than rain spells so the default feel is a mostly-sunny
// farm with occasional rain (the "balance lever" for rain frequency). Real
// duration is picked uniformly in [min, max] each time the state is entered.
export const WEATHER_DURATION_MS = {
  [WEATHER.SUN]:  { min: 150_000, max: 300_000 }, // ~2.5–5 min of sun
  [WEATHER.RAIN]: { min:  60_000, max: 120_000 }, // ~1–2 min of rain
};

// Rain makes horses get dirty faster (#123 grooming loop). This multiplies the
// action-based dirtying (lying down, a night passing) while it's raining. 1 = no
// change in sun. Keep it modest so rain is a nuisance, not a punishment.
export const RAIN_DIRT_MULTIPLIER = 2;

// Rain slowly tops up the trough (#103) — but only PARTIALLY, so refilling with the
// bucket still matters. It adds RAIN_TROUGH_FILL_PER_TICK to the level every
// RAIN_TROUGH_TICK_MS, and never fills past RAIN_TROUGH_CAP_FRACTION of capacity —
// so the trough can catch rainwater to a low level on its own but you must still
// pour buckets to top it off for a thirsty herd. (Balance levers for "how much
// rain fills the trough".)
export const RAIN_TROUGH_TICK_MS = 8_000;
export const RAIN_TROUGH_FILL_PER_TICK = 1;
export const RAIN_TROUGH_CAP_FRACTION = 0.5; // rain alone fills to at most half

// Decide the next weather state given the current one. `roll` is a 0..1 random
// (injected so the decision is deterministic/testable). Sun mostly stays sunny;
// rain reliably clears back to sun. Returns { state, durationMs }.
export function nextWeather(current, roll, rand = defaultRand) {
  let state;
  if (current === WEATHER.RAIN) {
    // After a rain spell, usually clear up; small chance it keeps raining.
    state = roll < 0.8 ? WEATHER.SUN : WEATHER.RAIN;
  } else {
    // After sun, mostly stay sunny; sometimes it clouds over and rains.
    state = roll < 0.3 ? WEATHER.RAIN : WEATHER.SUN;
  }
  const { min, max } = WEATHER_DURATION_MS[state];
  return { state, durationMs: rand(min, max) };
}

// The dirt multiplier for the current weather — used by the grooming/dirt hook so
// a night passing / lying down knocks grooming down faster in the rain (#123).
export function dirtMultiplier(weather) {
  return weather === WEATHER.RAIN ? RAIN_DIRT_MULTIPLIER : 1;
}

// Is the ambient wildlife allowed out in this weather? Birds/raccoon/fish hide in
// the rain and return when it's fair. (The scene also has its own night/asleep
// guards; this is purely the weather gate.)
export function wildlifeActiveInWeather(weather) {
  return weather !== WEATHER.RAIN;
}

// How much rain should raise the trough level this tick, given the current level
// and capacity. Rain tops up toward RAIN_TROUGH_CAP_FRACTION of capacity only;
// once the trough is already above that (e.g. you poured buckets), rain adds
// nothing. Returns 0 when no change is warranted. Pure — the scene applies it.
export function rainTroughFill(level, cap) {
  const rainCap = Math.floor(cap * RAIN_TROUGH_CAP_FRACTION);
  if (level >= rainCap) return 0;
  return Math.min(RAIN_TROUGH_FILL_PER_TICK, rainCap - level);
}

function defaultRand(min, max) {
  return min + Math.random() * (max - min);
}
