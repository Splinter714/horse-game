// Data-driven registry of AMBIENT / RANDOM events (issue #253).
//
// Historically each ambient event (a bird fly-by, a raccoon visit, a horse rolling
// in the dirt, weather turning to rain…) was scheduled ad-hoc by its own timer and,
// separately, hand-listed in the pause-menu dev overlay (`_devEventList`). The two
// drifted: a new event had to be wired in twice, and it was easy to add a spawner
// with no dev trigger (that's what happened to weather — #188).
//
// This module is the single source of truth. Each event is declared ONCE here as a
// descriptor; BOTH the ambient scheduler (scenes/paddock/ambientEvents.js) and the
// dev overlay (scenes/hotbar/pauseMenu.js) derive from it. Add one entry ⇒ the event
// auto-appears in the dev overlay AND enters the random rotation. No second list.
//
// A descriptor is:
//   {
//     id:      stable string key (used by tests / the scheduler picker)
//     label:   dev-overlay button text (emoji + words)
//     fire:    (scene) => void   — DOES the thing; reuses the scene's existing
//              spawn/roll primitives, so behaviour is unchanged from the old timers.
//     scheduled: bool (default true) — is this in the random ambient rotation?
//              (`false` = dev-only trigger, e.g. weather / force-mood cheats.)
//     weight:  relative pick weight in the rotation (default 1). Higher = more often.
//     needs:   optional ordered list of context gates from the pure set below; the
//              scheduler only fires the event when EVERY gate passes for the current
//              world context. Keeps the "may this fire now?" decision Phaser-free.
//   }
//
// The `fire` closures are the only scene-coupled part; everything the scheduler uses
// to *decide* is pure and unit-tested (mirrors data/wildlife.js + data/weather.js).

import { WEATHER } from './weather.js';

// ── Pure context gates ───────────────────────────────────────────────────────
// A gate is (ctx) => bool. `ctx` is a plain snapshot the scene passes each tick:
//   { phase: 'Morning'|'Afternoon'|'Evening'|'Night', sleeping: bool, weather }.
// Kept tiny and pure so the scheduler's "eligible right now?" logic is testable.
export const GATES = {
  // Not while the player is asleep (the whole world is frozen then).
  awake: (ctx) => !ctx.sleeping,
  // Daylit phases only (birds/fish read poorly at night).
  daylight: (ctx) => ctx.phase !== 'Night',
  // Fair weather only — ambient wildlife hides in the rain (#188).
  fair: (ctx) => ctx.weather !== WEATHER.RAIN,
  // Dusk/night — the raccoon is nocturnal.
  nocturnal: (ctx) => ctx.phase === 'Evening' || ctx.phase === 'Night',
};

// ── The registry ─────────────────────────────────────────────────────────────
// Order here is the order the dev overlay lists them. `fire` reuses whatever
// primitive already implements the event, picking a live target where needed.

// Pick a random idle, on-screen-agnostic grazer (horse) or null.
function idleHorse(scene) {
  const agents = scene._grazers?.() ?? [];
  const idle = agents.filter((h) => h.state === 'idle' && h.sprite?.active);
  if (!idle.length) return null;
  return idle[Math.floor(Math.random() * idle.length)];
}

function firstActive(scene, key, state) {
  return (scene.animals ?? []).find(
    (a) => a.key === key && a.sprite?.active && (state === undefined || a.state === state),
  );
}

