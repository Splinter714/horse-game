import Phaser from 'phaser';
import {
  COATS, BREEDS, FACE_MARKING_LABELS, PATTERN_LABELS, FEATHER_LABEL,
  SOCK_COLORS, SOCK_COLOR_LABELS, composeCoat, effectiveMarkings, colorKeyOf,
} from '../data/species/horse/coats.js';
import { PATTERN_VARIANT_COUNT } from '../data/species/horse/patterns.js';
import { S } from './paddock/constants.js';
import { growHitArea } from './uiUtils.js';

// Patterns and face markings are each single-select (mutually exclusive) with a
// "None" option (#147 follow-up).
const PATTERN_KEYS = Object.keys(PATTERN_LABELS);
const FACE_KEYS = Object.keys(FACE_MARKING_LABELS);

// Shared horse-appearance editor (#2/#17), hosted *inside* a scene as a sticky,
// scrollable "edit mode" rather than its own menu (#147). It used to be the
// standalone ManagementPanelScene; the section-builders + scroll machinery now live
// here as a mixin so the per-horse info panel can embed the same well-tested UI.
//
// The host scene calls `custEnter()` to open the editor for the currently-viewed
// horse (registry `viewingAnimal`) and gets `_onCustExit()` called when the player
// taps Done / ✕ / Esc. Edits apply live via PaddockScene.reskinHorse() + save, and
// the sections scroll beneath a pinned live preview, in real-world order:
//   Coat color → Patterns → Face markings → Leg markings → Feathering → Breeds.

const PAUSABLE = ['PaddockScene', 'DayNightScene'];
// Scenes hidden while editing so the editor owns the screen — the hotbar and the
// day/night tint + clock label (which otherwise renders over the panel).
const HIDE_DURING_EDIT = ['HotbarScene', 'DayNightScene'];
const LEG_CYCLE = [undefined, 'sock', 'stocking']; // bare → sock → stocking → bare
const TAP = 44; // comfortable touch-target minimum (#100/#146)

// Perceived brightness of a 0xRRGGBB colour (for picking dark vs light chip text).
const luminance = (hex) =>
  0.299 * ((hex >> 16) & 255) + 0.587 * ((hex >> 8) & 255) + 0.114 * (hex & 255);

