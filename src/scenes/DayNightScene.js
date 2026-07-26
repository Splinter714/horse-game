import Phaser from 'phaser';
import { EVENTS } from '../data/events.js';
import { loadDevSettings } from '../data/save.js';
import { applyDpr, logicalW, logicalH } from './uiUtils.js';
import { WEATHER, nextWeather } from '../data/weather.js';
import { seasonForDay, seasonPalette, nextSeason, SEASON_ORDER } from '../data/seasons.js';
import {
  nightProgress, isLateNightWarning, isPastLateNightLock,
  LATE_NIGHT_WARN_FRACTION, LATE_NIGHT_LOCK_FRACTION,
} from '../data/lateNight.js';

// Rain adds a subtle cool darkening ON TOP of the day/night tint (composed, gentle
// so it reads as overcast, never murky).
const RAIN_TINT_COLOR = 0x3a4a66;
const RAIN_TINT_ALPHA = 0.22;

// Rain particle field: thin pale streaks falling across the whole (logical) screen.
const RAIN_DROPS = 120;
const RAIN_ICONS = { [WEATHER.SUN]: '☀️', [WEATHER.RAIN]: '🌧️' };
// Dev weather-toggle label text (#327) — pairs with RAIN_ICONS for the readout.
const WEATHER_TEXT = { [WEATHER.SUN]: 'Sunny', [WEATHER.RAIN]: 'Rain' };

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

