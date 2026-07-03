import Phaser from 'phaser';
import { applyDpr, logicalW, logicalH, dprOf } from './uiUtils.js';
import { saveDevSettings } from '../data/save.js';
import { CUSTOMIZE } from '../data/customize.js';
import { DEMO_FOALS } from '../data/demoFoals.js';
import { BIRD_TYPES } from '../data/wildlife.js';
import { SPECIES } from '../data/species/index.js';
import { ROSTERS } from '../data/rosters.js';
import { buildChickTextures } from '../art/chickArt.js';

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

// A dedicated fixed key for a sample baby CHICK (mirrors DEMO_FOALS: fixed sample
// art, not part of any persisted roster) — built unconditionally below so the
// Chicken family can show the adult next to its baby, same "family" pattern as
// the Horse row (adult + foal) for a relative-size comparison at a glance.
const PREVIEW_CHICK_KEY = '__previewChick';

// AUTO-DERIVED roster families (#292-ish dev-tool fix): every species registered in
// SPECIES (src/data/species/index.js) gets a gallery row automatically — adding a
// new species (goat/llama/duck/rooster/fox/…) never requires touching this file.
// One sample individual is picked per species:
//   - if its ROSTERS default roster has individuals, use the first one's key
//   - if the roster starts EMPTY (bunny/fox/duck — attracted/tamed at runtime),
//     BootScene still builds a base texture unconditionally under the `${id}0`
//     convention (see art/index.js SPECIES_TEXTURES.bunny/fox/duck) — use that.
// Species with multiple visually distinct COAT VARIANTS in their default roster
// (llama: llama0=llama, llama1=alpaca) show one member per variant instead of
// just the first, so every look is visible in the gallery.
function autoRosterFamilies() {
  const families = [];
  for (const id of Object.keys(SPECIES)) {
    if (id === 'horse' || id === 'chicken') continue; // hand-curated below (family groupings)
    const roster = ROSTERS[id];
    const defaults = roster ? roster.defaultRoster() : {};
    const keys = Object.keys(defaults);
    const label = id.charAt(0).toUpperCase() + id.slice(1);

    if (!keys.length) {
      // Empty default roster (attracted/tamed at runtime) — sample the base texture
      // BootScene builds unconditionally for the untamed/wild sprite.
      families.push({ label, members: [{ key: `${id}0` }] });
      continue;
    }

    // Multiple default individuals whose `variant` differs (e.g. llama/alpaca) —
    // show one member per distinct variant. Otherwise just the first individual.
    const variants = new Set(keys.map((k) => defaults[k].variant).filter(Boolean));
    if (variants.size > 1) {
      const seen = new Set();
      const members = [];
      for (const k of keys) {
        const v = defaults[k].variant;
        if (v && seen.has(v)) continue;
        if (v) seen.add(v);
        members.push({ key: k, label: v ? v.charAt(0).toUpperCase() + v.slice(1) : undefined });
      }
      families.push({ label, members });
    } else {
      families.push({ label, members: [{ key: keys[0] }] });
    }
  }
  return families;
}

