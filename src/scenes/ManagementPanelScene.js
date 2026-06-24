import Phaser from 'phaser';
import {
  COATS, BREEDS, FACE_MARKING_LABELS, PATTERN_LABELS, FEATHER_LABEL,
  FEATHER_COLOR_LABELS, FEATHER_SWATCH, composeCoat, effectiveMarkings, colorKeyOf,
} from '../data/species/horse/coats.js';
import { growHitArea } from './uiUtils.js';

// Perceived brightness of a 0xRRGGBB colour (for picking dark vs light chip text).
const luminance = (hex) =>
  0.299 * ((hex >> 16) & 255) + 0.587 * ((hex >> 8) & 255) + 0.114 * (hex & 255);

// The stable / animal-management panel (#2/#16/#17). A modal overlay for managing
// the herd: pick a horse, then customize it. The horse chips + live preview stay
// pinned at the top; the editing sections scroll beneath them, in real-world order:
//   Coat color → Patterns → Face markings → Leg markings → Feathering → Breeds.
// Edits apply live via PaddockScene.reskinHorse() and are persisted.

const PAUSABLE = ['PaddockScene', 'DayNightScene'];
const LEG_CYCLE = [undefined, 'sock', 'stocking']; // bare → sock → stocking → bare
const SOCK_WHITE = 0xf0ead0;

export default class ManagementPanelScene extends Phaser.Scene {
  constructor() { super('ManagementPanelScene'); }

