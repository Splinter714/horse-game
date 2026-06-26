import Phaser from 'phaser';
import { applyDpr, logicalW, logicalH, dprOf } from './uiUtils.js';
import { saveDevSettings } from '../data/save.js';
import { CUSTOMIZE } from '../data/customize.js';
import { DEMO_FOALS } from '../data/demoFoals.js';

// ── Art preview (dev tool) ───────────────────────────────────────────────────
// A standalone gallery for art-directing the creatures. Boots straight into a
// grass-green stage that lays every animal out side by side, each playing its
// walk cycle at a comfortable, normalized size with its key + native frame
// dimensions labelled. Purely a viewer — no gameplay — so we can eyeball every
// creature's art (and the not-yet-wired barnyard animals) and work through
// changes one at a time.
//
// Reached via the pause-menu dev knob "Start screen → Art preview", which makes
// BootScene build the textures (including the disabled cow/sheep/pig/dog) and
// start this scene instead of the world. TEMP dev scaffolding — remove with the
// rest of the dev tools before a real release.
//
// It deliberately enumerates whatever frame textures each builder ACTUALLY
// produced (no hardcoded frame lists), so it always reflects the live art-
// generation path — e.g. the current buildHorseTextures, not any stale guess.

// What to show, grouped into FAMILIES. A family's members (e.g. an adult and its
// young) share ONE display scale and a common ground line, so their on-screen
// sizes reflect the art's TRUE relative proportions — that's how we check a
// foal really reads as smaller than its dam. Across families each is normalized
// so the tallest member fills TARGET_H (keeps the gallery readable when a 16px
// chicken sits beside a 256px horse). `key` is the texture base key the builder
// used; frames are `${key}_${frameName}` textures. Cow/sheep/pig/dog are the
// drawn-but-disabled animals; add their young (calf/lamb/piglet/pup) as a second
// member here once that art exists and the relative-size check comes for free.
const FAMILIES = [
  { label: 'Horse', members: [{ key: 'horse', label: 'Adult' }, { key: 'foal1', label: 'Foal' }] },
  { label: 'Chicken', members: [{ key: 'chicken0' }] },
  { label: 'Cat',     members: [{ key: 'cat' }] },
  { label: 'Cow',     members: [{ key: 'cow' }] },
  { label: 'Sheep',   members: [{ key: 'sheep0' }] }, // flock roster keys sheep0..2 (like chicken0)
  { label: 'Pig',     members: [{ key: 'pig' }] },
  { label: 'Dog',     members: [{ key: 'dog' }] },
  // Ambient wildlife (#181/#182/#183) — shown here so its art can be eyeballed even
  // though these critters only flit through the world on timers. Not tap-to-customize
  // (no customizer parts). The raccoon's run + the bird's flap animate (see the
  // locomotion-cycle filter below); the fish does its tail-flick.
  // New (crisp, super-sampled) next to the old (soft, 1×) for an A/B — the *Old keys
  // are gallery-only (PREVIEW_TEXTURES.wildlifeOld), so they just don't appear in
  // normal play. Each family normalizes to the same on-screen height, so the only
  // difference you see is edge crispness. TEMP: drop the (old 1×) rows once decided.
  { label: 'Raccoon (crisp)',    members: [{ key: 'raccoon2' }] },
  { label: 'Edge r1.5 f3',      members: [{ key: 'raccoon5' }] },
  { label: 'Edge r2.5 f5',      members: [{ key: 'raccoon5b' }] },
  { label: 'Edge r1.0 f2',      members: [{ key: 'raccoon5c' }] },
  { label: 'Edge+Inner blur',   members: [{ key: 'raccoon6' }] },
  { label: 'Bird (new 4×)',     members: [{ key: 'bird' }] },
  { label: 'Bird (old 1×)',     members: [{ key: 'birdOld' }] },
  { label: 'Fish (new 4×)',     members: [{ key: 'fish' }] },
  { label: 'Fish (old 1×)',     members: [{ key: 'fishOld' }] },
];

const TARGET_H = 200;       // tallest family member's on-screen height (logical px)
const PAD = 24;             // gap between family cells
const INNER_GAP = 14;       // gap between members within a family
const TOP = 56;             // y where the grid starts (below the title)

export default class ArtPreviewScene extends Phaser.Scene {
  constructor() {
    super('ArtPreviewScene');
  }

