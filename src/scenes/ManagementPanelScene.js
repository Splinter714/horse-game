import Phaser from 'phaser';
import { COATS, MARKING_LABELS, composeCoat } from '../data/species/horse/coats.js';
import { growHitArea } from './uiUtils.js';

// The stable / animal-management panel (#2/#16/#17). A modal overlay for managing
// the herd: pick a horse, recolor its coat (curated real-world presets), toggle
// markings, and rename it. Recoloring/marking is applied live via PaddockScene's
// reskinHorse() and persisted; customization lives HERE, not on the info card.

const PAUSABLE = ['PaddockScene', 'DayNightScene'];

export default class ManagementPanelScene extends Phaser.Scene {
  constructor() { super('ManagementPanelScene'); }

  create() {
    this.paddock = this.scene.get('PaddockScene');
    this.allHorses = this.registry.get('allHorses');
    this.keys = Object.keys(this.allHorses);
    this.sel = this.keys[0];
    this._detail = [];

    for (const k of PAUSABLE) if (this.scene.isActive(k)) this.scene.pause(k);

    this._buildChrome();
    this._buildSelector();
    this._buildDetail();

    this.input.keyboard.on('keydown-ESC', () => this.close());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const k of PAUSABLE) if (this.scene.isPaused(k)) this.scene.resume(k);
    });
  }

  // ── Static chrome: backdrop, panel, title, close ──────────────────────────
  _buildChrome() {
    const sw = this.scale.width, sh = this.scale.height;
    this.panelW = Math.min(sw - 20, 600);
    this.panelH = Math.min(sh - 20, 660);
    this.px = Math.round((sw - this.panelW) / 2);
    this.py = Math.round((sh - this.panelH) / 2);

    const dim = this.add.rectangle(0, 0, sw, sh, 0x000000, 0.62).setOrigin(0, 0).setInteractive();
    dim.on('pointerdown', () => this.close());

    const bg = this.add.graphics();
    bg.fillStyle(0x10131f, 0.99); bg.fillRoundedRect(this.px, this.py, this.panelW, this.panelH, 14);
    bg.lineStyle(2, 0x3a4060, 1); bg.strokeRoundedRect(this.px, this.py, this.panelW, this.panelH, 14);
    // absorb clicks inside the panel
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

  // ── Horse selector: a row of portrait chips ───────────────────────────────
  _buildSelector() {
    this._selNodes?.forEach(n => n.destroy());
    this._selNodes = [];
    const n = this.keys.length;
    const gap = 8;
    const cell = Math.min(64, Math.floor((this.panelW - 24 - (n - 1) * gap) / n));
    const totalW = n * cell + (n - 1) * gap;
    const x0 = this.px + Math.round((this.panelW - totalW) / 2);
    const y = this.py + 46;
    this._selY = y; this._selCell = cell;

    this.keys.forEach((k, i) => {
      const x = x0 + i * (cell + gap);
      const active = k === this.sel;
      const g = this.add.graphics();
      g.fillStyle(active ? 0x2a3360 : 0x1a1e30, 1); g.fillRoundedRect(x, y, cell, cell, 7);
      g.lineStyle(active ? 3 : 1, active ? 0xffe066 : 0x3a4060, 1); g.strokeRoundedRect(x, y, cell, cell, 7);
      const img = this.add.image(x + cell / 2, y + cell / 2, `portrait_${k}`)
        .setDisplaySize(cell - 12, cell - 12);
      const zone = this.add.zone(x, y, cell, cell).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this._select(k));
      this._selNodes.push(g, img, zone);
    });
  }

  _select(key) {
    if (key === this.sel) return;
    this.sel = key;
    this._buildSelector();
    this._buildDetail();
  }

  // ── Detail: preview, name + rename, coat swatches, marking chips ───────────
  _buildDetail() {
    this._detail.forEach(n => n.destroy());
    this._detail = [];
    const horse = this.allHorses[this.sel];
    const add = (n) => { this._detail.push(n); return n; };

    let y = this._selY + this._selCell + 16;
    const cx = this.px + this.panelW / 2;

    // Preview sprite (the live idle frame — reskin redraws it in place)
    add(this.add.image(cx, y + 34, `${this.sel}_idle_0`).setDisplaySize(96, 81).setOrigin(0.5, 0.5));
    this._preview = this._detail[this._detail.length - 1];
    y += 78;

    // Name + breed + rename
    this._nameText = add(this.add.text(cx, y, horse.name, {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#eef0fa', fontStyle: 'bold',
    }).setOrigin(0.5, 0));
    const rename = add(this.add.text(cx + 8 + this._nameText.width / 2 + 8, y + 1, '✎', {
      fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: '#ffe066',
      backgroundColor: '#2a3050', padding: { x: 6, y: 3 },
    }).setOrigin(0, 0).setInteractive({ useHandCursor: true }));
    growHitArea(rename);
    rename.on('pointerdown', () => this._rename());
    y += 24;
    this._breedText = add(this.add.text(cx, y, COATS[horse.coat]?.label ?? horse.breed, {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#9aa0c0',
    }).setOrigin(0.5, 0));
    y += 26;

    // Coat swatches
    add(this.add.text(this.px + 16, y, 'Coat', {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#aab0d0', fontStyle: 'bold',
    }).setOrigin(0, 0));
    y += 20;
    y = this._buildSwatches(y);
    y += 12;

    // Marking toggles
    add(this.add.text(this.px + 16, y, 'Markings', {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#aab0d0', fontStyle: 'bold',
    }).setOrigin(0, 0));
    y += 20;
    this._buildChips(y);
  }

  _buildSwatches(y) {
    const keys = Object.keys(COATS);
    const cols = 5, gap = 8;
    const cellW = Math.floor((this.panelW - 32 - (cols - 1) * gap) / cols);
    const cellH = 40;
    keys.forEach((ck, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = this.px + 16 + col * (cellW + gap);
      const cyy = y + row * (cellH + gap);
      const c = COATS[ck];
      const active = ck === this.allHorses[this.sel].coat;
      const g = this.add.graphics();
      g.fillStyle(c.body.mid, 1); g.fillRoundedRect(x, cyy, cellW, cellH, 6);
      g.fillStyle(c.mane.mid, 1); g.fillRoundedRect(x, cyy, cellW, 9, 6); // mane stripe
      g.lineStyle(active ? 3 : 1, active ? 0xffe066 : 0x00000055, 1); g.strokeRoundedRect(x, cyy, cellW, cellH, 6);
      const lbl = this.add.text(x + cellW / 2, cyy + cellH - 6, c.label, {
        fontFamily: 'system-ui, sans-serif', fontSize: '8.5px', color: '#10131f',
        backgroundColor: '#ffffffaa', padding: { x: 2, y: 0 }, align: 'center',
      }).setOrigin(0.5, 1);
      const zone = this.add.zone(x, cyy, cellW, cellH).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this._pickColor(ck));
      this._detail.push(g, lbl, zone);
    });
    const rows = Math.ceil(keys.length / cols);
    return y + rows * (cellH + gap);
  }

  _buildChips(y) {
    const marks = Object.keys(MARKING_LABELS);
    const eff = composeCoat(this.allHorses[this.sel].coat, this.allHorses[this.sel].markings).markings || {};
    const gap = 7;
    let x = this.px + 16;
    let row = 0;
    for (const m of marks) {
      const label = MARKING_LABELS[m];
      const w = 16 + label.length * 7.5;
      if (x + w > this.px + this.panelW - 16) { x = this.px + 16; row++; }
      const yy = y + row * 36;
      const on = !!eff[m];
      const g = this.add.graphics();
      g.fillStyle(on ? 0x3a6a44 : 0x1a1e30, 1); g.fillRoundedRect(x, yy, w, 28, 14);
      g.lineStyle(1, on ? 0x7fd68f : 0x3a4060, 1); g.strokeRoundedRect(x, yy, w, 28, 14);
      const lbl = this.add.text(x + w / 2, yy + 14, label, {
        fontFamily: 'system-ui, sans-serif', fontSize: '12px',
        color: on ? '#eafff0' : '#aab0d0',
      }).setOrigin(0.5, 0.5);
      const zone = this.add.zone(x, yy, w, 28).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this._toggleMarking(m));
      this._detail.push(g, lbl, zone);
      x += w + gap;
    }
  }

  // ── Edits ─────────────────────────────────────────────────────────────────
  _pickColor(colorKey) {
    const horse = this.allHorses[this.sel];
    if (horse.coat === colorKey) return;
    horse.coat = colorKey;
    horse.breed = COATS[colorKey].label; // keep the displayed breed in sync with the colour
    this._apply();
  }

  _toggleMarking(m) {
    const horse = this.allHorses[this.sel];
    const eff = composeCoat(horse.coat, horse.markings).markings || {};
    horse.markings = { ...eff, [m]: !eff[m] }; // becomes an explicit override
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

  // Apply current selection's data to the live world + persist, then refresh UI.
  _apply() {
    this.paddock.reskinHorse(this.sel);
    this.paddock._saveHorses();
    this._buildSelector(); // portraits may have changed colour
    this._buildDetail();   // swatch/chip highlights + preview + name
  }

  close() {
    this.scene.stop();
  }
}