  create() {
    this.paddock = this.scene.get('PaddockScene');
    this.allHorses = this.registry.get('allHorses');
    this.keys = Object.keys(this.allHorses);
    this.sel = this.keys[0];
    this.scrollY = 0;

    for (const k of PAUSABLE) if (this.scene.isActive(k)) this.scene.pause(k);

    this._buildChrome();
    this._buildSelector();
    this._buildHeader();
    this._buildContent();
    this._installScrollInput();

    this.input.keyboard.on('keydown-ESC', () => this.close());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const k of PAUSABLE) if (this.scene.isPaused(k)) this.scene.resume(k);
    });
  }

  // ── Static chrome: backdrop, panel, title, close, scroll viewport + mask ───
  _buildChrome() {
    const sw = this.scale.width, sh = this.scale.height;
    this.panelW = Math.min(sw - 20, 600);
    this.panelH = Math.min(sh - 20, 680);
    this.px = Math.round((sw - this.panelW) / 2);
    this.py = Math.round((sh - this.panelH) / 2);

    const dim = this.add.rectangle(0, 0, sw, sh, 0x000000, 0.62).setOrigin(0, 0).setInteractive().setDepth(0);
    dim.on('pointerdown', () => this.close());

    const bg = this.add.graphics().setDepth(1);
    bg.fillStyle(0x10131f, 0.99); bg.fillRoundedRect(this.px, this.py, this.panelW, this.panelH, 14);
    bg.lineStyle(2, 0x3a4060, 1); bg.strokeRoundedRect(this.px, this.py, this.panelW, this.panelH, 14);
    this.add.zone(this.px, this.py, this.panelW, this.panelH).setOrigin(0, 0).setInteractive().setDepth(1); // absorb

    this.add.text(this.px + this.panelW / 2, this.py + 14, 'Stable', {
      fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#eef0fa', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(6);

    const close = this.add.text(this.px + this.panelW - 12, this.py + 10, '✕', {
      fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#9aa0c0',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true }).setDepth(6);
    growHitArea(close);
    close.on('pointerdown', () => this.close());

    // Fixed-header geometry (deterministic so the scroll viewport is stable).
    const n = this.keys.length, gap = 8;
    this._selCell = Math.min(56, Math.floor((this.panelW - 24 - (n - 1) * gap) / n));
    this._selY = this.py + 44;
    this._previewTop = this._selY + this._selCell + 10;
    // Grass "pasture" viewport behind the preview so the horse (and its markings)
    // read against the same green as the game world, not the dark panel.
    this._pvW = Math.min(180, this.panelW - 80);
    this._pvH = 92;
    this._pvX = Math.round(this.px + this.panelW / 2 - this._pvW / 2);
    this._pvY = this._previewTop;
    this._nameY = this._previewTop + this._pvH + 10;
    this._breedY = this._nameY + 24;
    this.viewTop = this._breedY + 26;
    this.viewBottom = this.py + this.panelH - 12;
    this.viewH = this.viewBottom - this.viewTop;

    const mg = this.make.graphics();
    mg.fillStyle(0xffffff); mg.fillRect(this.px, this.viewTop, this.panelW, this.viewH);
    this._mask = mg.createGeometryMask();

    const pmg = this.make.graphics();
    pmg.fillStyle(0xffffff); pmg.fillRoundedRect(this._pvX, this._pvY, this._pvW, this._pvH, 10);
    this._previewMask = pmg.createGeometryMask();
  }

  // ── Horse selector: a row of side-view sprite chips (pinned) ──────────────
  _buildSelector() {
    this._selNodes?.forEach(n => n.destroy());
    this._selNodes = [];
    const n = this.keys.length, gap = 8, cell = this._selCell;
    const totalW = n * cell + (n - 1) * gap;
    const x0 = this.px + Math.round((this.panelW - totalW) / 2);
    const y = this._selY;

    this.keys.forEach((k, i) => {
      const x = x0 + i * (cell + gap);
      const active = k === this.sel;
      const g = this.add.graphics().setDepth(5);
      g.fillStyle(0x82c24e, 1); g.fillRoundedRect(x, y, cell, cell, 7); // grass, so dark horses read
      g.lineStyle(active ? 3 : 1, active ? 0xffe066 : 0x3a4060, 1); g.strokeRoundedRect(x, y, cell, cell, 7);
      const img = this.add.image(x + cell / 2, y + cell / 2, `${k}_idle_0`)
        .setDisplaySize(cell - 10, (cell - 10) * 54 / 64).setDepth(5);
      const zone = this.add.zone(x, y, cell, cell).setOrigin(0, 0).setInteractive({ useHandCursor: true }).setDepth(5);
      zone.on('pointerdown', () => this._select(k));
      this._selNodes.push(g, img, zone);
    });
  }

  // ── Pinned header: preview, name + rename, breed label ────────────────────
  _buildHeader() {
    this._headerNodes?.forEach(n => n.destroy());
    this._headerNodes = [];
    const add = (n) => { this._headerNodes.push(n.setDepth(5)); return n; };
    const horse = this.allHorses[this.sel];
    const cx = this.px + this.panelW / 2;
    const pvCy = this._pvY + this._pvH / 2;

    // Grass pasture backdrop (tiled world grass, rounded), then the live preview.
    const grass = add(this.add.tileSprite(cx, pvCy, this._pvW, this._pvH, 'grass'));
    grass.setMask(this._previewMask);
    const frame = add(this.add.graphics());
    frame.lineStyle(2, 0x3a4060, 1); frame.strokeRoundedRect(this._pvX, this._pvY, this._pvW, this._pvH, 10);
    add(this.add.image(cx, pvCy, `${this.sel}_idle_0`).setDisplaySize(96, 81).setOrigin(0.5, 0.5));

    const nameText = add(this.add.text(cx, this._nameY, horse.name, {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#eef0fa', fontStyle: 'bold',
    }).setOrigin(0.5, 0));
    const rename = add(this.add.text(cx + nameText.width / 2 + 12, this._nameY + 1, '✎', {
      fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: '#ffe066',
      backgroundColor: '#2a3050', padding: { x: 6, y: 3 },
    }).setOrigin(0, 0).setInteractive({ useHandCursor: true }));
    growHitArea(rename);
    rename.on('pointerdown', () => this._rename());

    add(this.add.text(cx, this._breedY, horse.breed || COATS[colorKeyOf(horse.coat)]?.label || '', {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#9aa0c0',
    }).setOrigin(0.5, 0));
  }

  // ── Scrollable content ─────────────────────────────────────────────────────
  _buildContent() {
    this.contentC?.destroy();
    const c = this.add.container(this.px, this.viewTop).setDepth(3);
    this.contentC = c;

    let y = 8;
    y = this._secCoat(c, y) + 14;
    y = this._secChips(c, 'Patterns', PATTERN_LABELS, y) + 14;
    y = this._secChips(c, 'Face markings', FACE_MARKING_LABELS, y) + 14;
    y = this._secLegs(c, y) + 14;
    y = this._secFeather(c, y) + 14;
    y = this._secBreeds(c, y) + 10;
    this.contentH = y;

    c.setMask(this._mask);
    this.scrollMax = Math.max(0, this.contentH - this.viewH);
    this._setScroll(this.scrollY);
    this._buildScrollbar();
  }

  _heading(c, text, y) {
    c.add(this.add.text(16, y, text, {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#aab0d0', fontStyle: 'bold',
    }).setOrigin(0, 0));
    return y + 20;
  }

  // Item zones fire on pointer-UP, ignored if the gesture was a scroll-drag or
  // released outside the viewport (zones can scroll under the pinned header).
  _tap(zone, fn) {
    zone.on('pointerup', (p) => { if (!this._dragMoved && this._inView(p)) fn(); });
  }

  _secCoat(c, y0) {
    let y = this._heading(c, 'Coat color', y0);
    const keys = Object.keys(COATS);
    const cols = 4, gap = 8;
    const cellW = Math.floor((this.panelW - 32 - (cols - 1) * gap) / cols);
    const cellH = 40;
    const activeColor = colorKeyOf(this.allHorses[this.sel].coat);
    keys.forEach((ck, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = 16 + col * (cellW + gap);
      const cyy = y + row * (cellH + gap);
      const co = COATS[ck];
      const active = ck === activeColor;
      const g = this.add.graphics();
      g.fillStyle(co.body.mid, 1); g.fillRoundedRect(x, cyy, cellW, cellH, 6);
      g.fillStyle(co.mane.mid, 1); g.fillRoundedRect(x, cyy, cellW, 9, 6); // mane stripe
      if (co.points !== undefined) { g.fillStyle(co.points, 1); g.fillRect(x + 4, cyy + cellH - 8, cellW - 8, 6); }
      g.lineStyle(active ? 3 : 1, active ? 0xffe066 : 0x00000055, 1); g.strokeRoundedRect(x, cyy, cellW, cellH, 6);
      const lbl = this.add.text(x + cellW / 2, cyy + cellH / 2, co.label, {
        fontFamily: 'system-ui, sans-serif', fontSize: '9.5px', color: '#10131f',
        backgroundColor: '#ffffffcc', padding: { x: 3, y: 1 }, align: 'center',
      }).setOrigin(0.5, 0.5);
      const zone = this.add.zone(x, cyy, cellW, cellH).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      this._tap(zone, () => this._pickColor(ck));
      c.add([g, lbl, zone]);
    });
    return y + Math.ceil(keys.length / cols) * (cellH + gap);
  }

  // A heading + a wrapping row of toggle chips for a {key: label} map.
  _secChips(c, title, labels, y0) {
    let y = this._heading(c, title, y0);
    const eff = effectiveMarkings(this.allHorses[this.sel].coat, this.allHorses[this.sel].markings);
    const gap = 7;
    let x = 16, row = 0;
    for (const [key, label] of Object.entries(labels)) {
      const w = 18 + label.length * 7.4;
      if (x + w > this.panelW - 16) { x = 16; row++; }
      const yy = y + row * 36;
      const on = !!eff[key];
      const g = this.add.graphics();
      g.fillStyle(on ? 0x3a6a44 : 0x1a1e30, 1); g.fillRoundedRect(x, yy, w, 28, 14);
      g.lineStyle(1, on ? 0x7fd68f : 0x3a4060, 1); g.strokeRoundedRect(x, yy, w, 28, 14);
      const lbl = this.add.text(x + w / 2, yy + 14, label, {
        fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: on ? '#eafff0' : '#aab0d0',
      }).setOrigin(0.5, 0.5);
      const zone = this.add.zone(x, yy, w, 28).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      this._tap(zone, () => this._toggleMarking(key));
      c.add([g, lbl, zone]);
      x += w + gap;
    }
    return y + (row + 1) * 36;
  }

  // Four mini-leg buttons in sprite order (back-far, back-near, front-far,
  // front-near), each drawn with the horse's own colours + current sock/stocking.
  _secLegs(c, y0) {
    let y = this._heading(c, 'Leg markings — tap to add a sock, again for a stocking', y0);
    const coat = composeCoat(this.allHorses[this.sel].coat, this.allHorses[this.sel].markings);
    const legs = coat.markings.legs || {};
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
      if (mark) { const wh = mark === 'stocking' ? 22 : 12; g.fillStyle(SOCK_WHITE, 1); g.fillRect(lx, top + legH - wh, lw, wh); }
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

  // Feathering: a toggle, plus colour options (Natural / White / Black) that
  // appear only when feathering is on. Each colour chip is filled with its tone.
  _secFeather(c, y0) {
    let y = this._heading(c, 'Feathering', y0);
    const horse = this.allHorses[this.sel];
    const eff = effectiveMarkings(horse.coat, horse.markings);
    const on = !!eff.feather;

    const w = 18 + FEATHER_LABEL.length * 7.4;
    const g = this.add.graphics();
    g.fillStyle(on ? 0x3a6a44 : 0x1a1e30, 1); g.fillRoundedRect(16, y, w, 28, 14);
    g.lineStyle(1, on ? 0x7fd68f : 0x3a4060, 1); g.strokeRoundedRect(16, y, w, 28, 14);
    const lbl = this.add.text(16 + w / 2, y + 14, FEATHER_LABEL, {
      fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: on ? '#eafff0' : '#aab0d0',
    }).setOrigin(0.5, 0.5);
    const zone = this.add.zone(16, y, w, 28).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this._tap(zone, () => this._toggleMarking('feather'));
    c.add([g, lbl, zone]);

    if (!on) return y + 28;

    // Colour chips on the next line.
    const coat = composeCoat(horse.coat, horse.markings);
    const cur = eff.featherColor || 'natural';
    y += 34;
    let x = 16;
    for (const [key, label] of Object.entries(FEATHER_COLOR_LABELS)) {
      const w2 = 18 + label.length * 7.4;
      const tone = key === 'natural' ? coat.mane.mid : FEATHER_SWATCH[key];
      const active = key === cur;
      const cg = this.add.graphics();
      cg.fillStyle(tone, 1); cg.fillRoundedRect(x, y, w2, 28, 14);
      cg.lineStyle(active ? 3 : 1, active ? 0xffe066 : 0x3a4060, 1); cg.strokeRoundedRect(x, y, w2, 28, 14);
      const cl = this.add.text(x + w2 / 2, y + 14, label, {
        fontFamily: 'system-ui, sans-serif', fontSize: '12px',
        color: luminance(tone) > 140 ? '#202434' : '#eef0fa',
      }).setOrigin(0.5, 0.5);
      const cz = this.add.zone(x, y, w2, 28).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      this._tap(cz, () => this._setFeatherColor(key));
      c.add([cg, cl, cz]);
      x += w2 + 8;
    }
    return y + 28;
  }

  _secBreeds(c, y0) {
    let y = this._heading(c, 'Breed presets — one tap sets colour + pattern + markings', y0);
    const keys = Object.keys(BREEDS);
    const cols = 2, gap = 8;
    const cellW = Math.floor((this.panelW - 32 - (cols - 1) * gap) / cols);
    const cellH = 38;
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

  // ── Scrolling ───────────────────────────────────────────────────────────────
  _installScrollInput() {
    this.input.on('wheel', (_p, _go, _dx, dy) => this._setScroll(this.scrollY + dy * 0.5));
    this.input.on('pointerdown', (p) => {
      if (!this._inView(p)) return;
      this._drag = true; this._dragMoved = false;
      this._dragStartY = p.y; this._dragStartScroll = this.scrollY;
    });
    this.input.on('pointermove', (p) => {
      if (!this._drag || !p.isDown) return;
      const dy = p.y - this._dragStartY;
      if (Math.abs(dy) > 6) this._dragMoved = true;
      this._setScroll(this._dragStartScroll - dy);
    });
    this.input.on('pointerup', () => { this._drag = false; });
  }

  _inView(p) {
    return p.x >= this.px && p.x <= this.px + this.panelW && p.y >= this.viewTop && p.y <= this.viewBottom;
  }

  _setScroll(v) {
    this.scrollY = Phaser.Math.Clamp(v, 0, this.scrollMax || 0);
    if (this.contentC) this.contentC.y = this.viewTop - this.scrollY;
    this._updateScrollbar();
  }

  _buildScrollbar() {
    this._sb?.destroy();
    this._sb = this.add.graphics().setDepth(6);
    this._updateScrollbar();
  }

  _updateScrollbar() {
    if (!this._sb) return;
    this._sb.clear();
    if (!this.scrollMax) return;
    const trackX = this.px + this.panelW - 7, trackH = this.viewH;
    const thumbH = Math.max(28, trackH * (this.viewH / this.contentH));
    const thumbY = this.viewTop + (trackH - thumbH) * (this.scrollY / this.scrollMax);
    this._sb.fillStyle(0x3a4060, 0.5); this._sb.fillRoundedRect(trackX, this.viewTop, 4, trackH, 2);
    this._sb.fillStyle(0xffe066, 0.85); this._sb.fillRoundedRect(trackX, thumbY, 4, thumbH, 2);
  }

  // ── Edits ─────────────────────────────────────────────────────────────────
  _pickColor(colorKey) {
    const horse = this.allHorses[this.sel];
    horse.coat = colorKey;
    horse.breed = COATS[colorKey].label;
    this._apply();
  }

  _toggleMarking(m) {
    const horse = this.allHorses[this.sel];
    const eff = effectiveMarkings(horse.coat, horse.markings);
    horse.markings = { ...eff, [m]: !eff[m] }; // authoritative override
    this._apply();
  }

  _cycleLeg(id) {
    const horse = this.allHorses[this.sel];
    const eff = effectiveMarkings(horse.coat, horse.markings);
    const legs = { ...(eff.legs || {}) };
    const i = LEG_CYCLE.indexOf(legs[id] ?? undefined);
    const next = LEG_CYCLE[(i + 1) % LEG_CYCLE.length];
    if (next) legs[id] = next; else delete legs[id];
    horse.markings = { ...eff, legs };
    this._apply();
  }

  _setFeatherColor(color) {
    const horse = this.allHorses[this.sel];
    const eff = effectiveMarkings(horse.coat, horse.markings);
    horse.markings = { ...eff, feather: true, featherColor: color };
    this._apply();
  }

  _applyBreed(breedKey) {
    const horse = this.allHorses[this.sel];
    const breed = BREEDS[breedKey];
    horse.coat = breed.color;
    horse.markings = JSON.parse(JSON.stringify(breed.markings)); // authoritative copy
    horse.breed = breed.label;
    this._apply();
  }

  _rename() {
    const horse = this.allHorses[this.sel];
    const name = window.prompt('Name this horse:', horse.name);
    if (name == null) return;
    const trimmed = name.trim().slice(0, 18);
    if (!trimmed) return;
    horse.name = trimmed;
    this._apply();
  }

  _select(key) {
    if (key === this.sel) return;
    this.sel = key;
    this._buildSelector();
    this._buildHeader();
    this._buildContent();
  }

  // Apply current selection's data to the live world + persist, then refresh UI.
  _apply() {
    this.paddock.reskinHorse(this.sel);
    this.paddock._saveHorses();
    this._buildSelector();
    this._buildHeader();
    this._buildContent();
  }

  close() {
    this.scene.stop();
  }
}
