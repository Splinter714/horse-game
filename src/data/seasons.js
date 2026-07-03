// Pure season logic (issue #272, v1 — VISUAL FIRST). Phaser-free and unit-testable,
// mirroring data/weather.js (which splits pure *decisions* from the scene wiring):
// the season order, which season a given day falls in, and each season's palette
// (a tint color/alpha wash + a light snow flag). DayNightScene owns the day counter,
// applies the tint on top of the day/night + weather pipeline, emits SEASON_CHANGE,
// and hosts the dev season-skip tap.
//
// v1 scope: VISUAL ONLY — a palette cycle + a way to tell the season. No gameplay
// effects (crop timing, temperature, animal behavior) — those are a later pass.

export const SEASON = {
  SPRING: 'spring',
  SUMMER: 'summer',
  FALL:   'fall',
  WINTER: 'winter',
};

// The cycle order. Index math (seasonForDay / nextSeason) relies on this order.
export const SEASON_ORDER = [
  SEASON.SPRING,
  SEASON.SUMMER,
  SEASON.FALL,
  SEASON.WINTER,
];

// How many in-game days each season lasts before the cycle advances. Kept short so
// the owner sees a full year turn over quickly while playtesting; a real balance
// lever later. (One "day" ticks over at each Morning in DayNightScene.)
export const DAYS_PER_SEASON = 3;

// Per-season look. `tint`/`alpha` is a full-screen wash composed ON TOP of the
// day/night tint + weather wash (like the rain wash), so it reads as an ambient
// seasonal cast at any time of day. Summer is intentionally near-neutral (alpha 0)
// so high summer looks clean and bright. `snow` flags winter for the falling-snow
// particle field. `label`/`icon` drive the on-screen season readout.
//
// These colours are a reasonable FIRST PASS — the exact palette/snow look is
// owner-art-directed at playtest, so they're easy to tune here without touching the
// scene wiring.
export const SEASON_PALETTE = {
  [SEASON.SPRING]: {
    label: 'Spring',
    icon: '🌸',
    tint: 0x7ad86a, // fresh green wash — lush new growth
    alpha: 0.10,
    snow: false,
  },
  [SEASON.SUMMER]: {
    label: 'Summer',
    icon: '☀️',
    tint: 0xffe9a8, // warm, near-neutral golden light
    alpha: 0.05,
    snow: false,
  },
  [SEASON.FALL]: {
    label: 'Fall',
    icon: '🍂',
    tint: 0xd8813a, // amber/rust autumn tones
    alpha: 0.16,
    snow: false,
  },
  [SEASON.WINTER]: {
    label: 'Winter',
    icon: '❄️',
    tint: 0xbcd6f0, // pale cold blue wash
    alpha: 0.18,
    snow: true,
  },
};

// Which season a given (0-based) day number falls in. Wraps forever, so day 0..2 is
// spring, 3..5 summer, … 12..14 spring again (with DAYS_PER_SEASON = 3). Pure.
export function seasonForDay(day, daysPerSeason = DAYS_PER_SEASON) {
  const seasonsElapsed = Math.floor(day / daysPerSeason);
  const idx = ((seasonsElapsed % SEASON_ORDER.length) + SEASON_ORDER.length) % SEASON_ORDER.length;
  return SEASON_ORDER[idx];
}

// The season that follows the given one in the cycle (spring→summer→…→winter→spring).
export function nextSeason(season) {
  const idx = SEASON_ORDER.indexOf(season);
  if (idx === -1) return SEASON_ORDER[0];
  return SEASON_ORDER[(idx + 1) % SEASON_ORDER.length];
}

// The palette for a season (falls back to spring for an unknown value). Pure lookup.
export function seasonPalette(season) {
  return SEASON_PALETTE[season] ?? SEASON_PALETTE[SEASON.SPRING];
}