// What to show, grouped into FAMILIES. A family's members (e.g. an adult and its
// young) share ONE display scale and a common ground line, so their on-screen
// sizes reflect the art's TRUE relative proportions — that's how we check a
// foal really reads as smaller than its dam. Across families each is normalized
// so the tallest member fills TARGET_H (keeps the gallery readable when a 16px
// chicken sits beside a 256px horse). `key` is the texture base key the builder
// used; frames are `${key}_${frameName}` textures.
//
// Horse and Chicken stay hand-curated here (adult + young family groupings); every
// OTHER roster species (cat/cow/sheep/pig/dog/bunny/goat/llama/fox/duck/rooster/…)
// is derived automatically from the SPECIES + ROSTERS registries by
// autoRosterFamilies() — see above. Ambient wildlife (raccoon/birds/fish) isn't a
// roster species, so it stays hand-curated below the auto block.
function buildFamilies() {
  return [
    { label: 'Horse', members: [{ key: 'horse', label: 'Adult' }, { key: 'foal1', label: 'Foal' }] },
    { label: 'Chicken', members: [{ key: 'chicken0', label: 'Adult' }, { key: PREVIEW_CHICK_KEY, label: 'Chick' }] },
    ...autoRosterFamilies(),
    // Ambient wildlife (#181/#182/#183) — shown here so its art can be eyeballed even
    // though these critters only flit through the world on timers. Not tap-to-customize
    // (no customizer parts). The raccoon's run + the bird's flap animate (see the
    // locomotion-cycle filter below); the fish does its tail-flick.
    // New (crisp, super-sampled) next to the old (soft, 1×) for an A/B — the *Old keys
    // are gallery-only (PREVIEW_TEXTURES.wildlifeOld), so they just don't appear in
    // normal play. Each family normalizes to the same on-screen height, so the only
    // difference you see is edge crispness. TEMP: drop the (old 1×) rows once decided.
    { label: 'Raccoon',            members: [{ key: 'raccoon5' }] },
    // One row per bird type (visual variety, #220) so each palette/silhouette can be
    // eyeballed. Keys are `bird_<id>` (the per-type texture prefix from wildlifeArt.js).
    ...BIRD_TYPES.map((t) => ({ label: `Bird — ${t.name}`, members: [{ key: `bird_${t.id}` }] })),
    { label: 'Bird (old 1×)',     members: [{ key: 'birdOld' }] },
    { label: 'Fish (new 4×)',     members: [{ key: 'fish' }] },
    { label: 'Fish (old 1×)',     members: [{ key: 'fishOld' }] },
  ];
}

const TARGET_H = 200;       // tallest family member's on-screen height (logical px)
const PAD = 24;             // gap between family cells
const INNER_GAP = 14;       // gap between members within a family
const TOP = 56;             // y where the grid starts (below the title)

// A real animation-frame suffix is a pose name followed by a numeric index
// (idle_0, walk_2, idle_content_1, swim_0, crow_1, …) — every species' texture
// builder names frames this way, so a pose is recognized STRUCTURALLY, not by a
// hardcoded per-species pose list. Mirrors scripts/sprite-preview.mjs's
// isFrameSuffix (git blame: the frame-discovery fix that dropped its hardcoded
// pose allowlist) — same principle applies to the animation picker below.
const isFrameSuffix = (s) => /^[a-z][a-z_]*_\d+$/.test(s);

export default class ArtPreviewScene extends Phaser.Scene {
  constructor() {
    super('ArtPreviewScene');
  }

