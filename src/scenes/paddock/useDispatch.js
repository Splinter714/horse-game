// Use-action dispatch — what the Use input (F / gamepad X / on-screen Use button)
// does with the equipped tool/carrier: act on the nearest valid target (harvest a
// milkable animal, brush/saddle/lead the right horse, drop food, or a world spot),
// plus the demand-based gathering it feeds. Resolution helpers (_nearestUseSpot/
// _nearestCareAnimal/_animalUseAction/_nearestToolHorse) are shared with the prompt
// labeling so the prompt and the action always agree. Extracted from player.js
// as its own concern (issue #167).

import Phaser from 'phaser';
import { CONTENT_DEFS, SHEARS, foodDemand } from '../../data/items.js';
import { getSpecies } from '../../data/species/index.js';
import { ROSTER_SPECIES } from '../../data/save.js';
import { CARE_DIST, USE_REACH } from './constants.js';
import { playGather, playSplash, playBrush } from '../../audio/sounds.js';

export const WithUseDispatch = (Base) => class extends Base {
  getActiveItem() {
    return this.scene.get('HotbarScene')?.getActiveItem() ?? null;
  }

  // Nearest in-reach world-spot action for the equipped item — a gathering source,
  // the trough, a nest, or the farm stand — or null if none is within reach. Shared
  // by useActiveTool (to dispatch) and checkToolProximity (to label) so the prompt
  // and the action always agree (#133).
  _nearestUseSpot(item) {
    let inst = null, instD = Infinity;
    for (const instancesOf of this.toolWorld) {
      for (const c of instancesOf(item)) {
        if (!c.canAct) continue;
        const dd = Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, c.x, c.y);
        if (dd < instD) { instD = dd; inst = c; }
      }
    }
    return inst && instD <= inst.reachDist ? inst : null;
  }

  // True if the player's facing points toward `spot` rather than away from it
  // (#204) — the same up/down/left/right → dominant-axis test worldObjects.js
  // uses to pick which side of the player food lands on. Facing "away" from a
  // gather source (e.g. backing up to lay a trail of piles next to it) means the
  // player wants to place, not refill; facing toward/along it means "keep filling"
  // (#133) still wins.
  _facingToward(spot) {
    const { sprite, facing } = this.player;
    const dx = spot.x - sprite.x, dy = spot.y - sprite.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      if (facing === 'right') return dx >= 0;
      if (facing === 'left')  return dx <= 0;
      return true; // facing up/down but spot is more horizontal — don't penalize
    } else {
      if (facing === 'down') return dy >= 0;
      if (facing === 'up')   return dy <= 0;
      return true; // facing left/right but spot is more vertical — don't penalize
    }
  }

  // The nearest in-world animal whose daily produce can be harvested (this.animals)
  // within Use reach, or null — any species that declares `produces` (today: the
  // cow's milk). Skips animals tucked away (invisible). Animals are no longer fed or
  // watered by direct carrier use — they eat dropped food and drink at the trough/
  // stream via their grazing AI — so feed/water alone no longer make a care target.
  _nearestCareAnimal() {
    let best = null, bestD = Infinity;
    for (const a of this.animals) {
      if (!a.model || !a.sprite.visible) continue;
      const spec = getSpecies(a.model.species);
      if (!spec.produces) continue;
      const d = Phaser.Math.Distance.Between(
        this.player.sprite.x, this.player.sprite.y, a.sprite.x, a.sprite.y);
      if (d <= USE_REACH && d < bestD) { bestD = d; best = a; }
    }
    return best;
  }

  // ── Scooper / droppings (#232) ──────────────────────────────────────────────

  // Nearest dropping within Use reach, or null. Shared by useActiveTool (to scoop)
  // and the prompt pass (to label "Scoop") so they always agree.
  _nearestDropping() {
    let best = null, bestD = Infinity;
    for (const d of (this.props.droppings ?? [])) {
      const dd = Phaser.Math.Distance.Between(
        this.player.sprite.x, this.player.sprite.y, d.x, d.y);
      if (dd <= USE_REACH && dd < bestD) { bestD = dd; best = d; }
    }
    return best;
  }

  // Scoop a dropping into the scooper: remove it from the world and add it to the
  // scooper's load (via the hotbar). Plays a soft scoop and floats the poop alone
  // (the `dropping` texture — the same pellets prop sitting in the world) up off the
  // player, with NO basket/scoop container around it (#318) — the pickup should read
  // as "the poop is gone," not "it landed in a basket."
  // No mood/stat effect — the dropping was cosmetic clutter (#232).
  scoopDropping(dropping) {
    const hot = this.scene.get('HotbarScene');
    const added = hot?.addScooperLoad?.(1) ?? 0;
    if (added <= 0) return; // scooper full — nothing to do
    this.removeDropping(dropping);
    playGather('compost'); // light dry scatter — a soft scoop
    this.showIcon('dropping', this.player.sprite);
  }

  // Dump the scooper's whole load into the compost bin, growing the farm's compost
  // store. Plays a wet plop and floats a compost icon over the bin. A no-op when the
  // scooper is empty (the interactable already gates on that).
  dumpCompost() {
    const hot = this.scene.get('HotbarScene');
    const dumped = hot?.dumpScooperLoad?.() ?? 0;
    if (dumped <= 0) return;
    playSplash(); // wet plop into the heap
    const bin = this.props.compostBin;
    if (bin) this.showIcon('iconBasketCompost', bin.sprite ?? bin);
  }

  // ── Shears (#254) ───────────────────────────────────────────────────────────

  // Nearest in-reach fleecy animal ready to shear, or null. "Fleecy" = a cooldown-
  // produce species (sheep/llama, `produces.mode === 'cooldown'`) that canProduce right
  // now. Registry-driven off species data, so a future woolly animal needs no edit here.
  // Shared by useActiveTool (to shear) and checkToolProximity (to label "Shear").
  _nearestShearAnimal() {
    let best = null, bestD = Infinity;
    for (const a of this.animals) {
      if (!a.model || !a.sprite.visible) continue;
      const spec = getSpecies(a.model.species);
      if (spec.produces?.mode !== 'cooldown') continue; // fleece regrows on a timer
      if (!a.model.canProduce?.()) continue;             // not grown back yet
      const d = Phaser.Math.Distance.Between(
        this.player.sprite.x, this.player.sprite.y, a.sprite.x, a.sprite.y);
      if (d <= USE_REACH && d < bestD) { bestD = d; best = a; }
    }
    return best;
  }

  // Nearest horse within Use reach, or null — the shears' secondary "trim the coat"
  // target (grooming via the brush path). Unlike the brush's dirtiest-first pick this
  // just takes the nearest horse: a trim is always available (grooms dust or bonds).
  _nearestTrimHorse() {
    let best = null, bestD = Infinity;
    for (const h of this.horses) {
      const d = Phaser.Math.Distance.Between(
        this.player.sprite.x, this.player.sprite.y, h.sprite.x, h.sprite.y);
      if (d <= USE_REACH && d < bestD) { bestD = d; best = h; }
    }
    return best;
  }

  // Shear a fleecy animal with the shears tool: run the SAME produce path as basket-
  // shearing (#233) — markProduced + shorn look + regrowth timer — but land the wool in
  // the shears' OWN load (like the scooper's compost load) instead of a basket. No-op
  // if the fleece isn't ready or the shears are full.
  shearWithTool(animal) {
    const model = animal.model;
    const prod = model && getSpecies(model.species).produces;
    if (!prod || !model.canProduce?.()) return;
    const added = this.scene.get('HotbarScene')?.addShearsLoad?.(1) ?? 0;
    if (added <= 0) return; // shears full — go dump at the stand first
    model.markProduced();
    this._saveAnimal(model);
    playBrush();                       // the shear-snip harvest sound (as #233)
    this.showIcon(prod.icon, animal.sprite);
    if (prod.mode === 'cooldown') this._refreshShornLook(animal); // shorn until regrown
  }

  // ── Trash can (#284) ────────────────────────────────────────────────────────

  // Empty the ACTIVE carrier's whole load into the trash can — a discard, not a
  // stock/sell. Generic over any carrier content (food/water/eggs/wool): whatever the
  // carrier holds is dropped to zero in one Use. The interactable already gates on the
  // carrier being non-empty, so this is a no-op otherwise. Flips the lid off for a beat
  // (reusing the raccoon's open/tidy sprite states), plays a soft scatter, and floats
  // the discarded content's icon over the bin as feedback.
  emptyIntoTrash() {
    const item = this.getActiveItem();
    if (!item || item.type !== 'carrier' || item.count <= 0) return;
    const hot = this.scene.get('HotbarScene');
    const dumped = hot?.emptyActiveCarrier?.() ?? 0;
    if (dumped <= 0) return;
    playGather('compost'); // soft dry scatter — tossing the load into the bin
    const can = this.props.trashCan;
    if (can?.sprite?.active) {
      can.sprite.setTexture('trashCanOpen');
      this.showIcon(CONTENT_DEFS[item.content].icon, can.sprite);
      this.time.delayedCall(450, () => {
        if (!can.open && can.sprite?.active) can.sprite.setTexture('trashCan');
      });
    }
  }

  // Resolve what Use does with `item` on a nearby harvestable animal, or null. Only
  // produce harvesting is a direct interaction now: the right EMPTY carrier on a
  // producing animal → harvest `produces` when ready (the cow's milk into a bucket).
  // The carrier kind comes from `produces.carrier` (default 'bucket'), and readiness
  // from the generic model gate (daily or regrowth-timer, #233). Feeding and watering
  // are no longer direct — animals graze dropped food and drink at the trough/stream
  // via their AI. Returns { label, run } so useActiveTool dispatches it and the prompt
  // pass labels it identically. Adding a producing animal is pure data.
  //
  // `produces.requiresTool` (playtest 2026-07-24, #233) opts a species OUT of this
  // bare-carrier path entirely — the sheep/llama's wool declares `requiresTool: 'shear'`
  // so a basket alone can no longer harvest it; only the matching tool's own Use path
  // (shearWithTool, dispatched from item.action === 'shear' in useActiveTool) can.
  _animalUseAction(item) {
    if (!item || item.type !== 'carrier') return null;
    const animal = this._nearestCareAnimal();
    if (!animal) return null;
    const model = animal.model;
    const spec = getSpecies(model.species);
    if (spec.produces?.requiresTool) return null; // needs a dedicated tool, not a bare carrier
    const who = model?.name ? ` ${model.name}` : '';

    // Empty carrier of the right kind → harvest, but only when the animal is ready.
    const wantCarrier = spec.produces?.carrier ?? 'bucket';
    if (item.carrier === wantCarrier && !item.content &&
        spec.produces && model?.canProduce?.()) {
      const verb = spec.produces.verb ?? 'Use';
      return { label: `${verb}${who}`, run: () => this._produceFromAnimal(animal) };
    }
    return null;
  }

  // tools: brush/saddle/lead act on the nearest valid horse, feed drops at your
  // feet, and carriers/water/eggs/selling walk to the nearest matching spot.
  useActiveTool() {
    if (this._paused || this._sleeping || this.riding || this.driving) return;
    if (this.scene.get('HotbarScene')?.invOpen) return;

    const item = this.getActiveItem();
    if (!item || item.action === 'interact') return; // empty hand: nothing to use

    const { player } = this;

    // Use never moves the player — it only acts on something already in reach.

    // Harvest produce (#cow): an empty bucket used on a milkable animal in reach.
    // Checked before the herd tools so it always wins near her. Feeding and watering
    // are no longer direct — animals eat dropped food and drink via their AI.
    const careAct = this._animalUseAction(item);
    if (careAct) { careAct.run(); return; }

    // Animal-targeted tools: act on the nearest valid horse if it's in reach.
    if (item.action === 'brush' || item.action === 'saddle' || item.action === 'lead') {
      const target = this._nearestToolHorse(item);
      if (!target) return;
      const d = Phaser.Math.Distance.Between(
        player.sprite.x, player.sprite.y, target.sprite.x, target.sprite.y);
      if (d > USE_REACH) return;
      if (item.action === 'saddle')    this.toggleSaddle(target);
      else if (item.action === 'lead') this.toggleLead(target);
      else                             this.useItemOnHorse(item, target);
      return;
    }

    // Shears (#254): a MULTI-USE cut/clip tool. Priority in reach:
    //   1. SHEAR the nearest fleecy animal (sheep/llama) that's ready → wool into the
    //      shears' own load (same produce path as basket-shearing #233). Only while
    //      that load is still wool — shears holding spun yarn (#358) take no more.
    //   2. else, while carrying a load, a world spot for it — spin at the wheel or
    //      dump at the farm stand (#358). Ahead of the trim so a horse grazing past
    //      the station can't swallow the Use you walked there to make.
    //   3. else TRIM the nearest horse's coat → the brush grooming path (a tidy clip).
    if (item.action === 'shear') {
      const load = item.load ?? 0;
      const shearable = load === 0 || item.content === SHEARS.content;
      const fleecy = shearable ? this._nearestShearAnimal() : null;
      if (fleecy && load < (item.capacity ?? Infinity)) {
        this.shearWithTool(fleecy);
        return;
      }
      if (load > 0) {
        const spot = this._nearestUseSpot(item); // spinning wheel / farm stand
        if (spot) { spot.activate(); return; }
      }
      const horse = this._nearestTrimHorse();
      if (horse) { this.useItemOnHorse(item, horse); return; }
      this._nearestUseSpot(item)?.activate();
      return;
    }

    // Scooper (#232): scoop up the nearest dropping in reach into the scooper's
    // load. If none is in reach (or the scooper is full), fall through to the world
    // spots so the compost bin (dump) can win when you're standing at it.
    if (item.action === 'scoop') {
      const dropping = this._nearestDropping();
      if (dropping && (item.load ?? 0) < (item.capacity ?? Infinity)) {
        this.scoopDropping(dropping);
        return;
      }
      this._nearestUseSpot(item)?.activate(); // dump at the compost bin, if there
      return;
    }

    // Bowl-stock food (#202 rework): cat food is never dropped on the ground — it
    // only goes into the cat's FOOD BOWL, which the cat eats from directly. Use fills
    // the bowl when in reach; otherwise it does nothing (no drop-on-ground fallback).
    if (CONTENT_DEFS[item.content]?.stocks) {
      this._nearestUseSpot(item)?.activate();
      return;
    }

    // Feed: a carrier holding food. An in-reach world spot only wins over dropping at
    // your feet when the player is actually facing it — that's "stand at a source and
    // keep filling" (#133) or stocking the farm stand (#80). Facing away from the
    // spot (e.g. backing away to lay a trail of piles right next to a gather
    // source, #204) drops food on the ground instead of re-filling. (Hay isn't
    // sellable and there's no hay source at the stand, so it still drops there.)
    if (item.action === 'feed' || CONTENT_DEFS[item.content]?.ground) {
      const spot = this._nearestUseSpot(item);
      if (spot && this._facingToward(spot)) spot.activate();
      else                                  this.placeFood(item);
      return;
    }

    // Everything else (fill trough, gather, collect egg, sell) is a world spot —
    // activate the nearest valid one only if we're already within its reach.
    this._nearestUseSpot(item)?.activate();
  }

  // Pick the horse a tool should act on. Saddle/lead target the nearest horse
  // within care distance (toggle actions, no "needs it" cap). The brush targets
  // the dirtiest horse *that needs brushing* within reach (lowest grooming,
  // tie-broken by distance, #96) — and returns null when every in-reach horse is
  // already clean, so brushing isn't offered or fired on a maxed coat (#98).
  _nearestToolHorse(item) {
    const allHorses = this.registry.get('allHorses');
    const dist = (h) => Phaser.Math.Distance.Between(
      this.player.sprite.x, this.player.sprite.y, h.sprite.x, h.sprite.y);

    if (item.action === 'brush') {
      const grooming = (h) => allHorses[h.key]?.stats.grooming ?? 100;
      const inReach = this.horses.filter(h => dist(h) <= USE_REACH);
      if (!inReach.length) return null; // no horse in reach to brush
      // Prefer a horse that still needs brushing (#96); but if every in-reach
      // horse is already clean, brush the nearest one anyway — brushing is always
      // available as a bonding activity (#116, revises the #98 maxed-out disable).
      const dirty = inReach.filter(h => grooming(h) < 99.5);
      const pool = dirty.length ? dirty : inReach;
      return pool.sort((a, b) => (grooming(a) - grooming(b)) || (dist(a) - dist(b)))[0];
    }

    let best = null, bestD = Infinity;
    for (const h of this.horses) {
      const d = dist(h);
      if (d < CARE_DIST && d < bestD) { bestD = d; best = h; }
    }
    return best;
  }

  // Live animal counts by species id, for demand-based gathering (#136). Driven by
  // the roster registry so a newly-spawned species (sheep #184) is counted with no
  // edit here — foodDemand only sums the species listed in a food's `feeds` anyway.
  _speciesCounts() {
    const out = {};
    for (const { id, registryKey } of ROSTER_SPECIES) {
      out[id] = Object.keys(this.registry.get(registryKey) ?? {}).length;
    }
    return out;
  }

  // How many of `content` a full gather should land on. Food: one per animal that can
  // eat it (#136), capped at carrier capacity. Non-food (water): just capacity.
  // `gatherAmount` (#401) opts a content OUT of the demand maths entirely — fox/duck/
  // bunny food are eaten by wild/tamed critters outside ROSTER_SPECIES, so
  // foodDemand/_speciesCounts always reads 0 for them and would otherwise fall
  // through to "no demand info → fill to capacity". Those three always gather a
  // flat, fixed amount instead (checked before the demand fallback).
  _gatherTarget(content, capacity) {
    const fixed = CONTENT_DEFS[content]?.gatherAmount;
    if (fixed != null) return Math.min(fixed, capacity);
    const demand = foodDemand(content, this._speciesCounts());
    return demand > 0 ? Math.min(demand, capacity) : capacity;
  }

  // Gather from a source in one Use (sources are infinite). Food tops the carrier up
  // to one unit per animal that eats it (#136); water just fills to capacity. Owner
  // preferred a single fill-up over the one-at-a-time loop (#78, reverting #122).
  // Refuses if the carrier already holds a different content.
  gatherFrom(source) {
    const hot = this.scene.get('HotbarScene');
    const item = this.getActiveItem();
    if (!item || item.type !== 'carrier') return;
    const target = this._gatherTarget(source.content, item.capacity);
    const have   = item.content === source.content ? item.count : 0;
    const want   = Math.max(0, target - have);
    const added  = want > 0 ? (hot?.fillActiveCarrier(source.content, want) ?? 0) : 0;
    if (added <= 0) return;
    playGather(source.content); // distinct per-source pickup sound (water → splash)
    this.showIcon(CONTENT_DEFS[source.content].icon, this.player.sprite);
  }
};
