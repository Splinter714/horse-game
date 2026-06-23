import Phaser from 'phaser';
import { EVENTS } from '../data/events.js';
import { getSpecies } from '../data/species/index.js';

// Unified slide-in info panel for any animal. What it shows is driven entirely by
// the animal's species data (../data/species): stat bars come from `needs`
// (+happiness), action buttons from `actions`, plus a `panel` block for portrait
// style / trait line / fixed-attribute row. Replaces the old per-species
// PortraitScene + ChickenInfoScene — a new species gets a working panel for free.

const PANEL_W = 300;

export default class InfoPanelScene extends Phaser.Scene {
  constructor() {
    super('InfoPanelScene');
    this.statFills = {};
    this.moodText  = null;
    this.panel     = null;
    this.closing   = false;
  }

  create() {
    this.closing = false;
    this.build();
    this.input.keyboard.on('keydown-ESC', () => this.close());
  }

  refresh() {
    this.closing = false;
    this.children.removeAll(true);
    this.input.keyboard.removeAllListeners();
    this.statFills = {};
    this.moodText  = null;
    this.panel     = null;
    this.build();
    this.input.keyboard.on('keydown-ESC', () => this.close());
  }

  // Stat keys to show as bars: every decaying need, plus happiness if the species
  // has it. Returns [{ key, label, color }].
  _statRows(spec) {
    const rows = Object.entries(spec.needs).map(([key, n]) => ({ key, label: n.label, color: n.color }));
    if (spec.happiness) rows.push({ key: 'happiness', label: spec.happiness.label, color: spec.happiness.color });
    return rows;
  }

  build() {
    const sw = this.scale.width;
    const sh = this.scale.height;
    const panelX = sw - PANEL_W;
    this._sw = sw;

    const viewing = this.registry.get('viewingAnimal');
    const animal  = viewing?.animal;
    const key     = viewing?.key ?? 'horse';
    if (!animal) { this.scene.stop(); return; }
    const spec = getSpecies(animal.species);
    const cfg  = spec.panel ?? {};

    // Dim backdrop over the play area — clicking it closes the panel.
    const backdrop = this.add.rectangle(0, 0, panelX, sh, 0x000000, 0.28)
      .setOrigin(0, 0).setInteractive();
    backdrop.on('pointerdown', () => this.close());

    // Panel container slides in from off-screen right.
    this.panel = this.add.container(sw, 0);

    const bg = this.add.graphics();
    bg.fillStyle(0xf4f1ec, 1);
    bg.fillRect(0, 0, PANEL_W, sh);
    bg.lineStyle(2, 0xd4cec4, 1);
    bg.lineBetween(0, 0, 0, sh);
    this.panel.add(bg);

    // ── Portrait (animated for species with idle frames, else a static image) ──
    if (cfg.portrait === 'animated') {
      const animKey = `panel_idle_${key}`;
      if (!this.anims.exists(animKey)) {
        this.anims.create({
          key: animKey,
          frames: [{ key: `${key}_idle_0` }, { key: `${key}_idle_1` }],
          frameRate: 2, repeat: -1,
        });
      }
      const sprite = this.add.sprite(PANEL_W / 2, 100, `${key}_idle_0`)
        .setScale(3).setOrigin(0.5, 0.5);
      sprite.play(animKey);
      this.panel.add(sprite);
    } else {
      this.panel.add(this.add.image(PANEL_W / 2, 100, `portrait_${key}`)
        .setDisplaySize(100, 100).setOrigin(0.5, 0.5));
    }

    // ── Name / breed / age ─────────────────────────────────────────────
    this.panel.add(this.add.text(PANEL_W / 2, 182, animal.name, {
      fontFamily: 'system-ui, sans-serif', fontSize: '22px',
      color: '#2c2c2a', fontStyle: 'bold',
    }).setOrigin(0.5, 0));

    this.panel.add(this.add.text(PANEL_W / 2, 212, `${animal.breed}  ·  ${animal.age} ${animal.age === 1 ? 'yr' : 'yrs'}`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#6a6860',
    }).setOrigin(0.5, 0));

    let infoY = 232;

    // ── Optional trait line (e.g. chicken personality) ─────────────────
    if (cfg.traitLine && animal[cfg.traitLine]) {
      this.panel.add(this.add.text(PANEL_W / 2, infoY, `${animal[cfg.traitLine]}`, {
        fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#a47a4a',
        fontStyle: 'italic',
      }).setOrigin(0.5, 0));
      infoY += 22;
    }

    // ── Optional fixed attributes (e.g. Ebony's health/speed/stamina) ──
    if (cfg.fixedAttrs && animal.health !== undefined) {
      this.panel.add(this.add.text(PANEL_W / 2, infoY,
        `Health ${animal.health}  ·  Speed ${animal.speed}  ·  Stamina ${animal.stamina}`, {
          fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: '#8a6a3a',
        }).setOrigin(0.5, 0));
      infoY += 20;
    }

