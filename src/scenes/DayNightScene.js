import Phaser from 'phaser';

// Total cycle: 4 min. Day = 2 min (morning 30s + afternoon 60s + evening 30s), Night = 2 min.
const PHASES = [
  { name: 'Morning',   color: 0xffcc44, alpha: 0.13, dur: 30_000 },
  { name: 'Afternoon', color: 0xffffff, alpha: 0.00, dur: 60_000 },
  { name: 'Evening',   color: 0xff7722, alpha: 0.20, dur: 30_000 },
  { name: 'Night',     color: 0x1a2255, alpha: 0.48, dur: 120_000 },
];
const DAY_MS = PHASES.reduce((s, p) => s + p.dur, 0);

const PHASE_ICONS = ['🌅', '☀️', '🌇', '🌙'];

export default class DayNightScene extends Phaser.Scene {
  constructor() {
    super('DayNightScene');
  }

  create() {
    this.elapsed     = 0;
    this.currentPhase = -1; // triggers initial phase-change event

    this.overlay = this.add.graphics().setDepth(500);
    this.label   = this.add.text(0, 0, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: '#00000055',
      padding: { x: 6, y: 4 },
    }).setDepth(501).setOrigin(1, 0).setScrollFactor(0);

    this.overlay.setScrollFactor(0);

    this._sw = this.scale.width;
    this._sh = this.scale.height;
    this.scale.on('resize', (gameSize) => {
      this._sw = gameSize.width;
      this._sh = gameSize.height;
    });
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
    const blend   = (this.elapsed - phaseStart) / PHASES[phaseIdx].dur;

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
