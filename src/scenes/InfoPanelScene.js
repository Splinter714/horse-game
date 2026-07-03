import Phaser from 'phaser';
import { getSpecies } from '../data/species/index.js';
import { growHitArea, applyDpr, logicalW, logicalH } from './uiUtils.js';
import { ART_SCALE } from '../art/_frames.js';
import { CUSTOMIZE } from '../data/customize.js';
import { ROSTER_SPECIES } from '../data/save.js';
import { WithCustomizerShell } from './customizer/shell.js';
import { WithCustomizerNav } from './customizer/nav.js';
import { WithHorseSections } from './customizer/horse.js';
import { WithIncubationPanel } from './customizer/incubationPanel.js';

// Persisted rosters by species id, so an in-panel edit saves the right roster
// generically (no per-species wiring). Every in-world customizable animal now has a
// roster (horse/chicken/cow/pig/cat), so edits persist across reloads. A future
// roster-less species would simply be absent here and recolour live-only.
const ROSTER_BY_ID = Object.fromEntries(ROSTER_SPECIES.map((r) => [r.id, r]));

// Lightweight, ephemeral info popup for any animal. It's a small floating card
// (not a modal panel) that auto-dismisses the moment you do almost anything else:
// tap away, press any key (Esc included), or move your character (PaddockScene
// closes it on movement). What it shows is driven entirely by the animal's
// species data (../data/species): stat bars from `needs` (+happiness), action
// buttons from `actions`, plus a `panel` block for portrait style / trait line /
// fixed-attribute row. A new species gets a working popup for free.

const CARD_W = 300;
const PAD    = 16;

// Capitalize the first letter of a display string (e.g. affinity "loves water" →
// "Loves water"). Leaves the rest untouched.
function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
// Brief grace window after opening so the key/tap that opened the popup can't
// instantly close it on the same input.
const OPEN_GRACE_MS = 140;

export default class InfoPanelScene extends WithCustomizerShell(WithCustomizerNav(WithHorseSections(WithIncubationPanel(Phaser.Scene)))) {
  constructor() {
    super('InfoPanelScene');
    this.statFills = {};
    this.moodText  = null;
    this.panel     = null;
    this.closing   = false;
    this._mode     = 'info';
  }

  create(data) {
    applyDpr(this, { topLeft: true }); // HiDPI: zoom this UI scene's camera (top-left anchored)
    this.closing = false;
    this._mode = 'info';
    // `{ edit: true }` launch data jumps straight into the appearance editor,
    // skipping the info-card render (used by the "Start editor on" dev tool).
    if (data?.edit && this._canEdit()) {
      this._enterEdit();
    } else {
      this.build();
      this._wireDismiss();
    }
  }

  // Drive the appearance editor's controller focus (mixin) while in edit mode.
  update() {
    if (this._mode === 'edit') this._pollEditPad();
  }

