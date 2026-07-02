import Phaser from 'phaser';
import { EVENTS } from '../data/events.js';
import { loadDevSettings } from '../data/save.js';
import { applyDpr, logicalW, logicalH } from './uiUtils.js';
import { WEATHER, nextWeather } from '../data/weather.js';

// Rain adds a subtle cool darkening on TOP of the day/night tint (composed, not
// replacing it — a blue-grey wash at low alpha). Kept gentle so it reads as
// overcast, never murky.
const RAIN_TINT_COLOR = 0x3a4a66;
const RAIN_TINT_ALPHA = 0.22;

// Rain particle field: thin pale streaks falling across the whole (logical) screen.
const RAIN_DROPS = 120;
const RAIN_ICONS = { [WEATHER.SUN]: '☀️', [WEATHER.RAIN]: '🌧️' };

// Total cycle ~10.5 min. Long daylight so there's plenty of time for chores:
// morning 2 min + afternoon 5 min + evening 2 min = 9 min day, night 1.5 min.
const PHASES = [
  { name: 'Morning',   color: 0xffcc44, alpha: 0.13, dur: 120_000 },
  { name: 'Afternoon', color: 0xffffff, alpha: 0.00, dur: 300_000 },
  { name: 'Evening',   color: 0xff7722, alpha: 0.20, dur: 120_000 },
  { name: 'Night',     color: 0x1a2255, alpha: 0.48, dur:  90_000 },
];
const DAY_MS = PHASES.reduce((s, p) => s + p.dur, 0);

// Each phase holds its color/alpha steady, then crossfades to the next phase
// over this window at the very end of the phase. (Clamped to half the phase's
// duration so short phases still hold for a moment.)
const TRANSITION_MS = 15_000;

const PHASE_ICONS = ['🌅', '☀️', '🌇', '🌙'];

export default class DayNightScene extends Phaser.Scene {
  constructor() {
    super('DayNightScene');
  }

  create() {
    applyDpr(this, { topLeft: true }); // HiDPI: zoom this UI scene's camera (top-left anchored)

    this.elapsed     = 0;
    this.currentPhase = -1; // triggers initial phase-change event

    // Dev tool (pause menu): boot the clock into a chosen phase so the owner can
    // test a specific time of day without waiting out the cycle. Sets elapsed to
    // the start of that phase; currentPhase stays -1 so the first update still
    // fires the phase-change event.
    const startPhase = loadDevSettings().startPhase;
    if (startPhase) {
      let off = 0;
      for (const p of PHASES) {
        if (p.name === startPhase) { this.elapsed = off; break; }
        off += p.dur;
      }
    }
    this._sleeping   = false;

    this.overlay = this.add.graphics().setDepth(500);

    // ── Weather (#188) ──────────────────────────────────────────────────────
    // The rain wash sits just above the day/night tint so it composes with it,
    // and below the sleep fade + label. The rain particle streaks sit above the
    // wash. Both are set up here; _applyWeather() drives their visibility.
    this.weatherTint = this.add.graphics().setDepth(501).setScrollFactor(0);
    this._buildRain();
    this._startWeather();

    // Full-screen black used for the sleep fade. Sits above the day/night tint
    // (and, while sleeping, above the UI scenes — see doSleep).
    this.fade = this.add.graphics().setDepth(100_000).setScrollFactor(0);
    this.label   = this.add.text(0, 0, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#ffffff',
      backgroundColor: '#000000bf', // more opaque box so it reads over the bright world (#120)
      padding: { x: 12, y: 8 },
    }).setDepth(520).setOrigin(1, 0).setScrollFactor(0);

    // Tap the time-of-day display to skip to the next phase (#89). Available in the
    // live build too, not just dev — handy for testing on the deployed game and a
    // quick way to nudge time along (sleeping at the barn still passes the night).
    this.label.setInteractive({ useHandCursor: true });
    this.label.on('pointerdown', () => this._advancePhase());

    this.overlay.setScrollFactor(0);

    // Full-screen overlay/label work in LOGICAL px (the camera zoom scales them to
    // the physical buffer). gameSize is physical, so read the logical size.
    this._sw = logicalW(this);
    this._sh = logicalH(this);
    this.scale.on('resize', () => {
      this._sw = logicalW(this);
      this._sh = logicalH(this);
      this._applyWeather?.(); // rain wash covers the whole (resized) screen
    });

