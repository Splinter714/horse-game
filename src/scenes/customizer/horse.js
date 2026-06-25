import {
  COATS, BREEDS, FACE_MARKING_LABELS, PATTERN_LABELS, FEATHER_LABEL,
  MANE_COLORS, MANE_COLOR_LABELS, DEFAULT_MANE,
  composeCoat, effectiveMarkings, colorKeyOf,
} from '../../data/species/horse/coats.js';
import { PATTERN_VARIANT_COUNT } from '../../data/species/horse/patterns.js';
import { buildHorseTextures, buildFoalTextures } from '../../art/horseArt.js';
import { colorRank } from './shell.js';

// The horse's rich, bespoke customizer sections — the part of the old monolithic
// customizer.js that's horse-specific. It plugs into the generic shell (shell.js):
// the shell owns chrome/preview/scroll/focus and the swatch/option/toggle primitives;
// this provides the horse's section list (coat → patterns → face → legs → dark
// markings → feathering → breeds), the matching edit handlers, the header (name +
// breed + rename), and a paddock-independent live re-skin.
//
// Behaviour is identical to before — same data flow through composeCoat() — just
// relocated so the horse becomes one species' entry in the unified system (#165/#169).

// Patterns and face markings are each single-select (mutually exclusive) with a
// "None" option (#147 follow-up).
const PATTERN_KEYS = Object.keys(PATTERN_LABELS);
const FACE_KEYS = Object.keys(FACE_MARKING_LABELS);
const LEG_CYCLE = [undefined, 'sock', 'stocking']; // bare → sock → stocking → bare
const SOCK_WHITE = 0xf0ead0; // socks/stockings are always white (#153)
const TAP = 44; // comfortable touch-target minimum (#100/#146)