  create() {
    applyDpr(this, { topLeft: true });

    // Build the fixed sample-chick texture (mirrors how DEMO_FOALS are built
    // unconditionally for the gallery) so the Chicken family can show it.
    if (!this.textures.exists(`${PREVIEW_CHICK_KEY}_idle_0`)) {
      buildChickTextures(this, PREVIEW_CHICK_KEY, 0);
    }

    this._bg = this.add.graphics().setDepth(0);

    // Build each family: gather its available members, pick ONE shared scale from
    // the tallest, then make an animated sprite + label per member.
    this._families = [];
    for (const fam of buildFamilies()) {
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

        // Tap a creature to dissect its art (dev mode) or open the customizer (prod).
        // A tap that was actually a scroll-drag is ignored (see _moved below). We also
        // require the press to have STARTED on this sprite: a gesture begun on the HTML
        // blur panel has its pointerdown stopped before Phaser sees it (so this sprite is
        // never "pressed"), but its pointerup can still land on a sprite if the pointer
        // drifted off the panel mid-drag — without this guard, dragging a slider would
        // dissect whatever sits behind the panel.
        const speciesId = this._speciesIdFor(b.m.key);
        sprite.setInteractive({ useHandCursor: true });
        sprite.on('pointerdown', () => { this._pressedSprite = sprite; });
        sprite.on('pointerup', () => {
          const pressedHere = this._pressedSprite === sprite;
          this._pressedSprite = null;
          if (!pressedHere || this._moved) return;
          if (globalThis.__dissect) {
            // Open the static part-breakdown AND surface this creature's poses/
            // animations in the same dock (#improve-art-preview) — see setPoses.
            globalThis.__dissect.show(b.m.key);
            globalThis.__dissect.setPoses?.(b.m.key, this._posesFor(b.m.key));
          } else if (this._isEditable(speciesId, b.m.key)) {
            this._openCustomizer(speciesId, b.m.key);
          }
        });

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

    this._title = this.add.text(0, 0, '🎨 Art Preview — tap an animal to dissect', {
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
    this.input.on('pointerup', () => { this._dragY = null; this._pressedSprite = null; });

    // The dissect overlay docks as a RIGHT sidebar (dev). It fires `dissectDockChanged` with
    // its width on open / 0 on close; reserve matching gallery space so it never covers a
    // card. (Bare event name — a dev-only DOM event, decoupled from src/dev/dissectOverlay.)
    this._reservedRight = 0;
    this._onDissectDock = (e) => {
      const w = e.detail?.width || 0;
      if (w === this._reservedRight) return;
      this._reservedRight = w;
      this.layout();
    };
    window.addEventListener('dissectDockChanged', this._onDissectDock);

    this.layout();
    this.scale.on('resize', this.layout, this);

    this.events.once('shutdown', () => {
      this.scale.off('resize', this.layout, this);
      window.removeEventListener('dissectDockChanged', this._onDissectDock);
    });
  }

  // Texture key → species id. Horses/foals map to 'horse'; chickens to 'chicken';
  // everything else is its own id (cat/cow/sheep/pig/dog/goat/llama/fox/duck/…).
  _speciesIdFor(key) {
    if (key.startsWith('foal')) return 'foal';   // young horse — its own (smaller) art
    if (key.startsWith('horse')) return 'horse';
    if (key === PREVIEW_CHICK_KEY) return 'chicken'; // baby chick — same species as the hen
    if (key.startsWith('chicken')) return 'chicken';
    if (key.startsWith('sheep')) return 'sheep'; // flock roster keys sheep0..2 → the sheep species
    if (key.startsWith('llama')) return 'llama'; // llama0=llama, llama1=alpaca variant
    // Strip a trailing roster-index digit (bunny0../fox0/duck0/rooster0/…) to get the
    // species id, but only for ids that are actually registered — 'cat'/'cow'/'pig'/
    // 'dog'/'goat' have no numeric suffix at all and pass through unchanged.
    const stripped = key.replace(/\d+$/, '');
    return SPECIES[stripped] ? stripped : key;
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

  // Discover a creature's available POSES structurally (no hardcoded per-species pose
  // list) — same principle as scripts/sprite-preview.mjs's isFrameSuffix/ORDER. Each
  // texture key `${key}_<pose>_<index>` groups into one pose entry with its ordered
  // frame keys, so the dissect dock's animation picker can play any of them (idle,
  // walk, eat, roll, wallow, swim, lay, sleep, nap, pounce, crow, spit, fly, run…).
  _posesFor(key) {
    const prefix = `${key}_`;
    const byPose = new Map();
    for (const k of this.textures.getTextureKeys()) {
      if (!k.startsWith(prefix)) continue;
      const suffix = k.slice(prefix.length);
      if (!isFrameSuffix(suffix)) continue;
      const pose = suffix.replace(/_\d+$/, '');
      if (!byPose.has(pose)) byPose.set(pose, []);
      byPose.get(pose).push(k);
    }
    for (const frames of byPose.values()) frames.sort();
    return [...byPose.entries()].map(([pose, frames]) => ({ pose, frames }));
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
    const gw = sw - (this._reservedRight || 0);   // gallery width, minus the right dissect dock

    this._bg.clear();
    this._bg.fillStyle(0x82c24e, 1).fillRect(0, 0, sw, sh);   // grass green

    this._title.setPosition(14, 12);
    this._back.setPosition(gw - 12, 12);                     // just left of the dissect dock
    this._scrollHint.setPosition(gw / 2, sh - 8);

    const cellW = Math.max(...this._families.map((f) => f.famW), 60) + PAD;
    const cellH = TARGET_H + 44;
    const cols = Math.max(1, Math.floor((gw - PAD) / cellW));
    const gridW = cols * cellW;
    const x0 = Math.round((gw - gridW) / 2) + cellW / 2;   // first column centre

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
