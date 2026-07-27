// Behavior dispatcher — the generic, data-driven AI tick. Each species declares an
// ordered `behaviors` list (src/data/species/<x>/index.js); the modules themselves
// ({ id, test, run }) live in that species' behaviors.js. This mixin walks the list
// in priority order and lets the first behavior that fires *and* successfully claims
// the agent win — exactly the semantics of the old hand-written if-ladders, just
// driven by data so a new animal composes a list instead of needing new tick code.
//
// The decision is split: `test(ctx)` is pure (unit-tested in the species'
// behaviors.test.js), `run(scene, agent)` reuses the existing movement primitives
// (horseGoEat/horseGoDrink/_horseBeg, chickenGoEat/chickenFollow/chickenGatherAt) —
// those are untouched, so the living-paddock feel is unchanged. `_behaviorContext`
// gathers the same quantities the old ladders computed inline into one plain object.

import Phaser from 'phaser';
import { getSpecies, BEHAVIORS } from '../../data/species/index.js';
import { speciesEatsContent } from '../../data/items.js';
import { WEATHER } from '../../data/weather.js';
import { BEG, CHICKEN_HUNGRY_FOLLOW_DIST, CHARM, HERD } from './constants.js';

export const WithBehaviors = (Base) => class extends Base {
  // Walk the agent's species behavior list; return true if a behavior claimed it
  // (so the caller skips wandering), false if none did.
  runBehaviors(agent) {
    // _speciesOf (world.js) maps a creature key to its species id: 'horse2' →
    // 'horse', 'chicken0' → 'chicken'.
    const species = this._speciesOf(agent.key);
    const ctx = species === 'chicken' ? this._chickenContext(agent)
      // The rooster reuses the chicken flock behaviors (same flock context) plus its
      // own dawn crow, gated by `crowing` — armed on the Morning phase (#269).
      : species === 'rooster' ? { ...this._chickenContext(agent), crowing: !!agent._crowing }
      : species === 'cat' ? this._catContext(agent)
      : species === 'dog' ? this._dogContext(agent)
      : species === 'bunny' ? this._bunnyContext(agent)
      : species === 'duck' ? this._duckContext(agent)
      : this._horseContext(agent);
    const spec = getSpecies(species);
    const registry = BEHAVIORS[species] ?? {};
    for (const id of spec.behaviors ?? []) {
      const b = registry[id];
      // test() gates; run() does the work and may still bail (e.g. pile taken),
      // in which case we fall through to the next behavior — never strand idle.
      if (b && b.test(ctx) && b.run(this, agent)) return true;
    }
    return false;
  }

  // ─── Context snapshots (pure data the behavior `test`s read) ───────────────

  // Shared by every grazer (horse + cow): the dispatcher routes any non-chicken
  // agent here. Reads the agent's model generically via _modelFor, so it works for
  // a horse (allHorses registry) or a cow (its attached model) alike.
  _horseContext(h) {
    const horse = this._modelFor(h);
    if (!horse) {
      return { hunger: 100, thirst: 100, nearestHayDist: Infinity, troughDist: Infinity, streamDist: Infinity, hasPlayer: false };
    }
    const pile = this._nearestReachableHay(h);
    const nearestHayDist = pile
      ? Phaser.Math.Distance.Between(h.sprite.x, h.sprite.y, pile.x, pile.y)
      : Infinity;

    const t = this.props.trough;
    const troughDist = (t?.filled && this._inPasture(t.x, t.y))
      ? Phaser.Math.Distance.Between(h.sprite.x, h.sprite.y, t.x, t.y)
      : Infinity;

    const water = this._nearestReachableWater(h);
    const streamDist = water
      ? Phaser.Math.Distance.Between(h.sprite.x, h.sprite.y, water.x, water.y)
      : Infinity;

    const hasPlayer = !!this.player;
    const playerDist = hasPlayer
      ? Phaser.Math.Distance.Between(h.sprite.x, h.sprite.y, this.player.sprite.x, this.player.sprite.y)
      : Infinity;

    // Cosmetic herd bond (#31): distance to this horse's favoured companion (its
    // bondKey buddy), Infinity when it has none / the buddy's gone. The seekBuddy
    // behavior uses it to amble back over once they've drifted apart.
    const buddy = this._bondedBuddy(h);
    const buddyDist = buddy
      ? Phaser.Math.Distance.Between(h.sprite.x, h.sprite.y, buddy.sprite.x, buddy.sprite.y)
      : Infinity;

    return {
      hunger: horse.stats.hunger,
      thirst: horse.stats.thirst,
      happiness: horse.stats.happiness,
      temperament: horse.temperament,
      nearestHayDist,
      troughDist,
      streamDist,
      hasPlayer,
      gateOpen: this._gateOpen(),
      playerDist,
      now: this.time.now,
      lastSeek: h._lastSeek ?? null,
      // Begging tuning is shared with the begging primitive, so it rides in via ctx.
      begHunger: BEG.HUNGER,
      begNoticeDist: BEG.NOTICE_DIST,
      begThrottleMs: BEG.THROTTLE_MS,
      // Pig wallow (#197): purely cosmetic, so it just needs daytime + a per-pig
      // cooldown — shared via ctx like the begging tuning above.
      isNight: !!this.isNight,
      lastWallow: h._lastWallow ?? null,
      wallowChance: CHARM.WALLOW_CHANCE,
      wallowCooldown: CHARM.WALLOW_COOLDOWN,
      // Herd bond (#31) tuning + state, shared with the seekBuddy behavior.
      buddyDist,
      bondHappy: HERD.HAPPY_AT,
      bondLingerGap: HERD.BOND_LINGER_GAP,
      bondChance: HERD.BOND_CHANCE,
      bondCooldown: HERD.BOND_COOLDOWN,
      lastBond: h._lastBond ?? null,
      // Covered shelter (#319) — the seekShelter behavior just needs to know it's
      // raining; the weather-change hook (weather.js) is what parks/releases the
      // horse, so no distance/state field is needed here.
      weather: this._weather ?? WEATHER.SUN,
    };
  }

  _chickenContext(a) {
    const gateOpen = this._gateOpen();
    const item = this.getActiveItem();
    const grainBin = this._grainBin();
    const playerDist = this.player
      ? Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, this.player.sprite.x, this.player.sprite.y)
      : Infinity;
    // A passing dog spooks the flock (#187) — distance to the nearest dog so the
    // fleeDog behavior (highest priority) can bolt the chicken a short way off.
    const dog = this._nearestDog(a);
    const dogDist = dog
      ? Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, dog.sprite.x, dog.sprite.y)
      : Infinity;
    return {
      nearestSeed: this._nearestReachableSeed(a, gateOpen),
      dogDist,
      scatterDist: CHARM.SCATTER_DIST,
      luring: !!this.player && item?.carrier === 'basket' && item.content === 'seed' && item.count > 0,
      // Hungry until actually fed today — NOT until the morning phase ends (#129).
      // An unfed flock keeps anticipating breakfast at the bin all day rather than
      // drifting back to wandering on a clock. Reset at dawn (dayNight.js).
      anticipating: !this._chickensFedToday && !!grainBin,
      // A hungry chicken trails a nearby player even with no seeds out yet (#128).
      playerDist,
      hungryFollowDist: CHICKEN_HUNGRY_FOLLOW_DIST,
      gateOpen,
    };
  }

  // Context for the dog's behaviors (#187/#231/#347). #347 added the survival half:
  // its hunger/thirst plus the distance to its own combined FOOD/WATER BOWL — but only
  // when that side is actually STOCKED (level > 0); an empty side reads as Infinity
  // (_catBowlDist), so a hungry dog with nothing in the dish just carries on herding /
  // wandering rather than pacing an empty bowl. Same shape as _catContext/_bunnyContext.
  //
  // The charm half is unchanged: dogHerdSheep needs how close
  // the nearest sheep is (Infinity when none are within herding range) plus a per-dog
  // cooldown; swimStream (species-generic, ./swim.js) needs the distance to the
  // nearest reachable stream point plus its own cooldown+chance. The dog roams the
  // whole world (`spawn.roam: 'world'`), so _nearestReachableWater's pasture-gate
  // check is a no-op for it — same lookup the horses' seekStream uses.
  _dogContext(a) {
    const flock = this._sheepNear(a, CHARM.HERD_RANGE);
    let nearestSheepDist = Infinity;
    for (const s of flock) {
      nearestSheepDist = Math.min(
        nearestSheepDist,
        Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, s.sprite.x, s.sprite.y));
    }
    const water = this._nearestReachableWater(a);
    const streamDist = water
      ? Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, water.x, water.y)
      : Infinity;
    const dog = a.model;
    return {
      isNight: !!this.isNight,
      // Survival (#347) — read by seekDogFood/seekDogWater.
      hunger: dog?.stats?.hunger ?? 100,
      thirst: dog?.stats?.thirst ?? 100,
      nearestFoodDist:  this._catBowlDist(a, this.props.dogBowl, 'food'),
      nearestWaterDist: this._catBowlDist(a, this.props.dogBowl, 'water'),
      nearestSheepDist,
      now: this.time.now,
      lastHerd: a._lastHerd ?? null,
      herdCooldown: CHARM.HERD_COOLDOWN,
      // Stream swim (#231, generic — any `swims` capability species).
      streamDist,
      lastSwim: a._lastSwim ?? null,
      swimChance: CHARM.SWIM_CHANCE,
      swimCooldown: CHARM.SWIM_COOLDOWN,
    };
  }

  // Context for the bunny's seek behaviors (#224, reworked #283). Mirrors the cat's
  // _catContext exactly: its hunger/thirst plus the distance to the bunny's FOOD/WATER
  // BOWL — but only when that bowl is actually STOCKED (level > 0); an empty bowl reads
  // as Infinity (_catBowlDist), so a hungry/thirsty bunny with no food in the dish just
  // hop-wanders rather than pacing an empty bowl. The bunny eats DIRECTLY from the bowls
  // now (petEatFromBowl), no more dropped ground piles.
  _bunnyContext(a) {
    const bunny = a.model;
    return {
      hunger: bunny?.stats?.hunger ?? 100,
      thirst: bunny?.stats?.thirst ?? 100,
      nearestFoodDist:  this._catBowlDist(a, this.props.bunnyBowl, 'food'),
      nearestWaterDist: this._catBowlDist(a, this.props.bunnyBowl, 'water'),
      isNight: !!this.isNight,
    };
  }

  // Context for the tamed duck's behaviors (#275). Mirrors the fox's shape (it eats
  // dropped DUCK-FOOD piles at `_nearestReachableHay`, diet-gated by items.js) — hunger/
  // thirst plus the distance to the nearest reachable dropped pile / filled trough —
  // PLUS the stream-swim fields the generic swimStream module (../../data/species/
  // swim.js) needs, since the duck also declares the `swims` capability. Same
  // streamDist/lastSwim/swimChance/swimCooldown shape as `_dogContext`.
  _duckContext(a) {
    const duck = a.model;
    const pile = this._nearestReachableHay(a);
    const nearestHayDist = pile
      ? Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, pile.x, pile.y)
      : Infinity;

    const t = this.props.trough;
    const troughDist = (t?.filled && this._inPasture(t.x, t.y))
      ? Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, t.x, t.y)
      : Infinity;

    const water = this._nearestReachableWater(a);
    const streamDist = water
      ? Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, water.x, water.y)
      : Infinity;

    return {
      hunger: duck?.stats?.hunger ?? 100,
      thirst: duck?.stats?.thirst ?? 100,
      nearestHayDist,
      troughDist,
      isNight: !!this.isNight,
      now: this.time.now,
      // Stream swim (#231, generic — any `swims` capability species).
      streamDist,
      lastSwim: a._lastSwim ?? null,
      swimChance: CHARM.SWIM_CHANCE,
      swimCooldown: CHARM.SWIM_COOLDOWN,
    };
  }

  // ─── Small shared lookups used by both contexts and behavior `run`s ────────

  _gateOpen() { return !!this.props.gate?.open; }

  _grainBin() { return this.props.sources?.find(s => s.content === 'seed'); }

  // Nearest hay pile this creature can actually reach, or null. Mirrors the old
  // horseTickForHorse scan. Pasture-roaming grazers (horses/cow/pig/sheep) are
  // fence-gated: a pile outside the pasture needs the gate open. A creature that
  // roams the whole world instead (`spawn.roam !== 'pasture'`) isn't fenced in at all,
  // so the gate check doesn't apply to it: any dropped pile it can eat is reachable
  // regardless of the pasture gate.
  //
  // `contentFilter`, if given, further restricts which pile contents count — a species
  // with more than one distinct diet dropped into the same pile list can pass a filter
  // to find "the nearest pile of *my* content" rather than just any edible pile.
  // Defaults to accepting anything the species eats (the original behavior). (The cat
  // no longer uses this — it eats straight from its bowls, #202 rework — but the
  // mechanism stays generic for any future multi-diet grazer.)
  _nearestReachableHay(h, contentFilter = null) {
    if (!this.props.hayPiles?.length) return null;
    const gateOpen = this._gateOpen();
    // Respect the grazer's diet: a pig walks past hay it won't eat but still goes
    // for apples/carrots (#…). Piles carry their `content`; the horse/cow eat all
    // three, so this is a no-op for them. (A content-less pile is treated as edible
    // for safety, though placeFood always tags one now.)
    const species = this._modelFor(h)?.species ?? 'horse';
    // The horse itself declares no `spawn` block (it's spawned via buildHorses, not
    // the generic species-spawn path) — so "not explicitly roam:'world'" is the
    // pasture-bound default, keeping horses/cow/pig/sheep gated exactly as before.
    const pastureBound = getSpecies(species).spawn?.roam !== 'world';
    let closest = null, closestDist = Infinity;
    for (const pile of this.props.hayPiles) {
      if (pastureBound && !this._inPasture(pile.x, pile.y) && !gateOpen) continue;
      if (pile.content && !speciesEatsContent(species, pile.content)) continue;
      if (contentFilter && pile.content !== contentFilter) continue;
      const d = Phaser.Math.Distance.Between(h.sprite.x, h.sprite.y, pile.x, pile.y);
      if (d < closestDist) { closestDist = d; closest = pile; }
    }
    return closest;
  }

  // Nearest stream bank point this horse can actually reach — the stream is the
  // only natural water horses drink from (the well is for buckets, not muzzles),
  // and it's outside the fence so it needs the gate open (#99). Stream sources
  // are the water sources that carry a `bank` drink-anchor. Mirrors
  // _nearestReachableHay; the trough is handled separately (props.trough).
  _nearestReachableWater(h) {
    const srcs = this.props.sources?.filter(s => s.content === 'water' && s.bank);
    if (!srcs?.length) return null;
    const gateOpen = this._gateOpen();
    let closest = null, closestDist = Infinity;
    for (const s of srcs) {
      if (!this._inPasture(s.x, s.y) && !gateOpen) continue;
      const d = Phaser.Math.Distance.Between(h.sprite.x, h.sprite.y, s.x, s.y);
      if (d < closestDist) { closestDist = d; closest = s; }
    }
    return closest;
  }
};