// Winter snow particle field (#272): mirrors the rain field, drawn once per frame
// into a single Graphics object (renderer-agnostic, works under Phaser.CANVAS).
const SNOW_FLAKES = 90;

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

    // ── Weather (#188) — rain wash composes over the day/night tint; _applyWeather()
    // drives visibility of it + the rain particle streaks.
    this.weatherTint = this.add.graphics().setDepth(501).setScrollFactor(0);
    this._buildRain();
    this._startWeather();

    // ── Seasons (#272) — a palette wash composed on top of day/night + weather,
    // plus winter snow. Advances one day per Morning; pure logic in data/seasons.js.
    this.seasonTint = this.add.graphics().setDepth(502).setScrollFactor(0);
    this._buildSnow();
    this._startSeasons();

    // Full-screen black used for the sleep fade. Sits above the day/night tint
    // (and, while sleeping, above the UI scenes — see doSleep).
    this.fade = this.add.graphics().setDepth(100_000).setScrollFactor(0);

    // Late-night forced sleep (#300): a vignette deepening toward the hard-lock —
    // a "getting sleepy" tell so auto-sleep doesn't feel random.
    this.lateNightVignette = this.add.graphics().setDepth(505).setScrollFactor(0);
    this.lateNightLabel = this.add.text(0, 0, '💤 Getting late...', {
      fontFamily: 'system-ui, sans-serif', fontSize: '16px', fontStyle: 'italic',
      color: '#ffffff', backgroundColor: '#00000099', padding: { x: 10, y: 6 },
    }).setDepth(520).setOrigin(0.5, 0).setScrollFactor(0).setVisible(false);
    this._lateNightLocked = false; // guards the forced-sleep trigger to once per night

    this.label   = this.add.text(0, 0, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: '22px', fontStyle: 'bold',
      color: '#ffffff', backgroundColor: '#000000bf', // opaque box reads over a bright world (#120)
      padding: { x: 12, y: 8 },
    }).setDepth(520).setOrigin(1, 0).setScrollFactor(0);

    // Tap the time-of-day display to skip to the next phase (#89). Available in the
    // live build too, not just dev — handy for testing on the deployed game and a
    // quick way to nudge time along (sleeping at the barn still passes the night).
    this.label.setInteractive({ useHandCursor: true });
    this.label.on('pointerdown', () => this._advancePhase());

    // Season readout, tucked under the time label (top-right). Tapping it skips to
    // the next season. Available in the live build too, not just dev (mirrors the
    // time label and FPS counter — the owner tests on the deployed build).
    this.seasonLabel = this.add.text(0, 0, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', fontStyle: 'bold',
      color: '#ffffff', backgroundColor: '#000000bf', padding: { x: 10, y: 6 },
    }).setDepth(520).setOrigin(1, 0).setScrollFactor(0);
    this.seasonLabel.setInteractive({ useHandCursor: true });
    this.seasonLabel.on('pointerdown', () => this._advanceSeason());

    // Weather readout, tucked under the season label (top-right, #327). Tapping it
    // force-toggles sun ↔ rain via _devSetWeather (same mechanism the pause-menu's
    // Random Events dev triggers use). Available in the live build too, not just
    // dev — same reasoning as the time/season labels above.
    this.weatherLabel = this.add.text(0, 0, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', fontStyle: 'bold',
      color: '#ffffff', backgroundColor: '#000000bf', padding: { x: 10, y: 6 },
    }).setDepth(520).setOrigin(1, 0).setScrollFactor(0);
    this.weatherLabel.setInteractive({ useHandCursor: true });
    this.weatherLabel.on('pointerdown', () => this._advanceWeather());

    this.overlay.setScrollFactor(0);

    // Full-screen overlay/label work in LOGICAL px (the camera zoom scales them to
    // the physical buffer). gameSize is physical, so read the logical size.
    this._sw = logicalW(this);
    this._sh = logicalH(this);
    this.scale.on('resize', () => {
      this._sw = logicalW(this);
      this._sh = logicalH(this);
      this._applyWeather?.(); // rain wash covers the whole (resized) screen
      this._applySeason?.();  // seasonal wash covers the whole (resized) screen
      this._applyLateNight?.(0); // vignette covers the whole (resized) screen
    });

    this.game.events.on(EVENTS.SLEEP, this.doSleep, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(EVENTS.SLEEP, this.doSleep, this);
    });
  }

  // Fade to black, jump the clock to morning, then fade back in. Lifts this scene
  // to the top so the black covers everything, then restores the UI on top after.
  doSleep() {
    if (this._sleeping) return;

    // Sleeping from INSIDE the house (#56): this scene is paused, so its tweens
    // won't advance. The house runs its own local fade; here we just jump the
    // clock synchronously so the next _applyClock() fires Morning on resume.
    if (this.scene.isPaused()) {
      this.elapsed = 0;
      this.currentPhase = -1;
      this.game.events.emit(EVENTS.SLEEP_DONE);
      return;
    }

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
    this._animateSnow(delta);
  }

  // ── Weather state machine (#188): a sun ↔ rain timer. Each state runs for a
  // rolled duration, then nextWeather() (pure) picks the next state. Changes fan
  // out on EVENTS.WEATHER_CHANGE so PaddockScene can react.
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

  // Dev trigger (#188/#253): force the weather on demand, re-arming the timer with
  // a fresh duration so the forced state lingers instead of rolling away next tick.
  _devSetWeather(weather) {
    this._weatherReady = true;
    const { durationMs } = nextWeather(weather, 1);
    this._weatherLeft = durationMs;
    this._setWeather(weather, /* announce */ true);
  }

  // Build the rain particle field: a pool of thin pale streaks that fall and wrap,
  // drawn once per frame into a single Graphics object (renderer-agnostic).
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

  // Show/hide the rain wash + particles for the current weather; composited over
  // the day/night tint (not merged) so both read together at any time of day.
  _applyWeather() {
    const raining = this._weather === WEATHER.RAIN;
    this.weatherTint.clear();
    if (raining) {
      this.weatherTint.fillStyle(RAIN_TINT_COLOR, RAIN_TINT_ALPHA);
      this.weatherTint.fillRect(0, 0, this._sw, this._sh);
    }
    this.rainGfx?.setVisible(raining);
    if (!raining) this.rainGfx?.clear();
    if (this.weatherLabel) {
      const icon = RAIN_ICONS[this._weather] ?? RAIN_ICONS[WEATHER.SUN];
      const label = WEATHER_TEXT[this._weather] ?? WEATHER_TEXT[WEATHER.SUN];
      this.weatherLabel.setText(`${icon} ${label}`);
      this.weatherLabel.setPosition(this._sw - 8, 80);
    }
  }

  // Dev tool: force-toggle the weather on tap (#327). Only two states exist
  // (data/weather.js), so this just flips between them via _devSetWeather.
  _advanceWeather() {
    const next = this._weather === WEATHER.RAIN ? WEATHER.SUN : WEATHER.RAIN;
    this._devSetWeather(next);
  }

  // ── Seasons (#272, VISUAL ONLY): a day counter advances at each Morning; season
  // is derived from it (pure seasonForDay). Changes fan out on EVENTS.SEASON_CHANGE.
  _startSeasons() {
    this._day = 0;
    this._season = null; // forces the first _setSeason to announce + apply
    // Emit the starting season once other scenes have had a chance to subscribe.
    this.time.delayedCall(0, () => {
      this._setSeason(seasonForDay(this._day), /* announce */ true);
    });
  }

  // Called when a new in-game day begins (Morning). Bumps the day counter and, if the
  // day crossed a season boundary, switches season (which announces + re-applies).
  _advanceDay() {
    this._day += 1;
    const season = seasonForDay(this._day);
    if (season !== this._season) this._setSeason(season, /* announce */ true);
  }

  _setSeason(season, announce) {
    this._season = season;
    this._applySeason();
    if (announce) this.game.events.emit(EVENTS.SEASON_CHANGE, { season });
  }

  // Dev tool: skip to the next season on tap. Jumps the day counter to the start
  // of the next season so the derived season stays consistent with the day count.
  _advanceSeason() {
    const target = nextSeason(this._season ?? seasonForDay(this._day));
    // Walk the day forward to the first day of the target season (at most a full
    // year of steps — cheap, and keeps _day authoritative).
    for (let i = 0; i < SEASON_ORDER.length * 366; i++) {
      this._day += 1;
      if (seasonForDay(this._day) === target) break;
    }
    this._setSeason(target, /* announce */ true);
  }

  // Build the snow particle field (winter only): a pool of pale flakes that drift and
  // wrap. Same single-Graphics approach as the rain field so it's renderer-agnostic.
  _buildSnow() {
    this.snowGfx = this.add.graphics().setDepth(511).setScrollFactor(0).setVisible(false);
    this._snowFlakes = [];
    for (let i = 0; i < SNOW_FLAKES; i++) {
      this._snowFlakes.push({
        x: Math.random() * this._sw,
        y: Math.random() * this._sh,
        r: 1 + Math.random() * 2,
        speed: 30 + Math.random() * 40, // px/sec — slow, floaty fall
        sway: Math.random() * Math.PI * 2,
        swaySpeed: 0.5 + Math.random() * 1.2,
      });
    }
  }

  _animateSnow(delta) {
    if (!this.snowGfx?.visible) return;
    const sw = this._sw, sh = this._sh;
    const dt = delta / 1000;
    this.snowGfx.clear();
    this.snowGfx.fillStyle(0xffffff, 0.85);
    for (const f of this._snowFlakes) {
      f.y += f.speed * dt;
      f.sway += f.swaySpeed * dt;
      f.x += Math.sin(f.sway) * 12 * dt; // gentle horizontal drift
      if (f.y > sh) { f.y = -f.r; f.x = Math.random() * sw; }
      if (f.x > sw) f.x -= sw;
      if (f.x < 0)  f.x += sw;
      this.snowGfx.fillCircle(f.x, f.y, f.r);
    }
  }

  // Apply the current season's palette wash + snow visibility, composited over the
  // day/night + weather tints so all three read together.
  _applySeason() {
    const pal = seasonPalette(this._season);
    this.seasonTint.clear();
    if (pal.alpha > 0.005) {
      this.seasonTint.fillStyle(pal.tint, pal.alpha);
      this.seasonTint.fillRect(0, 0, this._sw, this._sh);
    }
    this.snowGfx?.setVisible(!!pal.snow);
    if (!pal.snow) this.snowGfx?.clear();
    if (this.seasonLabel) {
      this.seasonLabel.setText(`${pal.icon} ${pal.label}`);
      this.seasonLabel.setPosition(this._sw - 8, 44);
    }
  }

  // Recompute the lighting overlay + clock label from `elapsed` and emit any phase
  // change. Split out of update() so a paused scene can still refresh on demand.
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
      const prevPhase = this.currentPhase;
      this.currentPhase = phaseIdx;
      // A new in-game day begins when we (re)enter Morning — but NOT on the very first
      // clock tick (prevPhase === -1), which is just the initial phase, not a rollover.
      // Sleeping also resets to Morning via this path, so a night's sleep counts as a
      // day. Advance the season day counter (#272) on that transition.
      if (p0.name === 'Morning' && prevPhase !== -1 && prevPhase !== phaseIdx) {
        this._advanceDay?.();
      }
      // Leaving Night resets the forced-sleep guard so next night can fire again.
      if (p0.name !== 'Night') this._lateNightLocked = false;
      this.game.events.emit(EVENTS.PHASE_CHANGE, { phase: p0.name, isNight: p0.name === 'Night' });
    }

    // Late-night forced sleep (#300): drive the warning vignette + hard-lock off how
    // far into the CURRENT Night phase we are (intoPhase/dur from the tint math above).
    this._applyLateNight(p0.name === 'Night' ? nightProgress(intoPhase, dur) : 0, p0.name);
  }

  // Warning vignette + forced-sleep trigger (#300). `progress` is 0..1 into Night.
  // Pure decisions live in data/lateNight.js; this fires the same EVENTS.SLEEP flow.
  _applyLateNight(progress, phase) {
    const warning = isLateNightWarning(phase, progress);
    this.lateNightVignette.clear();
    if (warning) {
      const t = Math.min(1, (progress - LATE_NIGHT_WARN_FRACTION) / (LATE_NIGHT_LOCK_FRACTION - LATE_NIGHT_WARN_FRACTION || 1));
      const alpha = 0.12 + 0.28 * t; // deepens as the lock approaches
      const sw = this._sw, sh = this._sh, edge = Math.min(sw, sh) * 0.28;
      this.lateNightVignette.fillStyle(0x000010, alpha);
      this.lateNightVignette.fillRect(0, 0, sw, edge);
      this.lateNightVignette.fillRect(0, sh - edge, sw, edge);
      this.lateNightVignette.fillRect(0, 0, edge, sh);
      this.lateNightVignette.fillRect(sw - edge, 0, edge, sh);
    }
    this.lateNightLabel.setVisible(warning);
    if (warning) this.lateNightLabel.setPosition(this._sw / 2, 8);

    // Past the threshold, sleep becomes involuntary — fires once per night.
    if (isPastLateNightLock(phase, progress) && !this._lateNightLocked && !this._sleeping) {
      this._lateNightLocked = true;
      this.game.events.emit(EVENTS.SLEEP);
    }
  }
}
