// Breeding & foals (#15, redesigned by #114) — the scene-coupled half of "bond two
// horses permanently, then breed them on demand, wait a gestation, name & customize
// the newborn foal, and it grows up only if you let it." The PURE logic (gestation
// timing, next-foal-key roster growth, parent-seeded look, the newborn's roster data,
// the pair-bond checks) lives in data/breeding.js; this mixin wires it into the
// world: the player-initiated pairing/bonding interaction, the separate on-demand
// breed action, the running gestation timers, the birth → name-prompt → customizer
// flow, growing the horse roster with the newborn, and honouring the "stay a baby
// forever" toggle in the grow-up path.
//
// #114 split what #15 shipped as one fused action into two deliberate steps:
//   1. PAIR/BOND — `toggleBondSelection`: the player opens a horse's info panel and
//      taps "Pair" to mark it as the chosen mate; opening a second, eligible horse's
//      panel then offers "Pair with <name>", which forms a PERMANENT bond (recorded
//      in `_pairBonds`, persisted via load/savePairBonds). No gestation starts here.
//      Monogamous: once bonded, a horse can't be paired with anyone else, and the
//      bond never breaks (no death, no re-pairing).
//   2. BREED — `startBreeding`: a SEPARATE, repeatable action available on an
//      already-bonded horse's panel. Each tap starts a new gestation with its bonded
//      mate (gated only by "not already expecting," same as #15's original gate). A
//      bonded pair can have many foals across many play sessions, each its own
//      deliberate choice.
// Both are deliberately deliberate (explicit taps, never automatic) so pairing and
// breeding are never accidental. A cutscene/animation for either moment is
// owner-art-directed; a small sparkle stands in for now.
//
// A newborn foal joins the SAME horse roster (allHorses) the herd lives in, so it
// persists through save.js's saved-key merge exactly like an attracted bunny grows the
// bunny roster — save.js stays species-agnostic. In-flight gestations persist in their
// own tiny storage key (load/saveGestations) so a foal paired before closing the game
// is still born on time (the clock runs in wall time, like offline decay). The
// gestation-completion / #299 holding-queue / birth / customizer-at-birth machinery is
// UNCHANGED by #114 — only how a gestation STARTS moved from pairing to a separate
// "Breed" action.

import Phaser from 'phaser';
import { PASTURE_BOUNDS } from './constants.js';
import {
  nextFoalKey, makeFoalData, seedFoalLook, isBornReady, GROWN_AGE,
  isBonded, bondMateKey, canBond,
} from '../../data/breeding.js';
import {
  loadGestations, saveGestations, loadReadyBirths, saveReadyBirths,
  loadPairBonds, savePairBonds,
} from '../../data/save.js';
import { Horse } from '../../data/species/horse/model.js';
import { composeCoat } from '../../data/species/horse/coats.js';
import { buildFoalTextures, buildHorseTextures, HORSE_POSTURE_IDS } from '../../art/horseArt.js';

