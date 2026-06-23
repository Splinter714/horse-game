import Phaser from 'phaser';

// Total cycle: 4 min. Day = 2 min (morning 30s + afternoon 60s + evening 30s), Night = 2 min.
const PHASES = [
  { name: 'Morning',   color: 0xffcc44, alpha: 0.13, dur: 30_000 },
  { name: 'Afternoon', color: 0xffffff, alpha: 0.00, dur: 60_000 },
  { name: 'Evening',   color: 0xff7722, alpha: 0.20, dur: 30_000 },
  { name: 'Night',     color: 0x1a2255, alpha: 0.48, dur: 120_000 },
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
    this.elapsed     = 0;
    this.currentPhase = -1; // triggers initial phase-change event
    this._sleeping   = false;

    this.overlay = this.add.graphics().setDepth(500);

    // Full-screen black used for the sleep fade. Sits above the day/night tint
    // (and, while sleeping, above the UI scenes — see doSleep).
    this.fade = this.add.graphics().setDepth(100_000).setScrollFactor(0);
    this.label   = this.add.text(0, 0, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#00000066',
      padding: { x: 10, y: 6 },
    }).setDepth(501).setOrigin(1, 0).setScrollFactor(0);

    // TESTING ONLY: tap the time-of-day display to skip to the next phase.
    // Remove before release.
    this.label.setInteractive({ useHandCursor: true });
    this.label.on('pointerdown', () => this._advancePhase());

    this.overlay.setScrollFactor(0);

    this._sw = this.scale.width;
    this._sh = this.scale.height;
    this.scale.on('resize', (gameSize) => {
      this._sw = gameSize.width;
      this._sh = gameSize.height;
    });

    this.game.events.on('sleep', this.doSleep, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('sleep', this.doSleep, this);
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
              this.scene.bringToTop('PortraitScene');
              this.scene.bringToTop('ChickenInfoScene');
              this.scene.bringToTop('HotbarScene');
              this.game.events.emit('sleep-done');
            },
          });
        });
      },
    });
  }

  // TESTING ONLY: jump the clock to the start of the next phase. Remove before
  // release (along with the label's pointer handler in create()).
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

    this.label.setText(`${PHASE_ICONS[phaseIdx]} ${p0.name}`);
    this.label.setPosition(sw - 8, 8);

    if (phaseIdx !== this.currentPhase) {
      this.currentPhase = phaseIdx;
      this.game.events.emit('phase-change', { phase: p0.name, isNight: p0.name === 'Night' });
    }
  }
}