  // Whether the currently-viewed animal has an appearance editor — i.e. its species
  // declares a customizer (CUSTOMIZE). Now every customizable in-world animal (horse,
  // chicken, cat, cow, pig), not just the horse (#165).
  _canEdit() {
    const animal = this.registry.get('viewingAnimal')?.animal;
    return !!(animal && CUSTOMIZE[animal.species]);
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
    const sw = logicalW(this);
    const sh = logicalH(this);
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
    // A still-a-baby chick (#274) has no dedicated static portrait texture built
    // (its art is only the smaller in-world frame set) — fall back to the
    // animated live-sprite portrait for any baby, even on a normally-static
    // species, the same way the horse foal already reads fine because the horse
    // species portrait is animated throughout.
    if (cfg.portrait === 'animated' || animal.isFoal) {
      const animKey = `panel_idle_${key}`;
      if (!this.anims.exists(animKey)) {
        this.anims.create({
          key: animKey,
          frames: [{ key: `${key}_idle_0` }, { key: `${key}_idle_1` }],
          frameRate: 2, repeat: -1,
        });
      }
      // Every animated-portrait species (horse, cow, pig, dog, cat, sheep) is drawn
      // super-sampled (ART_SCALE×) for HiDPI crispness, so its idle textures are
      // ART_SCALE× larger — divide that out to keep the portrait at the intended size.
      // (The chicken uses the static portrait branch below, sized via setDisplaySize.)
      // A baby chick's art canvas is much smaller than a horse's, so the fixed
      // horse-tuned pScale would render it tiny — size it to a consistent ~72px
      // on-screen footprint instead, keyed off its actual texture width.
      const sprite = this.add.sprite(CARD_W / 2, 78, `${key}_idle_0`).setOrigin(0.5, 0.5);
      if (animal.isFoal && animal.species === 'chicken') {
        const frameW = sprite.width || 1;
        sprite.setScale(72 / frameW);
      } else {
        sprite.setScale(3 / ART_SCALE);
      }
      sprite.play(animKey);
      this.panel.add(sprite);
    } else {
      this.panel.add(this.add.image(CARD_W / 2, 78, `portrait_${key}`)
        .setDisplaySize(96, 96).setOrigin(0.5, 0.5));
    }

    // ── Name / breed / age ─────────────────────────────────────────────
    // A nameless animal (e.g. the cow for now) shows a faded placeholder so the
    // title slot doesn't read as a bug — she can still be named later.
    const named = !!animal.name;
    this.panel.add(this.add.text(CARD_W / 2, 138, named ? animal.name : 'Unnamed', {
      fontFamily: 'system-ui, sans-serif', fontSize: '22px',
      color: named ? '#2c2c2a' : '#9a968c', fontStyle: named ? 'bold' : 'italic',
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

    // ── Personality & preferences (#88 v1) — display-only, driven by the
    //    animal's assigned `personality` object. Makes each animal read as an
    //    individual: temperament + favorites + affinities.
    infoY = this._addPersonality(animal, infoY);

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
    // care buttons here. The one action is appearance editing, for any species with a
    // customizer (#165) — it opens a sticky, scrollable editor in place.
    let bottomY = barY;
    if (CUSTOMIZE[animal.species]) {
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

    // ── Breeding & foals (#15) — horse-only in-panel controls ──────────────────
    // A grown horse gets a "Breed" button (player-initiated pairing); a foal gets a
    // "Stay a baby forever" toggle instead (kids get attached — a foal only grows up
    // when it's turned off). Both act through PaddockScene's breeding mixin.
    bottomY = this._addBreedingControls(animal, key, bottomY);
    // ── Baby chicks (#274) — chicken-only in-panel controls ────────────────────
    // A hen (with an eligible rooster present) gets an "Incubate" button; a
    // still-a-baby chick gets the same "Stay a baby forever" toggle as a foal.
    // Its own sibling method (paddock/incubation.js, WithIncubation) — this is a
    // fully parallel system to horse breeding, never touching breeding.js.
    bottomY = this._addIncubationControls(animal, key, bottomY);

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

  // ── Breeding & foals panel controls (#15) ──────────────────────────────────
  // Grown horse → a "Breed" button that marks it as a mate (or, if another horse is
  // already marked, "Breed with <name>" which starts the gestation). Foal → a "Stay a
  // baby forever" toggle. Only for horses; other species get nothing. Returns the new
  // bottom-y cursor. A small status line flashes feedback under the button.
  _addBreedingControls(animal, key, y) {
    if (animal.species !== 'horse') return y;
    const paddock = this.scene.get('PaddockScene');
    if (!paddock) return y;

    let cy = y + 6;

    // A newborn foal shows the growth toggle rather than a breed button.
    if (animal.isFoal) {
      const on = !animal.stayBaby; // "Allow growing up" is the inverse of stayBaby
      const label = animal.stayBaby ? '🍼  Stays a baby forever' : '🌱  Allowed to grow up';
      const toggle = this.add.text(CARD_W / 2, cy, label, {
        fontFamily: 'system-ui, sans-serif', fontSize: '13px',
        color: on ? '#eafff0' : '#4f4d47', fontStyle: 'bold',
        backgroundColor: on ? '#3a6a44' : '#e3ded3', padding: { x: 12, y: 7 }, align: 'center',
      }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
      growHitArea(toggle);
      toggle.on('pointerdown', () => {
        // Flip the toggle. Turning growth ON grows the foal up right away (and the
        // panel will close as the world takes over); otherwise just re-render.
        paddock.setStayBaby(key, !animal.stayBaby);
        if (!animal.isFoal) this.close(); // it grew up — model no longer a foal
        else this.refresh();
      });
      this.panel.add(toggle);
      return cy + toggle.height + 4;
    }

    // Grown horse: the breed button. Its label reflects any pending mate.
    const mate = paddock.pendingMateName?.(key);
    const label = mate ? `💕  Breed with ${mate}` : '💕  Breed';
    const breedBtn = this.add.text(CARD_W / 2, cy, label, {
      fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#5a1e3a',
      fontStyle: 'bold', backgroundColor: '#ffc0d8', padding: { x: 14, y: 8 }, align: 'center',
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    growHitArea(breedBtn);
    breedBtn.on('pointerdown', () => {
      const status = paddock.toggleBreedSelection?.(key);
      // If a gestation actually started (both horses picked), close the panel; else
      // flash the status and stay open so the player can pick the second horse.
      if (status && status.includes('expecting a foal')) { this.close(); return; }
      this._flashBreedStatus(status);
    });
    this.panel.add(breedBtn);
    cy += breedBtn.height + 4;
    return cy;
  }

  // Flash a short breeding status message under the breed button (auto-fades).
  _flashBreedStatus(text) {
    if (!text) return;
    this._breedStatus?.destroy();
    this._breedStatus = this.add.text(CARD_W / 2, (this._cardY ? 0 : 0), text, {
      fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: '#7a4a5a',
      align: 'center', wordWrap: { width: CARD_W - 24 },
    }).setOrigin(0.5, 1).setDepth(20000);
    // Position it just above the card's bottom edge in screen space.
    const y = (this._cardY ?? 0) + (this.panel?.getBounds?.().height ?? 0) - 2;
    this._breedStatus.setPosition((this._cardX ?? 0) + CARD_W / 2, y + 34);
    this.tweens.add({
      targets: this._breedStatus, alpha: 0, y: this._breedStatus.y - 10,
      delay: 1400, duration: 600, ease: 'Sine.easeIn',
      onComplete: () => { this._breedStatus?.destroy(); this._breedStatus = null; },
    });
  }

  addDivider(y) {
    const g = this.add.graphics();
    g.lineStyle(1, 0xd4cec4, 1);
    g.lineBetween(14, y, CARD_W - 14, y);
    this.panel.add(g);
  }

  // ── Personality & preferences section (#88 v1, display-only) ────────────────
  // Renders the animal's assigned personality: a temperament headline plus a few
  // "Loves …" lines (favorite activity/food/treat + affinities). Purely cosmetic —
  // no behavior effects this pass. Returns the new y cursor. A no-op (returns y
  // unchanged) if the animal somehow has no personality.
  _addPersonality(animal, y) {
    const p = animal.profile;
    if (!p) return y;

    let cy = y + 4;
    // Temperament headline — capitalized, e.g. "A gentle soul".
    if (p.temperament) {
      this.panel.add(this.add.text(CARD_W / 2, cy, `A ${p.temperament} soul`, {
        fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#a47a4a',
        fontStyle: 'italic',
      }).setOrigin(0.5, 0));
      cy += 20;
    }

    // "Loves …" preference lines — left-aligned, compact. Only the ones present.
    const likes = [];
    if (p.activity) likes.push(`Loves ${p.activity}`);
    if (p.food)     likes.push(`Favorite food: ${p.food}`);
    if (p.treat)    likes.push(`Favorite treat: ${p.treat}`);
    for (const a of p.affinities ?? []) likes.push(cap(a));

    for (const line of likes) {
      this.panel.add(this.add.text(14, cy, `• ${line}`, {
        fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#57554f',
        wordWrap: { width: CARD_W - 28 },
      }).setOrigin(0, 0));
      cy += 18;
    }

    return likes.length || p.temperament ? cy + 4 : y;
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
    // Open the editor for whatever animal the panel is showing. The model carries the
    // current look (horse: coat/markings; others: per-part swatch keys), and edits
    // persist to that species' roster — generically, by species id (a roster-less
    // species would get a null persist and recolour live-only). onExit falls to the
    // prototype _onCustExit below (rebuilds the info card); the shell handles the
    // pause/resume of the world + hotbar.
    const viewing = this.registry.get('viewingAnimal');
    const species = viewing?.animal?.species;
    const roster = ROSTER_BY_ID[species];
    this.custEnterFor({
      speciesId: species,
      key: viewing?.key,
      model: viewing?.animal,
      persist: roster ? () => roster.save(this.registry.get(roster.registryKey)) : null,
    });
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
