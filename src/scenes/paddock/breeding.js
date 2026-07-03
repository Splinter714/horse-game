// Breeding & foals (#15) — the scene-coupled half of "pair two horses, wait a
// gestation, name & customize the newborn foal, and it grows up only if you let it."
// The PURE logic (gestation timing, next-foal-key roster growth, parent-seeded look,
// the newborn's roster data) lives in data/breeding.js; this mixin wires it into the
// world: the player-initiated pairing interaction, the running gestation timers, the
// birth → name-prompt → customizer flow, growing the horse roster with the newborn,
// and honouring the "stay a baby forever" toggle in the grow-up path.
//
// The pairing INTERACTION (first-pass, flagged for playtest): the player opens a
// horse's info panel and taps a "Breed" button to mark it as the chosen mate; opening
// a second horse's panel then offers "Breed with <name>", which starts the gestation.
// It's deliberately deliberate (two explicit taps on two different horses) so breeding
// is never accidental — matching the issue's "the player deliberately pairs two
// horses" scope. A cutscene/animation for the moment is owner-art-directed; a small
// sparkle stands in for now.
//
// A newborn foal joins the SAME horse roster (allHorses) the herd lives in, so it
// persists through save.js's saved-key merge exactly like an attracted bunny grows the
// bunny roster — save.js stays species-agnostic. In-flight gestations persist in their
// own tiny storage key (load/saveGestations) so a foal paired before closing the game
// is still born on time (the clock runs in wall time, like offline decay).

import Phaser from 'phaser';
import { PASTURE_BOUNDS } from './constants.js';
import {
  nextFoalKey, makeFoalData, seedFoalLook, isBornReady, GROWN_AGE,
} from '../../data/breeding.js';
import { loadGestations, saveGestations } from '../../data/save.js';
import { Horse } from '../../data/species/horse/model.js';
import { composeCoat } from '../../data/species/horse/coats.js';
import { buildFoalTextures, buildHorseTextures, HORSE_POSTURE_IDS } from '../../art/horseArt.js';

