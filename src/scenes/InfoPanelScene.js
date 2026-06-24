import Phaser from 'phaser';
import { getSpecies } from '../data/species/index.js';
import { growHitArea } from './uiUtils.js';
import { WithCustomizer } from './customizer.js';

// Lightweight, ephemeral info popup for any animal. It's a small floating card
// (not a modal panel) that auto-dismisses the moment you do almost anything else:
// tap away, press any key (Esc included), or move your character (PaddockScene
// closes it on movement). What it shows is driven entirely by the animal's
// species data (../data/species): stat bars from `needs` (+happiness), action
// buttons from `actions`, plus a `panel` block for portrait style / trait line /
// fixed-attribute row. A new species gets a working popup for free.

const CARD_W = 300;
const PAD    = 16;
// Brief grace window after opening so the key/tap that opened the popup can't
// instantly close it on the same input.
const OPEN_GRACE_MS = 140;

export default class InfoPanelScene extends WithCustomizer(Phaser.Scene) {
  constructor() {
    super('InfoPanelScene');
    this.statFills = {};
    this.moodText  = null;
    this.panel     = null;
    this.closing   = false;
    this._mode     = 'info';
  }

  create() {
    this.closing = false;
    this._mode = 'info';
    this.build();
    this._wireDismiss();
  }

  // Drive the appearance editor's controller focus (mixin) while in edit mode.
  update() {
    if (this._mode === 'edit') this._pollEditPad();
  }

  // Whether the currently-viewed animal supports the appearance editor (horses).
  _canEdit() {
    const animal = this.registry.get('viewingAnimal')?.animal;
    return !!(animal && getSpecies(animal.species)?.capabilities?.customizable);
  }

  refresh() {
    this.closing = false;
    this.children.removeAll(true);
    this.input.keyboard.removeAllListeners();
    this.input.removeAllListeners();
    this.statFills = {};
    this.moodText  = null;
    this.panel     = null;
    this.build();
    this._wireDismiss();
  }

  // Auto-dismiss wiring: any key (Esc included) or a tap on the backdrop closes
  // the popup. The brief grace window keeps the opening input from closing it.
  _wireDismiss() {
    this._openAt = this.time.now;
    this.input.keyboard.on('keydown', () => this._maybeDismiss());
  }

  _maybeDismiss() {
    if (this.time.now - this._openAt < OPEN_GRACE_MS) return;
    this.close();
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
    this._sw = sw;
    this._sh = sh;

    const viewing = this.registry.get('viewingAnimal');
    const animal  = viewing?.animal;
    const key     = viewing?.key ?? 'horse';
    if (!animal) { this.scene.stop(); return; }
    const spec = getSpecies(animal.species);
    const cfg  = spec.panel ?? {};

    // Faint full-screen catcher — a tap anywhere outside the card closes it.
    const catcher = this.add.rectangle(0, 0, sw, sh, 0x000000, 0.12)
      .setOrigin(0, 0).setInteractive();
    catcher.on('pointerdown', () => this._maybeDismiss());

    // Card container — positioned (centered) after we know its height.
    this.panel = this.add.container(0, 0);

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
      const sprite = this.add.sprite(CARD_W / 2, 78, `${key}_idle_0`)
        .setScale(3).setOrigin(0.5, 0.5);
      sprite.play(animKey);
      this.panel.add(sprite);
    } else {
      this.panel.add(this.add.image(CARD_W / 2, 78, `portrait_${key}`)
        .setDisplaySize(96, 96).setOrigin(0.5, 0.5));
    }

    // ── Name / breed / age ─────────────────────────────────────────────
    this.panel.add(this.add.text(CARD_W / 2, 138, animal.name, {
      fontFamily: 'system-ui, sans-serif', fontSize: '22px',
      color: '#2c2c2a', fontStyle: 'bold',
    }).setOrigin(0.5, 0));

