// Use-action dispatch — what the Use input (F / gamepad X / on-screen Use button)
// does with the equipped tool/carrier: act on the nearest valid target (cow care,
// brush/saddle/lead the right horse, drop food, or a world spot), plus the
// demand-based gathering it feeds. Resolution helpers (_nearestUseSpot/
// _nearestCowInReach/_cowUseAction/_nearestToolHorse) are shared with the prompt
// labeling so the prompt and the action always agree. Extracted from player.js
// as its own concern (issue #167).

import Phaser from 'phaser';
import { CONTENT_DEFS, foodDemand } from '../../data/items.js';
import { getSpecies } from '../../data/species/index.js';
import { CARE_DIST, USE_REACH } from './constants.js';
import { playGather } from '../../audio/sounds.js';

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

  // The nearest in-world animal eligible for DIRECT care (this.animals) within Use
  // reach, or null — any species that declares a feed/water action or `produces`
  // (today: the cow). Skips animals tucked away (invisible). Driven by species data,
  // so a new directly-cared-for animal needs no edit here (#167 B3).
  _nearestCareAnimal() {
    let best = null, bestD = Infinity;
    for (const a of this.animals) {
      if (!a.model || !a.sprite.visible) continue;
      const spec = getSpecies(a.model.species);
      if (!spec.actions?.feed && !spec.actions?.water && !spec.produces) continue;
      const d = Phaser.Math.Distance.Between(
        this.player.sprite.x, this.player.sprite.y, a.sprite.x, a.sprite.y);
      if (d <= USE_REACH && d < bestD) { bestD = d; best = a; }
    }
    return best;
  }

  // Resolve what Use does with `item` on a nearby directly-cared-for animal, or null.
  // Carrier- and species-data-driven: food basket → Feed (if the species has a feed
  // action), water bucket → Water, empty bucket → harvest `produces` (milk) when
  // ready. Returns { label, run } so useActiveTool dispatches it and the prompt pass
  // labels it identically. Adding a feedable/milkable animal is pure data.
  _animalUseAction(item) {
    if (!item || item.type !== 'carrier') return null;
    const animal = this._nearestCareAnimal();
    if (!animal) return null;
    const model = animal.model;
    const spec = getSpecies(model.species);
    const who = model?.name ? ` ${model.name}` : '';

    if (item.carrier === 'basket' && item.action === 'feed' && item.count > 0 && spec.actions?.feed) {
      return { label: `Feed${who}`, run: () => this._applyConsumeCare(animal, 'feed') };
    }
    if (item.carrier === 'bucket') {
      if (item.content === 'water' && item.count > 0 && spec.actions?.water) {
        return { label: `Water${who}`, run: () => this._applyConsumeCare(animal, 'water') };
      }
      // Empty bucket → harvest, but only when the animal is actually ready to give it.
      if (!item.content && spec.produces && model?.readyToProduce && !model.producedToday) {
        const verb = spec.produces.verb ?? 'Use';
        return { label: `${verb}${who}`, run: () => this._produceFromAnimal(animal) };
      }
    }
    return null;
  }

  // tools: brush/saddle/lead act on the nearest valid horse, feed drops at your
  // feet, and carriers/water/eggs/selling walk to the nearest matching spot.
  useActiveTool() {
    if (this._paused || this._sleeping || this.riding) return;
    if (this.scene.get('HotbarScene')?.invOpen) return;
    const item = this.getActiveItem();
    if (!item || item.action === 'interact') return; // empty hand: nothing to use

    const { player } = this;

    // Use never moves the player — it only acts on something already in reach.

    // Direct animal care (#cow): a food basket / water bucket / empty (harvest)
    // bucket used on a feedable/milkable animal in reach. Checked before the herd
    // tools so it always wins near her. Generic over species (#167 B3).
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

    // Feed: a carrier holding food. Acting on an in-reach world spot wins over
    // dropping at your feet — a gathering source (keep filling rather than place,
    // #133) or the farm stand (sell sellable produce, #80). Only when you're not
    // standing at any such spot does Use drop the food where you are. (Hay isn't
    // sellable and there's no hay source at the stand, so it still drops there.)
    if (item.action === 'feed') {
      const spot = this._nearestUseSpot(item);
      if (spot) spot.activate();
      else      this.placeFood(item);
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

  // Live animal counts by species id, for demand-based gathering (#136).
  _speciesCounts() {
    return {
      horse:   Object.keys(this.registry.get('allHorses')   ?? {}).length,
      chicken: Object.keys(this.registry.get('allChickens') ?? {}).length,
      cow:     Object.keys(this.registry.get('allCows')     ?? {}).length,
    };
  }

  // How many of `content` a full gather should land on. Food: one per animal that can
  // eat it (#136), capped at carrier capacity. Non-food (water): just capacity.
  _gatherTarget(content, capacity) {
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