    // ── Mood line (species with happiness) ─────────────────────────────
    if (spec.mood) {
      this.moodText = this.add.text(PANEL_W / 2, infoY, `Feeling ${animal.mood()}`, {
        fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#1d9e75',
      }).setOrigin(0.5, 0);
      this.panel.add(this.moodText);
      infoY += 22;
    }

    this.addDivider(infoY);

    // ── Stat bars (one per need + happiness) ───────────────────────────
    const rows = this._statRows(spec);
    let barY = infoY + 14;
    for (const s of rows) {
      this.panel.add(this.add.text(14, barY, s.label, {
        fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#6a6860',
      }).setOrigin(0, 0.5));

      const trackX = 62;
      const trackW = PANEL_W - 76;
      const trackY = barY - 6;

      const trackBg = this.add.graphics();
      trackBg.fillStyle(0xe3ded3, 1);
      trackBg.fillRoundedRect(trackX, trackY, trackW, 12, 6);
      this.panel.add(trackBg);

      const v    = Phaser.Math.Clamp(animal.stats[s.key], 0, 100) / 100;
      const fill = this.add.graphics();
      fill.fillStyle(s.color, 1);
      fill.fillRoundedRect(trackX, trackY, Math.max(5, trackW * v), 12, 6);
      this.panel.add(fill);
      this.statFills[s.key] = { fill, trackX, trackW, color: s.color, trackY };

      barY += 26;
    }

    // ── Action buttons (2-col grid) ────────────────────────────────────
    const actions = Object.entries(spec.actions).map(([type, a]) => ({ type, label: a.label, icon: a.icon }));
    if (actions.length) {
      this.addDivider(barY + 6);
      const btnW = 124, btnH = 44, btnGap = 8;
      const btnY0 = barY + 20;
      actions.forEach((a, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const bx  = 14 + col * (btnW + btnGap);
        const by  = btnY0 + row * (btnH + btnGap);
        this.makeButton(bx, by, btnW, btnH, a.label, a.icon, () => this.act(a.type, animal, key));
      });
    }

    // ── Close button ───────────────────────────────────────────────────
    const closeBtn = this.add.text(PANEL_W - 12, 14, '✕', {
      fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#9a9790',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.close());
    this.panel.add(closeBtn);

    this.tweens.add({ targets: this.panel, x: panelX, duration: 220, ease: 'Quad.easeOut' });
  }

  addDivider(y) {
    const g = this.add.graphics();
    g.lineStyle(1, 0xd4cec4, 1);
    g.lineBetween(14, y, PANEL_W - 14, y);
    this.panel.add(g);
  }

  makeButton(bx, by, bw, bh, label, iconKey, onClick) {
    const g = this.add.graphics();
    const draw = (fill) => {
      g.clear();
      g.fillStyle(fill, 0.95);
      g.fillRoundedRect(bx, by, bw, bh, 8);
      g.lineStyle(1, 0xffffff, 0.12);
      g.strokeRoundedRect(bx, by, bw, bh, 8);
    };
    draw(0x3b4a63);
    this.panel.add(g);

    const icon = this.add.image(bx + 18, by + bh / 2, iconKey).setDisplaySize(18, 18);
    this.panel.add(icon);

    const txt = this.add.text(bx + 34, by + bh / 2, label, {
      fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#ffffff',
    }).setOrigin(0, 0.5);
    this.panel.add(txt);

    const zone = this.add.zone(bx, by, bw, bh).setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover',  () => draw(0x4a5d7d));
    zone.on('pointerout',   () => draw(0x3b4a63));
    zone.on('pointerdown',  () => draw(0x2c384c));
    zone.on('pointerup',    () => { draw(0x4a5d7d); onClick(); });
    this.panel.add(zone);
  }

  act(type, animal, key) {
    // PaddockScene.doAction is the single applier of the action to the model
    // (Phaser emits synchronously, so the shared object is already updated when
    // refreshStats reads it below). Applying here too would double-count.
    this.game.events.emit(EVENTS.ANIMAL_ACTION, { type, horseKey: key });
    this.refreshStats(animal);
  }

  refreshStats(animal) {
    for (const key of Object.keys(this.statFills)) {
      const { fill, trackX, trackW, color, trackY } = this.statFills[key];
      const v = Phaser.Math.Clamp(animal.stats[key], 0, 100) / 100;
      fill.clear();
      fill.fillStyle(color, 1);
      fill.fillRoundedRect(trackX, trackY, Math.max(5, trackW * v), 12, 6);
    }
    if (this.moodText) this.moodText.setText(`Feeling ${animal.mood()}`);
  }

  close() {
    if (this.closing) return;
    this.closing = true;
    this.tweens.add({
      targets: this.panel,
      x: this._sw ?? this.scale.width,
      duration: 180,
      ease: 'Quad.easeIn',
      onComplete: () => this.scene.stop(),
    });
  }
}