export const AMBIENT_EVENTS = [
  {
    id: 'bird_flyby',
    label: '🐦 Bird fly-by',
    needs: ['awake', 'daylight', 'fair'],
    weight: 2,
    fire: (s) => s._spawnFlyby?.(),
  },
  {
    id: 'bird_perch',
    label: '🐦 Bird perch (ground)',
    needs: ['awake', 'daylight', 'fair'],
    fire: (s) => s._spawnPerch?.(),
  },
  {
    id: 'bird_on_horse',
    label: '🐦 Bird on horse back',
    needs: ['awake', 'daylight', 'fair'],
    fire: (s) => s._maybeSpawnHorsePerch?.(),
  },
  {
    id: 'raccoon_visit',
    label: '🦝 Raccoon visit',
    needs: ['awake', 'fair', 'nocturnal'],
    fire: (s) => s._spawnRaccoon?.(),
  },
  {
    id: 'fish_surface',
    label: '🐟 Fish surface',
    needs: ['awake', 'daylight', 'fair'],
    weight: 2,
    fire: (s) => s._spawnFish?.(),
  },
  {
    id: 'cat_fishing',
    label: '🐱 Cat goes fishing',
    needs: ['awake'],
    fire: (s) => {
      const cat = firstActive(s, 'cat');
      if (cat && cat.state !== 'fishing') s.catGoFish?.(cat);
    },
  },
  {
    id: 'horse_roll',
    label: '🐴 Horse rolls in dirt',
    needs: ['awake', 'daylight'],
    weight: 2,
    fire: (s) => {
      const h = idleHorse(s);
      if (!h) return;
      const horse = s.registry?.get('allHorses')?.[h.key];
      if (horse) s._rollInDirt?.(h, horse);
    },
  },
  {
    id: 'horse_nicker',
    label: '🐴 Horse nicker',
    needs: ['awake'],
    fire: (s) => {
      const h = idleHorse(s);
      if (!h) return;
      s._shake?.(h.sprite);
      s._playNicker?.();
    },
  },
  {
    id: 'pig_wallow',
    label: '🐷 Pig wallow in mud',
    needs: ['awake'],
    fire: (s) => {
      const pig = firstActive(s, 'pig', 'idle');
      if (pig) s.pigGoWallow?.(pig);
    },
  },
  {
    id: 'chicken_lay',
    label: '🐔 Chicken lays egg',
    needs: ['awake', 'daylight'],
    weight: 2,
    fire: (s) => s.eggLayTick?.(),
  },

  // ── Dev-only triggers (not in the random rotation) ─────────────────────────
  // Weather force-toggles so the weather pass (#188) is testable on demand, and a
  // force-mood cheat so all three horse postures (#69) show instantly.
  {
    id: 'weather_rain',
    label: '🌧️ Force weather: Rain',
    scheduled: false,
    fire: (s) => s._devForceWeather?.(WEATHER.RAIN),
  },
  {
    id: 'weather_sun',
    label: '☀️ Force weather: Sun',
    scheduled: false,
    fire: (s) => s._devForceWeather?.(WEATHER.SUN),
  },
  {
    id: 'mood_neglected',
    label: '😠 Force a horse neglected',
    scheduled: false,
    fire: (s) => s._devForceMood?.('neglected'),
  },
  {
    id: 'mood_sad',
    label: '😞 Drop a horse’s happiness',
    scheduled: false,
    fire: (s) => s._devForceMood?.('sad'),
  },
  {
    id: 'mood_happy',
    label: '😊 Cheer a horse up',
    scheduled: false,
    fire: (s) => s._devForceMood?.('happy'),
  },
];

// ── Derived views (pure) ─────────────────────────────────────────────────────

// The full dev-overlay list: every declared event, in registry order. The overlay
// is now GENERATED from this — adding an event above makes it appear automatically.
export function devEventList(events = AMBIENT_EVENTS) {
  return events.map(({ id, label, fire }) => ({ id, label, fire }));
}

// The events that participate in the random ambient rotation (scheduled !== false).
export function scheduledEvents(events = AMBIENT_EVENTS) {
  return events.filter((e) => e.scheduled !== false);
}

// Is this event allowed to fire in the given world context? All of its `needs`
// gates must pass. An event with no `needs` is always eligible.
export function isEventEligible(event, ctx, gates = GATES) {
  return (event.needs ?? []).every((g) => gates[g]?.(ctx) ?? true);
}

// The scheduled events eligible to fire right now, given the world context.
export function eligibleEvents(ctx, events = AMBIENT_EVENTS, gates = GATES) {
  return scheduledEvents(events).filter((e) => isEventEligible(e, ctx, gates));
}

// Weighted random pick from a list of events. `roll` is a 0..1 random (injected so
// the pick is deterministic/testable). Returns null for an empty list.
export function pickEvent(events, roll = Math.random()) {
  if (!events.length) return null;
  const total = events.reduce((sum, e) => sum + (e.weight ?? 1), 0);
  let target = roll * total;
  for (const e of events) {
    target -= e.weight ?? 1;
    if (target < 0) return e;
  }
  return events[events.length - 1];
}
