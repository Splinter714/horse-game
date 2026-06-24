import Phaser from 'phaser';
import {
  COATS, BREEDS, FACE_MARKING_LABELS, PATTERN_LABELS, FEATHER_LABEL,
  LEG_IDS, composeCoat, effectiveMarkings, colorKeyOf,
} from '../data/species/horse/coats.js';
import { growHitArea } from './uiUtils.js';

// The stable / animal-management panel (#2/#16/#17). A modal overlay for managing
// the herd: pick a horse, then customize it across three tabs —
//   • Color    — the base coat colour (pure colours only).
//   • Markings — white face markings, whole-body patterns, feathering, and per-leg
//                socks/stockings.
//   • Breeds   — one-tap presets that set colour + pattern + markings together.
// Edits apply live via PaddockScene.reskinHorse() and are persisted. Customization
// lives HERE, not on the info card.

const PAUSABLE = ['PaddockScene', 'DayNightScene'];
const LEG_CYCLE = [undefined, 'sock', 'stocking']; // bare → sock → stocking → bare

export default class ManagementPanelScene extends Phaser.Scene {
  constructor() { super('ManagementPanelScene'); }

  create() {
    this.paddock = this.scene.get('PaddockScene');
    this.allHorses = this.registry.get('allHorses');
    this.keys = Object.keys(this.allHorses);
    this.sel = this.keys[0];
    this.tab = 'color';
    this._content = [];

    for (const k of PAUSABLE) if (this.scene.isActive(k)) this.scene.pause(k);

    this._buildChrome();
    this._buildSelector();
    this._buildHeader();
    this._buildTabs();
    this._buildContent();

    this.input.keyboard.on('keydown-ESC', () => this.close());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const k of PAUSABLE) if (this.scene.isPaused(k)) this.scene.resume(k);
    });
  }

  // ── Static chrome: backdrop, panel, title, close ──────────────────────────
  _buildChrome() {
    const sw = this.scale.width, sh = this.scale.height;
    this.panelW = Math.min(sw - 20, 600);
    this.panelH = Math.min(sh - 20, 680);
    this.px = Math.round((sw - this.panelW) / 2);
    this.py = Math.round((sh - this.panelH) / 2);

    const dim = this.add.rectangle(0, 0, sw, sh, 0x000000, 0.62).setOrigin(0, 0).setInteractive();
    dim.on('pointerdown', () => this.close());

    const bg = this.add.graphics();
    bg.fillStyle(0x10131f, 0.99); bg.fillRoundedRect(this.px, this.py, this.panelW, this.panelH, 14);
    bg.lineStyle(2, 0x3a4060, 1); bg.strokeRoundedRect(this.px, this.py, this.panelW, this.panelH, 14);
    this.add.zone(this.px, this.py, this.panelW, this.panelH).setOrigin(0, 0).setInteractive();

    this.add.text(this.px + this.panelW / 2, this.py + 14, 'Stable', {
      fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#eef0fa', fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    const close = this.add.text(this.px + this.panelW - 12, this.py + 10, '✕', {
      fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#9aa0c0',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    growHitArea(close);
    close.on('pointerdown', () => this.close());
  }

  // ── Horse selector: a row of side-view sprite chips ───────────────────────
  _buildSelector() {
    this._selNodes?.forEach(n => n.destroy());
    this._selNodes = [];
    const n = this.keys.length;
    const gap = 8;
    const cell = Math.min(58, Math.floor((this.panelW - 24 - (n - 1) * gap) / n));
    const totalW = n * cell + (n - 1) * gap;
    const x0 = this.px + Math.round((this.panelW - totalW) / 2);
    const y = this.py + 44;
    this._selY = y; this._selCell = cell;

    this.keys.forEach((k, i) => {
      const x = x0 + i * (cell + gap);
      const active = k === this.sel;
      const g = this.add.graphics();
      g.fillStyle(active ? 0x2a3360 : 0x1a1e30, 1); g.fillRoundedRect(x, y, cell, cell, 7);
      g.lineStyle(active ? 3 : 1, active ? 0xffe066 : 0x3a4060, 1); g.strokeRoundedRect(x, y, cell, cell, 7);
      const img = this.add.image(x + cell / 2, y + cell / 2, `${k}_idle_0`)
        .setDisplaySize(cell - 10, (cell - 10) * 54 / 64);
      const zone = this.add.zone(x, y, cell, cell).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this._select(k));
      this._selNodes.push(g, img, zone);
    });
  }

  // ── Always-visible header: preview, name + rename, breed label ────────────
  _buildHeader() {
    this._headerNodes?.forEach(n => n.destroy());
    this._headerNodes = [];
    const add = (n) => { this._headerNodes.push(n); return n; };
    const horse = this.allHorses[this.sel];
    const cx = this.px + this.panelW / 2;

    let y = this._selY + this._selCell + 14;
    add(this.add.image(cx, y + 40, `${this.sel}_idle_0`).setDisplaySize(96, 81).setOrigin(0.5, 0.5));
    y += 84;

    const nameText = add(this.add.text(cx, y, horse.name, {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#eef0fa', fontStyle: 'bold',
    }).setOrigin(0.5, 0));
    const rename = add(this.add.text(cx + nameText.width / 2 + 12, y + 1, '✎', {
      fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: '#ffe066',
      backgroundColor: '#2a3050', padding: { x: 6, y: 3 },
    }).setOrigin(0, 0).setInteractive({ useHandCursor: true }));
    growHitArea(rename);
    rename.on('pointerdown', () => this._rename());
    y += 24;

    add(this.add.text(cx, y, horse.breed || COATS[colorKeyOf(horse.coat)]?.label || '', {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#9aa0c0',
    }).setOrigin(0.5, 0));
    this._contentTop = y + 24;
  }

  // ── Tab bar: Color / Markings / Breeds ────────────────────────────────────
  _buildTabs() {
    this._tabNodes?.forEach(n => n.destroy());
    this._tabNodes = [];
    const tabs = [['color', 'Color'], ['markings', 'Markings'], ['breeds', 'Breeds']];
    const gap = 6;
    const w = Math.floor((this.panelW - 32 - gap * (tabs.length - 1)) / tabs.length);
    const y = this._contentTop;
    tabs.forEach(([id, label], i) => {
      const x = this.px + 16 + i * (w + gap);
      const on = id === this.tab;
      const g = this.add.graphics();
      g.fillStyle(on ? 0x2a3360 : 0x171b2a, 1); g.fillRoundedRect(x, y, w, 30, 8);
      g.lineStyle(on ? 2 : 1, on ? 0xffe066 : 0x3a4060, 1); g.strokeRoundedRect(x, y, w, 30, 8);
      const t = this.add.text(x + w / 2, y + 15, label, {
        fontFamily: 'system-ui, sans-serif', fontSize: '14px',
        color: on ? '#fff3c4' : '#aab0d0', fontStyle: on ? 'bold' : 'normal',
      }).setOrigin(0.5, 0.5);
      const zone = this.add.zone(x, y, w, 30).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this._setTab(id));
      this._tabNodes.push(g, t, zone);
    });
    this._tabBottom = y + 30 + 14;
  }

  _setTab(id) {
    if (id === this.tab) return;
    this.tab = id;
    this._buildTabs();
    this._buildContent();
  }

  // ── Tab content ───────────────────────────────────────────────────────────
  _buildContent() {
    this._content.forEach(n => n.destroy());
    this._content = [];
    const y = this._tabBottom;
    if (this.tab === 'color') this._tabColor(y);
    else if (this.tab === 'markings') this._tabMarkings(y);
    else this._tabBreeds(y);
  }

  _heading(text, y) {
    this._content.push(this.add.text(this.px + 16, y, text, {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#aab0d0', fontStyle: 'bold',
    }).setOrigin(0, 0));
    return y + 20;
  }

  // Generic wrapping chip row. items: [{key,label}]. isOn(key)->bool, onTap(key).
  _chipRow(items, y, isOn, onTap) {
    const gap = 7;
    let x = this.px + 16, row = 0;
    for (const { key, label } of items) {
      const w = 18 + label.length * 7.4;
      if (x + w > this.px + this.panelW - 16) { x = this.px + 16; row++; }
      const yy = y + row * 36;
      const on = isOn(key);
      const g = this.add.graphics();
      g.fillStyle(on ? 0x3a6a44 : 0x1a1e30, 1); g.fillRoundedRect(x, yy, w, 28, 14);
      g.lineStyle(1, on ? 0x7fd68f : 0x3a4060, 1); g.strokeRoundedRect(x, yy, w, 28, 14);
      const lbl = this.add.text(x + w / 2, yy + 14, label, {
        fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: on ? '#eafff0' : '#aab0d0',
      }).setOrigin(0.5, 0.5);
      const zone = this.add.zone(x, yy, w, 28).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => onTap(key));
      this._content.push(g, lbl, zone);
      x += w + gap;
    }
    return y + (row + 1) * 36;
  }

  _tabColor(y) {
    const keys = Object.keys(COATS);
    const cols = 4, gap = 8;
    const cellW = Math.floor((this.panelW - 32 - (cols - 1) * gap) / cols);
    const cellH = 40;
    const activeColor = colorKeyOf(this.allHorses[this.sel].coat);
    keys.forEach((ck, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = this.px + 16 + col * (cellW + gap);
      const cyy = y + row * (cellH + gap);
      const c = COATS[ck];
      const active = ck === activeColor;
      const g = this.add.graphics();
      g.fillStyle(c.body.mid, 1); g.fillRoundedRect(x, cyy, cellW, cellH, 6);
      g.fillStyle(c.mane.mid, 1); g.fillRoundedRect(x, cyy, cellW, 9, 6); // mane stripe
      if (c.points !== undefined) { g.fillStyle(c.points, 1); g.fillRect(x + 4, cyy + cellH - 8, cellW - 8, 6); } // points hint
      g.lineStyle(active ? 3 : 1, active ? 0xffe066 : 0x00000055, 1); g.strokeRoundedRect(x, cyy, cellW, cellH, 6);
      const lbl = this.add.text(x + cellW / 2, cyy + cellH / 2, c.label, {
        fontFamily: 'system-ui, sans-serif', fontSize: '9.5px', color: '#10131f',
        backgroundColor: '#ffffffcc', padding: { x: 3, y: 1 }, align: 'center',
      }).setOrigin(0.5, 0.5);
      const zone = this.add.zone(x, cyy, cellW, cellH).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this._pickColor(ck));
      this._content.push(g, lbl, zone);
    });
  }

  _tabMarkings(y) {
    const eff = effectiveMarkings(this.allHorses[this.sel].coat, this.allHorses[this.sel].markings);
    const isOn = (k) => !!eff[k];
    const toItems = (labels) => Object.entries(labels).map(([key, label]) => ({ key, label }));

    y = this._heading('Face markings', y);
    y = this._chipRow(toItems(FACE_MARKING_LABELS), y, isOn, (k) => this._toggleMarking(k)) + 8;

    y = this._heading('Patterns', y);
    y = this._chipRow(toItems(PATTERN_LABELS), y, isOn, (k) => this._toggleMarking(k)) + 8;

    y = this._heading('Feathering', y);
    y = this._chipRow([{ key: 'feather', label: FEATHER_LABEL }], y, isOn, (k) => this._toggleMarking(k)) + 8;

    y = this._heading('Legs — tap to add socks → stockings', y);
    this._buildLegButtons(y, eff.legs || {});
  }

  // Four mini-leg buttons in sprite order (back-far, back-near, front-far, front-near),
  // each drawn with the horse's own colours + current sock/stocking, tap to cycle.
  _buildLegButtons(y, legs) {
    const coat = composeCoat(this.allHorses[this.sel].coat, this.allHorses[this.sel].markings);
    const order = ['hindFar', 'hindNear', 'foreFar', 'foreNear'];
    const bw = 40, bh = 52, gap = 12;
    const totalW = order.length * bw + (order.length - 1) * gap;
    let x = this.px + Math.round((this.panelW - totalW) / 2);
    for (const id of order) {
      const mark = legs[id];
      const g = this.add.graphics();
      g.fillStyle(0x171b2a, 1); g.fillRoundedRect(x, y, bw, bh, 8);
      g.lineStyle(mark ? 2 : 1, mark ? 0x7fd68f : 0x3a4060, 1); g.strokeRoundedRect(x, y, bw, bh, 8);
      // draw a simple leg: upper body tone, lower points, white sock/stocking, hoof
      const lx = x + bw / 2 - 5, lw = 10, top = y + 8, legH = 30;
      g.fillStyle(coat.body.mid, 1); g.fillRect(lx, top, lw, legH);
      const pts = coat.points;
      if (pts !== undefined) { g.fillStyle(pts, 1); g.fillRect(lx, top + legH - 16, lw, 16); }
      if (mark) {
        const wh = mark === 'stocking' ? 22 : 12;
        g.fillStyle(0xf0ead0, 1); g.fillRect(lx, top + legH - wh, lw, wh);
      }
      g.fillStyle(coat.hoof, 1); g.fillRect(lx, top + legH, lw, 5);
      const lbl = this.add.text(x + bw / 2, y + bh - 8, mark ? (mark === 'stocking' ? 'tall' : 'sock') : '—', {
        fontFamily: 'system-ui, sans-serif', fontSize: '9px', color: mark ? '#eafff0' : '#7a80a0',
      }).setOrigin(0.5, 0.5);
      const zone = this.add.zone(x, y, bw, bh).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this._cycleLeg(id));
      this._content.push(g, lbl, zone);
      x += bw + gap;
    }
  }

  _tabBreeds(y) {
    y = this._heading('Breed presets — one tap sets colour + pattern + markings', y);
    const keys = Object.keys(BREEDS);
    const cols = 2, gap = 8;
    const cellW = Math.floor((this.panelW - 32 - (cols - 1) * gap) / cols);
    const cellH = 38;
    keys.forEach((bk, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = this.px + 16 + col * (cellW + gap);
      const cyy = y + row * (cellH + gap);
      const breed = BREEDS[bk];
      const swatch = COATS[breed.color] || COATS.palomino;
      const g = this.add.graphics();
      g.fillStyle(0x1a1e30, 1); g.fillRoundedRect(x, cyy, cellW, cellH, 8);
      g.lineStyle(1, 0x3a4060, 1); g.strokeRoundedRect(x, cyy, cellW, cellH, 8);
      g.fillStyle(swatch.body.mid, 1); g.fillRoundedRect(x + 6, cyy + 7, 24, 24, 5); // colour chip
      g.fillStyle(swatch.mane.mid, 1); g.fillRoundedRect(x + 6, cyy + 7, 24, 6, 5);
      const lbl = this.add.text(x + 38, cyy + cellH / 2, breed.label, {
        fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#eef0fa',
      }).setOrigin(0, 0.5);
      const zone = this.add.zone(x, cyy, cellW, cellH).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this._applyBreed(bk));
      this._content.push(g, lbl, zone);
    });
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
    this._buildTabs();
    this._buildContent();
  }

  // Apply current selection's data to the live world + persist, then refresh UI.
  _apply() {
    this.paddock.reskinHorse(this.sel);
    this.paddock._saveHorses();
    this._buildSelector(); // chip art may have changed
    this._buildHeader();   // preview + name + breed
    this._buildTabs();
    this._buildContent();  // highlights + leg buttons
  }

  close() {
    this.scene.stop();
  }
}