export const WithBreeding = (Base) => class extends Base {
  // Called from create() after the herd is built: restore any pregnancies that were
  // in flight when the game closed. (Foals already born live in the horse roster and
  // are spawned by buildHorses, so nothing to restore for them here.)
  buildBreeding() {
    this._pendingMate = null;                 // key of the horse marked as first parent
    this._gestations = loadGestations();      // [{ aKey, bKey, startedAt, seed }]
    this._breedAccum = 0;                      // ms accumulator so the born-check runs ~1/s
    // A gestation whose parents no longer exist (herd changed) is dropped defensively.
    const all = this.registry.get('allHorses') ?? {};
    this._gestations = this._gestations.filter((g) => all[g.aKey] && all[g.bKey]);
    saveGestations(this._gestations);
  }

  // Is a horse currently pregnant (party to an in-flight gestation)? Used to keep a
  // horse from being paired again while it's already expecting.
  _isExpecting(key) {
    return (this._gestations ?? []).some((g) => g.aKey === key || g.bKey === key);
  }

  // The info-panel "Breed" button routes here with the horse currently being viewed.
  // First tap marks the mate; a second tap on a DIFFERENT eligible horse starts the
  // gestation. Returns a short status string the panel can flash as feedback.
  toggleBreedSelection(key) {
    const all = this.registry.get('allHorses') ?? {};
    const horse = all[key];
    if (!horse) return null;
    // A foal can't breed, and an already-expecting horse can't take on another.
    if (horse.isFoal) return 'Foals are too young to breed';
    if (this._isExpecting(key)) return `${horse.name} is already expecting`;

    // No mate chosen yet → mark this one and wait for the second pick.
    if (!this._pendingMate) {
      this._pendingMate = key;
      this._sparkle(this._horseSprite(key));
      return `${horse.name} is ready to pair — pick a mate`;
    }
    // Tapping the same horse again cancels the selection.
    if (this._pendingMate === key) {
      this._pendingMate = null;
      return 'Pairing cancelled';
    }
    // A second, different horse → pair them and begin the gestation.
    const mateKey = this._pendingMate;
    this._pendingMate = null;
    return this.beginBreeding(mateKey, key);
  }

  // Whether a "Breed with <name>" prompt should be offered on the panel for `key`
  // (i.e. a different, eligible horse is already marked). Drives the button label.
  pendingMateName(key) {
    if (!this._pendingMate || this._pendingMate === key) return null;
    const all = this.registry.get('allHorses') ?? {};
    return all[this._pendingMate]?.name ?? null;
  }

  // Start a gestation between two horses: record it (persisted), sparkle over both,
  // and let updateBreeding count it down. The parent-seed is captured NOW (from the
  // parents' current looks) so it's stable even if a parent is later re-customized.
  beginBreeding(aKey, bKey) {
    const all = this.registry.get('allHorses') ?? {};
    const a = all[aKey], b = all[bKey];
    if (!a || !b) return null;
    const seed = seedFoalLook(a, b);
    const gest = { aKey, bKey, startedAt: Date.now(), seed };
    (this._gestations ??= []).push(gest);
    saveGestations(this._gestations);
    this._sparkle(this._horseSprite(aKey));
    this._sparkle(this._horseSprite(bKey));
    return `${a.name} and ${b.name} are expecting a foal! 💕`;
  }

  // Per-frame (from update): tick the gestation clock ~once a second and birth any
  // foal whose wait is up. Cheap and self-gating when there are no pregnancies.
  updateBreeding(delta) {
    if (!this._gestations?.length) return;
    this._breedAccum += delta;
    if (this._breedAccum < 1000) return;
    this._breedAccum = 0;
    const now = Date.now();
    const ready = this._gestations.filter((g) => isBornReady(g.startedAt, now));
    if (!ready.length) return;
    // Remove the ready ones first (so a birth can't re-fire) then birth each.
    this._gestations = this._gestations.filter((g) => !isBornReady(g.startedAt, now));
    saveGestations(this._gestations);
    for (const g of ready) this._birthFoal(g);
  }

  // Birth one foal from a completed gestation: build its roster data (parent-seeded,
  // isFoal + stayBaby), add it to allHorses (growing the roster), build its smaller
  // foal art, spawn it beside its mother in the pasture, persist, sparkle, then open
  // the existing horse customizer so the player NAMES and designs it at birth.
  _birthFoal(g) {
    const all = this.registry.get('allHorses') ?? {};
    const mom = all[g.aKey];
    const dad = all[g.bKey];
    const key = nextFoalKey(Object.keys(all));
    const data = makeFoalData(mom, dad, key, g.seed);

    // Add to the persisted horse roster.
    const model = new Horse(data);
    all[key] = model;
    this.registry.set('allHorses', all);

    // Build the foal's (smaller) textures from its seeded coat, then spawn it as an
    // ordinary horse-roster member (spawnHorse reads the model from allHorses) — it
    // wanders/behaves like a young horse. Spawn it near its mother if she's around.
    buildFoalTextures(this, key, composeCoat(model.coat, model.markings));
    const at = this._birthSpot(g.aKey);
    const foal = this.spawnHorse(at.x, at.y, key, 1200);
    this._sparkle(foal.sprite);

    // Persist immediately so the newborn survives a reload even before the autosave.
    this._saveHorses();

    // Open the customizer for the newborn: the player names it (customizer rename) and
    // designs its look, starting from the parent-seeded coat. Slight delay so the
    // birth sparkle reads first. openPortrait with { edit:true } jumps straight into
    // the appearance editor for the foal's key. (`_suppressFoalCustomizer` lets the
    // smoke harness birth a foal without popping the editor mid-test.)
    if (!this._suppressFoalCustomizer) {
      this.time.delayedCall(650, () => {
        if (this.registry.get('allHorses')?.[key]) this.openPortrait(key, { edit: true });
      });
    }
    return foal;
  }

  // Where a newborn appears: just beside its mother if she's in the world, else a
  // default spot in the pasture. Clamped into the pasture bounds.
  _birthSpot(momKey) {
    const mom = this._horseSprite(momKey);
    const bx = mom ? mom.x + Phaser.Math.Between(-50, 50) : 900;
    const by = mom ? mom.y + Phaser.Math.Between(20, 60)  : 1250;
    return {
      x: Phaser.Math.Clamp(bx, PASTURE_BOUNDS.minX + 20, PASTURE_BOUNDS.maxX - 20),
      y: Phaser.Math.Clamp(by, PASTURE_BOUNDS.minY + 20, PASTURE_BOUNDS.maxY - 20),
    };
  }

  // Grow a foal up into a young adult horse — but ONLY if the player has allowed it
  // (stayBaby === false). This is the honoring of the "stay a baby forever" toggle:
  // called from the day roll / the info-panel toggle, it's a no-op while stayBaby is
  // on. Rebuilds the model's art from foal → full horse frames and refreshes the
  // in-world sprite, with a small sparkle for the moment (owner-art-directed later).
  growUpFoal(key) {
    const all = this.registry.get('allHorses') ?? {};
    const model = all[key];
    if (!model || !model.isFoal) return false;
    if (model.stayBaby) return false; // the toggle keeps it a baby — respect it

    model.isFoal = false;
    model.age = GROWN_AGE;
    if (model.breed === 'Foal') model.breed = composeCoat(model.coat, model.markings).label || 'Horse';

    // Swap the smaller foal art for the full horse art under the same key, so the
    // on-screen sprite (which shares `${key}_*` textures) becomes a grown horse in
    // place. The full horse frames now exist, so create the swish/roll/posture anims
    // that spawnHorse skipped while it was a foal — otherwise the grown horse would
    // never tail-swish/roll/posture. Then refresh the current frame and sparkle.
    buildHorseTextures(this, key, composeCoat(model.coat, model.markings));
    this._ensureGrownHorseAnims(key);
    const s = this._horseSprite(key);
    if (s) { s.play(`idle_${key}`, true); this._sparkle(s); }
    this._saveHorses();
    return true;
  }

  // Create the swish/roll/posture animations for a horse key IF their frames now exist
  // and the anim isn't already made — used when a foal grows up (its foal art had no
  // such frames, so spawnHorse skipped these; buildHorseTextures has since added them).
  _ensureGrownHorseAnims(key) {
    if (!this.textures.exists(`${key}_swish_0`)) return; // still foal frames — nothing to add
    if (!this.anims.exists(`swish_${key}`)) {
      this.anims.create({
        key: `swish_${key}`,
        frames: [{ key: `${key}_swish_0` }, { key: `${key}_swish_1` },
                 { key: `${key}_swish_2` }, { key: `${key}_swish_3` }],
        frameRate: 5, repeat: -1,
      });
    }
    if (!this.anims.exists(`roll_${key}`)) {
      this.anims.create({
        key: `roll_${key}`,
        frames: [{ key: `${key}_roll_0` }, { key: `${key}_roll_1` },
                 { key: `${key}_roll_2` }, { key: `${key}_roll_3` }],
        frameRate: 5, repeat: -1,
      });
    }
    for (const id of HORSE_POSTURE_IDS) {
      if (this.anims.exists(`idle_${id}_${key}`)) continue;
      if (!this.textures.exists(`${key}_idle_${id}_0`)) continue;
      this.anims.create({
        key: `idle_${id}_${key}`,
        frames: [{ key: `${key}_idle_${id}_0` }, { key: `${key}_idle_${id}_1` }],
        frameRate: 2, repeat: -1,
      });
    }
  }

  // The info-panel "stay a baby" toggle flips the flag and persists. When turned OFF
  // (allow growing up), the foal grows up right away so the change is visible; turning
  // it back ON just parks it as a baby again (no shrink-back — one-way growth).
  setStayBaby(key, stay) {
    const all = this.registry.get('allHorses') ?? {};
    const model = all[key];
    if (!model || !model.isFoal) return;
    model.stayBaby = !!stay;
    this._saveHorses();
    if (!stay) this.growUpFoal(key);
  }

  // The in-world sprite for a horse key (or null), for FX positioning.
  _horseSprite(key) {
    return this.horses?.find((h) => h.key === key)?.sprite ?? null;
  }

  // Spawn every born horse that lives in the roster but ISN'T one of the seven fixed
  // default herd — the runtime-grown members (a still-a-baby foal, or a former foal
  // that has since grown up). Called by buildHorses after the defaults so a reloaded
  // game re-spawns the player's bred horses. Mirrors how bunnies/foxes restore from
  // their saved roster on boot. A foal wears the smaller foal art; a grown one the
  // full horse art (reskinHorse picks by isFoal, but its textures are built by the
  // horse art-registry builder on boot — we only need to build the FOAL frames here,
  // since the boot art builder already builds full horse frames for every roster key).
  spawnSavedFoals() {
    const all = this.registry.get('allHorses') ?? {};
    const already = new Set(this.horses.map((h) => h.key));
    for (const [key, model] of Object.entries(all)) {
      if (already.has(key)) continue;      // one of the seven default herd
      // A still-a-baby foal needs its smaller foal frames rebuilt (the boot art
      // builder makes full horse frames for every key); a grown former foal already
      // has the right horse frames from boot.
      if (model.isFoal) buildFoalTextures(this, key, composeCoat(model.coat, model.markings));
      const at = this._birthSpot(key);
      this.spawnHorse(at.x, at.y, key, Phaser.Math.Between(1000, 3000));
    }
  }
};