    const ageStr = `${animal.age} ${animal.age === 1 ? 'yr' : 'yrs'}`;
    // Sex with a ♀/♂ glyph (#113) — identity now carried on every animal.
    const sexStr = animal.sex ? `  ·  ${animal.sex === 'male' ? '♂ Male' : '♀ Female'}` : '';
    this.panel.add(this.add.text(CARD_W / 2, 168, `${animal.breed}  ·  ${ageStr}${sexStr}`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#57554f',
    }).setOrigin(0.5, 0));

    let infoY = 188;

    // ── Optional trait line (e.g. chicken personality) ─────────────────
    if (cfg.traitLine && animal[cfg.traitLine]) {
      this.panel.add(this.add.text(CARD_W / 2, infoY, `${animal[cfg.traitLine]}`, {
        fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#a47a4a',
        fontStyle: 'italic',
      }).setOrigin(0.5, 0));
      infoY += 22;
    }

    // ── Optional fixed attributes (e.g. Ebony's health/speed/stamina) ──
    if (cfg.fixedAttrs && animal.health !== undefined) {
      this.panel.add(this.add.text(CARD_W / 2, infoY,
        `Health ${animal.health}  ·  Speed ${animal.speed}  ·  Stamina ${animal.stamina}`, {
          fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#6e5226',
        }).setOrigin(0.5, 0));
      infoY += 21;
    }

    // ── Mood line (species with happiness) ─────────────────────────────
    if (spec.mood) {
      this.moodText = this.add.text(CARD_W / 2, infoY, `Feeling ${animal.mood()}`, {
        fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#178a66', fontStyle: 'bold',
      }).setOrigin(0.5, 0);
      this.panel.add(this.moodText);
      infoY += 22;
    }

    this.addDivider(infoY);

    // ── Stat bars (one per need + happiness) ───────────────────────────
    const rows = this._statRows(spec);
    let barY = infoY + 16;
    for (const s of rows) {
      this.panel.add(this.add.text(14, barY, s.label, {
        fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#4f4d47',
      }).setOrigin(0, 0.5));

      const trackX = 62;
      const trackW = CARD_W - 76;
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

    // The panel is purely informational (#91): care actions (feed/water/brush/
    // pet) are all performed in-world with equipped items/tools, so there are no
    // care buttons here. The one action is appearance editing, for species that
    // support it (horses, #147) — it opens a sticky, scrollable editor in place.
    let bottomY = barY;
    if (spec.capabilities?.customizable) {
      const btnY = barY + 4;
      const editBtn = this.add.text(CARD_W / 2, btnY, '✎  Edit appearance', {
        fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#10131f',
        fontStyle: 'bold', backgroundColor: '#ffe066', padding: { x: 14, y: 8 }, align: 'center',
      }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
      growHitArea(editBtn);
      editBtn.on('pointerdown', () => this._enterEdit());
      this.panel.add(editBtn);
      bottomY = btnY + editBtn.height + 4;
    }

    const cardH = bottomY + PAD;

    // Card background, inserted behind everything in the container.
    const bg = this.add.graphics();
    bg.fillStyle(0xf4f1ec, 1);
    bg.fillRoundedRect(0, 0, CARD_W, cardH, 14);
    bg.lineStyle(2, 0xd4cec4, 1);
    bg.strokeRoundedRect(0, 0, CARD_W, cardH, 14);
    this.panel.addAt(bg, 0);

    // ── Close button ───────────────────────────────────────────────────
    const closeBtn = this.add.text(CARD_W - 12, 12, '✕', {
      fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#9a9790',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    growHitArea(closeBtn); // comfortable tap target (#100)
    closeBtn.on('pointerdown', () => this.close());
    this.panel.add(closeBtn);

    // Center the card and pop it in (fade + a small rise).
    const cardX = Math.round((sw - CARD_W) / 2);
    const cardY = Math.round((sh - cardH) / 2);
    this._cardX = cardX;
    this._cardY = cardY;
    this.panel.setPosition(cardX, cardY + 12).setAlpha(0);
    this.tweens.add({
      targets: this.panel, y: cardY, alpha: 1,
      duration: 160, ease: 'Quad.easeOut',
    });
  }

  addDivider(y) {
    const g = this.add.graphics();
    g.lineStyle(1, 0xd4cec4, 1);
    g.lineBetween(14, y, CARD_W - 14, y);
    this.panel.add(g);
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

  // ── Appearance editor (#147) ───────────────────────────────────────────────
  // Swap the info card out for the sticky, scrollable editor (mixin: customizer.js)
  // for the horse this panel is showing.
  _enterEdit() {
    this.closing = false;
    this.children.removeAll(true);
    this.input.keyboard.removeAllListeners();
    this.input.removeAllListeners();
    this.statFills = {};
    this.moodText  = null;
    this.panel     = null;
    this._mode     = 'edit';
    this.custEnter();
  }

  // Called by the mixin's custExit(): the world is already resumed and the editor
  // torn down — rebuild the info card for the same animal.
  _onCustExit() {
    this._mode    = 'info';
    this.closing  = false;
    this.statFills = {};
    this.moodText  = null;
    this.panel     = null;
    this.build();
    this._wireDismiss();
  }

  close() {
    if (this.closing) return;
    // Safety: never leave the world paused if we're torn down mid-edit.
    if (this._custPaused) {
      for (const k of this._custPaused) if (this.scene.isPaused(k)) this.scene.resume(k);
      this._custPaused = null;
    }
    if (!this.panel) { this.scene.stop(); return; } // edit mode (or already gone)
    this.closing = true;
    this.tweens.add({
      targets: this.panel,
      y: (this._cardY ?? 0) + 12,
      alpha: 0,
      duration: 130,
      ease: 'Quad.easeIn',
      onComplete: () => this.scene.stop(),
    });
  }
}
