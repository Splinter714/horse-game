// Weather response (#188, Stage 1): the paddock reacts to EVENTS.WEATHER_CHANGE
// from DayNightScene's weather state machine. Applied as a functional mixin so
// `this` is the scene.
//
// Four gameplay hooks, all data-driven by the pure rules in data/weather.js:
//   • Rain dirties horses faster — see _dirtyHorse (dayNight.js), which scales the
//     action-based grooming loss by dirtMultiplier(this._weather).
//   • Ambient wildlife hides in rain — the wildlife schedulers gate on
//     wildlifeActiveInWeather(this._weather) (wildlife.js) and any critters out
//     when the rain starts are sent home here.
//   • Rain partially refills the trough — a slow timer tops it up toward a fraction
//     of capacity (rainTroughFill), so the bucket loop still matters for a full
//     trough. The tint/particles/indicator are DayNightScene's job.
//   • Rain sends horses to the covered shelter (#319) — fully automatic AI: the
//     seekShelter behavior (data/species/horse/behaviors.js) claims an idle/
//     wandering horse and parks it at props.shelter (horseGoToShelter, horseAI.js)
//     for the whole rain spell. When it clears, _releaseSheltering hands any
//     parked horses back to the normal wander chain.

import Phaser from 'phaser';
import { WEATHER, rainTroughFill, RAIN_TROUGH_TICK_MS } from '../../data/weather.js';
import { TROUGH_CAP } from './constants.js';

export const WithWeather = (Base) => class extends Base {
  onWeatherChange({ weather }) {
    const wasRaining = this._weather === WEATHER.RAIN;
    this._weather = weather;

    if (weather === WEATHER.RAIN) {
      // Rain starts: shoo any ambient critters that are currently out so they
      // "hide" (schedulers won't spawn new ones while it rains — wildlife.js).
      this._clearWildlifeForRain?.();
      this._startRainTroughFill();
    } else if (wasRaining) {
      // Cleared up: stop the rain fill; wildlife resumes on its own schedulers.
      this._stopRainTroughFill();
      this._releaseSheltering();
    }
  }

  // Hand any horse parked at the shelter (#319) back to the normal wander chain
  // once the rain clears — horseGoToShelter never resets state on its own (it
  // stays 'sheltering' for the whole rain spell), so this is the only way out.
  _releaseSheltering() {
    for (const h of this._grazers()) {
      if (h.state !== 'sheltering') continue;
      h.state = 'idle';
      this.scheduleWander(h, Phaser.Math.Between(500, 2000));
    }
  }

  // While it's raining, slowly catch rainwater in the trough — but only up to a
  // fraction of capacity (rainTroughFill enforces the cap), so you still need the
  // bucket to top it off for a thirsty herd.
  _startRainTroughFill() {
    this._stopRainTroughFill();
    this._rainTroughTimer = this.time.addEvent({
      delay: RAIN_TROUGH_TICK_MS, loop: true,
      callback: () => {
        if (this._weather !== WEATHER.RAIN || this._sleeping) return;
        const t = this.props.trough;
        if (!t) return;
        const add = rainTroughFill(t.level, TROUGH_CAP);
        if (add > 0) this._setTroughLevel(t.level + add);
      },
    });
  }

  _stopRainTroughFill() {
    if (this._rainTroughTimer) { this._rainTroughTimer.remove(); this._rainTroughTimer = null; }
  }
};
