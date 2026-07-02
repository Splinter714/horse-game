// The unified ambient-event scheduler + dev triggers (issue #253). Applied as a
// functional mixin so `this` is the scene.
//
// A single low-frequency timer walks the data-driven registry (data/ambientEvents.js):
// each tick it snapshots the world context (phase / asleep / weather), asks the pure
// helpers which registered events are eligible right now, weighted-picks one, and
// fires it via the registry's `fire(scene)` closure — which reuses the existing
// spawn/roll primitives. So EVERY declared event auto-schedules; there's no per-event
// timer to maintain and no separate dev-overlay list (pauseMenu.js derives that from
// the same registry).
//
// It complements, rather than replaces, the species/wildlife primitives' own internal
// pacing (birds still stagger their first appearance, the raccoon keeps its nocturnal
// cadence, egg-lay keeps its 45s tick). This adds a gentle extra sprinkle of ambient
// life driven entirely off the registry, and — crucially — is the one code path both
// the rotation and the dev overlay share, so a new event lights up in both at once.
//
// Also hosts the dev-only cheats the overlay exposes: force the weather state (#188)
// and force a horse's mood so all three postures show on demand (#69).

import Phaser from 'phaser';
import { playNicker } from '../../audio/sounds.js';
import { EVENTS } from '../../data/events.js';
import { WEATHER } from '../../data/weather.js';
import {
  AMBIENT_EVENTS, eligibleEvents, pickEvent,
} from '../../data/ambientEvents.js';

// How often the unified scheduler considers firing an ambient event (ms). Picked to
// be a gentle sprinkle on top of the per-critter pacing, not a firehose. Real delay
// jitters within [min, max] each round.
const AMBIENT_TICK_MS = { min: 14_000, max: 26_000 };

export const WithAmbientEvents = (Base) => class extends Base {
  // Start the unified ambient rotation. Safe to call once from create().
  startAmbientEvents() {
    this._scheduleAmbientEvent(this._ambientDelay());
  }

  _ambientDelay() {
    return Phaser.Math.Between(AMBIENT_TICK_MS.min, AMBIENT_TICK_MS.max);
  }

  _scheduleAmbientEvent(delay) {
    this.time.delayedCall(delay, () => {
      this._fireAmbientEvent();
      this._scheduleAmbientEvent(this._ambientDelay());
    });
  }

  // One rotation tick: pick a registry event eligible for the current world context
  // and fire it. The pure helpers own the "which are eligible / which to pick"
  // decisions; this just snapshots context and dispatches.
  _fireAmbientEvent() {
    const ctx = this._ambientCtx();
    const choices = eligibleEvents(ctx);
    const event = pickEvent(choices, Math.random());
    if (event) event.fire(this);
  }

  // The plain, Phaser-free world snapshot the pure eligibility gates read.
  _ambientCtx() {
    return {
      phase: this._phase,
      sleeping: !!this._sleeping,
      weather: this._weather ?? WEATHER.SUN,
    };
  }

  // ── Dev triggers (wired from the registry's dev-only entries) ──────────────

  // Nicker helper so the registry's horse-nicker `fire(scene)` closure has a scene
  // method to call (the audio module import lives here, not in the pure registry).
  _playNicker() {
    playNicker();
  }

  // Force the weather state on demand (#188). Drives DayNightScene's weather machine
  // so the tint / particles / indicator AND the paddock hooks (dirt rate, wildlife
  // hiding, trough rain-fill) all switch, exactly as a natural weather change would.
  _devForceWeather(weather) {
    const dn = this.scene.get('DayNightScene');
    if (dn?._devSetWeather) { dn._devSetWeather(weather); return; }
    // Fallback: at least fan out the event so the paddock hooks react.
    this.game.events.emit(EVENTS.WEATHER_CHANGE, { weather });
  }

  // Force a horse's mood so #69's postures are reachable instantly (dev cheat).
  //   'neglected' → pinned ears     (sets horse.neglected)
  //   'sad'       → drooped side-flop posture (drops happiness below the threshold)
  //   'happy'     → neutral/content posture   (clears neglect, restores happiness)
  // Picks a live horse (a visible idle one if possible) and re-applies its posture.
  _devForceMood(mood) {
    const pool = (this.horses ?? []).filter((h) => h.sprite?.active);
    if (!pool.length) return;
    // Prefer an idle horse so the posture is visible immediately (idle-only pose).
    const idle = pool.filter((h) => h.state === 'idle');
    const h = (idle.length ? idle : pool)[Phaser.Math.Between(0, (idle.length ? idle : pool).length - 1)];
    const horse = this.registry.get('allHorses')?.[h.key];
    if (!horse) return;

    if (mood === 'neglected') {
      horse.neglected = true;
    } else if (mood === 'sad') {
      horse.neglected = false;
      horse.stats.happiness = 30; // below the <55 "content"/droop threshold (horseArt)
    } else { // 'happy'
      horse.neglected = false;
      horse.stats.happiness = 100;
    }
    this.game.events.emit(EVENTS.STATS_CHANGED);
    // Re-pose right away if it's standing idle (otherwise it updates on the next idle).
    this._applyPosture?.(h);
  }
};