export const WithHorseSections = (Base) => class extends Base {
  // Header text: name (tap to rename) + breed/coat label.
  _horseHeaderInfo() {
    const horse = this.allHorses[this._editKey];
    return {
      title: horse.name,
      subtitle: horse.breed || COATS[colorKeyOf(horse.coat)]?.label || '',
      onRename: () => this._custRename(),
    };
  }

  // The horse section stack, in real-world order. Returns the final content height.
  _buildHorseSections(c, y0) {
    const horse = this.allHorses[this._editKey];
    const composed = composeCoat(horse.coat, horse.markings);
    const eff = composed.markings;
    // Mane is a curated realistic colour with a per-coat default (#155).
    const maneCur = MANE_COLORS[eff.maneColor] ? eff.maneColor : (DEFAULT_MANE[colorKeyOf(horse.coat)] || 'black');
    const maneEntries = Object.entries(MANE_COLOR_LABELS).map(([k, l]) => [k, l, MANE_COLORS[k].mid]);
    const curPattern = PATTERN_KEYS.find(k => eff[k]) || 'none';
    const curFace = FACE_KEYS.find(k => eff[k]) || 'none';
    const opt = (labels) => [['none', 'None'], ...Object.entries(labels)];

    let y = y0;
    y = this._secOptions(c, 'Gender', [['female', 'Female'], ['male', 'Male']],
      horse.sex || 'female', (k) => this._setGender(k), y) + 14;
    y = this._secCoat(c, y) + 14;
    y = this._secSwatches(c, 'Mane color', maneEntries, maneCur, (k) => this._setManeColor(k), y) + 14;
    // Patterns: single-select with None (#147 FU), then the active one's variant.
    y = this._secOptions(c, 'Patterns', opt(PATTERN_LABELS), curPattern, (k) => this._setPattern(k), y) + 8;
    y = this._secPatternVariants(c, y) + 6;
    if (curPattern === 'pinto') {
      y = this._secToggle(c, 'Two-tone mane', !!eff.pintoMane, () => this._toggleMarking('pintoMane'), y) + 14;
    }
    // Face markings: single-select with None (#147 FU).
    y = this._secOptions(c, 'Face markings', opt(FACE_MARKING_LABELS), curFace, (k) => this._setFace(k), y) + 14;
    y = this._secLegs(c, y) + 14;
    // One "Dark markings" group of toggleable detail layers (#152).
    y = this._secToggleChips(c, 'Dark markings', [
      ['Dark legs', composed.points !== undefined, () => this._toggleDarkLegs()],
      ['Dorsal stripe', !!composed.dorsal, () => this._toggleDorsal()],
      ['Leg barring', !!eff.legBars, () => this._toggleMarking('legBars')],
      ['Shoulder stripe', !!eff.shoulderStripe, () => this._toggleMarking('shoulderStripe')],
      ['Cobwebbing', !!eff.cobwebbing, () => this._toggleMarking('cobwebbing')],
      ['Sooty', !!eff.sooty, () => this._toggleMarking('sooty')],
      ['Ermine spots', !!eff.ermine, () => this._toggleMarking('ermine')],
      ['Bend-Or spots', !!eff.bendOr, () => this._toggleMarking('bendOr')],
    ], y) + 14;
    y = this._secFeather(c, y) + 14;
    y = this._secBreeds(c, y) + 10;
    return y;
  }

  // Coat swatches — the base body pigment (mane/dorsal/dark-legs are separate).
  _secCoat(c, y0) {
    let y = this._heading(c, 'Coat color', y0);
    const keys = Object.keys(COATS).sort((a, b) => colorRank(COATS[a].body.mid) - colorRank(COATS[b].body.mid));
    const cols = 4, gap = 8;
    const cellW = Math.floor((this.panelW - 32 - (cols - 1) * gap) / cols);
    const cellH = TAP;
    const activeColor = colorKeyOf(this.allHorses[this._editKey].coat);
    keys.forEach((ck, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = 16 + col * (cellW + gap);
      const cyy = y + row * (cellH + gap);
      const active = ck === activeColor;
      const g = this.add.graphics();
      g.fillStyle(COATS[ck].body.mid, 1); g.fillRoundedRect(x, cyy, cellW, cellH, 6);
      g.lineStyle(active ? 3 : 1, active ? 0xffe066 : 0x00000055, 1); g.strokeRoundedRect(x, cyy, cellW, cellH, 6);
      const zone = this.add.zone(x, cyy, cellW, cellH).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      this._tap(zone, () => this._pickColor(ck));
      c.add([g, zone]);
    });
    y += Math.ceil(keys.length / cols) * (cellH + gap);
    return this._secSelectedName(c, COATS[activeColor].label, y);
  }

  // For each pattern that's on, a "◀ n / N ▶" stepper to pick its variant (#139).
  _secPatternVariants(c, y0) {
    const horse = this.allHorses[this._editKey];
    const eff = effectiveMarkings(horse.coat, horse.markings);
    let y = y0;
    for (const [key, label] of Object.entries(PATTERN_LABELS)) {
      const N = PATTERN_VARIANT_COUNT[key] || 1;
      if (!eff[key] || N <= 1) continue;
      const cur = eff[key + 'Var'] ?? 1;
      const rowH = TAP, W = TAP;
      c.add(this.add.text(16, y + rowH / 2, label, {
        fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#cdd2ee',
      }).setOrigin(0, 0.5));
      const arrow = (x, glyph, delta) => {
        const g = this.add.graphics();
        g.fillStyle(0x1a1e30, 1); g.fillRoundedRect(x, y, W, rowH, 10);
        g.lineStyle(1, 0x3a4060, 1); g.strokeRoundedRect(x, y, W, rowH, 10);
        const t = this.add.text(x + W / 2, y + rowH / 2, glyph, {
          fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: '#ffe066',
        }).setOrigin(0.5, 0.5);
        const z = this.add.zone(x, y, W, rowH).setOrigin(0, 0).setInteractive({ useHandCursor: true });
        this._tap(z, () => this._setPatternVar(key, delta));
        c.add([g, t, z]);
      };
      const numW = 54, gap = 8;
      const startX = this.panelW - 16 - (W * 2 + gap * 2 + numW);
      arrow(startX, '◀', -1);
      c.add(this.add.text(startX + W + gap + numW / 2, y + rowH / 2, `${cur} / ${N}`, {
        fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#eef0fa',
      }).setOrigin(0.5, 0.5));
      arrow(startX + W + gap + numW + gap, '▶', +1);
      y += rowH + 8;
    }
    return y;
  }

  // Four mini-leg buttons in sprite order, each drawn with the horse's own colours.
  _secLegs(c, y0) {
    let y = this._heading(c, 'Leg markings — tap to add a sock, again for a stocking', y0);
    const coat = composeCoat(this.allHorses[this._editKey].coat, this.allHorses[this._editKey].markings);
    const legs = coat.markings.legs || {};
    const sockTone = SOCK_WHITE; // socks/stockings are always white (#153)
    const order = ['hindFar', 'hindNear', 'foreFar', 'foreNear'];
    const bw = 48, bh = 56, gap = 12;
    const totalW = order.length * bw + (order.length - 1) * gap;
    let x = Math.round((this.panelW - totalW) / 2);
    for (const id of order) {
      const mark = legs[id];
      const g = this.add.graphics();
      g.fillStyle(0x171b2a, 1); g.fillRoundedRect(x, y, bw, bh, 8);
      g.lineStyle(mark ? 2 : 1, mark ? 0x7fd68f : 0x3a4060, 1); g.strokeRoundedRect(x, y, bw, bh, 8);
      const lx = x + bw / 2 - 5, lw = 10, top = y + 8, legH = 30;
      g.fillStyle(coat.body.mid, 1); g.fillRect(lx, top, lw, legH);
      if (coat.points !== undefined) { g.fillStyle(coat.points, 1); g.fillRect(lx, top + legH - 16, lw, 16); }
      if (mark) { const wh = mark === 'stocking' ? 22 : 12; g.fillStyle(sockTone, 1); g.fillRect(lx, top + legH - wh, lw, wh); }
      g.fillStyle(coat.hoof, 1); g.fillRect(lx, top + legH, lw, 5);
      const lbl = this.add.text(x + bw / 2, y + bh - 9, mark || '—', {
        fontFamily: 'system-ui, sans-serif', fontSize: '9px', color: mark ? '#eafff0' : '#7a80a0',
      }).setOrigin(0.5, 0.5);
      const zone = this.add.zone(x, y, bw, bh).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      this._tap(zone, () => this._cycleLeg(id));
      c.add([g, lbl, zone]);
      x += bw + gap;
    }
    return y + bh;
  }

  // Feathering: an on/off toggle (its colour auto-derives per leg in the art, #155).
  _secFeather(c, y0) {
    let y = this._heading(c, 'Feathering', y0);
    const horse = this.allHorses[this._editKey];
    const on = !!effectiveMarkings(horse.coat, horse.markings).feather;

    const w = Math.max(64, 24 + FEATHER_LABEL.length * 8), h = TAP;
    const g = this.add.graphics();
    g.fillStyle(on ? 0x3a6a44 : 0x1a1e30, 1); g.fillRoundedRect(16, y, w, h, h / 2);
    g.lineStyle(on ? 3 : 1, on ? 0x7fd68f : 0x3a4060, 1); g.strokeRoundedRect(16, y, w, h, h / 2);
    const lbl = this.add.text(16 + w / 2, y + h / 2, FEATHER_LABEL, {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: on ? '#eafff0' : '#aab0d0',
    }).setOrigin(0.5, 0.5);
    const zone = this.add.zone(16, y, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this._tap(zone, () => this._toggleMarking('feather'));
    c.add([g, lbl, zone]);
    return y + h;
  }

  _secBreeds(c, y0) {
    let y = this._heading(c, 'Breed presets — one tap sets colour + pattern + markings', y0);
    const keys = Object.keys(BREEDS);
    const cols = 2, gap = 8;
    const cellW = Math.floor((this.panelW - 32 - (cols - 1) * gap) / cols);
    const cellH = 46;
    keys.forEach((bk, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = 16 + col * (cellW + gap);
      const cyy = y + row * (cellH + gap);
      const breed = BREEDS[bk];
      const swatch = COATS[breed.color] || COATS.palomino;
      const g = this.add.graphics();
      g.fillStyle(0x1a1e30, 1); g.fillRoundedRect(x, cyy, cellW, cellH, 8);
      g.lineStyle(1, 0x3a4060, 1); g.strokeRoundedRect(x, cyy, cellW, cellH, 8);
      g.fillStyle(swatch.body.mid, 1); g.fillRoundedRect(x + 6, cyy + 7, 24, 24, 5);
      g.fillStyle(swatch.mane.mid, 1); g.fillRoundedRect(x + 6, cyy + 7, 24, 6, 5);
      const lbl = this.add.text(x + 38, cyy + cellH / 2, breed.label, {
        fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#eef0fa',
      }).setOrigin(0, 0.5);
      const zone = this.add.zone(x, cyy, cellW, cellH).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      this._tap(zone, () => this._applyBreed(bk));
      c.add([g, lbl, zone]);
    });
    return y + Math.ceil(keys.length / cols) * (cellH + gap);
  }

  // ── Edits ─────────────────────────────────────────────────────────────────
  _pickColor(colorKey) {
    const horse = this.allHorses[this._editKey];
    horse.coat = colorKey;
    horse.breed = COATS[colorKey].label;
    this._applyEdit();
  }

  _toggleMarking(m) {
    const horse = this.allHorses[this._editKey];
    const eff = effectiveMarkings(horse.coat, horse.markings);
    horse.markings = { ...eff, [m]: !eff[m] }; // authoritative override
    this._applyEdit();
  }

  // Patterns are mutually exclusive with a "None" option (#147 FU).
  _setPattern(key) {
    const horse = this.allHorses[this._editKey];
    const next = { ...effectiveMarkings(horse.coat, horse.markings) };
    for (const p of PATTERN_KEYS) delete next[p];
    delete next.pintoMane;
    if (key !== 'none') next[key] = true;
    horse.markings = next;
    this._applyEdit();
  }

  // Face markings are mutually exclusive with a "None" option (#147 FU).
  _setFace(key) {
    const horse = this.allHorses[this._editKey];
    const next = { ...effectiveMarkings(horse.coat, horse.markings) };
    for (const f of FACE_KEYS) delete next[f];
    if (key !== 'none') next[key] = true;
    horse.markings = next;
    this._applyEdit();
  }

  // Step a pattern's variant 1..N (wraps), e.g. Dapples 1→2→…→5→1 (#139).
  _setPatternVar(pattern, delta) {
    const horse = this.allHorses[this._editKey];
    const eff = effectiveMarkings(horse.coat, horse.markings);
    const N = PATTERN_VARIANT_COUNT[pattern] || 1;
    let next = (eff[pattern + 'Var'] ?? 1) + delta;
    if (next < 1) next = N; if (next > N) next = 1;
    horse.markings = { ...eff, [pattern + 'Var']: next };
    this._applyEdit();
  }

  // Mane colour is always an explicit coat colour now (#140 FU).
  _setManeColor(key) {
    const horse = this.allHorses[this._editKey];
    horse.markings = { ...effectiveMarkings(horse.coat, horse.markings), maneColor: key };
    this._applyEdit();
  }

  // Dark legs ("points") and the dorsal stripe are decoupled toggles (follow-up).
  _toggleDarkLegs() {
    const horse = this.allHorses[this._editKey];
    const on = composeCoat(horse.coat, horse.markings).points !== undefined;
    horse.markings = { ...effectiveMarkings(horse.coat, horse.markings), darkLegs: !on };
    this._applyEdit();
  }

  _toggleDorsal() {
    const horse = this.allHorses[this._editKey];
    const on = !!composeCoat(horse.coat, horse.markings).dorsal;
    horse.markings = { ...effectiveMarkings(horse.coat, horse.markings), dorsal: !on };
    this._applyEdit();
  }

  _cycleLeg(id) {
    const horse = this.allHorses[this._editKey];
    const eff = effectiveMarkings(horse.coat, horse.markings);
    const legs = { ...(eff.legs || {}) };
    const i = LEG_CYCLE.indexOf(legs[id] ?? undefined);
    const next = LEG_CYCLE[(i + 1) % LEG_CYCLE.length];
    if (next) legs[id] = next; else delete legs[id];
    horse.markings = { ...eff, legs };
    this._applyEdit();
  }

  _applyBreed(breedKey) {
    const horse = this.allHorses[this._editKey];
    const breed = BREEDS[breedKey];
    horse.coat = breed.color;
    horse.markings = JSON.parse(JSON.stringify(breed.markings)); // authoritative copy
    horse.breed = breed.label;
    this._applyEdit();
  }

  // Gender is editable here too (#145); persists via the model's toJSON.
  _setGender(sex) {
    this.allHorses[this._editKey].sex = sex;
    this._applyEdit();
  }

  _custRename() {
    const horse = this.allHorses[this._editKey];
    const name = window.prompt('Name this horse:', horse.name);
    if (name == null) return;
    const trimmed = name.trim().slice(0, 18);
    if (!trimmed) return;
    horse.name = trimmed;
    this._applyEdit();
  }

  // Apply current data to the live textures + (optionally) persist, then refresh the
  // editor UI. Re-skinning is paddock-independent — buildHorse/FoalTextures redraws the
  // global `${key}_*` textures in place, so any on-screen sprite using them updates.
  // The foal shares the whole horse editor but has its own (smaller) art, so it rebuilds
  // with buildFoalTextures. `_custPersist` (set by the in-world host) saves the herd; the
  // art-preview host leaves it null (live-recolor only).
  _applyEdit() {
    const data = this.allHorses[this._editKey];
    const build = this._custSpecies === 'foal' ? buildFoalTextures : buildHorseTextures;
    build(this, this._editKey, composeCoat(data.coat, data.markings));
    this._custPersist?.();
    this._custHeader();
    this._custContent();
  }
};