    this.game.events.on(EVENTS.SLEEP, this.doSleep, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(EVENTS.SLEEP, this.doSleep, this);
    });
  }

  // Fade to black, jump the clock to morning, then fade back in. The day/night
  // tint normally renders below the UI scenes; for the fade we lift this scene
  // to the top so the black covers everything, then restore the UI on top after.
  doSleep() {
    if (this._sleeping) return;
    this._sleeping = true;
    this.scene.bringToTop();

    const a = { v: 0 };
    const draw = () => {
      this.fade.clear();
      this.fade.fillStyle(0x000000, a.v);
      this.fade.fillRect(0, 0, this._sw, this._sh);
    };

    this.tweens.add({
      targets: a, v: 1, duration: 700, ease: 'Sine.easeIn', onUpdate: draw,
      onComplete: () => {
        // Jump to the start of Morning (first phase) and force a phase-change
        // so the paddock wakes any sleeping animals.
        this.elapsed = 0;
        this.currentPhase = -1;
        this.time.delayedCall(450, () => {
          this.tweens.add({
            targets: a, v: 0, duration: 800, ease: 'Sine.easeOut', onUpdate: draw,
            onComplete: () => {
              this.fade.clear();
              this._sleeping = false;
              // Put the UI scenes back above the day/night tint.
              this.scene.bringToTop('InfoPanelScene');
              this.scene.bringToTop('HotbarScene');
              this.game.events.emit(EVENTS.SLEEP_DONE);
            },
          });
        });
      },
    });
  }

  // Jump the clock to the start of the next phase (wired to the time label's tap
  // handler in create()). Available in the live build (#89).
  _advancePhase() {
    if (this._sleeping) return;
    let phaseStart = 0, phaseIdx = 0;
    for (let i = 0; i < PHASES.length; i++) {
      if (this.elapsed < phaseStart + PHASES[i].dur) { phaseIdx = i; break; }
      phaseStart += PHASES[i].dur;
      phaseIdx = i;
    }
    const nextStart = (phaseStart + PHASES[phaseIdx].dur) % DAY_MS;
    this.elapsed = nextStart;
  }

  update(_time, delta) {
    this.elapsed = (this.elapsed + delta) % DAY_MS;
    this._applyClock();
    this._tickWeather(delta);
  }

  // ── Weather state machine (#188) ──────────────────────────────────────────
  // A simple sun ↔ rain timer. Each state runs for a rolled duration, then
  // nextWeather() (pure) picks the following state + its duration. State changes
  // fan out on EVENTS.WEATHER_CHANGE so PaddockScene can react (dirt rate,
  // wildlife hiding, trough rain-fill).

  _startWeather() {
    this._weather = WEATHER.SUN;
    this._weatherLeft = 0; // forces an immediate roll on the first tick
    this._weatherReady = false;
    // Emit the starting state once the paddock has had a chance to subscribe.
    this.time.delayedCall(0, () => {
      this._weatherReady = true;
      this._setWeather(this._weather, /* announce */ true);
      const { durationMs } = nextWeather(WEATHER.RAIN, 1); // seed a sun duration
      this._weatherLeft = durationMs;
    });
  }

  _tickWeather(delta) {
    if (!this._weatherReady) return;
    this._weatherLeft -= delta;
    if (this._weatherLeft <= 0) {
      const { state, durationMs } = nextWeather(this._weather, Math.random());
      this._weatherLeft = durationMs;
      if (state !== this._weather) this._setWeather(state, true);
    }
    this._animateRain(delta);
  }

  _setWeather(weather, announce) {
    this._weather = weather;
    this._applyWeather();
    if (announce) this.game.events.emit(EVENTS.WEATHER_CHANGE, { weather });
  }

  // Build the rain particle field: a pool of thin pale streaks that fall and wrap.
  // Drawn once per frame into a single Graphics object (cheap, renderer-agnostic —
  // no WebGL particle emitter, so it works under Phaser.CANVAS in the smoke test).
  _buildRain() {
    this.rainGfx = this.add.graphics().setDepth(510).setScrollFactor(0).setVisible(false);
    this._rainDrops = [];
    for (let i = 0; i < RAIN_DROPS; i++) {
      this._rainDrops.push({
        x: Math.random() * this._sw,
        y: Math.random() * this._sh,
        len: 10 + Math.random() * 14,
        speed: 520 + Math.random() * 380, // px/sec
      });
    }
  }

  _animateRain(delta) {
    if (this._weather !== WEATHER.RAIN || !this.rainGfx?.visible) return;
    const sw = this._sw, sh = this._sh;
    const dt = delta / 1000;
    const drift = 60 * dt; // a slight wind slant
    this.rainGfx.clear();
    this.rainGfx.lineStyle(2, 0xbcd0ea, 0.55);
    for (const d of this._rainDrops) {
      d.y += d.speed * dt;
      d.x += drift;
      if (d.y > sh) { d.y = -d.len; d.x = Math.random() * sw; }
      if (d.x > sw) d.x -= sw;
      this.rainGfx.lineBetween(d.x, d.y, d.x - drift * 0.5, d.y - d.len);
    }
  }

  // Show/hide the rain wash + particles for the current weather. The wash is a
  // separate low-alpha layer composited over the day/night tint (not merged into
  // it), so both read together — overcast at any time of day.
  _applyWeather() {
    const raining = this._weather === WEATHER.RAIN;
    this.weatherTint.clear();
    if (raining) {
      this.weatherTint.fillStyle(RAIN_TINT_COLOR, RAIN_TINT_ALPHA);
      this.weatherTint.fillRect(0, 0, this._sw, this._sh);
    }
    this.rainGfx?.setVisible(raining);
    if (!raining) this.rainGfx?.clear();
  }

  // Recompute the lighting overlay + clock label from the current `elapsed` time
  // and emit any phase change. Split out of update() so the dev-tools "Advance
  // Time" button can refresh the clock on demand WITHOUT unpausing — a paused
  // Phaser scene still renders, so a redraw here is visible while paused.
  _applyClock() {
    // Find which phase we're in based on variable durations
    let phaseIdx = 0, phaseStart = 0;
    for (let i = 0; i < PHASES.length; i++) {
      if (this.elapsed < phaseStart + PHASES[i].dur) { phaseIdx = i; break; }
      phaseStart += PHASES[i].dur;
      phaseIdx = i;
    }
    const nextIdx = (phaseIdx + 1) % PHASES.length;

    // Hold the phase value steady, only crossfade during the trailing window.
    const dur        = PHASES[phaseIdx].dur;
    const transition = Math.min(TRANSITION_MS, dur / 2);
    const intoPhase  = this.elapsed - phaseStart;
    const blend      = intoPhase <= dur - transition
      ? 0
      : (intoPhase - (dur - transition)) / transition;

    const p0 = PHASES[phaseIdx];
    const p1 = PHASES[nextIdx];

    const r0 = (p0.color >> 16) & 0xff, g0 = (p0.color >> 8) & 0xff, b0 = p0.color & 0xff;
    const r1 = (p1.color >> 16) & 0xff, g1 = (p1.color >> 8) & 0xff, b1 = p1.color & 0xff;
    const r = Math.round(r0 + (r1 - r0) * blend);
    const g = Math.round(g0 + (g1 - g0) * blend);
    const b = Math.round(b0 + (b1 - b0) * blend);
    const color = (r << 16) | (g << 8) | b;
    const alpha = p0.alpha + (p1.alpha - p0.alpha) * blend;

    const sw = this._sw, sh = this._sh;
    this.overlay.clear();
    if (alpha > 0.005) {
      this.overlay.fillStyle(color, alpha);
      this.overlay.fillRect(0, 0, sw, sh);
    }

    // Lightweight 'today's weather' indicator: append the weather icon to the
    // time-of-day label (#188). Falls back to sun until the first weather roll.
    const wxIcon = RAIN_ICONS[this._weather] ?? RAIN_ICONS[WEATHER.SUN];
    this.label.setText(`${PHASE_ICONS[phaseIdx]} ${p0.name}  ${wxIcon}`);
    this.label.setPosition(sw - 8, 8);

    if (phaseIdx !== this.currentPhase) {
      this.currentPhase = phaseIdx;
      this.game.events.emit(EVENTS.PHASE_CHANGE, { phase: p0.name, isNight: p0.name === 'Night' });
    }
  }
}
