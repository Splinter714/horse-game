import Phaser from 'phaser';
import { S } from '../paddock/constants.js';
import { growHitArea, logicalW, logicalH } from '../uiUtils.js';
import { CUSTOMIZE, swatchTone, defaultLook } from '../../data/customize.js';
import { reskinAnimal } from '../../art/index.js';
import { ART_SCALE } from '../../art/_frames.js';
import { DEMO_FOALS } from '../../data/demoFoals.js';

// Generic, species-agnostic customizer SHELL (#165). Hosts a sticky, scrollable
// "edit mode" with a pinned live preview on one side and recolour controls on the
// other. It owns everything that isn't species-specific: the split layout (landscape
// = panel RIGHT / preview LEFT; portrait = bottom sheet), scroll + mask, controller/
// keyboard focus nav, the live idle-animating preview sprite, and the section-builder
// primitives (swatch grids, option pills, toggles). Extracted from the old monolithic
// customizer.js so it can drive ANY animal (#169 split).
//
// Two content modes, chosen from the species' CUSTOMIZE schema:
//   • simple "parts" (sheep/cow/pig/dog/cat) — one swatch grid per editable part,
//     applied live via reskinAnimal(); rendered here.
//   • the horse — a rich bespoke section set provided by WithHorseSections
//     (sections: 'horse'); this shell just delegates to _buildHorseSections().
//
// Hosts call custEnterFor({ speciesId, key, persist, host, onExit }) and the shell
// calls back this._onCustExit?.() when the user taps Done / Esc / B.

const PAUSABLE = ['PaddockScene', 'DayNightScene'];
// Scenes hidden while editing so the editor owns the screen — the hotbar and the
// day/night tint + clock label (which otherwise renders over the panel).
const HIDE_DURING_EDIT = ['HotbarScene', 'DayNightScene'];
const TAP = 44; // comfortable touch-target minimum (#100/#146)

// HSL of a 0xRRGGBB colour, for ordering swatches by colour family (#154).
function hsl(hex) {
  const r = ((hex >> 16) & 255) / 255, g = ((hex >> 8) & 255) / 255, b = (hex & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let h = 0, s = 0;
  if (d > 1e-4) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h = h * 60; if (h < 0) h += 360;
  }
  return { h, s, l };
}
// Swatch sort key: chromatic colours grouped by hue then light→dark; near-grey and
// black colours grouped together at the end (#154).
export const colorRank = (hex) => {
  const { h, s, l } = hsl(hex);
  return s < 0.12 ? 400 + (1 - l) : h + (1 - l);
};