export const WithCustomizer = (Base) => class extends Base {
  // ── Lifecycle ───────────────────────────────────────────────────────────────
  custEnter() {
    this.allHorses = this.registry.get('allHorses');
    this._editKey = this.registry.get('viewingAnimal')?.key;
    if (!this._editKey || !this.allHorses?.[this._editKey]) return;
    this.paddock = this.scene.get('PaddockScene');
    this.scrollY = 0;
    this._dragMoved = false;
    // Controller / keyboard focus state (#147 controller support). The focus ring
    // only appears once a pad/arrow is used, so touch/mouse UX is unchanged.
    this._focusables = [];
    this._focusIdx = 0;
    this._focusActive = false;
    this._padPrev = {};

    // Pause the world so it freezes (no decay/autosave) and its update-loop closers
    // can't yank the editor away mid-edit. The full-screen overlay below hides the
    // busy scene; we only show an isolated copy of the edited horse.
    this._custPaused = [];
    for (const k of PAUSABLE) if (this.scene.isActive(k)) { this.scene.pause(k); this._custPaused.push(k); }
    // Hide the other UI/world overlays so only the editor shows.
    this._custHidden = [];
    for (const k of HIDE_DURING_EDIT) if (this.scene.isVisible(k)) { this.scene.setVisible(false, k); this._custHidden.push(k); }
    this.scene.bringToTop(); // keep the editor above everything

    this._custBuildChrome();      // computes the split layout + world region
    this._buildPreview();         // isolated, idle-animating horse on green pasture
    this._custHeader();
    this._custContent();
    this._installScrollInput();

    this.input.keyboard.on('keydown-ESC', () => this.custExit());
    this.input.keyboard.on('keydown-LEFT', () => this._moveFocus(-1, 0));
    this.input.keyboard.on('keydown-RIGHT', () => this._moveFocus(1, 0));
    this.input.keyboard.on('keydown-UP', () => this._moveFocus(0, -1));
    this.input.keyboard.on('keydown-DOWN', () => this._moveFocus(0, 1));
    this.input.keyboard.on('keydown-ENTER', () => this._activateFocus());
  }

  custExit() {
    this._focusRing = null; this._focusActive = false; this._focusables = [];
    if (this._custPaused) { for (const k of this._custPaused) if (this.scene.isPaused(k)) this.scene.resume(k); this._custPaused = null; }
    if (this._custHidden) { for (const k of this._custHidden) this.scene.setVisible(true, k); this._custHidden = null; }
    this._maskG?.destroy(); this._maskG = null; this._mask = null;
    this.contentC = null; this._sb = null; this._previewSprite = null;
    this.children.removeAll(true);
    this.input.removeAllListeners();
    this.input.keyboard.removeAllListeners();
    this._onCustExit?.();
  }

  // An isolated, idle-animating copy of the edited horse, centered on a plain green
  // pasture filling the world region — so you see only this horse (not the bunched-up
  // herd or scene props). It re-skins live because it shares the `${key}_idle_*`
  // textures that reskinHorse() redraws in place.
  _buildPreview() {
    const r = this._worldRegion;
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;

    // Size the horse to fill ~70% of whichever region dimension is the limit, so it's
    // big on a wide screen and scales down gracefully on a small/portrait one — with a
    // margin of pasture left around it (sprite aspect is 64×54).
    const dh = Math.max(120, Math.min(r.h * 0.7, r.w * 0.7 * 54 / 64));
    const dw = dh * 64 / 54;

    // Grass shown at the same scale relative to the horse as in the world: the world
    // draws grass at native tile size with the horse at scale S, so the preview tiles
    // by the horse's zoom factor here (preview horse height dh vs world's 54*S).
    this.add.tileSprite(cx, cy, r.w, r.h, 'grass').setOrigin(0.5, 0.5).setDepth(0)
      .setTileScale(dh / (54 * S));
    const shadow = this.add.graphics().setDepth(0);
    shadow.fillStyle(0x123a14, 0.28);
    shadow.fillEllipse(cx, cy + dh * 0.45, dw * 0.7, dh * 0.14);

    const animKey = `cust_idle_${this._editKey}`;
    if (!this.anims.exists(animKey)) {
      this.anims.create({
        key: animKey,
        frames: [{ key: `${this._editKey}_idle_0` }, { key: `${this._editKey}_idle_1` }],
        frameRate: 2, repeat: -1,
      });
    }
    this._previewSprite = this.add.sprite(cx, cy, `${this._editKey}_idle_0`)
      .setDisplaySize(dw, dh).setOrigin(0.5, 0.5).setDepth(1);
    this._previewSprite.play(animKey);
  }

  // ── Chrome: side (or bottom) editor panel + scroll viewport + mask ────────────
  // No full-screen dim — the world stays visible on the other side. Landscape =
  // panel on the RIGHT, world on the LEFT; portrait = panel as a BOTTOM sheet,
  // world on top. The world region is handed to the camera focus above.
  _custBuildChrome() {
    const sw = this.scale.width, sh = this.scale.height;
    const landscape = sw >= 720 && sw >= sh;
    if (landscape) {
      this.panelW = Phaser.Math.Clamp(Math.round(sw * 0.42), 320, 440);
      this.panelH = sh;
      this.px = sw - this.panelW;
      this.py = 0;
      this._worldRegion = { x: 0, y: 0, w: this.px, h: sh };
    } else {
      this.panelH = Phaser.Math.Clamp(Math.round(sh * 0.55), 280, sh - 140);
      this.panelW = sw;
      this.px = 0;
      this.py = sh - this.panelH;
      this._worldRegion = { x: 0, y: 0, w: sw, h: this.py };
    }

    const bg = this.add.graphics().setDepth(1);
    bg.fillStyle(0x10131f, 0.98); bg.fillRect(this.px, this.py, this.panelW, this.panelH);
    bg.lineStyle(2, 0x3a4060, 1);
    if (landscape) bg.lineBetween(this.px, 0, this.px, sh);
    else bg.lineBetween(0, this.py, sw, this.py);
    this.add.zone(this.px, this.py, this.panelW, this.panelH).setOrigin(0, 0).setInteractive().setDepth(1); // absorb taps

    const done = this.add.text(this.px + this.panelW - 12, this.py + 10, 'Done', {
      fontFamily: 'system-ui, sans-serif', fontSize: '15px', color: '#10131f', fontStyle: 'bold',
      backgroundColor: '#ffe066', padding: { x: 12, y: 6 },
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true }).setDepth(6);
    growHitArea(done);
    done.on('pointerup', () => { if (!this._dragMoved) this.custExit(); });
    // Done is a fixed (non-scrolling) focusable for controller nav.
    this._doneFocus = { id: 'done', x: done.x - done.width, y: done.y, w: done.width, h: done.height, activate: () => this.custExit(), fixed: true };
    this._focusRing = this.add.graphics().setDepth(7);

    // Header (name + breed) then the scroll viewport beneath it.
    this._nameY = this.py + 12;
    this._breedY = this._nameY + 24;
    this.viewTop = this._breedY + 24;
    this.viewBottom = this.py + this.panelH - 12;
    this.viewH = this.viewBottom - this.viewTop;

    this._maskG = this.make.graphics();
    this._maskG.fillStyle(0xffffff); this._maskG.fillRect(this.px, this.viewTop, this.panelW, this.viewH);
    this._mask = this._maskG.createGeometryMask();
  }

  // ── Pinned header: name (tap to rename) + breed label ─────────────────────────
  _custHeader() {
    this._custHeaderNodes?.forEach(n => n.destroy());
    this._custHeaderNodes = [];
    const add = (n) => { this._custHeaderNodes.push(n.setDepth(5)); return n; };
    const horse = this.allHorses[this._editKey];

    const name = add(this.add.text(this.px + 16, this._nameY, `${horse.name}  ✎`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#eef0fa', fontStyle: 'bold',
    }).setOrigin(0, 0).setInteractive({ useHandCursor: true }));
    growHitArea(name); // comfortable tap target (#146)
    name.on('pointerup', () => { if (!this._dragMoved) this._custRename(); });
    this._nameFocus = { id: 'name', x: name.x, y: name.y, w: name.width, h: name.height, activate: () => this._custRename(), fixed: true };

    add(this.add.text(this.px + 16, this._breedY, horse.breed || COATS[colorKeyOf(horse.coat)]?.label || '', {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#9aa0c0',
    }).setOrigin(0, 0));
  }

  // ── Scrollable content ────────────────────────────────────────────────────────
  _custContent() {
    this.contentC?.destroy();
    const c = this.add.container(this.px, this.viewTop).setDepth(3);
    this.contentC = c;
    this._focusables = []; // rebuilt as sections register their zones (via _tap)

    const horse = this.allHorses[this._editKey];
    const composed = composeCoat(horse.coat, horse.markings);
    const eff = composed.markings;
    // Mane has no coat-bundled "natural"; it defaults to the coat colour (#140 FU).
    const maneCur = (eff.maneColor && COATS[eff.maneColor]) ? eff.maneColor : colorKeyOf(horse.coat);
    const naturalFeather = composed.mane.mid;
    const curPattern = PATTERN_KEYS.find(k => eff[k]) || 'none';
    const curFace = FACE_KEYS.find(k => eff[k]) || 'none';
    const hasLegMark = Object.values(eff.legs || {}).some(Boolean);
    const opt = (labels) => [['none', 'None'], ...Object.entries(labels)];

    let y = 8;
    y = this._secOptions(c, 'Gender', [['female', 'Female'], ['male', 'Male']],
      horse.sex || 'female', (k) => this._setGender(k), y) + 14;
    y = this._secCoat(c, y) + 14;
    y = this._secColorPalette(c, 'Mane color', maneCur, (k) => this._setManeColor(k), y) + 14;
    // Patterns: single-select with None (#147 FU), then the active one's variant.
    y = this._secOptions(c, 'Patterns', opt(PATTERN_LABELS), curPattern, (k) => this._setPattern(k), y) + 8;
    y = this._secPatternVariants(c, y) + 6;
    if (curPattern === 'pinto') {
      y = this._secToggle(c, 'Two-tone mane', !!eff.pintoMane, () => this._toggleMarking('pintoMane'), y) + 14;
    }
    // Face markings: single-select with None (#147 FU).
    y = this._secOptions(c, 'Face markings', opt(FACE_MARKING_LABELS), curFace, (k) => this._setFace(k), y) + 14;
    y = this._secLegs(c, y) + 14;
    // Sock/stocking colour only matters once a leg has a sock/stocking (#141 FU).
    if (hasLegMark) {
      y = this._secSwatches(c, 'Sock color', this._sockEntries(), eff.sockColor || 'white', (k) => this._setSockColor(k), y) + 14;
    }
    // Primitive markings (decoupled from the coat, follow-up): dark legs ("points")
    // and the dun dorsal stripe, each defaulting to the coat's natural look.
    y = this._secToggle(c, 'Dark legs', composed.points !== undefined, () => this._toggleDarkLegs(), y) + 8;
    y = this._secToggle(c, 'Dorsal stripe', !!composed.dorsal, () => this._toggleDorsal(), y) + 14;
    y = this._secFeather(c, y, naturalFeather) + 14;
    y = this._secBreeds(c, y) + 10;
    this.contentH = y;

    // Fixed (non-scrolling) controls join the focus list last.
    if (this._nameFocus) this._focusables.push(this._nameFocus);
    if (this._doneFocus) this._focusables.push(this._doneFocus);
    this._focusIdx = Phaser.Math.Clamp(this._focusIdx, 0, this._focusables.length - 1);

    c.setMask(this._mask);
    this.scrollMax = Math.max(0, this.contentH - this.viewH);
    this._setScroll(this.scrollY);
    this._buildScrollbar();
    if (this._focusActive) this._refreshFocusRing();
  }

  _heading(c, text, y) {
    c.add(this.add.text(16, y, text, {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#aab0d0', fontStyle: 'bold',
    }).setOrigin(0, 0));
    return y + 20;
  }

  // Item zones fire on pointer-UP, ignored if the gesture was a scroll-drag or
  // released outside the viewport (zones can scroll under the pinned header).
  // Each zone is also registered as a (scrolling) focusable for controller nav.
  _tap(zone, fn) {
    zone.on('pointerup', (p) => { if (!this._dragMoved && this._inView(p)) fn(); });
    this._focusables.push({ id: 'f' + this._focusables.length, x: zone.x, y: zone.y, w: zone.width, h: zone.height, activate: fn, fixed: false });
  }

  _secCoat(c, y0) {
    let y = this._heading(c, 'Coat color', y0);
    const keys = Object.keys(COATS);
    const cols = 4, gap = 8;
    const cellW = Math.floor((this.panelW - 32 - (cols - 1) * gap) / cols);
    const cellH = TAP;
    const activeColor = colorKeyOf(this.allHorses[this._editKey].coat);
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

  // The full coat-colour palette as swatches (no "Natural" — a coat carries no
  // bundled mane colour, #140 FU). `extras` prepends extra entries [key,label,tone]
  // (feathering passes its own "Natural = match mane"). `onPick(key)` fires on tap.
  _secColorPalette(c, title, currentKey, onPick, y0, extras = []) {
    const entries = [...extras, ...Object.keys(COATS).map(k => [k, COATS[k].label, COATS[k].body.mid])];
    return this._secSwatches(c, title, entries, currentKey, onPick, y0);
  }

  // A grid of colour swatches. `entries` = [[key, label, tone], …]; `currentKey`
  // highlights the active one; `onPick(key)` fires on tap. Reused by the colour
  // palettes (mane/feather) and the sock-colour picker.
  _secSwatches(c, title, entries, currentKey, onPick, y0) {
    let y = this._heading(c, title, y0);
    const cols = 4, gap = 8;
    const cellW = Math.floor((this.panelW - 32 - (cols - 1) * gap) / cols);
    const cellH = TAP;
    entries.forEach(([key, label, tone], i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = 16 + col * (cellW + gap);
      const cyy = y + row * (cellH + gap);
      const active = key === currentKey;
      const g = this.add.graphics();
      g.fillStyle(tone, 1); g.fillRoundedRect(x, cyy, cellW, cellH, 6);
      g.lineStyle(active ? 3 : 1, active ? 0xffe066 : 0x00000055, 1); g.strokeRoundedRect(x, cyy, cellW, cellH, 6);
      const lbl = this.add.text(x + cellW / 2, cyy + cellH / 2, label, {
        fontFamily: 'system-ui, sans-serif', fontSize: '9.5px',
        color: luminance(tone) > 140 ? '#10131f' : '#eef0fa', align: 'center',
      }).setOrigin(0.5, 0.5);
      const zone = this.add.zone(x, cyy, cellW, cellH).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      this._tap(zone, () => onPick(key));
      c.add([g, lbl, zone]);
    });
    return y + Math.ceil(entries.length / cols) * (cellH + gap);
  }

  // Sock/stocking colour swatch entries (white / black / tan), #141 FU.
  _sockEntries() {
    return Object.entries(SOCK_COLOR_LABELS).map(([k, label]) => [k, label, SOCK_COLORS[k]]);
  }

  // A standalone labelled toggle pill (on = green/gold). Used for the optional
  // pinto two-tone mane (#144 FU).
  _secToggle(c, label, on, onTap, y0) {
    const h = TAP, w = Math.max(140, 28 + label.length * 8);
    const g = this.add.graphics();
    g.fillStyle(on ? 0x3a6a44 : 0x1a1e30, 1); g.fillRoundedRect(16, y0, w, h, h / 2);
    g.lineStyle(on ? 3 : 1, on ? 0xffe066 : 0x3a4060, 1); g.strokeRoundedRect(16, y0, w, h, h / 2);
    const lbl = this.add.text(16 + w / 2, y0 + h / 2, `${on ? '✓ ' : ''}${label}`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: on ? '#eafff0' : '#aab0d0',
    }).setOrigin(0.5, 0.5);
    const zone = this.add.zone(16, y0, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this._tap(zone, onTap);
    c.add([g, lbl, zone]);
    return y0 + h;
  }

  // A heading + a row of mutually-exclusive option pills (active = highlighted).
  // `options` is [[key, label], …]; `onPick(key)` fires on tap. Reused for sock
  // colour (#141) and gender (#145).
  _secOptions(c, title, options, currentKey, onPick, y0) {
    let y = this._heading(c, title, y0);
    const gap = 8, h = TAP, r = h / 2;
    let x = 16;
    for (const [key, label] of options) {
      const w = Math.max(64, 22 + label.length * 9);
      if (x + w > this.panelW - 16) { x = 16; y += h + 8; }
      const on = key === currentKey;
      const g = this.add.graphics();
      g.fillStyle(on ? 0x3a6a44 : 0x1a1e30, 1); g.fillRoundedRect(x, y, w, h, r);
      g.lineStyle(on ? 3 : 1, on ? 0xffe066 : 0x3a4060, 1); g.strokeRoundedRect(x, y, w, h, r);
      const lbl = this.add.text(x + w / 2, y + h / 2, label, {
        fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: on ? '#eafff0' : '#aab0d0',
      }).setOrigin(0.5, 0.5);
      const zone = this.add.zone(x, y, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      this._tap(zone, () => onPick(key));
      c.add([g, lbl, zone]);
      x += w + gap;
    }
    return y + h;
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
      // Label
      c.add(this.add.text(16, y + rowH / 2, label, {
        fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#cdd2ee',
      }).setOrigin(0, 0.5));
      // ◀  n / N  ▶ cluster, right-aligned
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

  // Four mini-leg buttons in sprite order (back-far, back-near, front-far,
  // front-near), each drawn with the horse's own colours + current sock/stocking.
  _secLegs(c, y0) {
    let y = this._heading(c, 'Leg markings — tap to add a sock, again for a stocking', y0);
    const coat = composeCoat(this.allHorses[this._editKey].coat, this.allHorses[this._editKey].markings);
    const legs = coat.markings.legs || {};
    const sockTone = SOCK_COLORS[coat.markings.sockColor] || SOCK_COLORS.white;
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

  // Feathering: a toggle, plus (when on) the full coat-colour palette for its colour
  // — with a "Natural" entry that matches the mane (#143). `naturalFeather` is that
  // matching tone (computed by the caller).
  _secFeather(c, y0, naturalFeather) {
    let y = this._heading(c, 'Feathering', y0);
    const horse = this.allHorses[this._editKey];
    const eff = effectiveMarkings(horse.coat, horse.markings);
    const on = !!eff.feather;

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

    if (!on) return y + h;

    return this._secColorPalette(c, 'Feather color', eff.featherColor || 'natural',
      (k) => this._setFeatherColor(k), y + h + 8, [['natural', 'Natural', naturalFeather]]);
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

  // ── Scrolling ───────────────────────────────────────────────────────────────
  _installScrollInput() {
    this.input.on('wheel', (_p, _go, _dx, dy) => this._setScroll(this.scrollY + dy * 0.5));
    this.input.on('pointerdown', (p) => {
      // Touch/mouse use hides the controller focus ring (it returns on next pad/arrow).
      if (this._focusActive) { this._focusActive = false; this._focusRing?.clear(); }
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
    if (this._focusActive) this._refreshFocusRing();
  }

  // ── Controller / keyboard focus navigation (#147 controller support) ──────────
  _screenRect(f) {
    return f.fixed ? f : { x: this.px + f.x, y: this.viewTop - this.scrollY + f.y, w: f.w, h: f.h };
  }

  // Move focus to the nearest focusable in direction (dx,dy). The first press just
  // shows the ring (so the player sees where focus is before it jumps).
  _moveFocus(dx, dy) {
    if (this._mode !== 'edit' || !this._focusables.length) return;
    if (!this._focusActive) { this._focusActive = true; this._focusIdx = 0; this._scrollToFocus(); this._refreshFocusRing(); return; }
    const cur = this._focusables[this._focusIdx];
    const a = this._screenRect(cur), ax = a.x + a.w / 2, ay = a.y + a.h / 2;
    let best = -1, bestScore = Infinity;
    this._focusables.forEach((f, i) => {
      if (i === this._focusIdx) return;
      const r = this._screenRect(f), bx = r.x + r.w / 2, by = r.y + r.h / 2;
      const ddx = bx - ax, ddy = by - ay;
      if (dx > 0 && ddx <= 4) return; if (dx < 0 && ddx >= -4) return;
      if (dy > 0 && ddy <= 4) return; if (dy < 0 && ddy >= -4) return;
      const along = dx !== 0 ? Math.abs(ddx) : Math.abs(ddy);
      const cross = dx !== 0 ? Math.abs(ddy) : Math.abs(ddx);
      const score = along + cross * 2;
      if (score < bestScore) { bestScore = score; best = i; }
    });
    if (best >= 0) { this._focusIdx = best; this._scrollToFocus(); this._refreshFocusRing(); }
  }

  _activateFocus() {
    if (this._mode !== 'edit') return;
    if (!this._focusActive) { this._focusActive = true; this._focusIdx = 0; this._scrollToFocus(); this._refreshFocusRing(); return; }
    this._focusables[this._focusIdx]?.activate?.();
  }

  // Scroll so the focused (scrolling) control sits inside the viewport.
  _scrollToFocus() {
    const f = this._focusables[this._focusIdx];
    if (!f || f.fixed) return;
    const topY = this.viewTop - this.scrollY + f.y;
    const botY = topY + f.h;
    if (topY < this.viewTop) this._setScroll(this.scrollY - (this.viewTop - topY) - 8);
    else if (botY > this.viewBottom) this._setScroll(this.scrollY + (botY - this.viewBottom) + 8);
  }

  _refreshFocusRing() {
    if (!this._focusRing) return;
    this._focusRing.clear();
    if (!this._focusActive) return;
    const f = this._focusables[this._focusIdx];
    if (!f) return;
    const r = this._screenRect(f);
    this._focusRing.lineStyle(3, 0xffffff, 0.95);
    this._focusRing.strokeRoundedRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6, 8);
  }

  // Poll the gamepad while editing: d-pad/stick moves focus, A activates, B exits.
  _pollEditPad() {
    const pad = this.input.gamepad && this.input.gamepad.getPad(0);
    if (!pad) return;
    const p = this._padPrev || {};
    const ls = pad.leftStick || { x: 0, y: 0 };
    const cur = {
      left: pad.left || ls.x < -0.5, right: pad.right || ls.x > 0.5,
      up: pad.up || ls.y < -0.5, down: pad.down || ls.y > 0.5,
      A: pad.A, B: pad.B,
    };
    if (cur.left && !p.left) this._moveFocus(-1, 0);
    if (cur.right && !p.right) this._moveFocus(1, 0);
    if (cur.up && !p.up) this._moveFocus(0, -1);
    if (cur.down && !p.down) this._moveFocus(0, 1);
    if (cur.A && !p.A) this._activateFocus();
    if (cur.B && !p.B) this.custExit();
    this._padPrev = cur;
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

  // Patterns are mutually exclusive with a "None" option (#147 FU): selecting one
  // clears the others (and the pinto-only two-tone-mane flag).
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

  // Mane colour is always an explicit coat colour now — no coat-bundled "natural"
  // (#140 FU). composeCoat resolves it for the art.
  _setManeColor(key) {
    const horse = this.allHorses[this._editKey];
    horse.markings = { ...effectiveMarkings(horse.coat, horse.markings), maneColor: key };
    this._applyEdit();
  }

  // Sock/stocking colour: 'white' (default) clears, else 'black'/'tan' (#141 FU).
  _setSockColor(key) {
    const horse = this.allHorses[this._editKey];
    const next = { ...effectiveMarkings(horse.coat, horse.markings) };
    if (key === 'white') delete next.sockColor; else next.sockColor = key;
    horse.markings = next;
    this._applyEdit();
  }

  // Dark legs ("points") and the dorsal stripe are decoupled toggles (follow-up):
  // store an explicit boolean override flipped from the current effective state.
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

  _setFeatherColor(color) {
    const horse = this.allHorses[this._editKey];
    const next = { ...effectiveMarkings(horse.coat, horse.markings), feather: true };
    if (color === 'natural') delete next.featherColor; else next.featherColor = color;
    horse.markings = next;
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

  // Gender is editable here too (#145); the info panel shows Male/Female and it
  // persists via the model's toJSON.
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

  // Apply current data to the live world + persist, then refresh the editor UI.
  _applyEdit() {
    this.paddock.reskinHorse(this._editKey);
    this.paddock._saveHorses();
    this._custHeader();
    this._custContent();
  }
};