export const WithBreeding = (Base) => class extends Base {
  // Called from create() after the herd is built: restore any pregnancies that were
  // in flight when the game closed, plus the permanent pair-bond list. (Foals already
  // born live in the horse roster and are spawned by buildHorses, so nothing to
  // restore for them here.)
  buildBreeding() {
    this._pendingMate = null;                 // key of the horse marked as first parent (bonding)
    this._gestations = loadGestations();      // [{ aKey, bKey, startedAt, seed }]
    this._breedAccum = 0;                      // ms accumulator so the born-check runs ~1/s
    // A gestation whose parents no longer exist (herd changed) is dropped defensively.
    const all = this.registry.get('allHorses') ?? {};
    this._gestations = this._gestations.filter((g) => all[g.aKey] && all[g.bKey]);
    saveGestations(this._gestations);

    // #299: gestations that finished their timer but are still waiting to be
    // revealed at the next wake-up (held rather than birthed live). Restored the
    // same way as in-flight gestations so a "ready" pregnancy survives a reload —
    // it just stays held until the player next sleeps and wakes.
    this._readyBirths = loadReadyBirths();    // [{ aKey, bKey, seed }]
    this._readyBirths = this._readyBirths.filter((g) => all[g.aKey] && all[g.bKey]);
    saveReadyBirths(this._readyBirths);

    // #114: permanent pair bonds. A bond whose partner no longer exists (herd
    // changed) is dropped defensively, same as gestations/readyBirths above.
    // This pair-bond + separate on-demand "Breed" action shape is BINDING for
    // every future species' breeding, not just horses — see CLAUDE.md "Breeding
    // & baby-animal design constraints" (rules 2 and 3).
    this._pairBonds = loadPairBonds();        // [{ aKey, bKey }]
    this._pairBonds = this._pairBonds.filter((p) => all[p.aKey] && all[p.bKey]);
    savePairBonds(this._pairBonds);
  }

  // Is a horse currently pregnant (party to an in-flight gestation)? Used to keep a
  // horse from breeding again while it's already expecting.
  _isExpecting(key) {
    return (this._gestations ?? []).some((g) => g.aKey === key || g.bKey === key);
  }

  // Is a horse already permanently bonded to a mate? (#114 monogamy check)
  isBonded(key) {
    return isBonded(key, this._pairBonds ?? []);
  }

  // The bonded mate's key for a horse, or null if unbonded.
  bondMateKey(key) {
    return bondMateKey(key, this._pairBonds ?? []);
  }

  // The info-panel "Pair"/"Bond" button routes here with the horse currently being
  // viewed. First tap marks the mate; a second tap on a DIFFERENT eligible horse
  // forms the PERMANENT bond — no gestation starts here (that's the separate "Breed"
  // action below). Returns a short status string the panel can flash as feedback.
  toggleBondSelection(key) {
    const all = this.registry.get('allHorses') ?? {};
    const horse = all[key];
    if (!horse) return null;
    // A foal can't bond, and an already-bonded horse can't be re-paired (monogamy).
    if (horse.isFoal) return 'Foals are too young to pair';
    if (this.isBonded(key)) return `${horse.name} is already bonded`;

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
    // A second, different horse → form the permanent bond.
    const mateKey = this._pendingMate;
    this._pendingMate = null;
    return this.formPairBond(mateKey, key);
  }

  // Whether a "Pair with <name>" prompt should be offered on the panel for `key`
  // (i.e. a different, eligible horse is already marked). Drives the button label.
  pendingMateName(key) {
    if (!this._pendingMate || this._pendingMate === key) return null;
    const all = this.registry.get('allHorses') ?? {};
    return all[this._pendingMate]?.name ?? null;
  }

  // Form a PERMANENT pair bond between two horses (#114). Validated with the pure
  // `canBond` check (both exist, distinct, not foals, neither already bonded) so the
  // scene and the tests agree. No gestation starts — that's a separate, later "Breed"
  // action. Persisted immediately so the bond survives a reload.
  formPairBond(aKey, bKey) {
    const all = this.registry.get('allHorses') ?? {};
    if (!canBond(aKey, bKey, this._pairBonds ?? [], all)) return null;
    const a = all[aKey], b = all[bKey];
    (this._pairBonds ??= []).push({ aKey, bKey });
    savePairBonds(this._pairBonds);
    this._sparkle(this._horseSprite(aKey));
    this._sparkle(this._horseSprite(bKey));
    return `${a.name} and ${b.name} are bonded for life! 💞`;
  }

  // The info-panel "Breed" button routes here with the horse currently being viewed
  // (#114): a SEPARATE, repeatable action from pairing, available once a horse is
  // already bonded. Starts a new gestation with its bonded mate, gated the same way
  // gestation always was (not already expecting). Returns a short status string.
  startBreeding(key) {
    const all = this.registry.get('allHorses') ?? {};
    const horse = all[key];
    if (!horse) return null;
    if (horse.isFoal) return 'Foals are too young to breed';
    const mateKey = this.bondMateKey(key);
    if (!mateKey) return `${horse.name} isn't paired with a mate yet`;
    if (this._isExpecting(key) || this._isExpecting(mateKey)) {
      return `${horse.name} is already expecting`;
    }
    return this.beginBreeding(key, mateKey);
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

  // Per-frame (from update): tick the gestation clock ~once a second. #299 — a
  // gestation whose timer completes is NOT birthed live; it's moved to the
  // "ready to birth" holding queue and revealed the next time the player wakes
  // (see flushReadyBirths, called on EVENTS.SLEEP_DONE). This is deliberately a
  // thin gate in front of the existing birth logic — unchanged by #114's breeding
  // rework, since #114 only changed what STARTS a gestation (bond → separate
  // "Breed" action), not what happens once one COMPLETES.
  updateBreeding(delta) {
    if (!this._gestations?.length) return;
    this._breedAccum += delta;
    if (this._breedAccum < 1000) return;
    this._breedAccum = 0;
    const now = Date.now();
    const ready = this._gestations.filter((g) => isBornReady(g.startedAt, now));
    if (!ready.length) return;
    // Remove the completed gestations, hold them as ready-to-birth instead of
    // birthing now — even if the player is wide awake and playing.
    this._gestations = this._gestations.filter((g) => !isBornReady(g.startedAt, now));
    saveGestations(this._gestations);
    (this._readyBirths ??= []).push(...ready);
    saveReadyBirths(this._readyBirths);
  }

  // Flush the "ready to birth" holding queue: birth every held foal now. Called
  // on EVENTS.SLEEP_DONE (wake-up) so births always read as a "while you were
  // sleeping" surprise beat, whether the gestation finished mid-play or mid-sleep.
  flushReadyBirths() {
    if (!this._readyBirths?.length) return;
    const ready = this._readyBirths;
    this._readyBirths = [];
    saveReadyBirths(this._readyBirths);
    for (const g of ready) this._birthFoal(g);
    if (ready.length) this._announceOvernightBirths(ready.length);
  }

  // The "while you were sleeping…" reveal beat: a short toast so a newly-woken
  // player notices the surprise before stumbling on the foal in the pasture.
  // Reuses the existing status-text styling pattern (no bespoke UI system needed).
  _announceOvernightBirths(count) {
    const text = count === 1
      ? '🐴 While you were sleeping, a foal was born!'
      : `🐴 While you were sleeping, ${count} foals were born!`;
    const cam = this.cameras?.main;
    if (!cam) return;
    const x = cam.worldView.centerX;
    const y = cam.worldView.centerY - 160;
    const msg = this.add.text(x, y, text, {
      fontFamily: 'system-ui, sans-serif', fontSize: '20px', fontStyle: 'bold',
      color: '#3a2a1a', backgroundColor: '#fff6c0e6', padding: { x: 16, y: 10 },
      align: 'center',
    }).setOrigin(0.5).setDepth(20000).setScrollFactor(1).setAlpha(0);
    this.tweens.add({
      targets: msg, alpha: 1, y: y - 14, duration: 500, ease: 'Sine.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: msg, alpha: 0, y: y - 28,
          delay: 2600, duration: 700, ease: 'Sine.easeIn',
          onComplete: () => msg.destroy(),
        });
      },
    });
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
