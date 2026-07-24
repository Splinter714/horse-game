// Baby chicks via rooster-bred incubation (#274) — the scene-coupled half of
// "player picks a hen to incubate, a fertilized egg waits out a timer, then a
// chick hatches and joins the flock." The PURE logic (hatch timing, next-chick-
// key roster growth, the parent-seeded chick look, the newborn's roster data)
// lives in data/species/chicken/incubation.js; this mixin wires it into the
// world: the player-initiated "Incubate" trigger (gated on an eligible rooster
// being present, #269's `breedingPartner` marker), the running incubation timers,
// the hatch → roster-growth flow, and honouring the "stay a baby forever" toggle
// (#298) in the grow-up path.
//
// Deliberately its own file, separate from paddock/breeding.js (horse breeding,
// #15) — #114 is reworking the horse pairing UX in parallel, so chicks are built
// as a fully parallel system that never touches the horse-breeding files, even
// though the SHAPE mirrors it closely.
//
// The trigger (first-pass, flagged for playtest): the player opens a HEN's info
// panel; if an eligible rooster (breedingPartner capability) is present in the
// flock and the hen isn't already incubating, an "Incubate" button starts a
// fertilized-egg timer right there — a single explicit tap, so it's never
// accidental (mirrors the deliberateness of the horse "Breed" flow, just
// single-tap since there's already exactly one rooster to pick).
//
// A newborn chick joins the SAME chicken roster (allChickens) the flock lives
// in, so it persists through save.js's saved-key merge exactly like a bred foal
// grows the horse roster or an attracted bunny grows the bunny roster — save.js
// stays species-agnostic. In-flight incubations persist in their own tiny
// storage key (load/saveIncubations) so an egg started before closing the game
// still hatches on time (the clock runs in wall time, like offline decay).

import Phaser from 'phaser';
import { SPECIES } from '../../data/species/index.js';
import { EVENTS } from '../../data/events.js';
import {
  nextChickKey, makeChickData, seedChickLook, isHatchReady, GROWN_CHICK_AGE,
} from '../../data/species/chicken/incubation.js';
import { loadIncubations, saveIncubations } from '../../data/save.js';
import { Chicken } from '../../data/species/chicken/model.js';
import { buildChickTextures } from '../../art/chickArt.js';
import { buildChickenTextures, CHICKEN_COATS } from '../../art/chickenArt.js';