export const WithCustomizerShell = (Base) => class extends Base {
  // ── Lifecycle ───────────────────────────────────────────────────────────────
  // opts: { speciesId, key, persist?, host?, onExit? }
  //   persist — optional save callback fired after each edit (in-world horse only).
  //   host    — optional scene key to pause+hide while editing (art-preview host).
  //   onExit  — optional callback when the editor closes (defaults to this._onCustExit).
  custEnterFor(opts) {
    this._custSpecies = opts.speciesId;
    this._editKey = opts.key;
    this._custPersist = opts.persist || null;
    this._custHostKey = opts.host || null;
    if (opts.onExit) this._onCustExit = opts.onExit;
    this._mode = 'edit';

    // Resolve the thing being edited. Horse-like subjects (horse + foal) carry a live
    // model the rich editor reads/writes; simple "parts" animals have no model, just an
    // in-memory `look` of per-part palette ramps that recolours the art live.
    if (this._isHorseLike()) {
      this.paddock = this.scene.get('PaddockScene'); // null in the art-preview host
      // The foal is a young horse (same coat editor). Its demo models aren't persisted,
      // so seed an in-memory roster from DEMO_FOALS on first use; `this.allHorses` then
      // works exactly like the herd map for every horse-section read/write below.
      if (this._custSpecies === 'foal') {
        let foals = this.registry.get('demoFoals');
        if (!foals) { foals = JSON.parse(JSON.stringify(DEMO_FOALS)); this.registry.set('demoFoals', foals); }
        this.allHorses = foals;
      } else {
        this.allHorses = this.registry.get('allHorses');
      }
      if (!this._editKey || !this.allHorses?.[this._editKey]) return false;
    } else {
      if (!CUSTOMIZE[this._custSpecies]?.parts) return false;
      this._look = defaultLook(this._custSpecies);
    }

    this.scrollY = 0;
    this._dragMoved = false;
    // Controller / keyboard focus state (#147). The ring only appears once a pad/arrow
    // is used, so touch/mouse UX is unchanged.
    this._focusables = [];
    this._focusIdx = 0;
    this._focusActive = false;
    this._padPrev = {};

    // Freeze the world so it can't yank the editor away mid-edit, and hide the busy
    // UI/world overlays so only the editor shows. The host scene (art-preview) is
    // paused+hidden too; PAUSABLE/HIDE entries that aren't active are simply skipped.
    this._custPaused = [];
    for (const k of [...PAUSABLE, this._custHostKey]) {
      if (k && this.scene.isActive(k) && k !== this.scene.key) { this.scene.pause(k); this._custPaused.push(k); }
    }
    this._custHidden = [];
    for (const k of [...HIDE_DURING_EDIT, this._custHostKey]) {
      if (k && this.scene.isVisible(k) && k !== this.scene.key) { this.scene.setVisible(false, k); this._custHidden.push(k); }
    }
    this.scene.bringToTop(); // keep the editor above everything

    this._custBuildChrome();      // computes the split layout + world region
    this._buildPreview();         // isolated, idle-animating creature on green pasture
    this._custHeader();
    this._custContent();
    this._installScrollInput();

    this.input.keyboard.on('keydown-ESC', () => this.custExit());
    this.input.keyboard.on('keydown-LEFT', () => this._moveFocus(-1, 0));
    this.input.keyboard.on('keydown-RIGHT', () => this._moveFocus(1, 0));
    this.input.keyboard.on('keydown-UP', () => this._moveFocus(0, -1));
    this.input.keyboard.on('keydown-DOWN', () => this._moveFocus(0, 1));
    this.input.keyboard.on('keydown-ENTER', () => this._activateFocus());
    return true;
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

  // An isolated, idle-animating copy of the edited creature, centred on plain green
  // pasture filling the world region — so you see only this animal (not the world or
  // gallery). It re-skins live because it shares the `${key}_idle_*` textures the
  // edit handlers redraw in place.
  _buildPreview() {
    const r = this._worldRegion;
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const src = this.textures.get(`${this._editKey}_idle_0`).getSourceImage();
    const aspect = src.width / src.height;

    // Size the creature to fill ~70% of whichever region dimension is the limit, with
    // a margin of pasture around it, keeping the art's native aspect ratio.
    const dh = Math.max(120, Math.min(r.h * 0.7, (r.w * 0.7) / aspect));
    const dw = dh * aspect;

    // Grass: horse-like previews match the world's grass zoom (preserves the long-tuned
    // in-world editor look). The horse/foal art is ART_SCALE super-sampled, so its native
    // LOGICAL height is src.height / ART_SCALE; the world draws it at scale S. Other
    // species use a sane backdrop scale. (For the horse this equals the old dh/(54*S).)
    const tileScale = this._isHorseLike() ? dh / ((src.height / ART_SCALE) * S) : 2;
    this.add.tileSprite(cx, cy, r.w, r.h, 'grass').setOrigin(0.5, 0.5).setDepth(0).setTileScale(tileScale);
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
  _custBuildChrome() {
    const sw = logicalW(this), sh = logicalH(this);
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
    this._doneFocus = { id: 'done', x: done.x - done.width, y: done.y, w: done.width, h: done.height, activate: () => this.custExit(), fixed: true };
    this._focusRing = this.add.graphics().setDepth(7);

    // Header (name/label + subtitle) then the scroll viewport beneath it.
    this._nameY = this.py + 12;
    this._breedY = this._nameY + 24;
    this.viewTop = this._breedY + 24;
    this.viewBottom = this.py + this.panelH - 12;
    this.viewH = this.viewBottom - this.viewTop;

    this._maskG = this.make.graphics();
    this._maskG.fillStyle(0xffffff); this._maskG.fillRect(this.px, this.viewTop, this.panelW, this.viewH);
    this._mask = this._maskG.createGeometryMask();
  }

  // ── Pinned header ─ title (+ optional rename) + subtitle ──────────────────────
  _custHeader() {
    this._custHeaderNodes?.forEach(n => n.destroy());
    this._custHeaderNodes = [];
    const add = (n) => { this._custHeaderNodes.push(n.setDepth(5)); return n; };
    const info = this._headerInfo();

    const title = add(this.add.text(this.px + 16, this._nameY, info.onRename ? `${info.title}  ✎` : info.title, {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#eef0fa', fontStyle: 'bold',
    }).setOrigin(0, 0));
    if (info.onRename) {
      title.setInteractive({ useHandCursor: true });
      growHitArea(title);
      title.on('pointerup', () => { if (!this._dragMoved) info.onRename(); });
      this._nameFocus = { id: 'name', x: title.x, y: title.y, w: title.width, h: title.height, activate: info.onRename, fixed: true };
    } else {
      this._nameFocus = null;
    }

    if (info.subtitle) {
      add(this.add.text(this.px + 16, this._breedY, info.subtitle, {
        fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#9aa0c0',
      }).setOrigin(0, 0));
    }
  }

  // Horse + foal share the rich horse editor (sections: 'horse'); both read/write a
  // model via this.allHorses. Everything else is the data-driven parts path.
  _isHorseLike() {
    return this._custSpecies === 'horse' || this._custSpecies === 'foal';
  }

  // Header text for the current subject. Horse-like subjects provide their own (name +
  // breed + rename) via WithHorseSections; everything else shows a plain species label.
  _headerInfo() {
    if (this._isHorseLike()) return this._horseHeaderInfo();
    const label = this._custSpecies.charAt(0).toUpperCase() + this._custSpecies.slice(1);
    return { title: label, subtitle: 'Tap a colour to recolour', onRename: null };
  }

  // ── Scrollable content ────────────────────────────────────────────────────────
  _custContent() {
    this.contentC?.destroy();
    const c = this.add.container(this.px, this.viewTop).setDepth(3);
    this.contentC = c;
    this._focusables = []; // rebuilt as sections register their zones (via _tap)

    // Horse keeps its rich, bespoke section set; everything else is data-driven parts.
    const endY = CUSTOMIZE[this._custSpecies]?.sections === 'horse'
      ? this._buildHorseSections(c, 8)
      : this._buildPartSections(c, 8);
    this.contentH = endY;

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

  // Data-driven simple parts: one swatch grid per editable part, naming the selection
  // beneath it. Picking a swatch recolours the live sprite (#165, live-recolor only).
  _buildPartSections(c, y0) {
    let y = y0;
    const parts = CUSTOMIZE[this._custSpecies].parts;
    for (const part of parts) {
      const cur = this._look[part.id];
      const sel = part.palette.find((s) => s.ramp === cur) || part.palette[0];
      const entries = part.palette.map((s) => [s.key, s.label, swatchTone(s.ramp)]);
      y = this._secSwatches(c, part.label, entries, sel.key, (k) => this._pickPartSwatch(part.id, k), y) + 14;
    }
    return y;
  }

  _pickPartSwatch(partId, swatchKey) {
    const part = CUSTOMIZE[this._custSpecies].parts.find((p) => p.id === partId);
    const swatch = part.palette.find((s) => s.key === swatchKey);
    if (!swatch) return;
    this._look = { ...this._look, [partId]: swatch.ramp };
    reskinAnimal(this, this._custSpecies, this._editKey, this._look); // redraws frames in place
    this._custContent(); // refresh the selected-swatch highlight + caption
  }

  _heading(c, text, y) {
    c.add(this.add.text(16, y, text, {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#aab0d0', fontStyle: 'bold',
    }).setOrigin(0, 0));
    return y + 20;
  }

  // Item zones fire on pointer-UP, ignored if the gesture was a scroll-drag or
  // released outside the viewport. Each zone is also a (scrolling) focusable.
  _tap(zone, fn) {
    zone.on('pointerup', (p) => { if (!this._dragMoved && this._inView(p)) fn(); });
    this._focusables.push({ id: 'f' + this._focusables.length, x: zone.x, y: zone.y, w: zone.width, h: zone.height, activate: fn, fixed: false });
  }

  // A grid of unlabelled colour swatches, ordered by colour family; `currentKey`
  // highlights the active one and its name shows as a caption below (#154).
  // `entries` = [[key, label, tone], …]; `onPick(key)` fires on tap.
  _secSwatches(c, title, entries, currentKey, onPick, y0) {
    let y = this._heading(c, title, y0);
    const sorted = [...entries].sort((a, b) => colorRank(a[2]) - colorRank(b[2]));
    const cols = 4, gap = 8;
    const cellW = Math.floor((this.panelW - 32 - (cols - 1) * gap) / cols);
    const cellH = TAP;
    sorted.forEach(([key, , tone], i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = 16 + col * (cellW + gap);
      const cyy = y + row * (cellH + gap);
      const active = key === currentKey;
      const g = this.add.graphics();
      g.fillStyle(tone, 1); g.fillRoundedRect(x, cyy, cellW, cellH, 6);
      g.lineStyle(active ? 3 : 1, active ? 0xffe066 : 0x00000055, 1); g.strokeRoundedRect(x, cyy, cellW, cellH, 6);
      const zone = this.add.zone(x, cyy, cellW, cellH).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      this._tap(zone, () => onPick(key));
      c.add([g, zone]);
    });
    y += Math.ceil(sorted.length / cols) * (cellH + gap);
    const sel = sorted.find(e => e[0] === currentKey);
    return this._secSelectedName(c, sel ? sel[1] : '', y);
  }

  // One caption under a swatch palette naming the selected colour (#154).
  _secSelectedName(c, name, y) {
    if (name) {
      c.add(this.add.text(16, y + 2, name, {
        fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#ffe066', fontStyle: 'bold',
      }).setOrigin(0, 0));
    }
    return y + 22;
  }

  // A standalone labelled toggle pill (on = green/gold).
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

  // A heading + a wrapping row of independent on/off toggle chips. `items` =
  // [[label, isOn, onTap], …].
  _secToggleChips(c, title, items, y0) {
    let y = this._heading(c, title, y0);
    const gap = 8, h = TAP, r = h / 2, step = h + 8;
    let x = 16, row = 0;
    for (const [label, on, onTap] of items) {
      const w = Math.max(56, 22 + label.length * 8);
      if (x + w > this.panelW - 16) { x = 16; row++; }
      const yy = y + row * step;
      const g = this.add.graphics();
      g.fillStyle(on ? 0x3a6a44 : 0x1a1e30, 1); g.fillRoundedRect(x, yy, w, h, r);
      g.lineStyle(on ? 3 : 1, on ? 0x7fd68f : 0x3a4060, 1); g.strokeRoundedRect(x, yy, w, h, r);
      const lbl = this.add.text(x + w / 2, yy + h / 2, `${on ? '✓ ' : ''}${label}`, {
        fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: on ? '#eafff0' : '#aab0d0',
      }).setOrigin(0.5, 0.5);
      const zone = this.add.zone(x, yy, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      this._tap(zone, onTap);
      c.add([g, lbl, zone]);
      x += w + gap;
    }
    return y + (row + 1) * step;
  }

  // A heading + a row of mutually-exclusive option pills (active = highlighted).
  // `options` is [[key, label], …]; `onPick(key)` fires on tap.
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
};
