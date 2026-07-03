// Pure tests for the data-driven ambient-events registry (#253). These guard the two
// things the registry promises: (1) the dev overlay is DERIVED from the registry (so
// every declared event shows up and stays in sync — no hand-written list), and (2) the
// ambient scheduler picks from the same registry, gated by pure eligibility rules.
// The scene-coupled `fire(scene)` closures are exercised by the smoke test.

import { describe, it, expect } from 'vitest';
import {
  AMBIENT_EVENTS, GATES, devEventList, scheduledEvents,
  isEventEligible, eligibleEvents, pickEvent,
} from './ambientEvents.js';
import { WEATHER } from './weather.js';

describe('registry shape', () => {
  it('every event has an id, a label, and a fire function', () => {
    for (const e of AMBIENT_EVENTS) {
      expect(typeof e.id, `id for ${e.label}`).toBe('string');
      expect(e.id.length).toBeGreaterThan(0);
      expect(typeof e.label, `label for ${e.id}`).toBe('string');
      expect(typeof e.fire, `fire for ${e.id}`).toBe('function');
    }
  });

  it('event ids are unique', () => {
    const ids = AMBIENT_EVENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every gate named in an event.needs exists in GATES', () => {
    for (const e of AMBIENT_EVENTS) {
      for (const g of e.needs ?? []) {
        expect(GATES[g], `unknown gate "${g}" on ${e.id}`).toBeTypeOf('function');
      }
    }
  });
});

describe('dev overlay is derived from the registry', () => {
  it('lists EVERY registered event (nothing hand-dropped)', () => {
    const list = devEventList();
    expect(list).toHaveLength(AMBIENT_EVENTS.length);
    expect(list.map((e) => e.id)).toEqual(AMBIENT_EVENTS.map((e) => e.id));
  });

  it('preserves registry order and exposes label + fire', () => {
    const list = devEventList();
    for (let i = 0; i < list.length; i++) {
      expect(list[i].label).toBe(AMBIENT_EVENTS[i].label);
      expect(list[i].fire).toBe(AMBIENT_EVENTS[i].fire);
    }
  });

  it('includes the weather + force-mood dev triggers (#188/#69)', () => {
    const ids = devEventList().map((e) => e.id);
    expect(ids).toContain('weather_rain');
    expect(ids).toContain('weather_sun');
    expect(ids).toContain('mood_neglected');
    expect(ids).toContain('mood_sad');
    expect(ids).toContain('mood_happy');
  });
});

describe('scheduled vs dev-only', () => {
  it('dev-only triggers (scheduled:false) are excluded from the rotation', () => {
    const ids = scheduledEvents().map((e) => e.id);
    for (const devOnly of ['weather_rain', 'weather_sun', 'mood_neglected', 'mood_sad', 'mood_happy']) {
      expect(ids).not.toContain(devOnly);
    }
  });

  it('ambient events (fish/birds/raccoon/etc.) ARE scheduled', () => {
    const ids = scheduledEvents().map((e) => e.id);
    expect(ids).toContain('fish_surface');
    expect(ids).toContain('bird_flyby');
    expect(ids).toContain('raccoon_visit');
    expect(ids).toContain('owl_visit');
    expect(ids).toContain('horse_roll');
    expect(ids).toContain('chicken_lay');
  });
});

describe('eligibility gates (pure)', () => {
  const day = { phase: 'Afternoon', sleeping: false, weather: WEATHER.SUN };
  const night = { phase: 'Night', sleeping: false, weather: WEATHER.SUN };
  const rain = { phase: 'Afternoon', sleeping: false, weather: WEATHER.RAIN };
  const asleep = { phase: 'Afternoon', sleeping: true, weather: WEATHER.SUN };
  const evening = { phase: 'Evening', sleeping: false, weather: WEATHER.SUN };

  const byId = (id) => AMBIENT_EVENTS.find((e) => e.id === id);

  it('fair-weather wildlife is ineligible in the rain', () => {
    expect(isEventEligible(byId('fish_surface'), rain)).toBe(false);
    expect(isEventEligible(byId('bird_flyby'), rain)).toBe(false);
    expect(isEventEligible(byId('fish_surface'), day)).toBe(true);
  });

  it('daylight-only wildlife is ineligible at night', () => {
    expect(isEventEligible(byId('bird_perch'), night)).toBe(false);
    expect(isEventEligible(byId('chicken_lay'), night)).toBe(false);
    expect(isEventEligible(byId('bird_perch'), day)).toBe(true);
  });

  it('the raccoon is nocturnal (evening/night only)', () => {
    expect(isEventEligible(byId('raccoon_visit'), day)).toBe(false);
    expect(isEventEligible(byId('raccoon_visit'), evening)).toBe(true);
    expect(isEventEligible(byId('raccoon_visit'), night)).toBe(true);
  });

  it('the owl is night-only (#271) — stricter than the raccoon: not at dusk', () => {
    expect(isEventEligible(byId('owl_visit'), day)).toBe(false);
    expect(isEventEligible(byId('owl_visit'), evening)).toBe(false); // dusk: owl stays put
    expect(isEventEligible(byId('owl_visit'), night)).toBe(true);
    expect(isEventEligible(byId('owl_visit'), rain)).toBe(false);    // hides in the rain
  });

  it('nothing fires while the player is asleep', () => {
    for (const e of scheduledEvents()) {
      expect(isEventEligible(e, asleep), `${e.id} should be asleep-gated`).toBe(false);
    }
  });

  it('eligibleEvents() only returns scheduled, gate-passing events', () => {
    const out = eligibleEvents(day);
    expect(out.length).toBeGreaterThan(0);
    for (const e of out) {
      expect(e.scheduled).not.toBe(false);
      expect(isEventEligible(e, day)).toBe(true);
    }
    // A dev-only trigger never appears even though its (empty) needs pass.
    expect(out.map((e) => e.id)).not.toContain('weather_rain');
  });
});

describe('weighted pick (deterministic)', () => {
  const events = [
    { id: 'a', weight: 1 },
    { id: 'b', weight: 3 },
  ];

  it('returns null for an empty pool', () => {
    expect(pickEvent([], 0.5)).toBeNull();
  });

  it('a low roll lands in the first bucket, a high roll in the last', () => {
    expect(pickEvent(events, 0).id).toBe('a');
    expect(pickEvent(events, 0.99).id).toBe('b');
  });

  it('weight biases the split (1:3 → boundary at 25%)', () => {
    expect(pickEvent(events, 0.2).id).toBe('a'); // 0.2*4 = 0.8 < 1
    expect(pickEvent(events, 0.3).id).toBe('b'); // 0.3*4 = 1.2 >= 1
  });

  it('treats a missing weight as 1', () => {
    const equal = [{ id: 'x' }, { id: 'y' }];
    expect(pickEvent(equal, 0.1).id).toBe('x');
    expect(pickEvent(equal, 0.9).id).toBe('y');
  });
});