// This is the SECOND species to implement breeding (after horses, paddock/breeding.js)
// — it independently follows the same three binding rules (stay-baby-by-default,
// permanent monogamous pairing, player-initiated only). See CLAUDE.md "Breeding &
// baby-animal design constraints" — every future species' breeding must too.
export const WithIncubation = (Base) => class extends Base {
  // Called from create() after the flock is built: restore any incubations that
  // were in flight when the game closed. (Chicks already hatched live in the
  // chicken roster and are spawned by buildAnimals, so nothing to restore for
  // them here.)
  buildIncubation() {
    this._incubations = loadIncubations(); // [{ henKey, roosterKey, startedAt, seed }]
    this._incubationAccum = 0;              // ms accumulator so the hatch-check runs ~1/s
    // An incubation whose hen no longer exists (roster changed) is dropped
    // defensively; the rooster is allowed to be gone too (a keepsake father).
    const hens = this.registry.get('allChickens') ?? {};
    this._incubations = this._incubations.filter((inc) => hens[inc.henKey]);
    saveIncubations(this._incubations);
  }

  // Is an eligible rooster present in the flock — i.e. any roster rooster whose
  // species declares the `breedingPartner` capability (#269's marker this issue
  // was waiting on)? Gates the whole incubate trigger. Roster-based (not "is it
  // currently spawned in the world") so this is consistent with `_breedingRooster`
  // below and can't disagree with what `startIncubation` actually checks.
  _hasBreedingRooster() {
    return !!this._breedingRooster();
  }

  // The flock's first eligible rooster's roster key + model, or null. Used to
  // seed the chick's look and record its parentage. (Only one rooster exists
  // today, but this stays correct if a second is ever added — first one found.)
  _breedingRooster() {
    const all = this.registry.get('allRoosters') ?? {};
    for (const [key, model] of Object.entries(all)) {
      if (SPECIES[model?.species]?.capabilities?.breedingPartner) return { key, model };
    }
    return null;
  }

  // Is a hen currently incubating (already has an in-flight fertilized egg)?
  // Keeps a hen from starting a second incubation on top of one already running.
  _isIncubating(henKey) {
    return (this._incubations ?? []).some((inc) => inc.henKey === henKey);
  }

  // The info-panel "Incubate" button routes here with the hen currently being
  // viewed. Starts a fertilized-egg incubation if a rooster is present and this
  // hen isn't already incubating. Returns a short status string the panel can
  // flash as feedback (mirrors toggleBreedSelection's return contract). `cost` is
  // recorded on the incubation record itself (currently always 0 — incubation has
  // no money cost today) so `cancelIncubation` below can refund whatever was
  // actually charged, without needing to know the price rules.
  startIncubation(henKey, cost = 0) {
    const hens = this.registry.get('allChickens') ?? {};
    const hen = hens[henKey];
    if (!hen) return null;
    if (hen.isFoal) return `${hen.name} is too young to hatch chicks`;
    if (this._isIncubating(henKey)) return `${hen.name} is already incubating an egg`;
    const rooster = this._breedingRooster();
    if (!rooster) return 'No rooster to father a chick yet';

    const seed = seedChickLook(hen, rooster.model);
    const inc = { henKey, roosterKey: rooster.key, startedAt: Date.now(), seed, cost };
    (this._incubations ??= []).push(inc);
    saveIncubations(this._incubations);
    this._sparkle(this._chickenSprite(henKey));
    return `${hen.name} is incubating a fertilized egg! 🥚`;
  }

  // #322: cancel an in-flight incubation for a hen. Refunds whatever `cost` was
  // recorded when the incubation started (0 today, since incubation has no money
  // cost — this stays correct if one is ever added). Nothing pair-bond-like exists
  // for chickens (only one rooster can ever be present today), so there's no bond
  // record to touch — cancelling just removes the in-flight egg.
  cancelIncubation(henKey) {
    const idx = (this._incubations ?? []).findIndex((inc) => inc.henKey === henKey);
    if (idx === -1) return null;
    const [inc] = this._incubations.splice(idx, 1);
    saveIncubations(this._incubations);
    if (inc.cost) {
      this.money = (this.money ?? 0) + inc.cost;
      this.game.events.emit(EVENTS.MONEY_CHANGED, this.money);
    }
    const hens = this.registry.get('allChickens') ?? {};
    const name = hens[henKey]?.name ?? 'The hen';
    return inc.cost
      ? `Incubation cancelled — refunded $${inc.cost}`
      : `${name}'s incubation was cancelled`;
  }

  // Per-frame (from update): tick the incubation clock ~once a second and hatch
  // any egg whose wait is up. Cheap and self-gating when nothing is incubating.
  updateIncubation(delta) {
    if (!this._incubations?.length) return;
    this._incubationAccum += delta;
    if (this._incubationAccum < 1000) return;
    this._incubationAccum = 0;
    const now = Date.now();
    const ready = this._incubations.filter((inc) => isHatchReady(inc.startedAt, now));
    if (!ready.length) return;
    // Remove the ready ones first (so a hatch can't re-fire) then hatch each.
    this._incubations = this._incubations.filter((inc) => !isHatchReady(inc.startedAt, now));
    saveIncubations(this._incubations);
    for (const inc of ready) this._hatchChick(inc);
  }

  // Hatch one chick from a completed incubation: build its roster data (parent-
  // seeded, isFoal + stayBaby per #298), add it to allChickens (growing the
  // roster), build its smaller chick art, spawn it beside its hen mother in the
  // yard, and persist.
  _hatchChick(inc) {
    const hens = this.registry.get('allChickens') ?? {};
    const roosters = this.registry.get('allRoosters') ?? {};
    const hen = hens[inc.henKey];
    const rooster = roosters[inc.roosterKey];
    const key = nextChickKey(Object.keys(hens));
    const data = makeChickData(hen, rooster, key, inc.seed);

    // Add to the persisted chicken roster — a chick IS a chicken (isFoal:true),
    // the same roster the flock lives in.
    const model = new Chicken(data);
    hens[key] = model;
    this.registry.set('allChickens', hens);

    // Build the chick's (smaller) textures from its seeded coat, then spawn it as
    // an ordinary chicken-roster member near its hen mother, using the same
    // generic spawn path every world species uses (_spawnWorldIndividual) so it
    // picks up the chicken's movement/capability wiring (pecks/roosts) for free.
    buildChickTextures(this, key, data.coat);
    const at = this._chickBirthSpot(inc.henKey);
    const a = this._spawnWorldIndividual(SPECIES.chicken, key, model, at);
    this._sparkle(a.sprite);

    // Persist immediately so the newborn survives a reload even before autosave.
    this._saveAnimal(model);
    return a;
  }

  // Where a newborn chick appears: just beside its hen mother if she's in the
  // world, else a default spot in the yard.
  _chickBirthSpot(henKey) {
    const hen = this._chickenSprite(henKey);
    const bx = hen ? hen.x + Phaser.Math.Between(-30, 30) : 560;
    const by = hen ? hen.y + Phaser.Math.Between(10, 30)  : 760;
    return { x: bx, y: by, home: { x: bx, y: by }, wanderRadius: 180 };
  }

  // Grow a chick up into a young hen — but ONLY if the player has allowed it
  // (stayBaby === false). Mirrors growUpFoal's honoring of the "stay a baby
  // forever" toggle: a no-op while stayBaby is on. Rebuilds the model's art from
  // chick → full chicken frames and refreshes the in-world sprite, with a small
  // sparkle for the moment.
  growUpChick(key) {
    const all = this.registry.get('allChickens') ?? {};
    const model = all[key];
    if (!model || !model.isFoal) return false;
    if (model.stayBaby) return false; // the toggle keeps it a baby — respect it

    model.isFoal = false;
    model.age = GROWN_CHICK_AGE;
    if (model.breed === 'Chick') model.breed = 'Chicken';

    // Swap the smaller chick art for the full hen art under the same key, so the
    // on-screen sprite (which shares `${key}_*` textures) becomes a grown hen in
    // place. Re-derive the coat from the chick's seeded coat index.
    const coat = CHICKEN_COATS[model.coat ?? 0] ?? CHICKEN_COATS[0];
    buildChickenTextures(this, key, coat);
    const s = this._chickenSprite(key);
    if (s) { s.play(`idle_${key}`, true); this._sparkle(s); }
    this._saveAnimal(model);
    return true;
  }

  // The info-panel "stay a baby" toggle flips the flag and persists. When turned
  // OFF (allow growing up), the chick grows up right away so the change is
  // visible; turning it back ON just parks it as a baby again (one-way growth,
  // same as the foal toggle).
  setChickStayBaby(key, stay) {
    const all = this.registry.get('allChickens') ?? {};
    const model = all[key];
    if (!model || !model.isFoal) return;
    model.stayBaby = !!stay;
    this._saveAnimal(model);
    if (!stay) this.growUpChick(key);
  }

  // The in-world sprite for a chicken/rooster/chick key (or null), for FX
  // positioning. Chicks/chickens live in `this.animals`, not `this.horses`.
  _chickenSprite(key) {
    return (this.animals ?? []).find((a) => a.key === key)?.sprite ?? null;
  }
};