  create() {
    applyDpr(this, { topLeft: true });

    this._bg = this.add.graphics().setDepth(0);

    // Build each family: gather its available members, pick ONE shared scale from
    // the tallest, then make an animated sprite + label per member.
    this._families = [];
    for (const fam of FAMILIES) {
      const built = [];
      let maxH = 0;
      for (const m of fam.members) {
        const frames = this._frameKeysFor(m.key);
        if (!frames.length) continue;  // builder didn't run / texture missing — skip
        const src = this.textures.get(frames[0]).getSourceImage();
        built.push({ m, frames, nativeW: src.width, nativeH: src.height });
        maxH = Math.max(maxH, src.height);
      }
      if (!built.length) continue;

      const scale = TARGET_H / maxH;   // shared within the family → true relative sizes
      const members = built.map((b) => {
        // Animate the locomotion cycle if present (walk / the raccoon's run / the
        // bird's fly), else whatever frames exist (idle, or the fish's tail-flick).
        const walk = b.frames.filter((k) => /_(walk|run|fly)_/.test(k));
        const seq = (walk.length ? walk : b.frames).map((k) => ({ key: k }));
        const animKey = `preview_${b.m.key}`;
        if (!this.anims.exists(animKey)) {
          this.anims.create({ key: animKey, frames: seq, frameRate: 6, repeat: -1 });
        }
        const sprite = this.add.sprite(0, 0, b.frames[0]).setScale(scale).setDepth(2);
        if (seq.length > 1) sprite.play(animKey);

        // Tap a creature to open the general customizer for it (#166), launched on top
        // of this gallery. Editable = the species declares customizable parts, or it's
        // a horse with a live model (the adult; demo foals have no model). A tap that
        // was actually a scroll-drag is ignored (see _moved below).
        const speciesId = this._speciesIdFor(b.m.key);
        if (this._isEditable(speciesId, b.m.key)) {
          sprite.setInteractive({ useHandCursor: true });
          sprite.on('pointerup', () => {
            if (!this._moved) this._openCustomizer(speciesId, b.m.key);
          });
        }

        const name = b.m.label ? `${fam.label} ${b.m.label}` : fam.label;
        const label = this.add.text(0, 0, `${name}\n${b.nativeW}×${b.nativeH}`, {
          fontFamily: 'system-ui, sans-serif', fontSize: '12px',
          color: '#1c2a12', align: 'center', fontStyle: 'bold',
        }).setOrigin(0.5, 0).setDepth(2);

        return { sprite, label, dispW: b.nativeW * scale, dispH: b.nativeH * scale };
      });

      const famW = members.reduce((s, x) => s + x.dispW, 0) + INNER_GAP * (members.length - 1);
      this._families.push({ members, famW });
    }

    this._title = this.add.text(0, 0, '🎨 Art Preview — tap an animal to customize', {
      fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: '#143', fontStyle: 'bold',
    }).setOrigin(0, 0).setDepth(3);

    // Hint pinned to the bottom while there's more below the fold.
    this._scrollHint = this.add.text(0, 0, '⌄ scroll for more', {
      fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#0d220d',
      backgroundColor: '#ffffffaa', padding: { x: 8, y: 4 },
    }).setOrigin(0.5, 1).setDepth(3).setVisible(false);

    // Back to the game: clear the start-screen knob and reload into the farm.
    this._back = this.add.text(0, 0, '‹ Back to Farm', {
      fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#0d220d',
      backgroundColor: '#ffffffcc', padding: { x: 10, y: 6 },
    }).setOrigin(1, 0).setDepth(3).setInteractive({ useHandCursor: true });
    this._back.on('pointerdown', () => {
      saveDevSettings({ startEditor: null });
      window.location.reload();
    });

    // Vertical scroll (the grid can be taller than the viewport). Wheel for
    // desktop, drag for touch/iPad. Only the cards move; chrome stays pinned.
    this._scrollY = 0;
    this._maxScroll = 0;
    this.input.on('wheel', (_p, _o, _dx, dy) => this._scrollBy(dy));
    this.input.on('pointerdown', (p) => {
      this._moved = false; // reset tap-vs-drag tracking each gesture
      if (this._back.getBounds().contains(p.x / dprOf(this), p.y / dprOf(this))) return;
      this._dragY = p.y; this._dragFrom = this._scrollY;
    });
    this.input.on('pointermove', (p) => {
      if (!p.isDown || this._dragY == null) return;
      const dy = (p.y - this._dragY) / dprOf(this);   // physical → logical
      if (Math.abs(dy) > 6) this._moved = true;       // a scroll-drag, not a tap
      this._setScroll(this._dragFrom - dy);
    });
    this.input.on('pointerup', () => { this._dragY = null; });

    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));
  }

  // Texture key → species id. Horses/foals map to 'horse'; chickens to 'chicken';
  // everything else is its own id (cat/cow/sheep/pig/dog).
  _speciesIdFor(key) {
    if (key.startsWith('foal')) return 'foal';   // young horse — its own (smaller) art
    if (key.startsWith('horse')) return 'horse';
    if (key.startsWith('chicken')) return 'chicken';
    if (key.startsWith('sheep')) return 'sheep'; // flock roster keys sheep0..2 → the sheep species
    return key;
  }

  // A creature is editable if its species declares customizable parts, a horse with a
  // live model in the roster, or a demo foal (the customizer seeds its model on open).
  _isEditable(speciesId, key) {
    if (speciesId === 'horse') return !!this.registry.get('allHorses')?.[key];
    if (speciesId === 'foal') return key in DEMO_FOALS;
    return !!CUSTOMIZE[speciesId]?.parts;
  }

  // Launch the general customizer on top of the gallery; it pauses + hides this scene
  // while editing and restores it on exit (#166).
  _openCustomizer(speciesId, key) {
    this._dragY = null;
    this.scene.launch('CustomizerScene', { speciesId, key, host: 'ArtPreviewScene' });
  }

  _scrollBy(dy) { this._setScroll(this._scrollY + dy); }
  _setScroll(y) {
    this._scrollY = Phaser.Math.Clamp(y, 0, this._maxScroll);
    this._applyScroll();
  }

  // Reposition every member from its family's base y, offset by the current
  // scroll. Members share a ground line (feet on the baseline) so a smaller young
  // animal visibly sits shorter than its adult.
  _applyScroll() {
    for (const f of this._families) {
      const baseline = f.baseY + TARGET_H - this._scrollY;   // shared feet line
      for (const m of f.members) {
        m.sprite.x = m.cx;
        m.sprite.y = baseline - m.dispH / 2;                 // bottom on the baseline
        m.label.x  = m.cx;
        m.label.y  = baseline + 6;
      }
    }
    if (this._scrollHint) this._scrollHint.setVisible(this._scrollY < this._maxScroll - 1);
  }

  // Texture frame keys for one creature, in name order (idle_0, idle_1, walk_0…).
  _frameKeysFor(key) {
    const prefix = `${key}_`;
    return this.textures.getTextureKeys()
      .filter((k) => k.startsWith(prefix))
      .sort();
  }

  // Flow the cards into a centred grid that wraps to the viewport width, and pin
  // the title/back chrome. Computes each card's base y (scroll-independent) and
  // the max scroll. Re-run on every resize (orientation, Safari toolbar).
  layout() {
    const sw = logicalW(this), sh = logicalH(this);

    this._bg.clear();
    this._bg.fillStyle(0x82c24e, 1).fillRect(0, 0, sw, sh);   // grass green

    this._title.setPosition(14, 12);
    this._back.setPosition(sw - 12, 12);
    this._scrollHint.setPosition(sw / 2, sh - 8);

    const cellW = Math.max(...this._families.map((f) => f.famW), 60) + PAD;
    const cellH = TARGET_H + 44;
    const cols = Math.max(1, Math.floor((sw - PAD) / cellW));
    const gridW = cols * cellW;
    const x0 = Math.round((sw - gridW) / 2) + cellW / 2;   // first column centre

    let bottom = TOP;
    this._families.forEach((f, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const cx = x0 + col * cellW;
      f.baseY = TOP + row * (cellH + PAD);      // top of the family's sprite box
      // Centre the member group in the cell, packed left→right with shared baseline.
      let mx = cx - f.famW / 2;
      for (const m of f.members) {
        m.cx = mx + m.dispW / 2;
        mx += m.dispW + INNER_GAP;
      }
      bottom = f.baseY + cellH;
    });

    // How far the content overflows the viewport (leave a small bottom margin).
    this._maxScroll = Math.max(0, bottom + 12 - sh);
    this._setScroll(this._scrollY);   // clamp to the new range + reposition
  }
}
